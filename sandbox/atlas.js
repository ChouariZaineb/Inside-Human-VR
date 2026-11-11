// Banc d'essai « style vidéo » : /sandbox/atlas.html
// Paramètres : ?mode=schema · ?webgl · ?post=1 (vue postérieure) · ?rx=90&ry=0&rz=0 (orientation du heart.glb, en degrés)
import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createHeartAtlas } from '../src/systems/HeartAtlas.js';

const q = new URLSearchParams(location.search);
const renderer = new THREE.WebGPURenderer({ antialias: true, alpha: true, forceWebGL: q.has('webgl') });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x000000, 0);
document.body.appendChild(renderer.domElement);
await renderer.init();

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.05, 100);
scene.add(new THREE.HemisphereLight(0xffffff, 0x7a90b8, 1.7));
const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(2, 4, 6); scene.add(key);

const atlas = createHeartAtlas();
scene.add(atlas.group);

// Vrai cœur : placer le fichier dans public/assets/models/heart.glb
const deg = (k) => THREE.MathUtils.degToRad(Number(q.get(k)) || 0);
atlas.loadHeart('/assets/models/heart.glb', { rotation: [deg('rx'), deg('ry'), deg('rz')] })
  .then(() => console.info('heart.glb chargé', atlas.hasAnimation ? '(animation incluse)' : ''))
  .catch(() => console.info('heart.glb absent : cœur provisoire'));

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

const VIEW = {
  anatomie: { pos: [0, 2.1, 9.5], target: [0.1, 1.9, 0] },
  schema: { pos: [0, 0.2, 15], target: [0, 0, 0] },
};
const TEXT = {
  anatomie: { ant: ['Vue antérieure', "L'axe du cœur est oblique en avant, en bas et à gauche"], post: ['Vue postérieure', "L'axe du cœur est oblique en avant, en bas et à gauche"] },
  schema: { ant: ['Schéma de la circulation', "Le cœur droit envoie le sang pauvre en O₂ vers les poumons ; le cœur gauche envoie le sang oxygéné vers le corps."] },
};
const tag = document.getElementById('tag'), cap = document.getElementById('caption');
let posterior = q.has('post'), targetYaw = posterior ? Math.PI : 0;

function refresh() {
  const m = atlas.mode;
  const [a, b] = m === 'anatomie' ? TEXT.anatomie[posterior ? 'post' : 'ant'] : TEXT.schema.ant;
  tag.textContent = a; cap.textContent = b;
  document.querySelectorAll('[data-mode]').forEach((el) => el.classList.toggle('on', el.dataset.mode === m));
  document.getElementById('flip').style.display = m === 'anatomie' ? '' : 'none';
  document.getElementById('axis').style.display = m === 'anatomie' ? '' : 'none';
  document.getElementById('flip').textContent = posterior ? 'Vue antérieure' : 'Vue postérieure';
  labels.forEach((l) => (l.el.style.display = m === 'schema' ? '' : 'none'));
}
function setMode(m) {
  atlas.setMode(m);
  const v = VIEW[m]; camera.position.set(...v.pos); controls.target.set(...v.target); controls.update();
  refresh();
}
const labels = atlas.schemaLabels.map((l) => { const el = document.createElement('div'); el.className = 'lbl'; el.textContent = l.text; document.body.appendChild(el); return { ...l, el }; });

document.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
document.getElementById('flip').addEventListener('click', () => { posterior = !posterior; targetYaw = posterior ? Math.PI : 0; refresh(); });
let axisOn = true;
document.getElementById('axis').addEventListener('click', (e) => { axisOn = !axisOn; atlas.setAxis(axisOn); e.target.classList.toggle('on', axisOn); });
document.getElementById('axis').classList.add('on');
addEventListener('keydown', (e) => {
  if (e.key === 'v') atlas.toggleVessels();
  if (e.key === 'h' && atlas.mode === 'anatomie') { camera.position.set(0.1, 2.3, 3.4); controls.target.set(0.1, 2.2, 0); controls.update(); } // gros plan sur le cœur
});
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

setMode(q.get('mode') === 'schema' ? 'schema' : 'anatomie');
if (posterior) atlas.group.rotation.y = Math.PI;
if (q.has('close')) { camera.position.set(0.1, 2.3, 3.4); controls.target.set(0.1, 2.2, 0); controls.update(); }

const tmp = new THREE.Vector3(), clock = new THREE.Clock(); let frames = 0, acc = 0;
const hud = document.getElementById('hud');
renderer.setAnimationLoop(() => {
  const dt = clock.getDelta();
  atlas.update(dt);
  atlas.group.rotation.y += (targetYaw - atlas.group.rotation.y) * Math.min(1, dt * 4);   // rotation douce avant/arrière
  controls.update();
  renderer.render(scene, camera);
  if (atlas.mode === 'schema') for (const l of labels) {
    tmp.copy(l.at).project(camera);
    l.el.style.left = `${(tmp.x * 0.5 + 0.5) * innerWidth}px`; l.el.style.top = `${(-tmp.y * 0.5 + 0.5) * innerHeight}px`;
  }
  frames++; acc += dt;
  if (acc > 0.5) { hud.textContent = `${renderer.backend?.isWebGPUBackend ? 'WebGPU' : 'WebGL 2'} · ${Math.round(frames / acc)} i/s · H : gros plan cœur · V : vaisseaux`; frames = 0; acc = 0; }
});
