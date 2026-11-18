// LungsModel.js – poumons générés par code : deux poumons, trachée et arbre bronchique, circulation pulmonaire.
// Les poumons respirent (shader breathing.js) et le sang passe du bleu au rouge en traversant chaque poumon.
// Repère : ~2,4 unités de haut, centré sur x = 0 ; x > 0 = poumon gauche du patient (à droite de l'écran).
// Usage :
//   const lungs = createLungs();             // { group, update(dt), dispose(), … }
//   scene.add(lungs.group);
//   boucle : lungs.update(dt);               // respiration + globules
//   sortie du niveau : lungs.dispose();
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { lungMaterial, bronchiMaterial, updateBreath, breath } from '../shaders/breathing.js';
import { vesselMaterial, makeProfile } from '../shaders/bloodFlow.js';
import { BloodParticles } from './Particles.js';

const V = (x, y, z = 0) => new THREE.Vector3(x, y, z);
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const LUNG = { halfW: 0.62, halfH: 1.0, halfD: 0.5, centerX: 0.7, centerY: 0.0 };

/** Géométrie d'un poumon : sphère déformée (sommet étroit, base large, face interne plate, encoche du cœur à gauche). */
function lungGeometry(side) {
  const g = new THREE.SphereGeometry(1, 96, 64);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const medial = -side * x;                                   // > 0 : face tournée vers le milieu du thorax
    let ax = x * LUNG.halfW * (0.66 + 0.34 * sstep(1, -1, y));  // étroit au sommet, large à la base
    let ay = y * LUNG.halfH;
    let az = z * LUNG.halfD * (0.8 + 0.2 * sstep(1, -1, y));
    if (y < -0.7) ay = (-0.7 + (y + 0.7) * 0.4) * LUNG.halfH;   // la base repose sur le diaphragme (aplatie)
    if (medial > 0) ax *= 1 - 0.45 * medial;                    // face interne aplatie
    if (side > 0) {                                             // poumon gauche : encoche cardiaque
      const bell = Math.exp(-(((y + 0.12) / 0.38) ** 2));
      ax *= 1 - 0.55 * bell * sstep(0, 0.6, medial);
      ax *= 0.94; ay *= 0.96;                                   // un peu plus petit que le droit
    }
    pos.setXYZ(i, ax, ay, az);
  }
  g.computeVertexNormals();
  return g;
}

/** Arbre bronchique : tronc → deux bronches souches → ramifications dans chaque poumon (reproductible). */
function bronchialTree(seed) {
  const rand = rng(seed), parts = [];
  const tube = (pts, r0) => {
    const c = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    parts.push(new THREE.TubeGeometry(c, Math.max(4, Math.ceil(c.getLength() * 18)), r0, 8, false));
  };
  const inLung = (p, side) => {
    const cx = side * LUNG.centerX, x = (p.x - cx) / (LUNG.halfW * 0.88), y = (p.y - LUNG.centerY) / (LUNG.halfH * 0.88), z = p.z / (LUNG.halfD * 0.85);
    return x * x + y * y + z * z < 1;
  };
  const grow = (p, d, len, r, depth, side) => {
    if (depth <= 0 || r < 0.004) return;
    const end = p.clone().addScaledVector(d, len);
    if (!inLung(end, side)) return;
    const mid = p.clone().lerp(end, 0.5).add(V((rand() - 0.5) * 0.04, (rand() - 0.5) * 0.04, (rand() - 0.5) * 0.04));
    tube([p, mid, end], r);
    for (let k = 0; k < 2; k++) {
      const spread = V((rand() - 0.5) * 1.3, (rand() - 0.5) * 1.1 - 0.15, (rand() - 0.5) * 1.1);
      grow(end, d.clone().addScaledVector(spread, 0.8).normalize(), len * (0.72 + rand() * 0.12), r * 0.68, depth - 1, side);
    }
  };
  tube([V(0, 1.7, 0), V(0, 1.4, 0), V(0, 1.05, 0)], 0.075);              // trachée
  for (const side of [-1, 1]) {
    const hilum = V(side * 0.34, 0.55, 0);
    tube([V(0, 1.05, 0), V(side * 0.14, 0.9, 0.01), hilum], 0.055);         // bronche souche
    for (let k = 0; k < 3; k++) {                                             // lobes
      const d = V(side * (0.55 + rand() * 0.3), (k - 1) * 0.7 + (rand() - 0.5) * 0.2, (rand() - 0.5) * 0.5).normalize();
      grow(hilum, d, 0.34, 0.04, 4, side);
    }
  }
  return mergeGeometries(parts);
}

