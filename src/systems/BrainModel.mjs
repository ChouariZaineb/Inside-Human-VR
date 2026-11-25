// BrainModel.js – cerveau et réseau de neurones générés par code.
//   createBrain()                    -> cerveau (deux hémisphères à circonvolutions, cervelet, tronc cérébral)
//   createNeuronNetwork(points, opts)-> chaîne de neurones : corps cellulaires, dendrites, axones, impulsion lumineuse
// L'impulsion nerveuse est calculée par le shader neuronSignal.js (TSL).
// Usage :
//   const net = createNeuronNetwork([[-1.1, 0, 0], [0, 0.5, 0], [1.1, 0, 0]]);
//   scene.add(net.group);
//   net.fire(() => console.log('le muscle reçoit le message'));
//   boucle : net.update(dt);
import * as THREE from 'three/webgpu';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { positionLocal, normalLocal, normalView, positionViewDirection, mix, vec3, float, abs, sin, mx_noise_float } from 'three/tsl';
import { axonMaterial, somaMaterial, SignalChain } from '../shaders/neuronSignal.mjs';

const V = (x, y, z = 0) => new THREE.Vector3(x, y, z);
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const fresnel = (p = 2.0) => float(1).sub(normalView.dot(positionViewDirection).abs()).pow(p);

/** Surface du cortex : bruit « en crête » → circonvolutions (gyri) et sillons sombres. */
function cortexMaterial({ opacity = 1 } = {}) {
  const m = new MeshStandardNodeMaterial({ roughness: 0.62, metalness: 0.0 });
  const p = positionLocal.mul(4.2);
  const ridge = float(1).sub(abs(mx_noise_float(p)));                        // 1 sur les crêtes, 0 dans les sillons
  const ridge2 = float(1).sub(abs(mx_noise_float(p.mul(2.1).add(vec3(3.1, 1.7, 5.3)))));
  const relief = ridge.pow(2.2).mul(0.7).add(ridge2.pow(2.0).mul(0.3));
  m.positionNode = positionLocal.add(normalLocal.mul(relief.mul(0.07).sub(0.035)));
  m.colorNode = mix(vec3(0.5, 0.26, 0.3), vec3(0.93, 0.66, 0.66), relief);   // sillons rosés sombres, crêtes claires
  m.emissiveNode = vec3(0.25, 0.1, 0.16).mul(fresnel(2.2).mul(0.7));
  if (opacity < 1) { m.transparent = true; m.opacity = opacity; m.depthWrite = false; }
  return m;
}

/** Cervelet : fines stries horizontales (« folia »). */
function cerebellumMaterial() {
  const m = new MeshStandardNodeMaterial({ roughness: 0.6 });
  const stripes = sin(positionLocal.y.mul(70.0).add(mx_noise_float(positionLocal.mul(3.0)).mul(2.0))).mul(0.5).add(0.5);
  m.colorNode = mix(vec3(0.58, 0.32, 0.34), vec3(0.88, 0.62, 0.6), stripes);
  m.emissiveNode = vec3(0.2, 0.08, 0.1).mul(fresnel(2.2));
  return m;
}

/**
 * Cerveau : ~2 unités de large. Orienté face à +z, haut = +y.
 * @param {{ glass?: boolean }} opts glass = cortex translucide pour voir un réseau de neurones à l'intérieur
 * @returns {{ group: THREE.Group, update: (dt:number)=>void, dispose: ()=>void }}
 */
export function createBrain({ glass = false } = {}) {
  const group = new THREE.Group();
  group.name = 'cerveau';
  const opacity = glass ? 0.42 : 1;

  for (const side of [-1, 1]) {                                              // deux hémisphères
    const g = new THREE.IcosahedronGeometry(1, 5);
    const hemi = new THREE.Mesh(g, cortexMaterial({ opacity }));
    hemi.scale.set(0.5, 0.7, 0.92);
    hemi.position.set(side * 0.52, 0.12, 0);
    hemi.name = side > 0 ? 'hémisphère-gauche' : 'hémisphère-droit';
    hemi.renderOrder = 2;
    group.add(hemi);
  }

  const cerebellum = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 4), cerebellumMaterial());
  cerebellum.scale.set(0.62, 0.3, 0.42);
  cerebellum.position.set(0, -0.42, -0.62);
  cerebellum.name = 'cervelet';
  group.add(cerebellum);

  const stem = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.14, 0.62, 8, 20),
    new MeshStandardNodeMaterial({ roughness: 0.55, color: 0xe8b8a8 }),
  );
  stem.position.set(0, -0.62, -0.18);
  stem.rotation.x = -0.35;
  stem.name = 'tronc-cérébral';
  group.add(stem);

  return {
    group,
    update() {},
    dispose() {
      group.traverse((o) => { o.geometry?.dispose(); for (const m of [].concat(o.material ?? [])) m.dispose(); });
      group.removeFromParent();
    },
  };
}

