/**
 * AudioManager.js — Son spatialisé de l'application (Web Audio API).
 *
 * Aucun fichier audio : tous les sons sont synthétisés par code (pas de licence, pas de téléchargement).
 *   - battements du cœur « lub-dub » (au rythme de heartRate, placés dans l'espace) ;
 *   - respiration (au rythme de breathRate) ;
 *   - ambiance de chaque organe (cœur, poumons, cerveau) ;
 *   - effets : sélection, réussite, erreur, niveau débloqué, impulsion nerveuse.
 *
 * Le navigateur interdit de lancer un son avant un geste de l'utilisateur : le contexte audio est donc
 * créé au premier clic / touche (bouton « Entrer en VR » ou « Mode bureau »).
 *
 * Usage minimal (dans main.js) :
 *   import { AudioManager } from './core/AudioManager.js';
 *   const audio = new AudioManager();
 *   audio.attach(engine);               // écoute le bus d'événements et suit la caméra
 *
 * Réactions automatiques (EventBus) :
 *   levelStarted → ambiance de l'organe · missionSuccess / missionError / levelUnlocked → effets ·
 *   objectSelected → petit clic.
 * Touche M : coupe / rétablit le son.
 */
import * as THREE from 'three/webgpu';
import { eventBus as defaultBus, EVENTS } from '../systems/EventBus.js';
import { heartRate } from '../shaders/tissuePulse.js';
import { breathRate } from '../shaders/breathing.js';

const LOOKAHEAD = 0.25;                       // on programme les sons 250 ms à l'avance (précision de la Web Audio API)
const STORAGE_KEY = 'ihvr-muted';

export class AudioManager {
  /**
   * @param {{ eventBus?: import('../systems/EventBus.js').EventBus, volume?: number }} opts
   */
  constructor({ eventBus = defaultBus, volume = 0.8 } = {}) {
    this.eventBus = eventBus;
    this.volume = volume;
    this.ctx = null;
    this.muted = readMuted();
    this.organ = null;
    /** Position (monde) d'où l'on entend le cœur. @type {THREE.Vector3} */
    this.heartPosition = new THREE.Vector3(0, 1.4, -3);
    /** Position (monde) d'où l'on entend la respiration. @type {THREE.Vector3} */
    this.breathPosition = new THREE.Vector3(0, 1.5, -3);

    this._camera = null;
    this._offs = [];
    this._ambience = null;
    this._nextBeat = 0;
    this._nextBreath = 0;
    this._noise = null;
    this._tmpPos = new THREE.Vector3();
    this._tmpQuat = new THREE.Quaternion();
    this._fwd = new THREE.Vector3();
    this._up = new THREE.Vector3();
    this._beatsOn = false;
    this._breathOn = false;
  }

  // ---------- Mise en route ----------

  /**
   * Relie le gestionnaire au moteur : suit la caméra, écoute les événements, se débloque au premier geste.
   * @param {{ camera: THREE.Camera, onUpdate: (cb:(dt:number)=>void)=>(()=>void) }} engine
   */
  attach(engine) {
    this._camera = engine.camera;
    this._offs.push(engine.onUpdate((dt) => this.update(dt)));
    this.bindEvents();
    const unlock = () => { this.unlock(); };
    for (const type of ['pointerdown', 'keydown', 'touchstart']) {
      window.addEventListener(type, unlock, { once: false, passive: true });
      this._offs.push(() => window.removeEventListener(type, unlock));
    }
    const key = (e) => { if (e.key === 'm' || e.key === 'M') this.toggleMute(); };
    window.addEventListener('keydown', key);
    this._offs.push(() => window.removeEventListener('keydown', key));
    return this;
  }

