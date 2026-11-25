// Particles.js – globules rouges en InstancedMesh : des milliers de cellules, UN seul appel de dessin.
// Usage :
//   const blood = new BloodParticles(curve, { count: 1500, radius: 0.45 });
//   scene.add(blood.mesh);
//   dans la boucle : blood.update(dt);
//   blood.dispose() à la sortie du niveau (un seul organe en mémoire).
import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { mix, attribute, vec3 } from 'three/tsl';
import { oxygen } from '../shaders/bloodFlow.mjs';
import { beatNode } from '../shaders/tissuePulse.mjs';

const FRAMES = 600;                 // échantillons précalculés le long de la courbe

// Les GLB Blender ne sont téléchargés qu'une fois. Les systèmes de particules
// gardent leurs InstancedMesh et leurs shaders ; seule la géométrie est remplacée.
const BLOOD_ASSETS = [
  ['erythrocyte', 'erythrocyte.glb'],
  ['platelet', 'platelet.glb'],
];
let bloodAssetsPromise;
let bloodAssets;

function meshGeometryFromGLB(scene) {
  scene.updateMatrixWorld(true);
  let source = null;
  scene.traverse((node) => { if (!source && node.isMesh) source = node; });
  if (!source) throw new Error('Le fichier GLB ne contient aucun maillage');
  const geometry = source.geometry.clone();
  geometry.applyMatrix4(source.matrixWorld);
  geometry.computeBoundingBox();
  const center = geometry.boundingBox.getCenter(new THREE.Vector3());
  geometry.translate(-center.x, -center.y, -center.z);
  geometry.computeVertexNormals();
  return geometry;
}

/** Précharge les géométries Blender, sans empêcher la scène de fonctionner en cas d'échec. */
export function preloadBloodModels() {
  if (bloodAssetsPromise) return bloodAssetsPromise;
  const loader = new GLTFLoader();
  bloodAssetsPromise = Promise.all(BLOOD_ASSETS.map(async ([key, file]) => {
    try {
      const model = await loader.loadAsync(`${import.meta.env.BASE_URL}assets/models/${file}`);
      return [key, meshGeometryFromGLB(model.scene)];
    } catch (error) {
      console.warn(`[Sang] Modèle Blender indisponible : ${file}; géométrie de secours conservée.`, error);
      return [key, null];
    }
  })).then((assets) => {
    bloodAssets = Object.fromEntries(assets);
    return bloodAssets;
  });
  return bloodAssetsPromise;
}

// Disque biconcave : creux central des deux côtés, bord périphérique plus épais.
// Le sang désoxygéné reste ROUGE foncé (le bleu du schéma correspond à un code pédagogique).
const RED_CELL_LOW_O2 = vec3(0.35, 0.018, 0.025);
const RED_CELL_HIGH_O2 = vec3(0.82, 0.045, 0.065);

export function redCellGeometry(size) {
  // Profil du centre vers le bord : centre fin, bord plus épais, fermeture sur l'équateur.
  const profile = [
    [0.001, 0.16], [0.18, 0.18], [0.40, 0.26],
    [0.65, 0.38], [0.82, 0.39], [0.96, 0.26], [1, 0],
  ];
  const top = profile.map(([r, y]) => new THREE.Vector2(r * size, y * size));
  const bottom = profile.slice(0, -1).reverse().map(([r, y]) => new THREE.Vector2(r * size, -y * size));
  return new THREE.LatheGeometry([...top, ...bottom], 24);
}

export function plateletGeometry(size) {
  // Fragment plaquettaire irrégulier, nettement plus petit qu'un globule rouge.
  const geo = new THREE.IcosahedronGeometry(size, 1);
  const points = geo.getAttribute('position');
  for (let i = 0; i < points.count; i++) {
    const x = points.getX(i), y = points.getY(i), z = points.getZ(i);
    const irregularity = 1 + 0.13 * Math.sin(13 * x / size + 5 * z / size);
    points.setXYZ(i, x * irregularity, y * 0.32, z * irregularity);
  }
  geo.computeVertexNormals();
  return geo;
}

