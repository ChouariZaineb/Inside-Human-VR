# Semaines 2 et 3 — Hentati Yessmine (visuels, shaders, son)

Branches : `feature/visuels-poumons-cerveau` (semaine 2), `feature/finitions-video` (semaine 3).

## Livrables
| Fichier | Rôle |
|---|---|
| `src/shaders/breathing.js` | Respiration en TSL (`breath`, `breathRate`, `breathJS`, `lungMaterial`, `bronchiMaterial`) |
| `src/shaders/bloodFlow.js` (modifié) | `oxygenTo()` / `updateOxygen()` : le sang passe du bleu au rouge ; option `outside` pour les tubes vus de l'extérieur |
| `src/shaders/neuronSignal.js` | Impulsion nerveuse (`axonMaterial`, `somaMaterial`, `SignalChain`, `neuronGlow`) |
| `src/systems/LungsModel.js` | `createLungs()` : poumons, bronches, circulation pulmonaire bleu → rouge |
| `src/systems/BrainModel.js` | `createBrain()`, `createNeuronNetwork(points)` |
| `src/core/AudioManager.js` | Sons synthétisés et spatialisés, réactifs au bus d'événements |
| `src/systems/Effects.js` | Brouillard, lumières par organe, effets de réussite et d'erreur |
| `src/core/Voice.js` | Lecture à voix haute (Web Speech API, fr-FR) |
| `sandbox/organs.html` + `organs.js` | Page de test de tout ce qui précède |
| `docs/marketing/` | Script vidéo, affiche, dossier de presse |
| `docs/design-notebook/` | Diagrammes de cas d'utilisation et de classes (Mermaid + PNG) |

Les modèles sont **générés par code** (pas de GLB Blender) : aucun fichier lourd, aucune licence à gérer, et les shaders peuvent animer directement la géométrie.

## Tester
`npm run dev`, puis ouvrir `/sandbox/organs.html` (ajouter `?webgl` si WebGPU est indisponible, `?o=brain` pour le cerveau). Boutons : Poumons, Cerveau, Impulsion nerveuse, Réussite, Erreur, Lire à voix haute, Activer le son (un clic est nécessaire pour autoriser le son), Muet (touche M).

## Intégration (à faire avec Zaineb et Melek — fichiers qui ne sont pas les miens)

**main.js** (après la création du moteur) :
```js
import { AudioManager } from './core/AudioManager.js';
import { Effects } from './systems/Effects.js';
import { Voice } from './core/Voice.js';
const audio = new AudioManager().attach(engine);
const fx = new Effects({ scene: engine.scene, camera: engine.camera }).attach();
engine.onUpdate((dt) => fx.update(dt));
const voice = new Voice().attach(async (id) => (await (await fetch(`${import.meta.env.BASE_URL}assets/content/levels.json`)).json()).levels.find((l) => l.id === id));
```
(`attach` du son et de la voix écoutent `levelStarted`, `missionSuccess`, `missionError`, `levelUnlocked`.)

**Niveau poumons** : `const lungs = createLungs(); scene.add(lungs.group);` puis `lungs.update(dt)` dans `onUpdate`, `lungs.dispose()` à la sortie.
**Niveau cerveau** : `const net = createNeuronNetwork(positionsDesTroisNeurones); scene.add(net.group);` ; au bon clic : `net.fire(() => … )` et `net.update(dt)` dans `onUpdate`. Pour le son : `audio.playNeuron(i)`.

## Limites connues
- Pas de modèles Blender/Draco : remplacés par des modèles procéduraux (voir ci-dessus).
- Testé en WebGL 2 (rendu logiciel) ; à vérifier en WebGPU et au casque, avec mesure des fps sur le PC de l'équipe.
- La vidéo doit être enregistrée par l'équipe (script prêt dans `docs/marketing/script-video.md`).
- Contenu pédagogique à faire relire par un enseignant de biologie.
