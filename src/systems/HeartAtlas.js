// HeartAtlas.js – scènes « Le cœur et la circulation » dans le style de la vidéo pédagogique :
//   mode 'anatomie' : torse translucide, cœur réaliste (heart.glb) + gros vaisseaux + arbres pulmonaires, axe du cœur
//   mode 'schema'   : poumons roses, cœur en blocs, tubes rouge/bleu avec sang qui circule
// Usage : const atlas = createHeartAtlas(); scene.add(atlas.group); atlas.setMode('anatomie'|'schema'); atlas.update(dt)
//         await atlas.loadHeart(url, { height, rotation }) pour brancher le vrai cœur.
import * as THREE from 'three/webgpu';
import { MeshStandardNodeMaterial, MeshBasicNodeMaterial } from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { vec3, float, mix, smoothstep, positionLocal, normalView, positionViewDirection, mx_noise_float } from 'three/tsl';
import { bodyGeometry } from './XrayBody.js';
import { createAnatomicalHeart } from './ProceduralHeart.js';
import { beatJS } from '../shaders/tissuePulse.js';
import { makeProfile } from '../shaders/bloodFlow.js';
import { BloodParticles } from './Particles.js';

const V = (x, y, z = 0) => new THREE.Vector3(x, y, z);
const RED = 0xe4231d, BLUE = 0x1c78ee;
const std = (color, extra = {}) => new MeshStandardNodeMaterial({ color, roughness: 0.4, metalness: 0, ...extra });
const fresnel = (p = 1.8) => float(1).sub(normalView.dot(positionViewDirection).abs()).pow(p);

function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const tube = (curve, r, mat, seg = 40) => new THREE.Mesh(new THREE.TubeGeometry(curve, seg, r, 12, false), mat);
const pathTube = (pts, r, mat) => tube(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), r, mat);

// ======================= Mode ANATOMIE =======================
function glassTorso() {
  const m = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
  const fade = smoothstep(-1.6, 0.9, positionLocal.y);              // les jambes disparaissent
  m.colorNode = mix(vec3(0.62, 0.80, 1.0), vec3(0.95, 0.98, 1.0), fresnel());
  m.opacityNode = fresnel().mul(0.5).add(0.09).mul(fade);
  const mesh = new THREE.Mesh(bodyGeometry(), m);
  mesh.renderOrder = 1;
  return mesh;
}

function placeholderHeart() {
  const geo = new THREE.SphereGeometry(1, 48, 36);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {              // forme de cœur : pointe en bas, base large en haut
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const t = y < 0 ? 1 + y * 0.55 : 1;
    x *= t; z *= t;
    p.setXYZ(i, x * 0.5, y * 0.6, z * 0.42);
  }
  geo.computeVertexNormals();
  const m = new MeshStandardNodeMaterial({ roughness: 0.55 });
  const fibres = mx_noise_float(positionLocal.mul(vec3(26, 5, 26))).mul(0.5).add(0.5); // fibres du myocarde
  m.colorNode = mix(vec3(0.86, 0.30, 0.18), vec3(1.0, 0.66, 0.46), fibres);
  return new THREE.Mesh(geo, m);
}

function branchTree(rand, root, dir, len, r, color, depth, out) {
  const mat = std(color);
  (function grow(p, d, l, rad, dep) {
    const pts = [p.clone()]; let cur = p.clone(); const dd = d.clone();
    for (let i = 0; i < 3; i++) { dd.x += (rand() - 0.5) * 0.35; dd.y += (rand() - 0.5) * 0.45; dd.normalize(); cur = cur.clone().addScaledVector(dd, l / 3); pts.push(cur); }
    out.add(pathTube(pts, rad, mat));
    if (dep > 0) for (let k = 0; k < 2; k++) {
      const a = (k ? 1 : -1) * (0.45 + rand() * 0.5);
      const nd = V(dd.x * Math.cos(a) - dd.y * Math.sin(a), dd.x * Math.sin(a) + dd.y * Math.cos(a), 0);
      grow(pts[2 + (k ? 1 : 0)] ?? pts[2], nd, l * (0.6 + rand() * 0.15), rad * 0.74, dep - 1);
    }
  })(root, dir, len, r, depth);
}

function pulmonaryTrees(group) {
  const rand = rng(11);
  // côté droit du patient (gauche de l'écran) et gauche du patient : artères bleues, veines rouges
  for (const s of [-1, 1]) {
    const hilum = V(s * 0.5, 0.32, -0.05);
    branchTree(rand, hilum, V(s * 0.9, 0.35, 0), 0.3, 0.02, BLUE, 3, group);
    branchTree(rand, hilum.clone().add(V(0, 0.1, 0)), V(s * 0.9, 0.9, 0), 0.27, 0.018, BLUE, 3, group);
    branchTree(rand, hilum.clone().add(V(0, -0.12, 0.02)), V(s * 0.9, -0.1, 0), 0.3, 0.02, RED, 3, group);
    branchTree(rand, hilum.clone().add(V(0, -0.2, 0.02)), V(s * 0.8, -0.6, 0), 0.27, 0.018, RED, 3, group);
  }
}