export class BloodParticles {
  /**
   * @param {THREE.Curve<THREE.Vector3>} curve  axe du vaisseau
   * @param {{count?:number, radius?:number, speed?:number, worldSpeed?:number, cellSize?:number, profile?:object, plateletRatio?:number}} opts
   *   radius = rayon intérieur du vaisseau ; speed = fraction du vaisseau parcourue par seconde au centre ;
   *   worldSpeed = vitesse en unités de la scène par seconde (prioritaire sur speed) ;
   *   profile = makeProfile(...) : couleur du globule (bleu/rouge) selon sa position dans le vaisseau
   */
  constructor(curve, { count = 1500, radius = 0.5, speed = 0.05, worldSpeed = 0, cellSize = 0.07, profile = null, plateletRatio = 0.06 } = {}) {
    this.curve = curve;
    this.count = count;
    this.speed = worldSpeed ? worldSpeed / curve.getLength() : speed;
    this.profile = profile;
    this.closed = !!curve.closed;

    this.points = curve.getSpacedPoints(FRAMES);
    const f = curve.computeFrenetFrames(FRAMES, this.closed);
    this.tangents = f.tangents; this.normals = f.normals; this.binormals = f.binormals;

    const mat = new MeshStandardNodeMaterial({ roughness: 0.4, metalness: 0.0 });
    const geo = redCellGeometry(cellSize);
    this.ox = new Float32Array(count).fill(1);
    geo.setAttribute('aOx', new THREE.InstancedBufferAttribute(this.ox, 1));
    const base = mix(RED_CELL_LOW_O2, RED_CELL_HIGH_O2, profile ? attribute('aOx', 'float') : oxygen);
    mat.colorNode = base;
    mat.emissiveNode = base.mul(beatNode.mul(0.25).add(0.12));

    this.mesh = new THREE.InstancedMesh(geo, mat, count);
    this.mesh.frustumCulled = false;
    this.mesh.name = 'globules-rouges';
    this.mesh.userData.modelSource = 'procedural';

    // Les plaquettes sont environ 20 fois moins nombreuses et ~3 fois plus petites.
    // Un second InstancedMesh conserve un faible coût de rendu GPU.
    this.plateletCount = Math.max(0, Math.round(count * Math.max(0, plateletRatio)));
    this.plateletMesh = new THREE.InstancedMesh(
      plateletGeometry(cellSize * 0.36),
      new THREE.MeshStandardMaterial({ color: 0xa58bb9, roughness: 0.8, metalness: 0 }),
      this.plateletCount,
    );
    this.plateletMesh.frustumCulled = false;
    this.plateletMesh.name = 'plaquettes-sanguines';
    this.plateletMesh.userData.modelSource = 'procedural';

    // Une géométrie locale par système, afin de pouvoir disposer chaque InstancedMesh.
    // Le modèle Blender du globule a un rayon ~1 ; celui de la plaquette ~0,32.
    this._disposed = false;
    this.cellSize = cellSize;
    if (bloodAssets) this._applyBloodModels(bloodAssets);
    else preloadBloodModels().then((assets) => {
      if (!this._disposed) this._applyBloodModels(assets);
    });

    // État par globule : position le long du vaisseau, décalage radial, vitesse, rotation propre.
    this.u = new Float32Array(count);
    this.ang = new Float32Array(count);
    this.rad = new Float32Array(count);      // 0..1 (fraction du rayon utile)
    this.spin = new Float32Array(count);
    this.tilt = new Float32Array(count);
    this.plateletU = new Float32Array(this.plateletCount);
    this.plateletAng = new Float32Array(this.plateletCount);
    this.plateletRad = new Float32Array(this.plateletCount);
    this.maxR = radius * 0.8;
    for (let i = 0; i < count; i++) {
      this.u[i] = Math.random();
      this.ang[i] = Math.random() * Math.PI * 2;
      this.rad[i] = Math.sqrt(Math.random());
      this.spin[i] = (Math.random() - 0.5) * 4;
      this.tilt[i] = Math.random() * Math.PI;
    }
    for (let i = 0; i < this.plateletCount; i++) {
      this.plateletU[i] = Math.random();
      this.plateletAng[i] = Math.random() * Math.PI * 2;
      this.plateletRad[i] = Math.sqrt(Math.random());
    }
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._q2 = new THREE.Quaternion();
    this._p = new THREE.Vector3(); this._s = new THREE.Vector3(1, 1, 1); this._e = new THREE.Euler();
    this._up = new THREE.Vector3(0, 1, 0);
    this.t = 0;
    this.update(0);
  }

