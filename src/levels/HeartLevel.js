/**
 * HeartLevel.js — Niveau 1 : le cœur.
 *
 * Mission : guider le globule rouge dans le bon ordre
 *   veine cave → oreillette droite → ventricule droit → artère pulmonaire.
 *
 * Déroulé (GameState) : ARRIVAL → EXPLORATION → MISSION → RESULT → DONE.
 * Tout le texte vient de levels.json ; ici il n'y a que la logique.
 *
 * Modèle 3D : tant que le vrai modèle (Yessmine) n'est pas là, le niveau affiche
 * des formes simples. Pour brancher le vrai modèle, appeler pour chaque pièce :
 *   level.registerElement('right_atrium', objet3D);
 */
import * as THREE from 'three/webgpu';
import { BaseLevel } from './BaseLevel.js';
import { PHASE } from '../data/GameState.js';

/** Position et couleur des formes provisoires (centre du cœur : x=0.8, y=1.5, z=-3.2). */
const PLACEHOLDERS = {
  vena_cava: { pos: [0.1, 2.4, -3.2], shape: 'cylinder', color: 0x3f6fd1 },
  right_atrium: { pos: [0.2, 1.8, -3.2], shape: 'sphere', color: 0x3f6fd1 },
  right_ventricle: { pos: [0.4, 1.1, -3.2], shape: 'sphere', color: 0x3f6fd1 },
  pulmonary_artery: { pos: [1.0, 2.4, -3.2], shape: 'cylinder', color: 0x3f6fd1 },
  left_atrium: { pos: [1.4, 1.8, -3.2], shape: 'sphere', color: 0xd14040 },
  left_ventricle: { pos: [1.3, 1.1, -3.2], shape: 'sphere', color: 0xd14040 },
};

const PANEL_POS = { x: -2.0, y: 1.7, z: -2.2 };
const BUTTON_POS = { x: -2.0, y: 0.85, z: -2.2 };
const FLASH = { success: 0x2e7d32, error: 0xc62828, info: 0x1565c0 };

export class HeartLevel extends BaseLevel {
  constructor(options) {
    super({ ...options, id: 'heart' });
    /** @type {Map<string, THREE.Object3D>} id d'élément → objet 3D */
    this.elements = new Map();
    this._flash = new Map(); // id → intensité (0 à 1)
    this.progress = 0; // nombre d'étapes réussies
    this.mainPanel = null;
    this.button = null;
    this._buttonAction = null;
  }

  // ---------- Construction ----------

  async onLoad() {
    for (const [id, p] of Object.entries(PLACEHOLDERS)) {
      const geometry = p.shape === 'sphere' ? new THREE.SphereGeometry(0.3, 24, 16) : new THREE.CylinderGeometry(0.14, 0.14, 0.6, 20);
      const material = new THREE.MeshStandardMaterial({ color: p.color, roughness: 0.5, emissive: 0x000000 });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(...p.pos);
      this.group.add(mesh);
      this.registerElement(id, mesh);
    }
    this.mainPanel = this.addPanel({ width: 1.6, height: 1.0 }, PANEL_POS);
    this.button = this.addPanel({ width: 1.0, height: 0.3, variant: 'button' }, BUTTON_POS);
    this.addInteractable(this.button.mesh);
  }

  /**
   * Associe un objet 3D (forme provisoire ou pièce du vrai modèle) à un élément du cœur.
   * @param {string} id Identifiant défini dans levels.json (ex. « right_atrium »).
   * @param {THREE.Object3D} object
   */
  registerElement(id, object) {
    object.userData.elementId = id;
    this.elements.set(id, object);
    this._flash.set(id, 0);
    this.addInteractable(object);
  }

  // ---------- Déroulé ----------

  onStart() {
    this.progress = 0;
    this._setButton(null);
    this.mainPanel.setContent({ title: this.content.intro.titre, body: this.content.intro.texte, variant: 'info' });
    this._setButton('startExploration', 'Explorer');
  }

  /** ARRIVAL → EXPLORATION */
  beginExploration() {
    if (this.gameState.phase !== PHASE.ARRIVAL) return;
    this.gameState.setPhase(PHASE.EXPLORATION);
    this.mainPanel.setContent({ title: this.content.exploration.titre, body: this.content.exploration.texte, variant: 'info' });
    this._setButton('startMission', 'Lancer la mission');
  }