/** Dendrites : petites branches qui partent du corps du neurone. */
function dendrites(rand, radius) {
  const parts = [];
  const branch = (p, d, len, r, depth) => {
    if (depth <= 0) return;
    const end = p.clone().addScaledVector(d, len);
    const mid = p.clone().lerp(end, 0.5).add(V((rand() - 0.5) * len * 0.35, (rand() - 0.5) * len * 0.35, (rand() - 0.5) * len * 0.35));
    const c = new THREE.CatmullRomCurve3([p, mid, end], false, 'centripetal');
    parts.push(new THREE.TubeGeometry(c, 8, r, 6, false));
    for (let k = 0; k < 2; k++) {
      const nd = d.clone().add(V((rand() - 0.5) * 1.4, (rand() - 0.5) * 1.4, (rand() - 0.5) * 1.4)).normalize();
      branch(end, nd, len * 0.62, r * 0.65, depth - 1);
    }
  };
  const n = 6 + Math.floor(rand() * 3);
  for (let i = 0; i < n; i++) {
    const d = V(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize();
    branch(d.clone().multiplyScalar(radius * 0.85), d, radius * 2.6, radius * 0.16, 3);
  }
  return mergeGeometries(parts);
}

/**
 * Chaîne de neurones reliés par des axones ; une impulsion lumineuse les traverse de l'un à l'autre.
 * @param {number[][]} points positions [x, y, z] des corps cellulaires, dans l'ordre de passage du message
 * @param {{ seed?: number, somaRadius?: number, speed?: number, colors?: number[][] }} opts
 * @returns {{ group, somas: THREE.Mesh[], axons: THREE.Mesh[], chain: SignalChain, fire, update, dispose }}
 */
export function createNeuronNetwork(points, { seed = 3, somaRadius = 0.14, speed = 1.1, colors = null } = {}) {
  const rand = rng(seed);
  const group = new THREE.Group();
  group.name = 'neurones';
  const palette = colors ?? [[0.3, 0.6, 1.0], [0.73, 0.49, 1.0], [0.22, 0.85, 0.7], [1.0, 0.7, 0.4]];
  const pts = points.map((p) => V(...p));

  const somaMats = [], axonMats = [], somas = [], axons = [];
  pts.forEach((p, i) => {
    const mat = somaMaterial({ color: palette[i % palette.length] });
    const soma = new THREE.Mesh(new THREE.SphereGeometry(somaRadius, 28, 20), mat);
    soma.position.copy(p);
    soma.name = `neurone-${i}`;
    const den = new THREE.Mesh(dendrites(rand, somaRadius), mat);            // même matériau : s'allume avec le corps
    den.position.copy(p);
    group.add(soma, den);
    somaMats.push(mat); somas.push(soma);
  });

  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const dir = b.clone().sub(a);
    const side = V(-dir.y, dir.x, 0).normalize().multiplyScalar(dir.length() * 0.12);
    const mid = a.clone().lerp(b, 0.5).add(side).add(V(0, 0, (rand() - 0.5) * 0.2));
    const from = a.clone().addScaledVector(dir.clone().normalize(), somaRadius * 0.9);
    const to = b.clone().addScaledVector(dir.clone().normalize(), -somaRadius * 0.9);
    const curve = new THREE.CatmullRomCurve3([from, mid, to], false, 'centripetal');
    const mat = axonMaterial({ color: palette[i % palette.length] });
    const axon = new THREE.Mesh(new THREE.TubeGeometry(curve, 64, somaRadius * 0.2, 10, false), mat);
    axon.name = `axone-${i}`;
    group.add(axon);
    axonMats.push(mat); axons.push(axon);
  }

  const chain = new SignalChain({ axons: axonMats, somas: somaMats, speed });
  return {
    group, somas, axons, chain,
    /** Envoie une impulsion ; `onArrive` est appelé quand elle atteint le dernier neurone. */
    fire: (onArrive) => chain.fire(onArrive),
    update: (dt) => chain.update(dt),
    dispose() {
      group.traverse((o) => { o.geometry?.dispose(); for (const m of [].concat(o.material ?? [])) m.dispose(); });
      group.removeFromParent();
    },
  };
}
