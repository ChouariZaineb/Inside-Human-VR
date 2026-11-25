/**
 * BrainLevel.js — Niveau 3 : transmettre un influx nerveux.
 *
 * Le contenu pédagogique reste dans levels.json. Les neurones sont un modèle 3D
 * importé (neuron.glb), couché à l'horizontale : trois neurones cliquables pour la
 * mission séquentielle (sensoriel → relais → moteur).
 *
 * Contrat commun avec LevelManager : load/start/update/dispose et objets pointables.
 */
import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { BaseLevel } from './BaseLevel.js';
import { PHASE } from '../data/GameState.js';

const NODES = [
  { id: 'sensory_neuron', position: [-0.95, 1.5, -3.3], color: 0x4c9cff },
  { id: 'relay_neuron', position: [0.5, 2.35, -3.5], color: 0xbb7cff },
  { id: 'motor_neuron', position: [1.95, 1.5, -3.3], color: 0x38d9b4 },
];

const PANEL_POS = { x: -2.15, y: 1.8, z: -2.1 };
const BUTTON_POS = { x: -2.15, y: 0.85, z: -2.1 };
const FLASH = { info: 0x2164cc, success: 0x31ba65, error: 0xeb4545 };
const SIGNAL_DURATION = 0.9;

/** Neurone multipolaire (Alain Sorazu, CC BY-SA 4.0, modifié) et longueur d'un neurone de la mission (m). */
const NEURON_URL = 'assets/models/neuron.glb';
const NEURON_LENGTH = 1.65;
/** Zone pointable autour d'un neurone (les branches sont trop fines pour être visées au rayon). */
const HIT_SIZE = [1.35, 0.7, 0.4];
/** Luminosité au repos d'un neurone de la mission. */
const REST_GLOW = 0.55;

export class BrainLevel extends BaseLevel {
  constructor(options) {
    super({ ...options, id: 'brain' });
    this.elements = new Map();
    this._flashes = new Map();
    this.progress = 0;
    this.mainPanel = null;
    this.button = null;
    this._signal = null;
    this._signalOrb = null;
  }

