# Crédits des ressources

Chaque ressource externe (modèle 3D, son, bibliothèque) est listée ici avec sa licence.
Règle du projet : licences CC0 ou CC BY uniquement ; l'attribution est affichée dans l'écran « Crédits » de l'application.

## Modèles 3D
Aucun modèle 3D externe n'est utilisé à ce jour.

| Élément | Origine | Licence |
|---|---|---|
| Cœur anatomique (ventricules, oreillettes, gros vaisseaux, coronaires) | Généré par code (`src/systems/ProceduralHeart.mjs`) | Création du projet |
| Corps humain, cage thoracique, poumons | Générés par code (`src/systems/BodyAtlas.js`, `XrayBody.mjs`) | Création du projet |
| Vaisseaux sanguins et réseau de branches | Générés par code (tubes paramétriques, `BodyAtlas.js`, `HeartAtlas.mjs`) | Création du projet |
| Poumons, bronches, circulation pulmonaire | Générés par code (`src/systems/LungsModel.mjs`) | Création du projet |
| Cerveau, cervelet, neurones | Générés par code (`src/systems/BrainModel.mjs`) | Création du projet |
| Squelette (`skeleton.glb`) | « Skeleton » par Huargenn, https://sketchfab.com/3d-models/skeleton-c5c20626d35e4689b2f2d23c5b262171, simplifié | CC BY 4.0 |
| Poumons (`lungs.glb`) | « Realistic Human Lungs » par neshallads, https://sketchfab.com/3d-models/realistic-human-lungs-ce09f4099a68467880f46e61eb9a3531, simplifié | CC BY 4.0 |
| Cerveau (`brain.glb`) | « Brain » par maheshshinde777, https://sketchfab.com/3d-models/brain-735ca31a3b22433281e6fa9606792faa, simplifié | CC BY 4.0 |
| Cœur (`heart.glb`) | « Human Heart 3d Model » par Sourav Pan, https://3d.nih.gov/entries/3DPX-022787 (NIH 3D) | CC0 1.0 |
| Neurone multipolaire (`neuron.glb`) | « Multipolar neuron » par Alain Sorazu, https://sketchfab.com/3d-models/multipolar-neuron-6834b20a2bc6473d85737587a20ff84f, modifié (simplifié, compressé) | CC BY-SA 4.0 |
| Vaisseaux sanguins (`vessels.glb`) | « Angiology » par Z-Anatomy, https://sketchfab.com/3d-models/angiology-0caae8f894cc40b69f3f78adf14b9665, modifié (artères et veines seulement, simplifié) | CC BY-SA 4.0 |
| Globules rouges | Géométrie de révolution générée par code (`src/systems/Particles.mjs`) | Création du projet |

Choix technique : les organes (squelette, poumons, cerveau, cœur, vaisseaux) sont des modèles `.glb` importés depuis
`public/assets/models/`, simplifiés et compressés (Draco) pour rester légers. Le battement, la respiration et la couleur
du sang sont animés par code et par shaders. Les éléments « Générés par code » ci-dessus sont des formes de secours ou des schémas.

**Licence CC BY-SA 4.0** : `vessels.glb` (modifié de « Angiology ») et `neuron.glb` (modifié de « Multipolar neuron ») restent
sous CC BY-SA 4.0 (partage dans les mêmes conditions). Ces deux fichiers ne sont pas couverts par la licence du code du projet,
et les crédits à Z-Anatomy et Alain Sorazu doivent être conservés partout où le projet est partagé.

## Sons
Aucun fichier audio : les sons sont synthétisés par code (Web Audio API, `src/core/AudioManager.mjs`).
La voix des explications est la synthèse vocale du navigateur (Web Speech API, `src/core/Voice.mjs`).

| Fichier | Titre | Auteur | Licence | Lien |
|---|---|---|---|---|

## Bibliothèques
| Bibliothèque | Licence | Lien |
|---|---|---|
| Three.js (rendu WebGPU, TSL, GLTFLoader, OrbitControls) | MIT | https://threejs.org |
| Décodeur Draco (fourni avec Three.js) | Apache 2.0 | https://github.com/google/draco |
| Vite | MIT | https://vite.dev |
