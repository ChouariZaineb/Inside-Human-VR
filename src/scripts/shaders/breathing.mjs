// breathing.mjs – respiration des poumons en TSL (compilé en WGSL par Three.js).
// Contrat utilisé par les autres modules :
//   breath               -> uniform 0..1 (0 = poumons vidés, 1 = poumons gonflés), mis à jour par updateBreath()
//   breathRate           -> uniform (cycles par minute), modifiable : breathRate.value = 20
//   breathJS(t, rate)    -> même courbe côté JS (0..1), pour synchroniser le son ou d'autres objets
//   updateBreath(t)      -> à appeler à chaque image avec le temps écoulé (s) : écrit `breath`
//   lungMaterial(opts)   -> matériau du poumon : la surface se gonfle et s'éclaircit à l'inspiration
//   bronchiMaterial()    -> matériau de l'arbre bronchique (suit légèrement la respiration)
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { uniform, positionLocal, normalLocal, normalView, positionViewDirection, mix, vec3, float, mx_noise_float, time } from 'three/tsl';

export const breathRate = uniform(15); // cycles par minute (adulte au repos : 12 à 16)
export const breath = uniform(0);

const smooth = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };

/**
 * Courbe de respiration : inspiration (40 % du cycle) puis expiration plus lente (60 %).
 * @param {number} t temps en secondes
 * @param {number} rate cycles par minute
 * @returns {number} 0..1
 */
export function breathJS(t, rate = breathRate.value) {
  const p = (t * rate / 60) % 1;
  return p < 0.4 ? smooth(p / 0.4) : 1 - smooth((p - 0.4) / 0.6);
}

/** À appeler à chaque image : écrit la valeur de la respiration dans l'uniform partagé. */
export function updateBreath(t) {
  breath.value = breathJS(t);
  return breath.value;
}

const fresnel = (p = 2.0) => float(1).sub(normalView.dot(positionViewDirection).abs()).pow(p);

/**
 * Matériau d'un poumon.
 * À l'inspiration : la surface s'écarte le long de sa normale, s'étire vers le bas (le diaphragme descend)
 * et la couleur s'éclaircit légèrement (plus d'air).
 * @param {{ color?: number[], bloodTint?: number }} opts
 */
export function lungMaterial({ color = [0.86, 0.5, 0.52], bloodTint = 0.0 } = {}) {
  const m = new MeshStandardNodeMaterial({ roughness: 0.55, metalness: 0.0 });
  const swell = normalLocal.mul(breath.mul(0.07));                  // gonflement
  const drop = vec3(0, positionLocal.y.mul(breath).mul(0.05), 0);   // étirement vertical
  m.positionNode = positionLocal.add(swell).add(drop);

  // Texture du tissu (lobules) : bruit à deux échelles, très léger.
  const lob = mx_noise_float(positionLocal.mul(7.0)).mul(0.5).add(0.5);
  const fine = mx_noise_float(positionLocal.mul(22.0).add(time.mul(0.02))).mul(0.5).add(0.5);
  const base = vec3(...color);
  const air = vec3(1.0, 0.8, 0.8);
  const tissue = mix(base.mul(0.78), base, lob.mul(0.7).add(fine.mul(0.3)));
  m.colorNode = mix(tissue, air.mul(tissue), breath.mul(0.35)).add(vec3(0.0, 0.0, bloodTint));
  m.emissiveNode = vec3(0.35, 0.1, 0.12).mul(fresnel(2.5).mul(0.6).add(breath.mul(0.08)));
  return m;
}

/** Arbre bronchique : blanc rosé, suit la respiration de façon discrète. */
export function bronchiMaterial() {
  const m = new MeshStandardNodeMaterial({ roughness: 0.45, metalness: 0.0 });
  m.positionNode = positionLocal.add(normalLocal.mul(breath.mul(0.012)));
  m.colorNode = mix(vec3(0.93, 0.74, 0.74), vec3(0.98, 0.88, 0.86), breath);
  m.emissiveNode = vec3(0.2, 0.08, 0.08).mul(fresnel(2.0));
  return m;
}
