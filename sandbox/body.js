// Banc d'essai « corps réaliste » : /sandbox/body.html  (?webgl · ?view=exploded · ?focus=lungs · ?cam=x,y,z,tx,ty,tz)
import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createRealBody } from '../src/systems/RealBody.js';

const q = new URLSearchParams(location.search);
const renderer = new THREE.WebGPURenderer({ antialias: true, alpha: true, forceWebGL: q.has('webgl') });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x000000, 0);
document.body.appendChild(renderer.domElement);
await renderer.init();

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.05, 100);
scene.add(new THREE.HemisphereLight(0xffffff, 0x444455, 2.2));
const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(2, 4, 5); scene.add(key);
const rim = new THREE.DirectionalLight(0x88aaff, 1.0); rim.position.set(-3, 2, -4); scene.add(rim);

const body = await createRealBody({ base: import.meta.env.BASE_URL });
scene.add(body.group);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
const cam = (q.get('cam') ?? '0,1.1,5.2,0,0.95,0').split(',').map(Number);
camera.position.set(cam[0], cam[1], cam[2]); controls.target.set(cam[3], cam[4], cam[5]); controls.update();

const sync = () => {
  document.querySelectorAll('[data-v]').forEach((b) => b.classList.toggle('on', b.dataset.v === body.view));
};
document.querySelectorAll('[data-v]').forEach((b) => b.addEventListener('click', () => { body.setView(b.dataset.v); sync(); }));
document.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => {
  body.focus(b.dataset.f);
  const c = { lungs: [0, 1.3, 1.3, 0, 1.3, 0], brain: [0, 1.7, 1.0, 0, 1.68, 0], heart: [0, 1.25, 1.0, 0, 1.25, 0] }[b.dataset.f];
  if (c) { camera.position.set(c[0], c[1], c[2]); controls.target.set(c[3], c[4], c[5]); controls.update(); }
}));
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
if (q.has('view')) body.setView(q.get('view'));
if (q.has('focus')) body.focus(q.get('focus'));
sync();
window.__ready?.();
const hud = document.getElementById('hud'), clock = new THREE.Clock(); let frames = 0, acc = 0;
renderer.setAnimationLoop(() => {
  const dt = clock.getDelta();
  body.update(dt); controls.update(); renderer.render(scene, camera);
  frames++; acc += dt;
  if (acc > 0.5) { hud.textContent = `${renderer.backend?.isWebGPU || renderer.backend?.isWebGPUBackend ? 'WebGPU' : 'WebGL 2'} · ${Math.round(frames / acc)} i/s · parties : ${Object.keys(body.parts).join(', ')}`; frames = 0; acc = 0; }
});