  /** @param {number} dt secondes écoulées depuis l'image précédente */
  update(dt) {
    this.t += dt;
    const n = FRAMES;
    for (let i = 0; i < this.count; i++) {
      // Profil de Poiseuille : plus rapide au centre qu'près de la paroi.
      const v = this.speed * (1.15 - this.rad[i] * this.rad[i]);
      let u = this.u[i] + v * dt;
      if (u >= 1) u -= 1;
      this.u[i] = u;
      if (this.profile) this.ox[i] = this.profile.at(u);

      const k = Math.min(n - 1, Math.floor(u * n));
      const P = this.points[k], T = this.tangents[k], N = this.normals[k], B = this.binormals[k];
      const r = this.rad[i] * this.maxR, a = this.ang[i];
      this._p.set(
        P.x + (N.x * Math.cos(a) + B.x * Math.sin(a)) * r,
        P.y + (N.y * Math.cos(a) + B.y * Math.sin(a)) * r,
        P.z + (N.z * Math.cos(a) + B.z * Math.sin(a)) * r,
      );
      this._q.setFromUnitVectors(this._up, T);                      // axe du disque aligné sur le flux
      this._e.set(this.tilt[i] * 0.6, this.t * this.spin[i], 0);    // petit basculement + rotation
      this._q.multiply(this._q2.setFromEuler(this._e));
      this._m.compose(this._p, this._q, this._s);
      this.mesh.setMatrixAt(i, this._m);
    }
    // Plaquettes dispersées dans le même vaisseau, sans modifier le gameplay.
    for (let i = 0; i < this.plateletCount; i++) {
      let u = this.plateletU[i] + this.speed * 0.8 * dt;
      u = ((u % 1) + 1) % 1;
      this.plateletU[i] = u;
      const k = Math.min(n - 1, Math.floor(u * n));
      const P = this.points[k], T = this.tangents[k], N = this.normals[k], B = this.binormals[k];
      const r = this.plateletRad[i] * this.maxR, a = this.plateletAng[i];
      this._p.set(
        P.x + (N.x * Math.cos(a) + B.x * Math.sin(a)) * r,
        P.y + (N.y * Math.cos(a) + B.y * Math.sin(a)) * r,
        P.z + (N.z * Math.cos(a) + B.z * Math.sin(a)) * r,
      );
      this._q.setFromUnitVectors(this._up, T);
      this._q.multiply(this._q2.setFromEuler(this._e.set(0, this.t * 0.5 + i, 0)));
      this._m.compose(this._p, this._q, this._s);
      this.plateletMesh.setMatrixAt(i, this._m);
    }
    this.plateletMesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.profile) this.mesh.geometry.getAttribute('aOx').needsUpdate = true;
  }

  _applyBloodModels(assets) {
    if (assets.erythrocyte && this.mesh.userData.modelSource !== 'blender-glb') {
      const geometry = assets.erythrocyte.clone();
      geometry.scale(this.cellSize, this.cellSize, this.cellSize);
      // Conserver le niveau d'oxygénation individuel du shader WebGPU existant.
      geometry.setAttribute('aOx', new THREE.InstancedBufferAttribute(this.ox, 1));
      const previous = this.mesh.geometry;
      this.mesh.geometry = geometry;
      previous.dispose();
      this.mesh.userData.modelSource = 'blender-glb';
    }
    if (assets.platelet && this.plateletMesh.userData.modelSource !== 'blender-glb') {
      const geometry = assets.platelet.clone();
      const scale = this.cellSize * (0.36 / 0.32);
      geometry.scale(scale, scale, scale);
      const previous = this.plateletMesh.geometry;
      this.plateletMesh.geometry = geometry;
      previous.dispose();
      this.plateletMesh.userData.modelSource = 'blender-glb';
    }
  }

  dispose() {
    this._disposed = true;
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.mesh.dispose();
    this.plateletMesh.geometry.dispose();
    this.plateletMesh.material.dispose();
    this.plateletMesh.dispose();
  }
}
