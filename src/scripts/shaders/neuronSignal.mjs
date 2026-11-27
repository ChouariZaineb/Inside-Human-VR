// neuronSignal.mjs – influx nerveux en TSL : une impulsion lumineuse voyage le long des neurones.
// Contrat :
//   axonMaterial(opts)       -> matériau pour un axone (TubeGeometry : uv.x = longueur 0..1).
//                               material.userData.progress = uniform : position de la tête de l'impulsion
//                               (< 0 : éteint, 0..1 : sur l'axone, > 1 : l'impulsion est passée)
//   somaMaterial(opts)       -> matériau pour le corps du neurone ; material.userData.activation = uniform 0..1
//   new SignalChain({ axons, somas, speed })
//        .fire(onArrive)     -> lance une impulsion sur toute la chaîne (neurone 0 → axone 0 → neurone 1 → …)
//        .update(dt)         -> à appeler à chaque image
//        .reset()            -> éteint tout
//   neuronGlow               -> uniform 0..1 (intensité globale de la lueur), pour les effets de réussite
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { uv, uniform, time, vec3, float, mix, exp, step, mx_noise_float, normalView, positionViewDirection } from 'three/tsl';

export const neuronGlow = uniform(1);

const fresnel = (p = 2.0) => float(1).sub(normalView.dot(positionViewDirection).abs()).pow(p);

/**
 * Axone : fibre sombre, traversée par une impulsion lumineuse.
 * L'impulsion a un front net à l'avant et une traînée qui s'estompe derrière.
 * @param {{ color?: number[], glow?: number[] }} opts couleurs RGB 0..1
 */
export function axonMaterial({ color = [0.22, 0.42, 0.9], glow = [1.0, 0.92, 0.45] } = {}) {
  const m = new MeshStandardNodeMaterial({ roughness: 0.4, metalness: 0.0, transparent: true });
  const progress = uniform(-1);
  const d = progress.sub(uv().x);                       // > 0 : derrière la tête de l'impulsion
  const trail = exp(d.mul(-7.0));                        // traînée
  const front = exp(d.mul(45.0));                        // front très net devant
  const pulse = mix(front, trail, step(0, d));           // 1 à la tête, 0 ailleurs
  const base = vec3(...color);
  const flicker = mx_noise_float(vec3(uv().x.mul(18.0), time.mul(1.2), 0)).mul(0.5).add(0.5);
  m.colorNode = base.mul(mix(float(0.5), float(0.9), flicker));
  m.emissiveNode = base.mul(0.18).add(vec3(...glow).mul(pulse.mul(2.2))).mul(neuronGlow);
  m.opacityNode = float(0.7).add(pulse.mul(0.3));
  m.userData.progress = progress;
  return m;
}

/** Corps du neurone : s'allume quand l'impulsion y arrive. */
export function somaMaterial({ color = [0.35, 0.6, 1.0], glow = [1.0, 0.9, 0.5] } = {}) {
  const m = new MeshStandardNodeMaterial({ roughness: 0.35, metalness: 0.0 });
  const activation = uniform(0);
  const base = vec3(...color);
  const shimmer = mx_noise_float(vec3(time.mul(0.6), 1.0, 2.0)).mul(0.5).add(0.5);
  m.colorNode = mix(base.mul(0.6), base, activation);
  m.emissiveNode = base.mul(shimmer.mul(0.12).add(fresnel(2.0).mul(0.35)))
    .add(vec3(...glow).mul(activation.mul(1.6))).mul(neuronGlow);
  m.userData.activation = activation;
  return m;
}

/**
 * Pilote une impulsion qui traverse une chaîne : neurone 0 → axone 0 → neurone 1 → axone 1 → …
 * `axons` : matériaux issus de axonMaterial() ; `somas` : matériaux issus de somaMaterial()
 * (il y a un neurone de plus que d'axones).
 */
export class SignalChain {
  /** @param {{ axons: any[], somas: any[], speed?: number }} opts speed = axones parcourus par seconde */
  constructor({ axons, somas, speed = 1.1 }) {
    this.axons = axons;
    this.somas = somas;
    this.speed = speed;
    this.s = 0;
    this.running = false;
    this._done = null;
    this.reset();
  }

  /** Lance l'impulsion ; `onArrive` est appelé quand elle atteint le dernier neurone. */
  fire(onArrive = null) {
    this.s = -0.25;
    this.running = true;
    this._arrived = false;
    this._done = onArrive;
  }

  reset() {
    this.running = false;
    this.s = 0;
    this._arrived = false;
    this.axons.forEach((m) => { m.userData.progress.value = -1; });
    this.somas.forEach((m) => { m.userData.activation.value = 0; });
  }

  update(dt) {
    if (!this.running) return;
    this.s += dt * this.speed;
    const n = this.axons.length;
    this.axons.forEach((m, i) => { m.userData.progress.value = this.s - i; });
    this.somas.forEach((m, j) => {
      const k = this.s - j;
      m.userData.activation.value = Math.exp(-k * k * 5);           // s'allume à l'arrivée, puis s'estompe
    });
    if (!this._arrived && this.s >= n) {                            // l'impulsion atteint le dernier neurone
      this._arrived = true;
      const cb = this._done;
      this._done = null;
      cb?.();
    }
    if (this.s >= n + 1.6) this.reset();                            // tout s'est éteint
  }
}