  /** Crée (ou réveille) le contexte audio. À appeler depuis un geste de l'utilisateur. */
  unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return false;
      this.ctx = new Ctx();
      const c = this.ctx;
      this.master = c.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(c.destination);
      this.ambientBus = c.createGain(); this.ambientBus.gain.value = 0.5; this.ambientBus.connect(this.master);
      this.sfxBus = c.createGain(); this.sfxBus.gain.value = 0.8; this.sfxBus.connect(this.master);
      this._noise = makeNoise(c);
      this.heartPanner = makePanner(c); this.heartPanner.connect(this.master);
      this.breathPanner = makePanner(c); this.breathPanner.connect(this.master);
      this._nextBeat = c.currentTime + 0.2;
      this._nextBreath = c.currentTime + 0.2;
      if (this.organ) this.setOrgan(this.organ);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return true;
  }

  bindEvents() {
    const bus = this.eventBus;
    this._offs.push(
      bus.on(EVENTS.LEVEL_STARTED, ({ levelId }) => this.setOrgan(levelId)),
      bus.on(EVENTS.MISSION_SUCCESS, () => this.playSuccess()),
      bus.on(EVENTS.MISSION_ERROR, () => this.playError()),
      bus.on(EVENTS.LEVEL_UNLOCKED, () => this.playUnlock()),
      bus.on(EVENTS.OBJECT_SELECTED, () => this.playSelect()),
    );
  }

  // ---------- Volume ----------

  setVolume(v) {
    this.volume = Math.min(1, Math.max(0, v));
    if (this.master && !this.muted) this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
  }

  setMuted(muted) {
    this.muted = muted;
    try { localStorage.setItem(STORAGE_KEY, muted ? '1' : '0'); } catch { /* stockage indisponible : sans importance */ }
    if (this.master) this.master.gain.setTargetAtTime(muted ? 0 : this.volume, this.ctx.currentTime, 0.05);
  }

  toggleMute() { this.setMuted(!this.muted); return this.muted; }

  // ---------- Ambiance par organe ----------

  /**
   * Change l'ambiance. `levelId` : 'heart' | 'lungs' | 'brain' | 'home' | null.
   * Cœur : battements · poumons : respiration · cerveau : scintillements électriques.
   */
  setOrgan(levelId) {
    this.organ = levelId;
    if (!this.ctx) return;                                             // sera appliqué au déblocage
    this._ambience?.stop();
    this._ambience = null;
    this._beatsOn = levelId === 'heart';
    this._breathOn = levelId === 'lungs';
    const drone = { heart: 49, lungs: 58, brain: 82, home: 55 }[levelId];
    if (drone) this._ambience = makeAmbience(this.ctx, this.ambientBus, this._noise, levelId, drone);
  }

  /** Active ou coupe séparément les battements et la respiration (pour des démonstrations). */
  setLayers({ heart = this._beatsOn, breath = this._breathOn } = {}) {
    this._beatsOn = heart;
    this._breathOn = breath;
  }

  // ---------- Boucle ----------

  /** À appeler à chaque image (fait par attach()). */
  update() {
    const c = this.ctx;
    if (!c || c.state !== 'running') return;
    this._updateListener();
    if (this._beatsOn) {
      this._place(this.heartPanner, this.heartPosition);
      const period = 60 / heartRate.value;
      if (this._nextBeat < c.currentTime) this._nextBeat = c.currentTime + 0.05;
      while (this._nextBeat < c.currentTime + LOOKAHEAD) { this._heartbeat(this._nextBeat); this._nextBeat += period; }
    }
    if (this._breathOn) {
      this._place(this.breathPanner, this.breathPosition);
      const period = 60 / breathRate.value;
      if (this._nextBreath < c.currentTime) this._nextBreath = c.currentTime + 0.05;
      while (this._nextBreath < c.currentTime + LOOKAHEAD) { this._breathCycle(this._nextBreath, period); this._nextBreath += period; }
    }
  }

  _updateListener() {
    if (!this._camera) return;
    const L = this.ctx.listener;
    this._camera.updateWorldMatrix(true, false);
    this._camera.matrixWorld.decompose(this._tmpPos, this._tmpQuat, new THREE.Vector3());
    this._fwd.set(0, 0, -1).applyQuaternion(this._tmpQuat);
    this._up.set(0, 1, 0).applyQuaternion(this._tmpQuat);
    if (L.positionX) {
      const t = this.ctx.currentTime;
      L.positionX.setValueAtTime(this._tmpPos.x, t); L.positionY.setValueAtTime(this._tmpPos.y, t); L.positionZ.setValueAtTime(this._tmpPos.z, t);
      L.forwardX.setValueAtTime(this._fwd.x, t); L.forwardY.setValueAtTime(this._fwd.y, t); L.forwardZ.setValueAtTime(this._fwd.z, t);
      L.upX.setValueAtTime(this._up.x, t); L.upY.setValueAtTime(this._up.y, t); L.upZ.setValueAtTime(this._up.z, t);
    } else {
      L.setPosition(this._tmpPos.x, this._tmpPos.y, this._tmpPos.z);
      L.setOrientation(this._fwd.x, this._fwd.y, this._fwd.z, this._up.x, this._up.y, this._up.z);
    }
  }

  _place(panner, p) {
    if (panner.positionX) { panner.positionX.value = p.x; panner.positionY.value = p.y; panner.positionZ.value = p.z; }
    else panner.setPosition(p.x, p.y, p.z);
  }

  // ---------- Sons du corps ----------

  /** « Lub-dub » : deux battements graves, le second plus court et plus faible. */
  _heartbeat(t) {
    const c = this.ctx;
    this._thump(t, 62, 0.95, 0.16, this.heartPanner);              // lub
    this._thump(t + 0.30, 76, 0.6, 0.12, this.heartPanner);        // dub
    void c;
  }

  _thump(t, freq, gain, dur, dest) {
    const c = this.ctx;
    const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq * 1.9, t);
    o.frequency.exponentialRampToValueAtTime(freq * 0.55, t + dur);
    f.type = 'lowpass'; f.frequency.value = 220;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g).connect(dest);
    o.start(t); o.stop(t + dur + 0.05);
  }

  /** Un cycle respiratoire : souffle d'inspiration (40 %) puis d'expiration (60 %). */
  _breathCycle(t, period) {
    const c = this.ctx, inh = period * 0.4, exh = period * 0.6;
    this._puff(t, inh, 700, 1500, 0.32);                           // le souffle monte vers l'aigu en inspirant
    this._puff(t + inh, exh, 1100, 500, 0.24);                     // et redescend en expirant
    void c;
  }

  _puff(t, dur, f0, f1, gain) {
    const c = this.ctx;
    const src = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain();
    src.buffer = this._noise; src.loop = true;
    bp.type = 'bandpass'; bp.Q.value = 0.9;
    bp.frequency.setValueAtTime(f0, t);
    bp.frequency.linearRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + dur * 0.45);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    src.connect(bp).connect(g).connect(this.breathPanner);
    src.start(t, Math.random() * 0.8); src.stop(t + dur + 0.05);
  }

  // ---------- Effets ----------

  /** Petit clic de sélection. */
  playSelect() { this._tone(this.ctx?.currentTime, 660, 0.06, 'triangle', 0.18); }

  /** Réussite : arpège montant. */
  playSuccess() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.02;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this._tone(t + i * 0.1, f, 0.34, 'triangle', 0.3));
  }

  /** Erreur : deux notes graves descendantes. */
  playError() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.02;
    this._tone(t, 196, 0.2, 'square', 0.16, 600);
    this._tone(t + 0.16, 147, 0.3, 'square', 0.16, 600);
  }

  /** Niveau débloqué : deux carillons. */
  playUnlock() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.02;
    this._tone(t, 880, 0.5, 'sine', 0.26); this._tone(t + 0.14, 1318.5, 0.7, 'sine', 0.22);
  }

  /** Impulsion nerveuse : bip de plus en plus aigu à chaque neurone traversé (step = 0, 1, 2…). */
  playNeuron(step = 0) { this._tone(this.ctx?.currentTime, 520 * 1.26 ** step, 0.22, 'sine', 0.24); }

  _tone(t, freq, dur, type = 'sine', gain = 0.2, lowpass = 0) {
    const c = this.ctx;
    if (!c || t === undefined) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (lowpass) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lowpass; node = o.connect(f); }
    node.connect(g).connect(this.sfxBus);
    o.start(t); o.stop(t + dur + 0.05);
  }

  // ---------- Fin ----------

  dispose() {
    this._ambience?.stop();
    this._offs.forEach((off) => off());
    this._offs = [];
    this.ctx?.close();
    this.ctx = null;
  }
}

