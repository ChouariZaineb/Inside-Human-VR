# Crédits des ressources

Chaque ressource externe (modèle 3D, son, bibliothèque) est listée ici avec sa licence.
Règle du projet : licences CC0 ou CC BY uniquement ; l'attribution est affichée dans l'écran « Crédits » de l'application.

## Modèles 3D
Aucun modèle 3D externe n'est utilisé à ce jour.

| Élément | Origine | Licence |
|---|---|---|
| Cœur anatomique (ventricules, oreillettes, gros vaisseaux, coronaires) | Généré par code (`src/systems/ProceduralHeart.js`) | Création du projet |
| Corps humain, cage thoracique, poumons | Générés par code (`src/systems/BodyAtlas.js`, `XrayBody.js`) | Création du projet |
| Vaisseaux sanguins et réseau de branches | Générés par code (tubes paramétriques, `BodyAtlas.js`, `HeartAtlas.js`) | Création du projet |
| Globules rouges | Géométrie de révolution générée par code (`src/systems/Particles.js`) | Création du projet |

Choix technique : des modèles procéduraux, légers (quelques ko au lieu de plusieurs Mo), sans dépendance de licence,
et qui permettent d'animer le battement et la couleur du sang (rouge/bleu) directement dans les shaders.
Un modèle `public/assets/models/heart.glb` peut remplacer le cœur généré : il serait alors ajouté dans ce tableau.

## Sons
Aucun son pour l'instant (audio spatialisé prévu au sprint 5).

| Fichier | Titre | Auteur | Licence | Lien |
|---|---|---|---|---|

## Bibliothèques
| Bibliothèque | Licence | Lien |
|---|---|---|
| Three.js (rendu WebGPU, TSL, GLTFLoader, OrbitControls) | MIT | https://threejs.org |
| Décodeur Draco (fourni avec Three.js) | Apache 2.0 | https://github.com/google/draco |
| Vite | MIT | https://vite.dev |