function greatVessels() {
  const g = new THREE.Group();
  g.add(pathTube([V(-0.05, 0.25, 0.04), V(-0.04, 0.5, 0.04), V(0.06, 0.66), V(0.2, 0.58), V(0.26, 0.36)], 0.07, std(RED)));       // aorte
  g.add(pathTube([V(-0.3, 0.62, 0), V(-0.3, 0.36, 0), V(-0.26, 0.12, 0)], 0.06, std(BLUE)));                                     // veine cave sup.
  g.add(pathTube([V(-0.55, 0.42, -0.1), V(-0.1, 0.45, -0.1), V(0.45, 0.42, -0.1)], 0.055, std(BLUE)));                            // tronc pulmonaire
  g.add(pathTube([V(-0.6, 0.12, -0.12), V(-0.2, 0.18, -0.12), V(0.4, 0.14, -0.12)], 0.05, std(RED)));                              // veines pulmonaires
  return g;
}

function axisArrow() {
  const g = new THREE.Group();
  const mat = new MeshBasicNodeMaterial({ transparent: true, opacity: 0.6 }); mat.colorNode = vec3(0.30, 0.32, 0.22);
  const len = 0.95;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, len, 16), mat); shaft.position.y = len / 2;
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 20), mat); head.position.y = len + 0.08;
  g.add(shaft, head);
  const dir = V(0.55, -0.85, 0.25).normalize();
  g.quaternion.setFromUnitVectors(V(0, 1, 0), dir);
  g.position.set(-0.45, 0.7, 0.35);
  return g;
}

// ======================= Mode SCHÉMA =======================
function lungShape(s) {
  const pts = [[2.4, 2.8], [3.6, 3.0], [4.4, 2.2], [4.5, 0.5], [4.2, -1.4], [3.7, -2.8], [3.3, -2.9], [2.9, -1.8], [2.45, -0.2], [2.3, 1.4]];
  const c = new THREE.CatmullRomCurve3(pts.map(([x, y]) => V(s * x, y)), true, 'centripetal').getPoints(80);
  return new THREE.Shape(c.map((p) => new THREE.Vector2(p.x, p.y)));
}
function schema() {
  const g = new THREE.Group();
  const tubes = [];
  const pink = new MeshStandardNodeMaterial({ color: 0xffa8f2, roughness: 0.6 });
  for (const s of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(lungShape(s), { depth: 0.35, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.08, bevelSegments: 4 }), pink);
    m.position.z = -0.9; g.add(m);
  }
  const organs = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.0, 1.1), std(0xf4f1e6, { roughness: 0.8 }));
  organs.position.set(0, -3.3, -0.2); g.add(organs);

  // cœur en blocs : droit (bleu), gauche (rouge, derrière)
  const rh = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.9, 0.8), std(0x22b4ff));
  rh.position.set(-0.35, 0.0, 0); g.add(rh);
  const tri = new THREE.Shape([new THREE.Vector2(0, 0.95), new THREE.Vector2(0, -0.95), new THREE.Vector2(1.4, -0.95)]);
  const rv = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: 0.8, bevelEnabled: false }), std(0x1676e8));
  rv.position.set(0.12, 0, -0.4); g.add(rv);
  const lv = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: 0.8, bevelEnabled: false }), std(RED));
  lv.position.set(0.12, 0, -1.2); g.add(lv);

  // circuits : [points, rayon, rouge?]
  const circuits = [
    { pts: [V(-0.35, 3.4), V(-0.35, 1.0)], r: 0.13, red: false },                                              // veine cave supérieure
    { pts: [V(0, -2.8, -0.2), V(-0.35, -2.2), V(-0.35, -1.0)], r: 0.13, red: false },                          // veine cave inférieure
    { pts: [V(0.9, 0.9), V(1.0, 1.35), V(0.4, 1.55), V(2.5, 1.55)], r: 0.13, red: false },                     // artère pulmonaire D
    { pts: [V(0.4, 1.55), V(-2.5, 1.55)], r: 0.13, red: false },                                               // artère pulmonaire G
    { pts: [V(2.5, -0.2, -0.9), V(0.9, -0.2, -0.9)], r: 0.12, red: true },                                     // veines pulmonaires
    { pts: [V(-2.5, -0.2, -0.9), V(-0.9, -0.2, -0.9)], r: 0.12, red: true },
    { pts: [V(0.9, 0.9, -1.2), V(0.9, 2.3, -1.2), V(1.2, 2.9, -1.2), V(1.6, 2.3, -1.2), V(1.6, -2.3, -1.0), V(0.4, -2.9, -0.4)], r: 0.13, red: true }, // aorte
  ];
  const blood = [];
  for (const c of circuits) {
    const curve = new THREE.CatmullRomCurve3(c.pts, false, 'centripetal');
    g.add(tube(curve, c.r, std(c.red ? RED : BLUE, { transparent: true, opacity: 0.85 }), 60));
    const b = new BloodParticles(curve, { count: Math.round(curve.getLength() * 22), radius: c.r, worldSpeed: 1.1, cellSize: c.r * 0.7, profile: makeProfile([[0, c.red ? 1 : 0]]) });
    g.add(b.mesh); blood.push(b);
  }
  return { group: g, blood, labels: [
    { text: 'Poumon droit', at: V(-3.4, -2.5, -0.5) }, { text: 'Poumon gauche', at: V(3.4, -2.5, -0.5) },
    { text: 'Organes et muscles', at: V(0, -3.9, 0.4) }, { text: 'Cœur droit', at: V(-0.35, 1.1, 0.4) }, { text: 'Cœur gauche', at: V(1.3, -1.0, -0.8) },
  ] };
}

