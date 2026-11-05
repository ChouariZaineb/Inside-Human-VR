/**
 * GameState.js — Machine à états d'un niveau + calcul du score (patrons State + Singleton).
 *
 * Cycle de vie d'un niveau :
 *   ARRIVAL → EXPLORATION → MISSION → RESULT → DONE
 *
 * Score d'un niveau = SCORE_MAX − PENALITE_ERREUR × erreurs (jamais en dessous de 0).
 * Le temps est mesuré entre le début de la MISSION et sa réussite.
 */
import { eventBus as defaultBus, EVENTS } from '../systems/EventBus.js';

/** Phases possibles d'un niveau. */
export const PHASE = Object.freeze({
  IDLE: 'idle', // aucun niveau en cours
  ARRIVAL: 'arrival', // arrivée et explication
  EXPLORATION: 'exploration', // exploration par téléportation
  MISSION: 'mission', // mission en cours
  RESULT: 'result', // affichage du résultat
  DONE: 'done', // niveau terminé
});

/** Transitions autorisées : phase actuelle → phases suivantes possibles. */
const TRANSITIONS = Object.freeze({
  [PHASE.IDLE]: [PHASE.ARRIVAL],
  [PHASE.ARRIVAL]: [PHASE.EXPLORATION],
  [PHASE.EXPLORATION]: [PHASE.MISSION],
  [PHASE.MISSION]: [PHASE.RESULT],
  [PHASE.RESULT]: [PHASE.DONE],
  [PHASE.DONE]: [],
});

export const SCORE_MAX = 100;
export const PENALITE_ERREUR = 10;

export class GameState {
  /**
   * @param {import('../systems/EventBus.js').EventBus} [bus] Bus d'événements (injectable pour les tests).
   * @param {() => number} [now] Horloge en millisecondes (injectable pour les tests).
   */
  constructor(bus = defaultBus, now = () => performance.now()) {
    this.bus = bus;
    this._now = now;
    /** Niveaux débloqués. Le cœur est ouvert dès le départ. */
    this.unlocked = new Set(['heart']);
    /** Dernier résultat de chaque niveau : { levelId: { score, correct, errors, timeSeconds } }. */
    this.results = {};
    this._resetLevel(null);
  }

  _resetLevel(levelId) {
    this.levelId = levelId;
    this.phase = PHASE.IDLE;
    this.correct = 0;
    this.errors = 0;
    this._missionStart = null;
  }

  /** Démarre un niveau : remet les compteurs à zéro et passe en phase ARRIVAL. */
  startLevel(levelId) {
    this._resetLevel(levelId);
    this._transition(PHASE.ARRIVAL);
    this.bus.emit(EVENTS.LEVEL_STARTED, { levelId });
  }

  /**
   * Passe à la phase suivante.
   * @param {string} next Une valeur de PHASE.
   * @throws {Error} si la transition n'est pas autorisée.
   */
  setPhase(next) {
    this._transition(next);
  }

  _transition(next) {
    const allowed = TRANSITIONS[this.phase] ?? [];
    if (!allowed.includes(next)) {
      throw new Error(`Transition interdite : ${this.phase} → ${next}`);
    }
    const from = this.phase;
    this.phase = next;
    if (next === PHASE.MISSION) this._missionStart = this._now();
    this.bus.emit(EVENTS.STATE_CHANGED, { levelId: this.levelId, from, to: next });
  }

  /** Enregistre une bonne réponse. */
  recordCorrect() {
    this._assertMission();
    this.correct += 1;
    this._emitScore();
  }

  /** Enregistre une erreur. */
  recordError(elementId) {
    this._assertMission();
    this.errors += 1;
    this.bus.emit(EVENTS.MISSION_ERROR, { levelId: this.levelId, elementId });
    this._emitScore();
  }

  _assertMission() {
    if (this.phase !== PHASE.MISSION) {
      throw new Error(`Action possible seulement pendant la mission (phase actuelle : ${this.phase})`);
    }
  }

  _emitScore() {
    this.bus.emit(EVENTS.SCORE_CHANGED, {
      levelId: this.levelId,
      correct: this.correct,
      errors: this.errors,
      score: this.computeScore(),
    });
  }

  /** @returns {number} Score actuel, entre 0 et SCORE_MAX. */
  computeScore() {
    return Math.max(0, SCORE_MAX - PENALITE_ERREUR * this.errors);
  }

  /** @returns {number} Secondes écoulées depuis le début de la mission (0 si pas commencée). */
  get elapsedSeconds() {
    if (this._missionStart === null) return 0;
    return Math.round((this._now() - this._missionStart) / 100) / 10;
  }

  /**
   * Termine la mission avec succès : passe en RESULT, mémorise le résultat,
   * émet « missionSuccess » et, si un niveau suivant est donné, « levelUnlocked ».
   * @param {{ nextLevelId?: string|null }} [options]
   * @returns {{ levelId: string, score: number, correct: number, errors: number, timeSeconds: number }}
   */
  finishLevel({ nextLevelId = null } = {}) {
    this._assertMission();
    const timeSeconds = this.elapsedSeconds;
    this._transition(PHASE.RESULT);
    const result = {
      levelId: this.levelId,
      score: this.computeScore(),
      correct: this.correct,
      errors: this.errors,
      timeSeconds,
    };
    this.results[this.levelId] = result;
    this.bus.emit(EVENTS.MISSION_SUCCESS, result);
    if (nextLevelId) this.unlock(nextLevelId);
    return result;
  }

  /** Marque le niveau comme terminé (après l'écran de résultat). */
  completeLevel() {
    const levelId = this.levelId;
    this._transition(PHASE.DONE);
    this.bus.emit(EVENTS.LEVEL_COMPLETED, { levelId });
  }

  /** Débloque un niveau (sans effet s'il l'est déjà). */
  unlock(levelId) {
    if (this.unlocked.has(levelId)) return;
    this.unlocked.add(levelId);
    this.bus.emit(EVENTS.LEVEL_UNLOCKED, { levelId });
  }

  isUnlocked(levelId) {
    return this.unlocked.has(levelId);
  }

  /** Données à sauvegarder (utilisées par Storage.js en semaine 2). */
  toJSON() {
    return { unlocked: [...this.unlocked], results: this.results };
  }

  /** Restaure une sauvegarde produite par toJSON(). */
  restore(snapshot) {
    if (!snapshot) return;
    this.unlocked = new Set(['heart', ...(snapshot.unlocked ?? [])]);
    this.results = snapshot.results ?? {};
  }
}

/** Instance unique (Singleton) utilisée par toute l'application. */
export const gameState = new GameState();
