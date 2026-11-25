/**
 * Effects.mjs — finitions visuelles : brouillard et lumières propres à chaque organe,
 * effets de réussite (lueur dorée) et d'erreur (flash rouge + petite secousse).
 *
 * Usage (dans main.mjs) :
 *   import { Effects } from './systems/Effects.mjs';
 *   const fx = new Effects({ scene, camera });
 *   engine.onUpdate((dt) => fx.update(dt));
 *   fx.attach();                     // réagit à levelStarted, missionSuccess, missionError
 * Manuel : fx.setOrgan('lungs'); fx.success(); fx.error();
 */
import * as THREE from 'three/webgpu';
import { eventBus as defaultBus, EVENTS } from './EventBus.mjs';
import { neuronGlow } from '../shaders/neuronSignal.mjs';

/** Ambiance de chaque organe : fond, brouillard (densité), lumière principale et lueur d'appoint. */
export const AMBIANCES = {
  home:  { fog: 0x0a1030, density: 0.020, key: 0xffffff, keyI: 1.6, fill: 0x6a86ff, fillI: 1.0, glow: 0x4a6cff },
  heart: { fog: 0x2a0710, density: 0.045, key: 0xffd6d0, keyI: 1.8, fill: 0xff4a4a, fillI: 1.4, glow: 0xff3b3b },
  lungs: { fog: 0x2a1020, density: 0.035, key: 0xfff0f0, keyI: 1.8, fill: 0xff9aa8, fillI: 1.2, glow: 0xff8aa0 },
  brain: { fog: 0x0a0a2e, density: 0.040, key: 0xdde4ff, keyI: 1.5, fill: 0x8a6bff, fillI: 1.6, glow: 0x9a7bff },
};

export class Effects {
  /** @param {{ scene: THREE.Scene, camera?: THREE.Camera, eventBus?: any }} opts */
  constructor({ scene, camera = null, eventBus = defaultBus }) {
    this.scene = scene;
    this.camera = camera;
    this.eventBus = eventBus;
    this.key = new THREE.DirectionalLight(0xffffff, 1.6); this.key.position.set(2, 4, 5);
    this.fill = new THREE.PointLight(0xffffff, 1.0, 14, 1.6); this.fill.position.set(0, 0.5, 1.5);
    this.flash = new THREE.PointLight(0xffffff, 0, 10, 1.4);
    scene.add(this.key, this.fill, this.flash);
    scene.fog = new THREE.FogExp2(0x0a1030, 0.02);
    this._target = AMBIANCES.home;
    this._color = new THREE.Color();
    this._shake = 0; this._pulse = 0; this._pulseColor = new THREE.Color(); this._offs = [];
    this._camBase = null;
    this.setOrgan('home', true);
  }

  attach() {
    const bus = this.eventBus;
    this._offs.push(
      bus.on(EVENTS.LEVEL_STARTED, ({ levelId }) => this.setOrgan(levelId)),
      bus.on(EVENTS.MISSION_SUCCESS, () => this.success()),
      bus.on(EVENTS.MISSION_ERROR, () => this.error()),
    );
    return this;
  }

  /** Change d'ambiance (transition douce) ; `instant` pour appliquer sans transition. */
  setOrgan(id, instant = false) {
    this._target = AMBIANCES[id] ?? AMBIANCES.home;
    if (instant) this._apply(1);
  }

  /** Réussite : lueur dorée qui s'estompe, neurones plus lumineux. */
  success() { this._pulse = 1; this._pulseColor.set(0xffd34a); this._pulseKind = 'ok'; }

  /** Erreur : flash rouge et courte secousse de l'organe. */
  error() { this._pulse = 1; this._pulseColor.set(0xff2a2a); this._pulseKind = 'ko'; this._shake = 1; }

  update(dt) {
    this._apply(Math.min(1, dt * 2.5));
    if (this._pulse > 0) {
      this._pulse = Math.max(0, this._pulse - dt * (this._pulseKind === 'ok' ? 0.6 : 1.8));
      this.flash.color.copy(this._pulseColor);
      this.flash.intensity = this._pulse * (this._pulseKind === 'ok' ? 6 : 9);
      this.flash.position.copy(this.camera ? this.camera.position : this.fill.position);
      neuronGlow.value = 1 + (this._pulseKind === 'ok' ? this._pulse * 1.2 : 0);
    } else { this.flash.intensity = 0; neuronGlow.value = 1; }
    if (this._shake > 0) {                                  // secousse : décalage aléatoire de la scène, qui revient à 0
      this._shake = Math.max(0, this._shake - dt * 3);
      const a = this._shake * 0.03;
      this.scene.position.set((Math.random() - 0.5) * a, (Math.random() - 0.5) * a, 0);
    } else this.scene.position.set(0, 0, 0);
  }

  _apply(k) {
    const a = this._target;
    this._color.set(a.fog);
    this.scene.fog.color.lerp(this._color, k);
    this.scene.fog.density += (a.density - this.scene.fog.density) * k;
    this.key.color.lerp(this._color.set(a.key), k); this.key.intensity += (a.keyI - this.key.intensity) * k;
    this.fill.color.lerp(this._color.set(a.fill), k); this.fill.intensity += (a.fillI - this.fill.intensity) * k;
  }

  dispose() {
    this._offs.forEach((off) => off()); this._offs = [];
    this.scene.remove(this.key, this.fill, this.flash);
    this.scene.fog = null; this.scene.position.set(0, 0, 0);
  }
}
