// Particles.js – globules rouges en InstancedMesh : des milliers de cellules, UN seul appel de dessin.
// Usage :
//   const blood = new BloodParticles(curve, { count: 1500, radius: 0.45 });
//   scene.add(blood.mesh);
//   dans la boucle : blood.update(dt);
//   blood.dispose() à la sortie du niveau (un seul organe en mémoire).
import * as THREE from 'three/webgpu';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { mix, attribute } from 'three/tsl';
import { oxygen, BLOOD_BLUE, BLOOD_RED } from '../shaders/bloodFlow.js';
import { beatNode } from '../shaders/tissuePulse.js';

const FRAMES = 600;                 // échantillons précalculés le long de la courbe

// Disque biconcave (forme d'un globule rouge) par révolution.
function cellGeometry(size) {
  const prof = [[0, 0.30], [0.25, 0.36], [0.5, 0.48], [0.75, 0.50], [0.92, 0.32], [1, 0]]
    .map(([r, h]) => new THREE.Vector2(r * size, h * size * 0.55));
  const pts = [...prof.map((p) => new THREE.Vector2(p.x, p.y)), ...prof.reverse().map((p) => new THREE.Vector2(p.x, -p.y))];
  pts[0].x = Math.max(pts[0].x, 0.0001);
  return new THREE.LatheGeometry(pts, 16);
}

export class BloodParticles {
  /**
   * @param {THREE.Curve<THREE.Vector3>} curve  axe du vaisseau
   * @param {{count?:number, radius?:number, speed?:number, worldSpeed?:number, cellSize?:number, profile?:object}} opts
   *   radius = rayon intérieur du vaisseau ; speed = fraction du vaisseau parcourue par seconde au centre ;
   *   worldSpeed = vitesse en unités de la scène par seconde (prioritaire sur speed) ;
   *   profile = makeProfile(...) : couleur du globule (bleu/rouge) selon sa position dans le vaisseau
   */
  constructor(curve, { count = 1500, radius = 0.5, speed = 0.05, worldSpeed = 0, cellSize = 0.07, profile = null } = {}) {
    this.curve = curve;
    this.count = count;
    this.speed = worldSpeed ? worldSpeed / curve.getLength() : speed;
    this.profile = profile;
    this.closed = !!curve.closed;

    this.points = curve.getSpacedPoints(FRAMES);
    const f = curve.computeFrenetFrames(FRAMES, this.closed);
    this.tangents = f.tangents; this.normals = f.normals; this.binormals = f.binormals;

    const mat = new MeshStandardNodeMaterial({ roughness: 0.4, metalness: 0.0 });
    const geo = cellGeometry(cellSize);
    this.ox = new Float32Array(count).fill(1);
    geo.setAttribute('aOx', new THREE.InstancedBufferAttribute(this.ox, 1));
    const base = mix(BLOOD_BLUE, BLOOD_RED, profile ? attribute('aOx', 'float') : oxygen);
    mat.colorNode = base;
    mat.emissiveNode = base.mul(beatNode.mul(0.25).add(0.12));

    this.mesh = new THREE.InstancedMesh(geo, mat, count);
    this.mesh.frustumCulled = false;

    // État par globule : position le long du vaisseau, décalage radial, vitesse, rotation propre.
    this.u = new Float32Array(count);
    this.ang = new Float32Array(count);
    this.rad = new Float32Array(count);      // 0..1 (fraction du rayon utile)
    this.spin = new Float32Array(count);
    this.tilt = new Float32Array(count);
    this.maxR = radius * 0.8;
    for (let i = 0; i < count; i++) {
      this.u[i] = Math.random();
      this.ang[i] = Math.random() * Math.PI * 2;
      this.rad[i] = Math.sqrt(Math.random());
      this.spin[i] = (Math.random() - 0.5) * 4;
      this.tilt[i] = Math.random() * Math.PI;
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
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.profile) this.mesh.geometry.getAttribute('aOx').needsUpdate = true;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.mesh.dispose();
  }
}