  /** EXPLORATION → MISSION */
  beginMission() {
    if (this.gameState.phase !== PHASE.EXPLORATION) return;
    this.gameState.setPhase(PHASE.MISSION);
    this.progress = 0;
    this._setButton(null);
    this.mainPanel.setContent({
      title: this.content.mission.titre,
      body: this.content.mission.consigne,
      footer: `Étape 1 sur ${this.content.mission.sequence.length}`,
      variant: 'info',
    });
  }

  /**
   * Appelé quand un objet est pointé et sélectionné.
   * @param {THREE.Object3D} object
   */
  onSelect(object) {
    const action = this._findUserData(object, 'action');
    if (action && object === this.button?.mesh) return this._onButton(action);
    const id = this._findUserData(object, 'elementId');
    if (id) this.selectElement(id);
  }

  _onButton(action) {
    if (action === 'startExploration') this.beginExploration();
    else if (action === 'startMission') this.beginMission();
    else if (action === 'complete') this.gameState.completeLevel();
  }

  /**
   * Sélection d'un élément du cœur : informe (exploration) ou valide (mission).
   * @param {string} id
   */
  selectElement(id) {
    const phase = this.gameState.phase;
    if (phase === PHASE.EXPLORATION) return this._showInfo(id);
    if (phase !== PHASE.MISSION) return;

    const sequence = this.content.mission.sequence;
    const done = sequence.slice(0, this.progress).some((s) => s.id === id);
    if (done) return this._showInfo(id); // déjà franchi : pas une erreur

    const expected = sequence[this.progress];
    if (id === expected.id) return this._onCorrect(expected);
    this._onWrong(id, expected);
  }

  _showInfo(id) {
    const el = this.content.elements.find((e) => e.id === id);
    if (!el) return;
    this._flashElement(id, 'info');
    this.mainPanel.setContent({ title: el.nom, body: el.fonction, variant: 'info' });
  }

  _onCorrect(step) {
    this.gameState.recordCorrect();
    this.progress += 1;
    this._flashElement(step.id, 'success');
    const total = this.content.mission.sequence.length;
    if (this.progress < total) {
      this.mainPanel.setContent({ title: 'Bien joué !', body: step.explication, footer: `Étape ${this.progress} sur ${total}`, variant: 'success' });
    } else {
      this._finishMission(step);
    }
  }

  _onWrong(id, expected) {
    this.gameState.recordError(id);
    this._flashElement(id, 'error');
    const m = this.content.mission;
    const why = m.erreurs?.[id] ?? m.erreurGenerique;
    this.mainPanel.setContent({
      title: 'Oups !',
      body: `${why}\nIndice : ${expected.indice}`,
      footer: `Étape ${this.progress + 1} sur ${m.sequence.length}`,
      variant: 'error',
    });
  }

  _finishMission(lastStep) {
    const result = this.gameState.finishLevel({ nextLevelId: this.content.unlocks });
    const minutes = result.timeSeconds;
    this.mainPanel.setContent({
      title: this.content.reussite.titre,
      body: `${lastStep.explication}\n${this.content.reussite.texte}`,
      footer: `Score : ${result.score}/100  ·  Erreurs : ${result.errors}  ·  Temps : ${minutes} s`,
      variant: 'success',
    });
    this._setButton('complete', 'Continuer');
  }

  // ---------- Affichage ----------

  _setButton(action, label = '') {
    this._buttonAction = action;
    this.button.mesh.userData.action = action;
    this.button.mesh.visible = action !== null;
    if (action) this.button.setContent({ title: label, variant: 'button' });
  }

  _flashElement(id, kind) {
    const mesh = this.elements.get(id);
    if (!mesh?.material?.emissive) return;
    mesh.material.emissive.setHex(FLASH[kind]);
    this._flash.set(id, 1);
  }

  _findUserData(object, key) {
    for (let o = object; o; o = o.parent) {
      if (o.userData?.[key] !== undefined && o.userData[key] !== null) return o.userData[key];
    }
    return null;
  }

  onUpdate(delta, elapsed) {
    // Battement simple (≈ 70 battements par minute) et fondu du halo de retour visuel
    const beat = 1 + 0.05 * Math.pow(Math.max(0, Math.sin(elapsed * Math.PI * 2 * 1.2)), 3);
    for (const [id, mesh] of this.elements) {
      if (mesh.geometry?.type === 'SphereGeometry') mesh.scale.setScalar(beat);
      const f = this._flash.get(id) ?? 0;
      if (f > 0 && mesh.material?.emissiveIntensity !== undefined) {
        const next = Math.max(0, f - delta * 1.2);
        this._flash.set(id, next);
        mesh.material.emissiveIntensity = next;
      }
    }
  }

  onDispose() {
    this.elements.clear();
    this._flash.clear();
  }
}
