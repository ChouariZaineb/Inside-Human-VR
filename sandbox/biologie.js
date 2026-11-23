// Contrôle des GLB générés avec Blender, indépendant des missions interactives.
import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const renderer = new THREE.WebGPURenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);
await renderer.init();
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a1020);
scene.add(new THREE.HemisphereLight(0xffffff, 0x3d4c75, 2));
const light = new THREE.DirectionalLight(0xffffff, 2.5);
light.position.set(3, 6, 5);
scene.add(light);
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 2.6, 9);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.3, 0);
controls.update();
const models = [
  ['erythrocyte.glb', -3],
  ['platelet.glb', -1],
  ['oxygen_o2.glb', 1],
  ['carbon_dioxide_co2.glb', 3],
];
const loader = new GLTFLoader();
let loaded = 0;
for (const [name, x] of models) {
  try {
    const model = (await loader.loadAsync(`${import.meta.env.BASE_URL}assets/models/${name}`)).scene;
    model.position.set(x, 0, 0);
    scene.add(model);
    loaded++;
  } catch (error) {
    console.warn(`Modèle manquant ${name} : générer les GLB avec Blender`, error);
  }
}
document.getElementById('status').textContent = `${loaded}/4 modèles Blender chargés. ${loaded < 4 ? 'Générer les fichiers avec le script Blender.' : 'Prêts pour inspection.'}`;
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
