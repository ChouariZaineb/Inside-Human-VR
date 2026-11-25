/**
 * HeartLevel.js — Niveau 1 : le cœur.
 *
 * Mission : guider le globule rouge dans le bon ordre
 *   veine cave → oreillette droite → ventricule droit → artère pulmonaire.
 *
 * Déroulé (GameState) : ARRIVAL → EXPLORATION → MISSION → RESULT → DONE.
 * Tout le texte vient de levels.json ; ici il n'y a que la logique.
 *
 * Modèle 3D : le vrai cœur anatomique (heart.glb, NIH 3D, CC0) est affiché en grand devant
 * l'utilisateur, et il bat. Chaque élément de la mission (veine cave, oreillettes, ventricules,
 * artère pulmonaire) est une « zone » lumineuse posée sur la bonne partie du modèle : c'est elle
 * qu'on pointe et qu'on sélectionne. Si le modèle ne peut pas être chargé, le niveau garde
 * les formes simples d'origine (le niveau reste jouable).
 */
import * as THREE from 'three/webgpu';
import { BaseLevel } from './BaseLevel.js';
import { PHASE } from '../data/GameState.js';
import { createRealBody } from '../systems/RealBody.js';

/** Vrai cœur : centre et hauteur dans le niveau (m). Le modèle normalisé mesure 0,15 m. */
const HEART_CENTER = [0.75, 1.6, -3.0];
const HEART_HEIGHT = 1.6;

/**
 * Zones sélectionnables posées sur le vrai modèle : décalage depuis le centre du cœur (m)
 * et rayon. Le cœur est vu de face : la partie droite du cœur est à gauche de l'utilisateur.
 */
const HOTSPOTS = {
  vena_cava: { offset: [-0.28, 0.46, 0.15], radius: 0.08, color: 0x3f6fd1 },
  right_atrium: { offset: [-0.21, -0.06, 0.38], radius: 0.11, color: 0x3f6fd1 },
  right_ventricle: { offset: [0.08, -0.24, 0.39], radius: 0.12, color: 0x3f6fd1 },
  pulmonary_artery: { offset: [0.06, 0.22, 0.23], radius: 0.08, color: 0x3f6fd1 },
  left_atrium: { offset: [0.32, 0.19, -0.13], radius: 0.09, color: 0xd14040 },
  left_ventricle: { offset: [0.34, -0.36, 0.36], radius: 0.12, color: 0xd14040 },
};

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
    this.heartModel = null; // vrai cœur 3D (heart.glb), s'il a pu être chargé
    this.hotspots = false;  // true : les éléments sont des zones posées sur le vrai cœur
  }

  // ---------- Construction ----------

  async onLoad() {
    const realHeart = await this._loadRealHeart();
    if (realHeart) this._addHotspots();
    else this._addPlaceholders();
    this.mainPanel = this.addPanel({ width: 1.6, height: 1.0 }, PANEL_POS);
    this.button = this.addPanel({ width: 1.0, height: 0.3, variant: 'button' }, BUTTON_POS);
    this.addInteractable(this.button.mesh);
  }

  /**
   * Charge le vrai cœur (heart.glb de Yessmine) et le place en grand devant l'utilisateur.
   * @returns {Promise<boolean>} true si le modèle est affiché.
   * @private
   */
  async _loadRealHeart() {
    try {
      const body = await createRealBody({ parts: ['heart'] });
      const part = body.parts.heart;
      if (!part) return false;
      part.root.position.set(0, 0, 0);
      this.heartModel = new THREE.Group();
      this.heartModel.name = 'coeur-reel';
      this.heartModel.add(part.root);
      this.heartModel.scale.setScalar(HEART_HEIGHT / part.cfg.size);
      this.heartModel.position.set(...HEART_CENTER);
      this.heartModel.rotation.y = Math.PI / 2; // vue de face (antérieure) : ventricule droit vers l'utilisateur
      this.group.add(this.heartModel);
      return true;
    } catch (error) {
      console.warn('[HeartLevel] Cœur 3D indisponible, formes simples utilisées :', error.message ?? error);
      return false;
    }
  }

  /**
   * Zones sélectionnables sur les parties du vrai cœur. Elles sont invisibles :
   * on ne voit que le cœur. Une zone s'allume seulement quand on la pointe,
   * et elle clignote en vert ou en rouge quand on la sélectionne.
   * @private
   */
  _addHotspots() {
    this.hotspots = true;
    for (const [id, h] of Object.entries(HOTSPOTS)) {
      const material = new THREE.MeshStandardMaterial({
        color: h.color, emissive: h.color, emissiveIntensity: 0.6,
        transparent: true, opacity: 0, depthWrite: false, roughness: 0.4,
      });
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(h.radius, 24, 16), material);
      mesh.name = `zone-${id}`;
      mesh.position.set(HEART_CENTER[0] + h.offset[0], HEART_CENTER[1] + h.offset[1], HEART_CENTER[2] + h.offset[2]);
      mesh.renderOrder = 2; // dessinées après le cœur : visibles par-dessus
      mesh.userData.customHover = true; // le survol est affiché par le niveau (opacité), pas par Interaction
      this.group.add(mesh);
      this.registerElement(id, mesh);
    }
  }

  /** Formes simples d'origine (si le modèle 3D manque). @private */
  _addPlaceholders() {
    for (const [id, p] of Object.entries(PLACEHOLDERS)) {
      const geometry = p.shape === 'sphere' ? new THREE.SphereGeometry(0.3, 24, 16) : new THREE.CylinderGeometry(0.14, 0.14, 0.6, 20);
      const material = new THREE.MeshStandardMaterial({ color: p.color, roughness: 0.5, emissive: 0x000000 });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(...p.pos);
      this.group.add(mesh);
      this.registerElement(id, mesh);
    }
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
    if (this.heartModel) this.heartModel.children[0].scale.setScalar(beat); // le vrai cœur bat
    for (const [id, mesh] of this.elements) {
      if (mesh.geometry?.type === 'SphereGeometry') mesh.scale.setScalar(beat);
      const f = this._flash.get(id) ?? 0;
      if (mesh.material?.emissiveIntensity === undefined) continue;
      if (this.hotspots) {
        // Zone invisible, allumée quand on la pointe, clignote (vert / rouge / bleu) quand on la sélectionne.
        const next = Math.max(0, f - delta * 1.2);
        this._flash.set(id, next);
        const target = Math.max(next * 0.7, mesh.userData.hovered ? 0.45 : 0);
        mesh.material.opacity += (target - mesh.material.opacity) * Math.min(1, delta * 12);
        if (f > 0 && next === 0) mesh.material.emissive.setHex(HOTSPOTS[id].color); // retour à la couleur de la zone
      } else if (f > 0) {
        const next = Math.max(0, f - delta * 1.2);
        this._flash.set(id, next);
        mesh.material.emissiveIntensity = next;
      }
    }
  }

  onDispose() {
    this.heartModel = null;
    this.hotspots = false;
    this.elements.clear();
    this._flash.clear();
  }
}