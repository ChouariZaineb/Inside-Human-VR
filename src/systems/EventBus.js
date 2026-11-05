/**
 * EventBus.js — Bus d'événements (patrons Observer + Singleton).
 *
 * Permet aux modules de réagir à des événements (missionSuccess, levelUnlocked…)
 * sans dépendre les uns des autres.
 *
 * Exemple :
 *   import { eventBus, EVENTS } from './systems/EventBus.js';
 *   const off = eventBus.on(EVENTS.LEVEL_UNLOCKED, ({ levelId }) => console.log(levelId));
 *   eventBus.emit(EVENTS.LEVEL_UNLOCKED, { levelId: 'lungs' });
 *   off(); // se désabonner
 */

/** Noms d'événements partagés par toute l'application. */
export const EVENTS = Object.freeze({
  /** Un niveau démarre. Données : { levelId } */
  LEVEL_STARTED: 'levelStarted',
  /** La phase d'un niveau change. Données : { levelId, from, to } */
  STATE_CHANGED: 'stateChanged',
  /** Le score change. Données : { levelId, correct, errors, score } */
  SCORE_CHANGED: 'scoreChanged',
  /** Mauvaise réponse pendant une mission. Données : { levelId, elementId } */
  MISSION_ERROR: 'missionError',
  /** Mission réussie. Données : { levelId, score, correct, errors, timeSeconds } */
  MISSION_SUCCESS: 'missionSuccess',
  /** Un nouveau niveau est débloqué. Données : { levelId } */
  LEVEL_UNLOCKED: 'levelUnlocked',
  /** Le joueur a fini le niveau (écran de résultat fermé). Données : { levelId } */
  LEVEL_COMPLETED: 'levelCompleted',
  /** Un objet 3D a été pointé et sélectionné (émis par Interaction.js). Données : { object } */
  OBJECT_SELECTED: 'objectSelected',
});

export class EventBus {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this._listeners = new Map();
  }

  /**
   * S'abonne à un événement.
   * @param {string} event Nom de l'événement.
   * @param {(payload?: any) => void} handler Fonction appelée à chaque émission.
   * @returns {() => void} Fonction pour se désabonner.
   */
  on(event, handler) {
    if (typeof handler !== 'function') throw new TypeError('EventBus.on : handler doit être une fonction');
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(handler);
    return () => this.off(event, handler);
  }

  /**
   * S'abonne pour une seule émission.
   * @returns {() => void} Fonction pour se désabonner.
   */
  once(event, handler) {
    const wrapper = (payload) => {
      this.off(event, wrapper);
      handler(payload);
    };
    return this.on(event, wrapper);
  }

  /** Se désabonne d'un événement. */
  off(event, handler) {
    const set = this._listeners.get(event);
    if (!set) return;
    set.delete(handler);
    if (set.size === 0) this._listeners.delete(event);
  }

  /**
   * Émet un événement. Une erreur dans un abonné n'empêche pas les autres d'être appelés.
   * @param {string} event
   * @param {any} [payload]
   */
  emit(event, payload) {
    const set = this._listeners.get(event);
    if (!set) return;
    for (const handler of [...set]) {
      try {
        handler(payload);
      } catch (err) {
        console.error(`[EventBus] erreur dans un abonné de « ${event} »`, err);
      }
    }
  }

  /** Supprime tous les abonnés (utile pour les tests). */
  clear() {
    this._listeners.clear();
  }
}

/** Instance unique (Singleton) utilisée par toute l'application. */
export const eventBus = new EventBus();
