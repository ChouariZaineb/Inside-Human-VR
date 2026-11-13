// XrayBody.js – corps masculin « radio » : silhouette bleue lumineuse, cage thoracique, poumons, cœur,
// artères (rouge) et veines (bleu) lumineuses avec flèches animées dans le sens du sang.
// Repère : ~10 unités de haut, centré sur x=0, face à +z. x>0 = côté gauche du patient (droite de l'écran).
// Usage : const body = createXrayBody(); scene.add(body.group); boucle : body.update(dt);
import * as THREE from 'three/webgpu';
import { MeshStandardNodeMaterial, MeshBasicNodeMaterial } from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { vec3, float, mix, normalView, positionViewDirection } from 'three/tsl';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { createAnatomicalHeart } from './ProceduralHeart.js';
import { beatJS } from '../shaders/tissuePulse.js';

const V = (x, y, z = 0) => new THREE.Vector3(x, y, z);
const fresnel = (p = 1.8) => float(1).sub(normalView.dot(positionViewDirection).abs()).pow(p);
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---------- Contour du corps (moitié droite) ----------
const HALF = [
  [0, 5.0], [0.34, 4.96], [0.5, 4.72], [0.52, 4.3], [0.45, 3.95], [0.32, 3.75], [0.28, 3.55],
  [0.7, 3.42], [1.25, 3.3], [1.62, 3.1], [1.72, 2.6], [1.76, 1.6], [1.8, 0.6], [1.92, -0.5], [2.02, -1.3], [2.12, -2.1], [2.18, -2.35],
  [2.05, -2.45], [1.95, -2.25], [1.78, -1.4], [1.6, -0.4], [1.5, 0.5], [1.45, 1.6], [1.38, 2.2],
  [1.2, 2.0], [1.12, 1.2], [0.98, 0.3], [0.92, -0.25], [1.0, -0.8], [1.04, -1.5], [0.98, -2.5], [0.84, -3.2], [0.78, -4.0], [0.7, -4.6],
  [0.78, -4.9], [0.95, -5.0], [0.5, -5.05], [0.4, -4.6], [0.4, -3.6], [0.42, -2.6], [0.36, -1.6], [0.26, -0.9], [0.1, -0.62], [0, -0.58],
];
const CONTOUR = (() => {
  const right = HALF.map(([x, y]) => V(x, y));
  const left = HALF.slice(1, -1).reverse().map(([x, y]) => V(-x, y));
  return new THREE.CatmullRomCurve3([...right, ...left], true, 'centripetal').getPoints(600).map((p) => new THREE.Vector2(p.x, p.y));
})();
function inside(x, y) {
  let c = false;
  for (let i = 0, j = CONTOUR.length - 1; i < CONTOUR.length; j = i++) {
    const a = CONTOUR[i], b = CONTOUR[j];
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}
const nearHeart = (x, y) => ((x - 0.28) / 0.45) ** 2 + ((y - 2.15) / 0.55) ** 2 < 1;
const okPoint = (x, y, m = 0.06) => !nearHeart(x, y) && inside(x, y) && inside(x - m, y) && inside(x + m, y) && inside(x, y + m) && inside(x, y - m);

// ---------- Silhouette lumineuse ----------
/** Géométrie extrudée du corps masculin (réutilisée par HeartAtlas). */
export function bodyGeometry() {
  const geo = new THREE.ExtrudeGeometry(new THREE.Shape(CONTOUR), { depth: 0.3, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.1, bevelSegments: 8, curveSegments: 1 });
  geo.translate(0, 0, -0.15);
  return geo;
}

function silhouette() {
  const geo = bodyGeometry();
  const m = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
  const f = fresnel(1.5);
  m.colorNode = mix(vec3(0.05, 0.28, 0.95), vec3(0.4, 0.78, 1.0), f);
  m.opacityNode = f.mul(0.62).add(0.15);
  const mesh = new THREE.Mesh(geo, m);
  mesh.renderOrder = 1;
  return mesh;
}

// ---------- Squelette du thorax ----------
function boneMat(op = 0.55) {
  const m = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
  m.colorNode = vec3(0.55, 0.82, 1.0);
  m.opacityNode = float(op);
  return m;
}
const tube = (pts, r, mat, seg = 40, rad = 8) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), seg, r, rad, false), mat);

