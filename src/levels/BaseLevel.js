/**
 * BaseLevel.js — Classe de base de tous les niveaux (patron Template Method).
 *
 * Déroulé commun, appelé par le LevelManager :
 *   await level.load();     // charge le contenu, crée la scène du niveau
 *   level.start();          // démarre le niveau (GameState passe en ARRIVAL)
 *   level.update(dt, t);    // à chaque image
 *   level.dispose();        // libère la mémoire en quittant le niveau
 *
 * Chaque organe redéfinit les crochets onLoad / onStart / onUpdate / onSelect / onDispose.
 *
 * Contrat avec Interaction.js (Zeineb) :
 *   - Interaction fait son raycasting sur level.getInteractables() ;
 *   - quand un objet est pointé et sélectionné, elle émet :
 *       eventBus.emit(EVENTS.OBJECT_SELECTED, { object })
 */
import * as THREE from 'three/webgpu';
import { eventBus as defaultBus, EVENTS } from '../systems/EventBus.js';
import { gameState as defaultGameState } from '../data/GameState.js';
import { UIPanel } from '../systems/UIPanel.js';

/** Chemin de levels.json, compatible avec le « base » de Vite (GitHub Pages). */
const CONTENT_PATH = 'assets/content/levels.json';
let contentPromise = null;

/**
 * Charge levels.json (une seule fois) et renvoie le contenu du niveau demandé.
 * @param {string} levelId
 * @returns {Promise<object>}
 */
export async function loadLevelContent(levelId) {
  if (!contentPromise) {
    const base = import.meta.env?.BASE_URL ?? '/';
    contentPromise = fetch(`${base}${CONTENT_PATH}`).then((res) => {
      if (!res.ok) throw new Error(`Impossible de charger levels.json (HTTP ${res.status})`);
      return res.json();
    });
    contentPromise.catch(() => {
      contentPromise = null; // permet de réessayer
    });
  }
  const data = await contentPromise;
  const level = data.levels.find((l) => l.id === levelId);
  if (!level) throw new Error(`Niveau inconnu dans levels.json : ${levelId}`);
  return level;
}

export class BaseLevel {
  /**
   * @param {object} options
   * @param {string} options.id Identifiant du niveau (ex. « heart »), identique à levels.json.
   * @param {THREE.Scene} options.scene Scène à laquelle le niveau ajoute ses objets.
   * @param {THREE.Camera} [options.camera] Caméra (pour tourner les panneaux vers le joueur).
   * @param {object} [options.content] Contenu du niveau (sinon chargé depuis levels.json).
   * @param {import('../systems/EventBus.js').EventBus} [options.eventBus]
   * @param {import('../data/GameState.js').GameState} [options.gameState]
   * @param {(opts: object) => UIPanel} [options.createPanel] Fabrique de panneaux (remplaçable pour les tests).
   */
  constructor({ id, scene, camera = null, content = null, eventBus = defaultBus, gameState = defaultGameState, createPanel = (o) => new UIPanel(o) }) {
    this.id = id;
    this.scene = scene;
    this.camera = camera;
    this.content = content;
    this.eventBus = eventBus;
    this.gameState = gameState;
    this.createPanel = createPanel;

    this.group = new THREE.Group();
    this.group.name = `level-${id}`;
    this.panels = [];
    this.loaded = false;
    this.active = false;
    this._interactables = [];
    this._unsubscribe = null;
  }

  /** Charge le contenu et construit la scène du niveau. */
  async load() {
    if (this.loaded) return;
    this.content ??= await loadLevelContent(this.id);
    this.scene.add(this.group);
    await this.onLoad();
    this.loaded = true;
  }

  /** Démarre le niveau. */
  start() {
    if (!this.loaded) throw new Error(`Niveau « ${this.id} » : appeler load() avant start()`);
    this.group.visible = true;
    this.active = true;
    this._unsubscribe = this.eventBus.on(EVENTS.OBJECT_SELECTED, ({ object }) => this.onSelect(object));
    this.gameState.startLevel(this.id);
    this.onStart();
  }

  /**
   * Mise à jour à chaque image.
   * @param {number} delta Secondes depuis l'image précédente.
   * @param {number} elapsed Secondes depuis le début.
   */
  update(delta, elapsed) {
    if (!this.active) return;
    for (const panel of this.panels) panel.update(this.camera);
    this.onUpdate(delta, elapsed);
  }

  /** Libère la mémoire : un seul organe doit rester chargé à la fois. */
  dispose() {
    this.active = false;
    this._unsubscribe?.();
    this._unsubscribe = null;
    this.onDispose();
    this.group.traverse((obj) => {
      obj.geometry?.dispose();
      for (const mat of [].concat(obj.material ?? [])) {
        mat.map?.dispose();
        mat.dispose();
      }
    });
    this.scene.remove(this.group);
    this.panels = [];
    this._interactables = [];
    this.loaded = false;
  }

  /** @returns {THREE.Object3D[]} Objets que le raycasting peut pointer dans ce niveau. */
  getInteractables() {
    return this._interactables;
  }

  /**
   * Crée un panneau, l'ajoute au niveau et le suit pour le tourner vers le joueur.
   * @param {object} options Options de UIPanel (width, height, variant…).
   * @param {{ x: number, y: number, z: number }} position
   * @returns {UIPanel}
   */
  addPanel(options, position) {
    const panel = this.createPanel(options);
    panel.setPosition(position.x, position.y, position.z);
    this.group.add(panel.mesh);
    this.panels.push(panel);
    return panel;
  }

  /** Déclare un objet comme pointable. */
  addInteractable(object) {
    this._interactables.push(object);
  }

  // ---- Crochets à redéfinir dans chaque niveau ----
  async onLoad() {}
  onStart() {}
  onUpdate(_delta, _elapsed) {}
  /** Appelé quand un objet est sélectionné (voir le contrat en haut du fichier). */
  onSelect(_object) {}
  onDispose() {}
}
