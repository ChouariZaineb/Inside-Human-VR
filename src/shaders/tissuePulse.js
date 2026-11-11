// tissuePulse.js – battement du cœur en TSL (compilé en WGSL par Three.js).
// Contrat utilisé par les autres modules :
//   heartbeatMaterial()  -> matériau à appliquer aux meshes du cœur
//   heartRate            -> uniform (battements/minute), modifiable : heartRate.value = 90
//   beatNode             -> nœud TSL 0..1 du battement, réutilisable par d'autres shaders
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { time, uniform, fract, exp, positionLocal, normalLocal, vec3, mix, float, mx_noise_float } from 'three/tsl';

export const heartRate = uniform(72); // battements par minute

// Bosse gaussienne centrée sur `center` dans la phase 0..1 du cycle.
const bump = (phase, center, width) => {
  const d = phase.sub(center).div(width);
  return exp(d.mul(d).negate());
};

// « Lub-dub » : une contraction forte puis une plus faible, par cycle.
export const beatNode = (() => {
  const phase = fract(time.mul(heartRate.div(60)));
  return bump(phase, 0.08, 0.05).add(bump(phase, 0.32, 0.06).mul(0.6));
})();

/** Matériau du cœur : gonflement synchronisé, rougeur et lueur au battement. */
export function heartbeatMaterial() {
  const m = new MeshStandardNodeMaterial({ roughness: 0.5, metalness: 0.0 });
  const tissue = mx_noise_float(positionLocal.mul(4.0).add(time.mul(0.15))).mul(0.5).add(0.5); // texture du muscle
  const swell = normalLocal.mul(beatNode.mul(0.07));
  m.positionNode = positionLocal.add(swell);
  m.colorNode = mix(vec3(0.38, 0.03, 0.05), vec3(0.78, 0.09, 0.10), tissue.mul(0.6).add(beatNode.mul(0.4)));
  m.emissiveNode = vec3(0.55, 0.02, 0.03).mul(beatNode.mul(float(0.6)));
  return m;
}

/** Même battement « lub-dub » côté JS (0..1), pour animer un modèle chargé depuis un .glb. */
export function beatJS(t, bpm = heartRate.value) {
  const ph = (t * bpm / 60) % 1;
  const g = (c, w) => Math.exp(-(((ph - c) / w) ** 2));
  return g(0.08, 0.05) + 0.6 * g(0.32, 0.06);
}
