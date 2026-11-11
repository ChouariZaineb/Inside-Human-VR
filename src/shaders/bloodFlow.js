// bloodFlow.js – flux du sang en TSL : paroi intérieure du vaisseau.
// Contrat :
//   vesselMaterial(opts)  -> matériau (face intérieure) à mettre sur un TubeGeometry (uv.x = longueur)
//   oxygen                -> uniform 0..1 global (0 = sang désoxygéné bleu-violet, 1 = oxygéné rouge)
//   makeProfile(stops)    -> oxygénation le long d'un vaisseau : [[u, 0..1], ...] (u = position 0..1)
//                            ex. artère rouge puis veine bleue : makeProfile([[0,1],[0.4,1],[0.6,0],[1,0]])
import { MeshStandardNodeMaterial, BackSide } from 'three/webgpu';
import { time, uv, uniform, vec3, mix, mx_noise_float, smoothstep, float } from 'three/tsl';
import { beatNode } from './tissuePulse.js';

export const oxygen = uniform(1);

export const BLOOD_RED = vec3(0.92, 0.04, 0.06);
export const BLOOD_BLUE = vec3(0.12, 0.28, 0.95);
export const bloodColor = (ox = oxygen) => mix(BLOOD_BLUE, BLOOD_RED, ox);

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Profil d'oxygénation le long d'un vaisseau, utilisable côté shader (node) et côté JS (at). */
export function makeProfile(stops) {
  return {
    at(u) {
      let v = stops[0][1];
      for (let i = 1; i < stops.length; i++) v += (stops[i][1] - v) * sstep(stops[i - 1][0], stops[i][0], u);
      return v;
    },
    node(uNode) {
      let v = float(stops[0][1]);
      for (let i = 1; i < stops.length; i++) v = mix(v, float(stops[i][1]), smoothstep(stops[i - 1][0], stops[i][0], uNode));
      return v;
    },
  };
}

/** @param {{speed?:number, repeat?:number, profile?:ReturnType<typeof makeProfile>}} opts */
export function vesselMaterial({ speed = 0.5, repeat = 60, profile = null } = {}) {
  const m = new MeshStandardNodeMaterial({ side: BackSide, roughness: 0.65, metalness: 0.0 });
  const ox = profile ? profile.node(uv().x) : oxygen;
  const col = bloodColor(ox);
  const along = uv().x.mul(repeat).sub(time.mul(speed * repeat * 0.2)); // stries qui défilent
  const around = uv().y.mul(10.0);
  const n = mx_noise_float(vec3(along, around, time.mul(0.1))).mul(0.5).add(0.5);
  m.colorNode = mix(col.mul(0.35), col.mul(0.9), n);
  m.emissiveNode = col.mul(n.mul(0.25).add(beatNode.mul(0.15)));
  return m;
}
