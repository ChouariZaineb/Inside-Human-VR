// Banc d'essai « corps en radio » : /sandbox/xray.html   (?webgl pour forcer WebGL 2 · ?spin pour rotation lente)
import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createXrayBody } from '../src/systems/XrayBody.js';

const q = new URLSearchParams(location.search);
const renderer = new THREE.WebGPURenderer({ antialias: true, alpha: true, forceWebGL: q.has('webgl') });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x000000, 0);
document.body.appendChild(renderer.domElement);
await renderer.init();

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.05, 100);
scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x223366, 1.6));
const key = new THREE.DirectionalLight(0xffffff, 2.0); key.position.set(2, 4, 6); scene.add(key);

const body = createXrayBody({ branches: Number(q.get('b')) || 1 });
scene.add(body.group);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
const VIEW = {
  1: { pos: [0, 0, 25], target: [0, 0, 0] },
  2: { pos: [0.3, 2.6, 10], target: [0.3, 2.4, 0] },
  3: { pos: [0.3, 2.3, 4.6], target: [0.3, 2.3, 0] },
};
function view(k) {
  const v = VIEW[k]; camera.position.set(...v.pos); controls.target.set(...v.target); controls.update();
  document.querySelectorAll('[data-v]').forEach((b) => b.classList.toggle('on', b.dataset.v === String(k)));
}
document.querySelectorAll('[data-v]').forEach((b) => b.addEventListener('click', () => view(b.dataset.v)));
let back = q.has('back'), yaw = back ? Math.PI : 0;
const flip = document.getElementById('flip');
flip.addEventListener('click', () => { back = !back; yaw = back ? Math.PI : 0; flip.textContent = back ? 'Vue de face' : 'Vue de dos'; });
addEventListener('keydown', (e) => { if (VIEW[e.key]) view(e.key); });
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
view(q.get('v') || 1);
if (back) body.group.rotation.y = Math.PI;
document.getElementById('hud').textContent = 'démarrage…';   // signale que l'initialisation est terminée

const hud = document.getElementById('hud'), clock = new THREE.Clock(); let frames = 0, acc = 0;
renderer.setAnimationLoop(() => {
  const dt = clock.getDelta();
  body.update(dt);
  if (q.has('spin')) yaw += dt * 0.35;
  body.group.rotation.y += (yaw - body.group.rotation.y) * Math.min(1, dt * 4);
  controls.update();
  renderer.render(scene, camera);
  frames++; acc += dt;
  if (acc > 0.5) { hud.textContent = `${renderer.backend?.isWebGPU || renderer.backend?.isWebGPUBackend ? 'WebGPU' : 'WebGL 2'} · ${Math.round(frames / acc)} i/s · touches 1 2 3 : vues`; frames = 0; acc = 0; }
});
