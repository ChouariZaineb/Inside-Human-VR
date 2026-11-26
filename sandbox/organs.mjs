// Banc d'essai « organes » : /sandbox/organs.html  (?o=brain pour démarrer sur le cerveau)
import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createRealBody } from '../src/systems/RealBody.mjs';
import { createNeuronNetwork } from '../src/systems/BrainModel.mjs';
import { AudioManager } from '../src/core/AudioManager.mjs';
import { Effects } from '../src/systems/Effects.mjs';
import { Voice } from '../src/core/Voice.mjs';
import { breathRate, breathJS } from '../src/shaders/breathing.mjs';

const q = new URLSearchParams(location.search);
const renderer = new THREE.WebGPURenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x000000, 0);
document.body.appendChild(renderer.domElement);
await renderer.init();
if (!renderer.backend.isWebGPUBackend) throw new Error('WebGPU est obligatoire : ce navigateur ou cette carte graphique ne le fournit pas (pas de repli WebGL).');

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.05, 100);
scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x223366, 1.6));
const key = new THREE.DirectionalLight(0xffffff, 2.0); key.position.set(2, 4, 6); scene.add(key);

// Les organes sont des DONNÉES : modèles .glb (public/assets/models), jamais générés par code.
const real = await createRealBody({ parts: ['lungs', 'brain'] });
function placeOrgan(name, size) {
  const part = real.parts[name];
  delete real.parts[name];                       // on gère nous-mêmes la position (RealBody ne la touche plus)
  const holder = new THREE.Group();
  part.root.position.set(0, 0, 0);
  holder.add(part.root);
  holder.scale.setScalar(size / part.cfg.size);
  return holder;
}
const lungs = { group: placeOrgan('lungs', 2.4), update() {} };
const brain = { group: placeOrgan('brain', 2.0), update() {} };
brain.group.traverse((o) => { if (o.isMesh) [].concat(o.material).forEach((m) => { m.transparent = true; m.opacity = 0.35; m.depthWrite = false; }); });
const net = createNeuronNetwork([[-0.7, 0.05, 0.1], [-0.25, 0.3, 0.2], [0.25, 0.1, 0.15], [0.7, 0.3, 0.05]], { somaRadius: 0.07, speed: 1.0 });
const brainGroup = new THREE.Group(); brainGroup.add(net.group);
brainGroup.add(brain.group);
scene.add(lungs.group, brainGroup);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
const fx = new Effects({ scene, camera });
const voice = new Voice();
const audio = new AudioManager();
audio.camera = camera;
audio._camera = camera;
let organ = null;
function show(o) {
  organ = o;
  lungs.group.visible = o === 'lungs'; brainGroup.visible = o === 'brain';
  camera.position.set(...(o === 'lungs' ? [0, 0.2, 6.2] : [2.4, 1.8, 3.6])); controls.target.set(0, 0, 0); controls.update();
  document.getElementById('tag').textContent = o === 'lungs' ? 'Poumons' : 'Cerveau';
  document.querySelectorAll('[data-o]').forEach((b) => b.classList.toggle('on', b.dataset.o === o));
  audio.setOrgan(o); fx.setOrgan(o);
}
document.querySelectorAll('[data-o]').forEach((b) => b.addEventListener('click', () => show(b.dataset.o)));
const fire = () => { net.fire(() => audio.playSuccess()); [0, 1, 2, 3].forEach((i) => setTimeout(() => audio.playNeuron(i), i * 900 + 250)); };
document.getElementById('fire').addEventListener('click', fire);
document.getElementById('ok').addEventListener('click', () => { fx.success(); audio.playSuccess(); });
document.getElementById('ko').addEventListener('click', () => { fx.error(); audio.playError(); });
document.getElementById('voice').addEventListener('click', () => fetch('/assets/content/levels.json').then((r) => r.json()).then((d) => voice.readLevel(d.levels.find((l) => l.id === organ), { mission: true })));
if (q.has('ok')) setTimeout(() => fx.success(), 500);
if (q.has('ko')) setTimeout(() => fx.error(), 500);
document.getElementById('snd').addEventListener('click', () => { audio.unlock(); audio.setOrgan(organ); });
document.getElementById('mute').addEventListener('click', () => audio.toggleMute());
addEventListener('keydown', (e) => { if (e.key === 'm' || e.key === 'M') audio.toggleMute(); });
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
if (q.has('rate')) breathRate.value = Number(q.get('rate'));
show(q.get('o') || 'lungs');
window.__ready?.();
const hud = document.getElementById('hud'), clock = new THREE.Clock(); let frames = 0, acc = 0, auto = 0, t = 0; const lungsBase = lungs.group.scale.x;
window.__t = 0;
renderer.setAnimationLoop(() => {
  const dt = q.has('step') ? 1 / 30 : clock.getDelta();
  window.__t += dt;
  t += dt; lungs.group.scale.setScalar(lungsBase * (1 + 0.05 * breathJS(t))); fx.update(dt); lungs.update(dt); brain.update(dt); net.update(dt); audio.update(dt);
  if (organ === 'brain' && (auto += dt) > 4) { auto = 0; fire(); }
  controls.update();
  renderer.render(scene, camera);
  frames++; acc += dt;
  if (acc > 0.5) { hud.textContent = `${'WebGPU'} · ${Math.round(frames / acc)} i/s`; frames = 0; acc = 0; }
});