function ribcage() {
  const g = new THREE.Group();
  const mat = boneMat(0.42);
  const geos = [];
  for (let i = 0; i < 10; i++) {
    const t = i / 9, y0 = 3.05 - i * 0.27;
    const a = 0.6 + 0.45 * Math.sin(Math.PI * (0.15 + 0.75 * t)), b = 0.27;
    for (const s of [-1, 1]) {
      const pts = [];
      for (let k = 0; k <= 10; k++) {
        const th = (k / 10) * 0.86 * Math.PI;
        pts.push(V(s * a * Math.sin(th), y0 - 0.75 * (th / Math.PI) ** 2, -b * Math.cos(th)));   // les côtes descendent vers l'avant
      }
      pts.push(V(s * 0.07, y0 - 0.62, 0.29));
      geos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), 36, 0.02, 6, false));
    }
  }
  g.add(new THREE.Mesh(mergeGeometries(geos), mat));
  g.add(tube([V(0, 3.4, -0.28), V(0, 1.5, -0.3), V(0, -0.4, -0.26)], 0.04, boneMat(0.14)));                       // colonne
  const sternum = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.7, 0.04), boneMat(0.22)); sternum.position.set(0, 2.35, 0.29); g.add(sternum);
  for (const s of [-1, 1]) g.add(tube([V(s * 0.06, 3.02, 0.25), V(s * 0.7, 3.14, 0.18), V(s * 1.38, 3.22, 0.04)], 0.025, boneMat(0.3)));   // clavicules
  g.renderOrder = 1;
  return g;
}

function lungs() {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const m = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
    m.colorNode = vec3(0.62, 0.28, 0.2);
    m.opacityNode = fresnel(1.2).mul(0.35).add(0.12);
    const lung = new THREE.Mesh(new THREE.SphereGeometry(1, 36, 28), m);
    lung.scale.set(s > 0 ? 0.5 : 0.58, 1.0, 0.24);
    lung.position.set(s * 0.68, 2.05, -0.02);
    g.add(lung);
  }
  return g;
}

// ---------- Circulation ----------
const mirrorX = (pts) => pts.map((p) => V(-p.x, p.y, p.z));
const ARM_A_R = [V(0.0, 3.2), V(-0.6, 3.25), V(-1.2, 3.15), V(-1.45, 2.5), V(-1.55, 1.5), V(-1.65, 0.4), V(-1.85, -0.8), V(-2.0, -1.7), V(-2.1, -2.3)];
const ARM_V_R = [V(-2.2, -2.3), V(-1.95, -1.7), V(-1.75, -0.8), V(-1.55, 0.4), V(-1.45, 1.5), V(-1.35, 2.5), V(-1.1, 3.05), V(-0.6, 3.15), V(-0.15, 3.3)];
const LEG_A_R = [V(0.28, -0.55, -0.1), V(0.1, -0.85), V(-0.3, -1.4), V(-0.52, -2.4), V(-0.55, -3.4), V(-0.5, -4.3), V(-0.5, -4.85)];
const LEG_V_R = [V(-0.36, -4.85), V(-0.38, -3.4), V(-0.4, -2.4), V(-0.25, -1.4), V(-0.05, -0.85), V(0.0, -0.58, -0.08)];

