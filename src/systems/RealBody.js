/**
 * RealBody.js — corps humain réaliste : squelette + poumons + cerveau + cœur (modèles .glb libres).
 *
 *   const body = await createRealBody();       // charge les .glb de public/assets/models/
 *   scene.add(body.group);
 *   body.setView('assembled' | 'exploded');    // organes dans le corps, ou écartés comme sur un atlas
 *   body.focus('lungs');                       // met un organe en évidence (les autres s'estompent)
 *   boucle : body.update(dt);
 *
 * Repère : pieds à y = 0, hauteur du squelette = `height` (1,8 par défaut), face à +z.
 * Les modèles sont normalisés (taille et centre) au chargement : seules les valeurs de PARTS à régler.
 * Si un fichier manque, la partie est simplement ignorée (le reste s'affiche).
 */
import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

/**
 * Réglages de chaque partie (en mètres, repère du corps de 1,8 m).
 *  size   : dimension cible de la plus grande dimension choisie par `fit` ('y' | 'x' | 'z' | 'max')
 *  rot    : rotation [x, y, z] en radians appliquée avant la mise à l'échelle
 *  inBody : position dans le corps · exploded : position en vue éclatée
 */
export const PARTS = {
  skeleton: { url: 'assets/models/skeleton.glb', fit: 'y', size: 1.8, rot: [0, 0, 0], inBody: [0, 0.9, 0], exploded: [0, 0.9, 0] },
  lungs:    { url: 'assets/models/lungs.glb',    fit: 'y', size: 0.36, rot: [0, 0, 0], inBody: [0, 1.36, 0.03], exploded: [0.75, 1.25, 0.1] },
  brain:    { url: 'assets/models/brain.glb',    fit: 'x', size: 0.15, rot: [0, 0, 0], inBody: [0, 1.655, -0.012], exploded: [0, 2.15, 0] },
  heart:    { url: 'assets/models/heart.glb',    fit: 'y', size: 0.12, rot: [0, Math.PI, 0], inBody: [0.025, 1.32, 0.05], exploded: [-0.75, 1.25, 0.1] },
};

const loader = new GLTFLoader().setDRACOLoader(new DRACOLoader().setDecoderPath(`${import.meta.env?.BASE_URL ?? './'}draco/`));
const ease = (t) => t * t * (3 - 2 * t);

async function loadPart(name, cfg, base) {
  const gltf = await loader.loadAsync(`${base}${cfg.url}`);
  const model = gltf.scene, wrap = new THREE.Group();
  model.rotation.set(...cfg.rot); wrap.add(model);
  const box = new THREE.Box3().setFromObject(wrap), s = box.getSize(new THREE.Vector3());
  const ref = cfg.fit === 'x' ? s.x : cfg.fit === 'z' ? s.z : cfg.fit === 'max' ? Math.max(s.x, s.y, s.z) : s.y;
  model.scale.setScalar(cfg.size / Math.max(ref, 1e-6));
  box.setFromObject(wrap); model.position.sub(box.getCenter(new THREE.Vector3()));
  const root = new THREE.Group(); root.name = name; root.add(wrap);
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.frustumCulled = false;
    const mats = [].concat(o.material);
    mats.forEach((m) => { m.userData.baseOpacity = m.opacity; });
  });
  return { root, animations: gltf.animations, model };
}

/** @param {{ base?: string, height?: number, parts?: string[] }} opts */
export async function createRealBody({ base = import.meta.env?.BASE_URL ?? './', parts = Object.keys(PARTS), skeletonOpacity = 0.55 } = {}) {
  const group = new THREE.Group(); group.name = 'corps-reel';
  const items = {};
  await Promise.all(parts.map(async (name) => {
    try {
      const p = await loadPart(name, PARTS[name], base);
      p.cfg = PARTS[name]; p.root.position.set(...p.cfg.inBody); group.add(p.root); items[name] = p;
    } catch (e) { console.info(`RealBody : ${name} indisponible (${e.message ?? e})`); }
  }));

  let view = 'assembled', k = 0, kTarget = 0, focus = null, t = 0;
  const setOpacity = (name, a) => {
    items[name]?.root.traverse((o) => {
      if (!o.isMesh) return;
      [].concat(o.material).forEach((m) => { m.transparent = a < 0.999; m.opacity = a * (m.userData.baseOpacity ?? 1); m.depthWrite = a > 0.6; });
    });
  };
  const refresh = () => {
    const exploded = kTarget > 0.5;
    for (const n of Object.keys(items)) {
      let a = 1;
      if (n === 'skeleton') a = exploded ? 1 : skeletonOpacity;           // squelette translucide : on voit les organes
      if (focus && n !== focus) a *= n === 'skeleton' ? 0.4 : 0.25;
      setOpacity(n, a);
    }
  };
  refresh();

  return {
    group, parts: items,
    setView(v) { view = v; kTarget = v === 'exploded' ? 1 : 0; refresh(); },
    get view() { return view; },
    focus(name) { focus = items[name] ? name : null; refresh(); },
    update(dt) {
      t += dt;
      k += (kTarget - k) * Math.min(1, dt * 3);
      const e = ease(Math.min(1, Math.max(0, k)));
      for (const [n, p] of Object.entries(items)) {
        if (n === 'skeleton') continue;
        p.root.position.set(...p.cfg.inBody.map((v, i) => v + (p.cfg.exploded[i] - v) * e));
        p.root.rotation.y = e * Math.sin(t * 0.6) * 0.4;               // en vue éclatée, les organes tournent doucement
      }
    },
    dispose() { group.traverse((o) => { o.geometry?.dispose(); [].concat(o.material ?? []).forEach((m) => m.dispose()); }); group.removeFromParent(); },
  };
}