/** Circulation pulmonaire : artère (bleue) → réseau capillaire du poumon (le sang devient rouge) → veine (rouge) → cœur. */
function pulmonaryLoop(side) {
  const hx = side * 0.34;
  const pts = [
    V(side * 0.1, 0.62, 0.2),                       // sort du cœur (artère pulmonaire)
    V(hx, 0.58, 0.2),
    V(side * 0.7, 0.9, 0.32), V(side * 0.98, 0.35, 0.34),     // périphérie du poumon
    V(side * 1.0, -0.35, 0.3), V(side * 0.78, -0.82, 0.28),
    V(side * 0.52, -0.5, 0.32), V(side * 0.46, 0.05, 0.3),
    V(hx + side * 0.02, 0.4, 0.24),
    V(side * 0.12, 0.5, 0.2),                       // retourne au cœur (veine pulmonaire)
  ];
  return new THREE.CatmullRomCurve3(pts, true, 'centripetal');
}

/**
 * @param {{ seed?: number, glass?: boolean, blood?: boolean, particles?: number }} opts
 *   glass = poumons translucides (on voit les bronches) ; blood = circulation pulmonaire bleu → rouge
 */
export function createLungs({ seed = 11, glass = true, blood = true, particles = 500 } = {}) {
  const group = new THREE.Group();
  group.name = 'poumons';

  const lungs = [];
  for (const side of [-1, 1]) {
    const mat = lungMaterial();
    if (glass) { mat.transparent = true; mat.opacity = 0.55; mat.depthWrite = false; }
    const mesh = new THREE.Mesh(lungGeometry(side), mat);
    mesh.position.set(side * LUNG.centerX, LUNG.centerY, 0);
    mesh.name = side > 0 ? 'poumon-gauche' : 'poumon-droit';
    mesh.renderOrder = 2;
    group.add(mesh);
    lungs.push(mesh);
  }

  const bronchi = new THREE.Mesh(bronchialTree(seed), bronchiMaterial());
  bronchi.name = 'bronches';
  group.add(bronchi);

  const bloodSystems = [];
  const owned = [];
  if (blood) {
    for (const side of [-1, 1]) {
      const curve = pulmonaryLoop(side);
      const profile = makeProfile([[0, 0], [0.3, 0], [0.5, 1], [0.9, 1], [1, 0]]);   // bleu → rouge dans le poumon
      const tubeMat = vesselMaterial({ speed: 0.4, repeat: 40, profile, outside: true });
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 160, 0.032, 10, true), tubeMat);
      tube.name = 'circulation-pulmonaire';
      group.add(tube);
      const cells = new BloodParticles(curve, { count: particles, radius: 0.032, worldSpeed: 0.55, cellSize: 0.05, profile });
      group.add(cells.mesh);
      bloodSystems.push(cells);
      owned.push(tube);
    }
  }

  let t = 0;
  return {
    group, lungs, bronchi, blood: bloodSystems,
    /** Valeur de respiration 0..1 (pour synchroniser le son). */
    get breath() { return breath.value; },
    update(dt) {
      t += dt;
      updateBreath(t);
      for (const b of bloodSystems) b.update(dt);
    },
    dispose() {
      for (const b of bloodSystems) b.dispose();
      group.traverse((o) => { o.geometry?.dispose(); for (const m of [].concat(o.material ?? [])) m.dispose(); });
      group.removeFromParent();
    },
  };
}