const VESSELS = [
  // artères (rouge) : le sang s'éloigne du cœur
  { red: true, r: 0.09, pts: [V(0.12, 2.65, 0.02), V(0.12, 3.0), V(0.2, 3.28), V(0.4, 3.2), V(0.43, 2.9), V(0.4, 2.0, -0.1), V(0.35, 0.8, -0.12), V(0.28, -0.55, -0.1)] }, // aorte
  { red: true, r: 0.05, pts: LEG_A_R },
  { red: true, r: 0.05, pts: [V(0.28, -0.55, -0.1), V(0.45, -0.9), V(0.6, -1.4), V(0.6, -2.4), V(0.58, -3.4), V(0.52, -4.3), V(0.52, -4.85)] },
  { red: true, r: 0.045, pts: ARM_A_R },
  { red: true, r: 0.045, pts: [V(0.4, 3.2), ...mirrorX(ARM_A_R).slice(1)] },
  { red: true, r: 0.04, pts: [V(-0.04, 3.22, 0.06), V(-0.08, 3.7, 0.08), V(-0.05, 4.2, 0.12), V(-0.02, 4.72, 0.1)] },
  { red: true, r: 0.04, pts: [V(0.18, 3.28, 0.04), V(0.2, 3.7, 0.08), V(0.15, 4.2, 0.12), V(0.1, 4.7, 0.1)] },
  // veines (bleu) : le sang revient vers le cœur
  { red: false, r: 0.07, pts: [V(-0.16, 3.4), V(-0.13, 3.0), V(-0.08, 2.72, 0.02)] },                              // veine cave supérieure
  { red: false, r: 0.08, pts: [V(0.0, -0.58, -0.08), V(-0.02, 0.5, -0.06), V(-0.03, 1.5, -0.02), V(0.0, 1.95, 0.0)] }, // veine cave inférieure
  { red: false, r: 0.05, pts: LEG_V_R },
  { red: false, r: 0.05, pts: [V(0.42, -4.85), V(0.42, -3.4), V(0.4, -2.4), V(0.28, -1.4), V(0.1, -0.85), V(0.0, -0.58, -0.08)] },
  { red: false, r: 0.045, pts: ARM_V_R },
  { red: false, r: 0.045, pts: [...mirrorX(ARM_V_R).slice(0, -2), V(0.3, 3.1, 0.12), V(-0.12, 3.32, 0.1)] },
  { red: false, r: 0.04, pts: [V(0.0, 4.72, 0.05), V(0.0, 4.2), V(-0.04, 3.7), V(-0.16, 3.38)] },
  // petite circulation : poumons
  { red: false, r: 0.06, pts: [V(0.15, 2.55, 0.12), V(0.0, 2.78, 0.1), V(-0.35, 2.88, 0.0), V(-0.65, 2.75, -0.05)] },
  { red: false, r: 0.055, pts: [V(0.3, 2.7, 0.08), V(0.55, 2.88, 0.0), V(0.8, 2.78, -0.05)] },
  { red: true, r: 0.05, pts: [V(-0.65, 2.3, -0.08), V(-0.3, 2.3, -0.1), V(0.0, 2.3, -0.1)] },
  { red: true, r: 0.05, pts: [V(0.95, 2.25, -0.08), V(0.65, 2.32, -0.1), V(0.42, 2.35, -0.08)] },
];

const RED_MAT = () => new MeshStandardNodeMaterial({ color: 0xd8101c, roughness: 0.35, emissive: 0xc00818, emissiveIntensity: 0.9 });
const BLUE_MAT = () => new MeshStandardNodeMaterial({ color: 0x1b6fe0, roughness: 0.35, emissive: 0x1260d8, emissiveIntensity: 0.8 });

function grow(rand, out, p, d, len, r, depth) {
  const pts = [p.clone()]; let cur = p.clone(); const dd = d.clone();
  for (let i = 0; i < 4; i++) {
    dd.x += (rand() - 0.5) * 0.3; dd.y += (rand() - 0.5) * 0.3; dd.normalize();
    const n = cur.clone().addScaledVector(dd, len / 4); n.z = THREE.MathUtils.clamp(n.z + (rand() - 0.5) * 0.04, -0.15, 0.15);
    if (!okPoint(n.x, n.y)) break;
    pts.push(n); cur = n;
  }
  if (pts.length < 3) return;
  out.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), pts.length * 3, r, 4, false));
  if (depth > 0) for (let k = 0; k < 2; k++) {
    const a = (k ? 1 : -1) * (0.5 + rand() * 0.5);
    grow(rand, out, pts[Math.min(pts.length - 1, 1 + k)], V(dd.x * Math.cos(a) - dd.y * Math.sin(a), dd.x * Math.sin(a) + dd.y * Math.cos(a)), len * 0.6, r * 0.75, depth - 1);
  }
}

