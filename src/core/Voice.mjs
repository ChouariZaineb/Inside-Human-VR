/**
 * Voice.js — lecture à voix haute des explications (Web Speech API, synthèse vocale du navigateur, en français).
 * Aucune donnée n'est envoyée : la voix est celle du système. Les textes viennent de levels.json.
 *
 * Usage :
 *   import { Voice } from './core/Voice.mjs';
 *   const voice = new Voice();
 *   voice.speak('Bienvenue dans les poumons !');
 *   voice.readLevel(content);          // intro + exploration (+ consigne de mission)
 *   voice.attach(levelProvider);       // optionnel : lit l'intro au démarrage ; levelProvider(id) -> contenu
 * Touche V : active / coupe la voix.  voice.stop() interrompt la lecture.
 */
import { eventBus as defaultBus, EVENTS } from '../systems/EventBus.mjs';

const KEY = 'ihvr-voice';

export class Voice {
  constructor({ eventBus = defaultBus, lang = 'fr-FR', rate = 0.95, pitch = 1 } = {}) {
    this.eventBus = eventBus; this.lang = lang; this.rate = rate; this.pitch = pitch;
    this.supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
    this.enabled = this._read();
    this._offs = [];
    this._voice = null;
    if (this.supported) {
      this._pick();
      window.speechSynthesis.addEventListener?.('voiceschanged', () => this._pick());   // les voix arrivent parfois en retard
    }
  }

  _read() { try { return localStorage.getItem(KEY) !== '0'; } catch { return true; } }

  /** Choisit une voix française (de préférence locale, plus rapide et hors ligne). */
  _pick() {
    const list = window.speechSynthesis.getVoices().filter((v) => v.lang?.toLowerCase().startsWith(this.lang.slice(0, 2)));
    this._voice = list.find((v) => v.lang === this.lang && v.localService) ?? list.find((v) => v.lang === this.lang) ?? list[0] ?? null;
  }

  setEnabled(on) {
    this.enabled = on;
    try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* sans importance */ }
    if (!on) this.stop();
  }

  toggle() { this.setEnabled(!this.enabled); return this.enabled; }

  /** Lit un texte (interrompt la lecture en cours). Renvoie une promesse résolue à la fin. */
  speak(text) {
    if (!this.supported || !this.enabled || !text) return Promise.resolve();
    this.stop();
    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(String(text).replace(/\s+/g, ' ').replace(/O₂/g, 'dioxygène').replace(/CO₂/g, 'dioxyde de carbone'));
      u.lang = this.lang; u.rate = this.rate; u.pitch = this.pitch;
      if (this._voice) u.voice = this._voice;
      u.onend = u.onerror = () => resolve();
      window.speechSynthesis.speak(u);
    });
  }

  /** Lit l'accueil du niveau : titre d'intro, texte, puis consigne d'exploration. */
  async readLevel(content, { mission = false } = {}) {
    if (!content) return;
    const parts = [content.intro?.texte, content.exploration?.texte];
    if (mission) parts.push(content.mission?.consigne);
    for (const p of parts.filter(Boolean)) { if (!this.enabled) return; await this.speak(p); }
  }

  stop() { if (this.supported) window.speechSynthesis.cancel(); }

  /** Lit l'introduction à chaque démarrage de niveau et l'explication de la réussite ; touche V = muet. */
  attach(levelProvider) {
    const bus = this.eventBus;
    if (levelProvider) {
      this._offs.push(bus.on(EVENTS.LEVEL_STARTED, async ({ levelId }) => {
        try { this.readLevel(await levelProvider(levelId)); } catch { /* contenu indisponible */ }
      }));
      this._offs.push(bus.on(EVENTS.MISSION_SUCCESS, async ({ levelId }) => {
        try { const c = await levelProvider(levelId); await this.speak([c.reussite?.titre, c.reussite?.texte].filter(Boolean).join('. ')); } catch { /* idem */ }
      }));
    }
    const key = (e) => { if (e.key === 'v' || e.key === 'V') this.toggle(); };
    window.addEventListener('keydown', key);
    this._offs.push(() => window.removeEventListener('keydown', key));
    return this;
  }

  dispose() { this.stop(); this._offs.forEach((o) => o()); this._offs = []; }
}
