// ProceduralHeart.js – cœur anatomique généré par code (aucun téléchargement, aucune licence).
// Cavités (VG, VD, OG, OD + auricules), gros vaisseaux (aorte, tronc pulmonaire, veines caves et pulmonaires)
// et artères/veines coronaires collées à la surface du muscle.
// Repère local : pointe vers le bas (y -0.6), base en haut ; hauteur totale ≈ 1.4. Vue antérieure vers +z.
import * as THREE from 'three/webgpu';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { vec3, mix, positionLocal, mx_noise_float } from 'three/tsl';

const V = (x, y, z = 0) => new THREE.Vector3(x, y, z);
const RED = 0xe0201a, BLUE = 0x1f6fe8;

function muscleMaterial(low, high) {
  const m = new MeshStandardNodeMaterial({ roughness: 0.5 });
  const fibres = mx_noise_float(positionLocal.mul(vec3(22, 5, 22))).mul(0.5).add(0.5); // fibres du myocarde
  m.colorNode = mix(vec3(...low), vec3(...high), fibres);
  return m;
}
const PALETTES = {
  atlas: { v: [[0.78, 0.22, 0.10], [0.98, 0.54, 0.30]], a: [[0.66, 0.17, 0.10], [0.86, 0.48, 0.30]] },   // orange (vue pédagogique)
  xray: { v: [[0.26, 0.08, 0.07], [0.60, 0.30, 0.22]], a: [[0.62, 0.55, 0.40], [0.90, 0.84, 0.68]] },    // brun + oreillettes beiges (style radio)
};

// Ellipsoïde déformé : `taper` > 0 effile le bas (pointe du cœur), `tilt` incline autour de z.
function blob(center, radii, { taper = 0, tilt = 0, mat }) {
  const geo = new THREE.SphereGeometry(1, 56, 44);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const t = y < 0 ? 1 + y * taper : 1;
    p.setXYZ(i, x * t * radii[0], y * radii[1], z * t * radii[2]);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...center);
  m.rotation.z = tilt;
  return m;
}

const vesselMat = (c, o = {}) => new MeshStandardNodeMaterial({ color: c, roughness: 0.4, ...o });
const pipe = (pts, r, mat, seg = 40) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), seg, r, 12, false), mat);

export function createAnatomicalHeart({ palette = 'atlas' } = {}) {
  const g = new THREE.Group();
  const muscle = new THREE.Group();
  const pal = PALETTES[palette] ?? PALETTES.atlas;
  const mv = muscleMaterial(...pal.v), ma = muscleMaterial(...pal.a);

  muscle.add(
    blob([0.12, -0.16, -0.04], [0.31, 0.47, 0.27], { taper: 0.62, tilt: 0.0, mat: mv }),    // ventricule gauche
    blob([-0.17, -0.10, 0.09], [0.27, 0.40, 0.22], { taper: 0.55, tilt: 0.0, mat: mv }),    // ventricule droit
    blob([-0.28, 0.26, 0.0], [0.20, 0.23, 0.19], { mat: ma }),                              // oreillette droite
    blob([-0.10, 0.40, 0.17], [0.12, 0.09, 0.07], { mat: ma }),                             // auricule droit
    blob([0.17, 0.30, -0.13], [0.21, 0.16, 0.17], { mat: ma }),                             // oreillette gauche
    blob([0.30, 0.30, 0.06], [0.11, 0.09, 0.07], { mat: ma }),                              // auricule gauche
  );
  g.add(muscle);

  // Gros vaisseaux
  g.add(
    pipe([V(0.02, 0.28, 0.0), V(0.0, 0.52, 0.0), V(0.1, 0.76, -0.02), V(0.27, 0.74, -0.07), V(0.33, 0.52, -0.1), V(0.34, 0.2, -0.12)], 0.095, vesselMat(RED)),       // aorte
    pipe([V(0.0, 0.7, -0.04), V(0.12, 0.84, -0.04)], 0.045, vesselMat(RED)),                                                                                     // tronc brachiocéphalique
    pipe([V(-0.06, 0.26, 0.14), V(-0.03, 0.48, 0.12), V(0.08, 0.62, 0.02), V(0.3, 0.64, -0.06), V(0.5, 0.58, -0.08)], 0.085, vesselMat(BLUE)),                     // tronc pulmonaire
    pipe([V(-0.3, 0.9, 0.0), V(-0.3, 0.62, 0.0), V(-0.29, 0.38, 0.0)], 0.07, vesselMat(BLUE)),                                                                     // veine cave supérieure
    pipe([V(-0.28, 0.1, 0.0), V(-0.27, -0.12, -0.02), V(-0.27, -0.3, -0.02)], 0.075, vesselMat(BLUE)),                                                             // veine cave inférieure
    pipe([V(0.5, 0.44, -0.2), V(0.34, 0.34, -0.16)], 0.045, vesselMat(RED)),                                                                                       // veines pulmonaires
    pipe([V(0.45, 0.28, -0.22), V(0.3, 0.26, -0.17)], 0.045, vesselMat(RED)),
    pipe([V(-0.52, 0.5, -0.12), V(-0.3, 0.4, -0.1), V(-0.05, 0.34, -0.14)], 0.045, vesselMat(RED)),
    pipe([V(-0.5, 0.32, -0.14), V(-0.28, 0.28, -0.12), V(0.0, 0.26, -0.15)], 0.045, vesselMat(RED)),
  );

  // Coronaires : collées au muscle grâce à des rayons envoyés depuis l'avant.
  g.updateMatrixWorld(true);
  const rc = new THREE.Raycaster();
  const snap = (pts, strict = false) => pts.map((p) => {
    rc.set(V(p.x, p.y, 2), V(0, 0, -1));
    const h = rc.intersectObjects(muscle.children, false)[0];
    return h ? V(p.x, p.y, h.point.z + 0.006) : (strict ? null : p);
  }).filter(Boolean);
  const coronary = (pts, r, color, branches = 3, side = 1) => {
    const s = snap(pts);
    g.add(pipe(s, r, vesselMat(color), 50));
    for (let i = 0; i < branches; i++) {
      const a = s[Math.min(s.length - 2, 1 + i)];
      const b = snap([V(a.x + side * (0.12 + 0.03 * i), a.y - 0.08 - 0.05 * i, 0), V(a.x + side * (0.22 + 0.04 * i), a.y - 0.2 - 0.05 * i, 0), V(a.x + side * (0.28 + 0.04 * i), a.y - 0.34 - 0.05 * i, 0)], true);
      if (b.length >= 2) g.add(pipe([a, ...b], r * 0.6, vesselMat(color), 20));   // branche seulement si elle reste sur le muscle
    }
  };
  coronary([V(0.06, 0.3, 0), V(0.0, 0.1, 0), V(-0.02, -0.15, 0), V(0.0, -0.4, 0), V(0.02, -0.55, 0)], 0.014, RED, 3, 1);       // interventriculaire antérieure
  coronary([V(-0.14, 0.34, 0), V(-0.3, 0.2, 0), V(-0.42, 0.0, 0), V(-0.4, -0.2, 0), V(-0.3, -0.34, 0)], 0.014, RED, 2, -1);    // coronaire droite
  coronary([V(0.22, 0.2, 0), V(0.18, 0.0, 0), V(0.2, -0.2, 0), V(0.14, -0.4, 0)], 0.012, BLUE, 2, 1);                          // veines cardiaques

  return g;
}