class FlowArrows {
  constructor(curves, color, speed = 0.6) {
    const shaft = new THREE.CylinderGeometry(0.012, 0.012, 0.13, 6); shaft.translate(0, 0.065 - 0.11, 0);
    const head = new THREE.ConeGeometry(0.045, 0.1, 10); head.translate(0, 0.18 - 0.11, 0);
    const geo = mergeGeometries([shaft, head].map((x) => x.toNonIndexed()));
    const mat = new MeshBasicNodeMaterial(); mat.colorNode = vec3(...color);
    this.items = [];
    for (const c of curves) {
      const len = c.getLength(), n = Math.max(1, Math.round(len / 0.8));
      for (let k = 0; k < n; k++) this.items.push({ c, u: k / n, du: speed / len });
    }
    this.mesh = new THREE.InstancedMesh(geo, mat, this.items.length);
    this.mesh.frustumCulled = false;
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._s = V(1, 1, 1); this._up = V(0, 1, 0);
    this.update(0);
  }
  update(dt) {
    this.items.forEach((it, i) => {
      it.u = (it.u + it.du * dt) % 1;
      const p = it.c.getPointAt(it.u), t = it.c.getTangentAt(it.u);
      p.z += 0.03;
      this._q.setFromUnitVectors(this._up, t);
      this._m.compose(p, this._q, this._s);
      this.mesh.setMatrixAt(i, this._m);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

export function createXrayBody({ branches = 1 } = {}) {
  const group = new THREE.Group();
  group.add(silhouette(), ribcage(), lungs());

  // cœur (palette beige + brun) incliné : pointe vers le bas et vers la gauche du patient
  const heart = new THREE.Group();
  const inner = createAnatomicalHeart({ palette: 'xray' }); inner.scale.setScalar(0.98);
  heart.add(inner);
  heart.position.set(0.28, 2.15, 0.08);
  heart.rotation.z = 0.45;
  group.add(heart);

  // vaisseaux principaux
  const redArrows = [], blueArrows = [], redTubes = [], blueTubes = [];
  for (const v of VESSELS) {
    const curve = new THREE.CatmullRomCurve3(v.pts, false, 'centripetal');
    (v.red ? redTubes : blueTubes).push(new THREE.TubeGeometry(curve, Math.ceil(curve.getLength() * 24), v.r, 10, false));
    (v.red ? redArrows : blueArrows).push(curve);
  }
  group.add(new THREE.Mesh(mergeGeometries(redTubes), RED_MAT()), new THREE.Mesh(mergeGeometries(blueTubes), BLUE_MAT()));

  // petites branches (reproductibles)
  const rand = rng(5), rb = [], bb = [];
  for (const v of VESSELS) {
    const curve = new THREE.CatmullRomCurve3(v.pts, false, 'centripetal');
    const n = Math.round(curve.getLength() * 2.5 * branches);
    for (let i = 0; i < n; i++) {
      const u = 0.05 + rand() * 0.9, P = curve.getPointAt(u), T = curve.getTangentAt(u), s = rand() < 0.5 ? -1 : 1;
      const d = V(-T.y * s, T.x * s).multiplyScalar(0.8).addScaledVector(T, 0.4).normalize();
      grow(rand, v.red ? rb : bb, P, d, 0.25 + rand() * 0.25, 0.012, 2);
    }
  }
  if (rb.length) group.add(new THREE.Mesh(mergeGeometries(rb), RED_MAT()));
  if (bb.length) group.add(new THREE.Mesh(mergeGeometries(bb), BLUE_MAT()));

  // flèches de sens du sang : rose (artères) et cyan (veines)
  const ra = new FlowArrows(redArrows, [1.0, 0.5, 0.55]);
  const ba = new FlowArrows(blueArrows, [0.45, 0.95, 1.0]);
  group.add(ra.mesh, ba.mesh);

  let t = 0, mixer = null, real = null;
  return {
    group, heart,
    // Remplace le cœur généré par un vrai modèle .glb (ex. /assets/models/heart.glb).
    // height : hauteur du cœur dans la scène · rotation : [rx, ry, rz] en radians · position : décalage local
    async loadRealHeart(url, { height = 1.7, rotation = [0, 0, 0], position = [0, 0, 0] } = {}) {
      const loader = new GLTFLoader().setDRACOLoader(new DRACOLoader().setDecoderPath(`${import.meta.env.BASE_URL}draco/`));
      const gltf = await loader.loadAsync(url);
      const model = gltf.scene, wrap = new THREE.Group();
      model.rotation.set(...rotation); wrap.add(model);
      const box = new THREE.Box3().setFromObject(wrap);
      model.scale.setScalar(height / Math.max(box.getSize(new THREE.Vector3()).y, 1e-4));   // mise à l'échelle automatique
      box.setFromObject(wrap); model.position.sub(box.getCenter(new THREE.Vector3()));       // recentrage sur l'origine
      wrap.position.set(...position);
      wrap.traverse((o) => { if (o.isMesh) { o.renderOrder = 3; o.frustumCulled = false; } });
      heart.remove(inner); inner.traverse((o) => { o.geometry?.dispose(); });
      heart.add(wrap); real = wrap;
      if (gltf.animations.length) { mixer = new THREE.AnimationMixer(model); gltf.animations.forEach((a) => mixer.clipAction(a).play()); }
      return { hasAnimation: !!mixer };
    },
    update(dt) {
      t += dt;
      ra.update(dt); ba.update(dt);
      if (mixer) mixer.update(dt);                                   // animation fournie par le modèle
      else heart.scale.setScalar(1 + 0.05 * beatJS(t));              // sinon battement par shader/JS
    },
  };
}