// ======================= Assemblage =======================
export function createHeartAtlas() {
  const group = new THREE.Group();

  const anat = new THREE.Group();
  anat.add(glassTorso());
  const heartGroup = new THREE.Group();
  heartGroup.position.set(0.12, 2.2, 0.1);
  heartGroup.rotation.set(0.1, 0, -0.55);               // axe oblique : en avant, en bas, à gauche
  const placeholder = new THREE.Group();                 // cœur anatomique généré par code (remplaçable par un .glb)
  const inner = createAnatomicalHeart(); inner.scale.setScalar(0.85); placeholder.add(inner);
  const vessels = greatVessels();
  heartGroup.add(placeholder);
  const around = new THREE.Group();                      // gros vaisseaux et arbres pulmonaires : non inclinés
  around.position.copy(heartGroup.position);
  vessels.position.y = 0.2; vessels.visible = false;      // le cœur procédural a ses propres gros vaisseaux
  around.add(vessels);
  pulmonaryTrees(around);
  const arrow = axisArrow(); around.add(arrow);
  anat.add(heartGroup, around);

  const sch = schema();

  group.add(anat, sch.group);
  let mode = 'anatomie', t = 0, mixer = null, model = null;

  const api = {
    group, heartGroup, arrow, schemaLabels: sch.labels,
    get mode() { return mode; },
    setMode(m) { mode = m; anat.visible = m === 'anatomie'; sch.group.visible = m === 'schema'; },
    setAxis(v) { arrow.visible = v; },
    async loadHeart(url, { height = 0.9, rotation = [0, 0, 0] } = {}) {
      const loader = new GLTFLoader().setDRACOLoader(new DRACOLoader().setDecoderPath(`${import.meta.env.BASE_URL}draco/`));
      const gltf = await loader.loadAsync(url);
      const wrap = new THREE.Group(); model = gltf.scene; model.rotation.set(...rotation); wrap.add(model);
      const box = new THREE.Box3().setFromObject(wrap);
      model.scale.setScalar(height / Math.max(box.getSize(new THREE.Vector3()).y, 1e-4));
      box.setFromObject(wrap); model.position.sub(box.getCenter(new THREE.Vector3()));
      wrap.traverse((o) => { if (o.isMesh) o.renderOrder = 3; });
      heartGroup.remove(placeholder); heartGroup.add(wrap);
      vessels.visible = false;                         // le modèle contient déjà ses gros vaisseaux (touche V pour les afficher)
      if (gltf.animations.length) { mixer = new THREE.AnimationMixer(model); gltf.animations.forEach((a) => mixer.clipAction(a).play()); }
      else wrap.userData.pulse = true;
      api.heartModel = wrap; api.hasAnimation = !!mixer;
      return wrap;
    },
    toggleVessels() { vessels.visible = !vessels.visible; },
    update(dt) {
      t += dt;
      if (mixer) mixer.update(dt);
      const target = api.heartModel?.userData.pulse ? api.heartModel : (!api.heartModel ? placeholder : null);
      if (target) target.scale.setScalar(target === placeholder ? 1 + 0.06 * beatJS(t) : 1 + 0.06 * beatJS(t));
      if (mode === 'schema') for (const b of sch.blood) b.update(dt);
    },
  };
  api.setMode('anatomie');
  return api;
}