// ---------- Utilitaires ----------

function readMuted() {
  try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
}

/** Bruit blanc de 2 s, réutilisé par la respiration et les ambiances. */
function makeNoise(ctx) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = (w * 0.6 + last * 8) * 0.5; }   // bruit « rosé »
  return buf;
}

/** Source spatialisée (HRTF : l'oreille perçoit la direction en casque). */

function makePanner(ctx) {
  const p = ctx.createPanner();

  p.panningModel = 'HRTF';
  p.distanceModel = 'inverse';

  // Rendre les sons audibles à une plus grande distance
  p.refDistance = 10;
  p.rolloffFactor = 0.2;
  p.maxDistance = 100;

  return p;
}


/** Ambiance continue d'un organe ; renvoie { stop() }. */
function makeAmbience(ctx, dest, noise, organ, droneHz) {
  const out = ctx.createGain();
  out.gain.value = 0.0001;
  out.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + 1.5);
  out.connect(dest);
  const stops = [];

  // Nappe grave : deux sinus légèrement désaccordés.
  for (const detune of [-4, 5]) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = droneHz; o.detune.value = detune; g.gain.value = 0.16;
    o.connect(g).connect(out); o.start(); stops.push(() => o.stop());
  }
  // Souffle filtré qui respire lentement (le cerveau est plus clair).
  const src = ctx.createBufferSource(), lp = ctx.createBiquadFilter(), ng = ctx.createGain(), lfo = ctx.createOscillator(), lfoG = ctx.createGain();
  src.buffer = noise; src.loop = true;
  lp.type = organ === 'brain' ? 'bandpass' : 'lowpass'; lp.frequency.value = organ === 'brain' ? 2200 : 420; lp.Q.value = 0.6;
  ng.gain.value = organ === 'lungs' ? 0.1 : 0.05;
  lfo.frequency.value = organ === 'lungs' ? 0.12 : 0.07; lfoG.gain.value = ng.gain.value * 0.7;
  lfo.connect(lfoG).connect(ng.gain);
  src.connect(lp).connect(ng).connect(out);
  src.start(); lfo.start(); stops.push(() => src.stop(), () => lfo.stop());

  // Cerveau : scintillements électriques aléatoires (notes aiguës douces).
  let timer = 0;
  if (organ === 'brain') {
    const scale = [659.25, 739.99, 830.61, 987.77, 1108.7, 1318.5];
    timer = setInterval(() => {
      const t = ctx.currentTime + 0.02, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = scale[Math.floor(Math.random() * scale.length)];
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.connect(g).connect(out); o.start(t); o.stop(t + 0.55);
    }, 700);
  }

  return {
    stop() {
      clearInterval(timer);
      const t = ctx.currentTime;
      out.gain.cancelScheduledValues(t); out.gain.setTargetAtTime(0.0001, t, 0.25);
      setTimeout(() => { stops.forEach((s) => { try { s(); } catch { /* déjà arrêté */ } }); out.disconnect(); }, 1200);
    },
  };
}