  async onLoad() {
    const template = await this._loadNeuronTemplate();
    for (const node of NODES) {
      const neuron = createMissionNeuron(template, node.color);
      neuron.position.set(...node.position);
      neuron.name = node.id;
      this.group.add(neuron);
      this.registerElement(node.id, neuron);
    }

    // Liaison pédagogique entre les neurones. Le shader final pourra remplacer
    // cet effet temporaire sans changer la logique de la mission.
    const positions = NODES.map((node) => new THREE.Vector3(...node.position));
    this._drawConnection(positions[0], positions[1]);
    this._drawConnection(positions[1], positions[2]);

    const synapse = new THREE.Mesh(
      new THREE.TorusGeometry(0.14, 0.035, 12, 24),
      new THREE.MeshStandardMaterial({ color: 0xffca60, emissive: 0x382000, roughness: 0.35 }),
    );
    synapse.position.copy(positions[0]).lerp(positions[1], 0.5);
    synapse.rotation.y = Math.PI / 6;
    synapse.name = 'synapse';
    this.group.add(synapse);
    this.registerElement('synapse', synapse);

    // Cible visuelle : le muscle reçoit le message à la fin du parcours.
    const muscle = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.16, 0.48, 8, 16),
      new THREE.MeshStandardMaterial({ color: 0xe78a91, roughness: 0.6 }),
    );
    muscle.position.set(3.15, 1.05, -3.3);
    muscle.rotation.z = Math.PI / 2;
    muscle.name = 'muscle-cible';
    this.group.add(muscle);
    this._targetPosition = muscle.position.clone();
    this._drawConnection(positions[2], this._targetPosition);

    this._signalOrb = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xfff176 }),
    );
    this._signalOrb.visible = false;
    this.group.add(this._signalOrb);

    this.mainPanel = this.addPanel({ width: 1.6, height: 1.0 }, PANEL_POS);
    this.button = this.addPanel({ width: 1.0, height: 0.3, variant: 'button' }, BUTTON_POS);
    this.addInteractable(this.button.mesh);
  }

  /**
   * Charge le modèle et le normalise : couché (corps cellulaire à gauche, terminaisons à droite),
   * centré, de longueur 1. Renvoie null si le fichier manque : les zones pointables sont alors affichées.
   */
  async _loadNeuronTemplate() {
    const base = import.meta.env.BASE_URL;
    const draco = new DRACOLoader().setDecoderPath(`${base}draco/`);
    try {
      const gltf = await new GLTFLoader().setDRACOLoader(draco).loadAsync(`${base}${NEURON_URL}`);
      const lying = new THREE.Group();
      lying.rotation.z = Math.PI / 2; // le haut du modèle passe à gauche
      lying.add(gltf.scene);
      const holder = new THREE.Group();
      holder.add(lying);
      const box = new THREE.Box3().setFromObject(holder);
      const scale = 1 / box.getSize(new THREE.Vector3()).x;
      lying.scale.setScalar(scale);
      lying.position.copy(box.getCenter(new THREE.Vector3()).multiplyScalar(-scale));
      holder.updateMatrixWorld(true);
      return holder;
    } catch (error) {
      console.warn('[Cerveau] Neurone 3D indisponible :', error.message ?? error);
      return null;
    } finally {
      draco.dispose();
    }
  }

  /** Points proposés à la téléportation ; pas de déplacement continu. */
  getTeleportPoints() {
    return [
      { position: new THREE.Vector3(0, 0, 0), rotationY: 0 },
      { position: new THREE.Vector3(0.6, 0, -1.25), rotationY: 0 },
    ];
  }

  _drawConnection(from, to) {
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([from, to]),
      new THREE.LineBasicMaterial({ color: 0x74b4ff, transparent: true, opacity: 0.55 }),
    );
    this.group.add(line);
  }

  /** Permet de substituer ultérieurement un modèle 3D sans toucher à la mission. */
  registerElement(id, object) {
    object.userData.elementId = id;
    this.elements.set(id, object);
    this._flashes.set(id, 0);
    this.addInteractable(object);
  }

  onStart() {
    this.progress = 0;
    this._signal = null;
    this._signalOrb.visible = false;
    this.mainPanel.setContent({
      title: this.content.intro.titre,
      body: this.content.intro.texte,
      variant: 'info',
    });
    this._setButton('explore', 'Explorer');
  }

  beginExploration() {
    if (this.gameState.phase !== PHASE.ARRIVAL) return;
    this.gameState.setPhase(PHASE.EXPLORATION);
    this.mainPanel.setContent({
      title: this.content.exploration.titre,
      body: this.content.exploration.texte,
      variant: 'info',
    });
    this._setButton('mission', 'Lancer la mission');
  }

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

  onSelect(object) {
    if (object === this.button?.mesh) {
      const action = object.userData.action;
      if (action === 'explore') this.beginExploration();
      else if (action === 'mission') this.beginMission();
      else if (action === 'complete') this.gameState.completeLevel();
      return;
    }

    let candidate = object;
    while (candidate && !candidate.userData?.elementId) candidate = candidate.parent;
    if (candidate?.userData.elementId) this.selectElement(candidate.userData.elementId);
  }

  /** Sélection testable indépendamment du raycasting VR/bureau. */
  selectElement(id) {
    const element = this.content.elements.find((item) => item.id === id);
    if (!element) return;
    const phase = this.gameState.phase;
    if (phase === PHASE.EXPLORATION) return this._showInfo(element);
    if (phase !== PHASE.MISSION) return;

    const sequence = this.content.mission.sequence;
    if (sequence.slice(0, this.progress).some((step) => step.id === id)) {
      return this._showInfo(element); // étape déjà réussie : pas de pénalité
    }

    const expected = sequence[this.progress];
    if (expected.id !== id) {
      this.gameState.recordError(id);
      this._flash(id, 'error');
      const explanation = this.content.mission.erreurs?.[id] ?? this.content.mission.erreurGenerique;
      this.mainPanel.setContent({
        title: 'Pas encore !',
        body: `${explanation}\nIndice : ${expected.indice}`,
        footer: `Étape ${this.progress + 1} sur ${sequence.length}`,
        variant: 'error',
      });
      return;
    }

    this.gameState.recordCorrect();
    this._flash(id, 'success');
    this._animateSignal(id);
    this.progress += 1;

    if (this.progress < sequence.length) {
      this.mainPanel.setContent({
        title: 'Signal transmis !',
        body: expected.explication,
        footer: `Étape ${this.progress + 1} sur ${sequence.length}`,
        variant: 'success',
      });
      return;
    }

    const result = this.gameState.finishLevel({ nextLevelId: this.content.unlocks });
    this.mainPanel.setContent({
      title: this.content.reussite.titre,
      body: this.content.reussite.texte,
      footer: `Score : ${result.score}/100 · Erreurs : ${result.errors} · Temps : ${result.timeSeconds} s`,
      variant: 'success',
    });
    this._setButton('complete', 'Terminer');
  }

  _showInfo(element) {
    this._flash(element.id, 'info');
    this.mainPanel.setContent({ title: element.nom, body: element.fonction, variant: 'info' });
  }

  _setButton(action, label = '') {
    this.button.mesh.userData.action = action;
    this.button.mesh.visible = action !== null;
    if (action) this.button.setContent({ title: label, variant: 'button' });
  }

  _animateSignal(id) {
    const order = NODES.map((item) => item.id);
    const index = order.indexOf(id);
    const from = this.elements.get(id).position.clone();
    const to = index < order.length - 1
      ? this.elements.get(order[index + 1]).position.clone()
      : this._targetPosition.clone();
    this._signal = { from, to, time: 0 };
    this._signalOrb.position.copy(from);
    this._signalOrb.visible = true;
  }

  _flash(id, kind) {
    const node = this.elements.get(id);
    if (!node) return;
    node.traverse((mesh) => {
      if (mesh.material?.emissive) {
        mesh.material.emissive.setHex(FLASH[kind]);
        mesh.material.emissiveIntensity = 1;
      }
    });
    this._flashes.set(id, 1);
  }

  onUpdate(delta, elapsed) {
    for (const [id, value] of this._flashes) {
      if (value <= 0) continue;
      const remaining = Math.max(0, value - delta * 1.5);
      this._flashes.set(id, remaining);
      this.elements.get(id)?.traverse((mesh) => {
        const material = mesh.material;
        if (!material?.emissive) return;
        const rest = material.userData.rest; // neurones : couleur propre ; synapse : éteinte
        const floor = rest?.intensity ?? 0;
        material.emissiveIntensity = floor + (1 - floor) * remaining;
        if (remaining === 0 && rest) material.emissive.setHex(rest.color);
      });
    }

    // Respiration lumineuse discrète des neurones.
    for (const [index, node] of NODES.entries()) {
      const object = this.elements.get(node.id);
      if (object) object.scale.setScalar(1 + 0.035 * Math.sin(elapsed * 2.5 + index));
    }

    if (this._signal) {
      this._signal.time = Math.min(SIGNAL_DURATION, this._signal.time + delta);
      const t = this._signal.time / SIGNAL_DURATION;
      this._signalOrb.position.lerpVectors(this._signal.from, this._signal.to, t);
      if (t >= 1) {
        this._signal = null;
        this._signalOrb.visible = false;
      }
    }
  }

  onDispose() {
    this.elements.clear();
    this._flashes.clear();
    this._signal = null;
  }
}

/** Copie un matériau avec sa couleur de repos (les flashs de la mission y reviennent). */
function tint(material, color, intensity, opacity = 1) {
  const copy = material.clone();
  copy.color.setHex(color);
  copy.emissive.setHex(color);
  copy.emissiveIntensity = intensity;
  copy.opacity = opacity;
  copy.transparent = opacity < 1;
  copy.userData.rest = { color, intensity };
  return copy;
}

/** Un neurone de la mission : le modèle teinté et sa zone pointable invisible. */
function createMissionNeuron(template, color) {
  const root = new THREE.Group();
  root.add(new THREE.Mesh(
    new THREE.BoxGeometry(...HIT_SIZE),
    template
      ? new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
      : new THREE.MeshStandardMaterial({ color, emissive: 0x000000 }), // secours si le modèle manque
  ));
  if (template) {
    const model = template.clone(true);
    model.scale.setScalar(NEURON_LENGTH);
    model.traverse((mesh) => {
      if (mesh.isMesh) mesh.material = tint(mesh.material, color, REST_GLOW);
    });
    root.add(model);
  }
  return root;
}
