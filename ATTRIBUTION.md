# Fichier d'attribution et d'origine des ressources (ATTRIBUTION.md)

**Projet :** Inside Human VR : voyage en VR à l'intérieur du corps humain (cœur, poumons, cerveau)
**Équipe :** Melek Mallouli, Yessmine Hentati, Zaineb Chouari
**Version :** 2.0 — Évaluation SUP'COM (2026/2027), mise à jour du 12/11/2026

---

## 1. Modèles 3D, textures et assets graphiques

Aucun modèle 3D, texture, image ni son externe n'est utilisé. Tous les visuels sont générés par code (géométries Three.js et matériaux TSL).

| Asset | Source originale | Auteur | Licence | Modifications / méthode |
|---|---|---|---|---|
| Cœur anatomique (ventricules, oreillettes, aorte, tronc pulmonaire, veines caves, coronaires) | Généré par code : `src/systems/ProceduralHeart.js` | Équipe | Code du projet | Formes ellipsoïdales fusionnées, vaisseaux en `TubeGeometry`, coronaires plaquées sur le muscle par raycast |
| Corps « radio » (silhouette, côtes, sternum, colonne, poumons, réseau de vaisseaux) | Généré par code : `src/systems/XrayBody.js` | Équipe | Code du projet | Silhouette extrudée à partir d'un contour 2D dessiné à la main, côtes et vaisseaux paramétriques |
| Torse en verre et schéma de circulation | Généré par code : `src/systems/HeartAtlas.js` | Équipe | Code du projet | Fresnel, arbres pulmonaires, flèches de flux |
| Globules rouges | Généré par code : `src/systems/Particles.js` | Équipe | Code du projet | `InstancedMesh` de disques biconcaves (`LatheGeometry`) |
| Sons, textures, images | Aucun | – | – | – |

> Si un modèle externe est ajouté plus tard (ex. cœur Sketchfab ou NIH 3D), il doit être listé ici avec : source (URL), auteur, licence (CC-BY, domaine public…) et modifications (décimation, compression GLB + Draco).

**Références visuelles (inspiration uniquement, aucun asset repris) :** vidéo YouTube « Le cœur et la circulation » (`VPxIDkK69IQ`), images de référence de type atlas d'anatomie et radiographie.

---

## 2. Bibliothèques tierces et modules externes (versions fixées)

Aucun CDN n'est utilisé. Les paquets sont installés via npm et leur version est figée dans `package.json` et `package-lock.json`.

| Bibliothèque | Version fixée | Source de référence | Licence | Rôle dans le projet |
|---|---|---|---|---|
| Three.js (`three`, module `three/webgpu` + TSL) | 0.187.0 | https://www.npmjs.com/package/three/v/0.187.0 | MIT | Moteur de rendu WebGPU uniquement (`WebGPURenderer`, aucun repli WebGL), shaders TSL compilés en WGSL, `ArrayCamera` pour la stéréo VR |
| Draco (décodeur, fourni avec Three.js) | version incluse dans three 0.187.0 | `public/draco/` (copié depuis `node_modules/three/examples/jsm/libs/draco/`) | Apache 2.0 | Décompression des modèles GLB |
| Vite | 8.3.5 | https://www.npmjs.com/package/vite/v/8.3.5 | MIT | Serveur de développement HTTPS et build |
| Playwright (`@playwright/test`) | 1.63.0 | https://www.npmjs.com/package/@playwright/test/v/1.63.0 | Apache 2.0 | Tests de bout en bout (`tests/e2e/`) |
| IWER (Immersive Web Emulation Runtime, Meta) | 2.8.0 | https://www.npmjs.com/package/iwer/v/2.8.0 | MIT | Casque Meta Quest 3 simulé dans les tests (session `immersive-vr`, manettes) |
| GitHub Actions : `actions/checkout`, `actions/setup-node`, `actions/upload-artifact`, `actions/configure-pages`, `actions/upload-pages-artifact`, `actions/deploy-pages` | v4 / v4 / v4 / v5 / v3 / v4 | https://github.com/actions | MIT | Intégration continue et déploiement sur GitHub Pages (`.github/workflows/`) |
| Immersive Web Emulator (extension Chrome, Meta) | version du Chrome Web Store | https://chromewebstore.google.com (Immersive Web Emulator) | MIT | Test manuel de la VR sans casque (outil de développement, hors dépôt) |
| mkcert | v1.4.4 | https://github.com/FiloSottile/mkcert | BSD-3 | Certificat local HTTPS (hors dépôt, dossier `certificates/` ignoré par git) |

---

## 3. Extraits de code copiés ou adaptés

Aucun extrait de StackOverflow, de tutoriel ou de dépôt tiers n'a été copié tel quel. Les techniques ci-dessous sont des méthodes standard réécrites pour le projet :

| Fonction / fichier | Source de la technique | Adaptation effectuée |
|---|---|---|
| `src/shaders/tissuePulse.js` : battement « lub-dub » | Fonction gaussienne classique, écrite par l'équipe | Deux gaussiennes par cycle en TSL, équivalent JS `beatJS` |
| `src/shaders/bloodFlow.js` : bruit de flux | Nœud `mx_noise_float` fourni par Three.js (TSL) | Stries animées le long du vaisseau, couleur rouge/bleue selon l'oxygénation |
| `src/systems/Particles.js` : vitesse de Poiseuille | Profil de vitesse parabolique (physique des fluides) | Vitesse maximale au centre du vaisseau, repères de Frenet précalculés |
| `src/systems/XrayBody.js` : générateur pseudo-aléatoire | mulberry32 (algorithme public, domaine public) | Graine fixe pour obtenir toujours le même réseau de vaisseaux |
| `src/systems/XrayBody.js` : test point dans polygone | Algorithme classique « ray casting » | Garde les petites branches à l'intérieur de la silhouette |
| `src/core/XRPresenter.js` : boucle `XRSession.requestAnimationFrame`, `getViewerPose`, `XRWebGLLayer` | Spécification W3C WebXR Device API (https://www.w3.org/TR/webxr/) | Rendu des deux yeux en une passe WebGPU (`ArrayCamera`), copie de l'image vers la couche XR |
| `src/systems/Manipulation.js` : snap turn | Technique de locomotion VR classique (rotation par paliers) | Paliers de 30°, hystérésis 0,7 / 0,3, rotation autour de la tête |
| `public/sw.js` : « réseau d'abord, cache en secours » | Stratégie standard des Service Workers (documentation MDN) | Message `CACHE_URLS` pour ranger les fichiers du premier chargement |

---

## 4. Déclaration de l'usage des assistants IA (Claude)

**Outils :** claude.ai (conversation, explications et génération de fichiers) et Claude Code (dans VS Code).
**Colonne « Demande faite à l'IA » :** les demandes ont été faites en langage informel et souvent en plusieurs messages courts. Chaque demande est ici **reformulée de façon explicite** (contexte, action demandée, résultat attendu), en restant fidèle à ce qui a été demandé et produit. Ce n'est pas une copie mot pour mot.
**Règle de l'équipe :** aucun code n'est intégré sans être relu, testé dans le navigateur (Immersive Web Emulator) et compris par l'auteur·e de la branche.

### 4.1 Moteur, VR, intégration, qualité (Zaineb Chouari)

| Composant concerné | Usage principal de l'IA | Demande faite à l'IA (reformulation fidèle) | Modèle | Vérification appliquée par l'étudiante |
|---|---|---|---|---|
| Structure initiale : `src/core/Engine.js`, `Renderer.js`, `XRManager.js`, `vite.config.js`, `README.md` | Génération de la structure du projet et du moteur | « Génère un prompt pour Claude Code qui crée la base du projet Inside Human VR : un projet Vite servi en HTTPS (certificat mkcert), un moteur Three.js (`Engine.js` avec la boucle de rendu, `Renderer.js`, `XRManager.js` pour la session WebXR), une scène de départ et un README qui explique l'installation et le lancement. » | Claude Opus 5.5 (moyen) | Lancement en HTTPS (mkcert), test VR avec l'émulateur, relecture de chaque fichier avec explications |
| `src/core/LevelManager.js`, `src/levels/LungsLevel.js` | Génération du chargement des niveaux et de la mission des poumons | « Pour le Sprint 2, crée un `LevelManager` qui charge un seul niveau à la fois, enregistre les niveaux (accueil, cœur, poumons, cerveau) et passe au niveau suivant quand un niveau est terminé. Crée ensuite `LungsLevel`, basé sur `BaseLevel` de Melek : l'utilisateur dépose les molécules d'O₂ dans le capillaire et les molécules de CO₂ dans l'alvéole, avec un score et des messages d'explication. Guide-moi étape par étape et explique chaque fichier. » | Claude Opus 5.5 (moyen) | Mission jouée en bureau et en VR, passage cœur → poumons vérifié |
| `src/core/Renderer.js` (WebGPU obligatoire), `src/core/XRPresenter.js`, `XRManager.js` | Passage à `WebGPURenderer` sans repli WebGL et rendu de la session `immersive-vr` avec l'API WebXR Device | « Le prof exige WebGPU et l'API WebXR Device en `immersive-vr`. Modifie `Renderer.js` pour utiliser uniquement `WebGPURenderer` (sans repli WebGL), avec un message d'erreur clair si WebGPU est absent. Crée `XRPresenter.js` qui ouvre la session `immersive-vr` avec `navigator.xr.requestSession`, lit la pose de chaque œil avec `getViewerPose` et rend les deux yeux en une passe WebGPU. Adapte `XRManager.js` pour suivre les deux manettes. Guide-moi étape par étape. » | Claude Opus 5.5 (moyen) | Console : `[Renderer] Backend : WebGPU` ; session `immersive-vr` ouverte avec l'émulateur, deux yeux affichés |
| `public/manifest.webmanifest`, `public/sw.js`, `public/icons/`, `src/pwa.js` | Génération de la PWA (manifeste, Service Worker hors ligne, icônes) | « Transforme l'application en PWA installable : ajoute un `manifest.webmanifest` (nom, couleurs, icônes 192, 512 et maskable), un Service Worker `sw.js` qui fonctionne hors ligne avec la stratégie « réseau d'abord, cache en secours », et `pwa.js` qui enregistre le Service Worker depuis `main.js`. Explique comment le vérifier dans l'onglet Application de Chrome. » | Claude Opus 5.5 (moyen) | Onglet Application de Chrome : manifeste valide, Service Worker actif, rechargement hors ligne réussi |
| `src/systems/Interaction.js` (saisie), `src/core/DesktopControls.js`, `src/scenes/BodyScene.js` | Saisie d'objets au grip (VR) et au clic droit (bureau) | « Ajoute de l'interactivité : dans `Interaction.js`, permets de saisir un objet avec le grip de la manette en VR et avec le clic droit en bureau, de le déplacer puis de le relâcher. Rends le cœur saisissable dans `BodyScene.js` (il revient à sa place quand on le lâche) et les molécules dans `LungsLevel.js` (elles sont déposées dans la zone où on les lâche). » | Claude Opus 5.5 (moyen) | Cœur et molécules saisis et relâchés dans l'émulateur, retour à leur place |
| `src/systems/Manipulation.js`, vibrations dans `Interaction.js` et `XRManager.js` | Retour haptique, snap turn au joystick, rotation et distance de l'objet tenu | « Propose des évolutions d'interactivité VR avancée compatibles avec notre projet, puis implémente-les : vibration des manettes au survol, à la sélection et à la saisie ; rotation de l'utilisateur par paliers de 30° au joystick (snap turn) ; rotation et rapprochement de l'objet tenu au joystick, avec la molette et les touches Q / E en bureau. Mets tout cela dans un nouveau fichier `Manipulation.js` et documente-le dans `MOTEUR_VR.md`. » | Claude Opus 5.5 (moyen) | Joystick et vibrations testés dans l'émulateur ; touches Q / E et molette en bureau |
| `docs/PIPELINE_XR.md` | Rédaction de la formalisation mathématique (poses, matrices, projection, raycasting, snap turn) | « Rédige `docs/PIPELINE_XR.md`, la formalisation mathématique du pipeline XR de notre projet : poses et matrices de vue, projection de chaque œil, lancer de rayon depuis la manette, saisie d'un objet (changement de repère avec `attach`), téléportation, snap turn, interpolations (smoothstep, slerp) et zones de dépôt des poumons. Chaque formule doit renvoyer au fichier du code qui l'utilise. » | Claude Opus 5.5 (moyen) | Formules recoupées avec le code (`XRPresenter.js`, `Interaction.js`, `Manipulation.js`) et avec la source de three.js |
| `tests/e2e/`, `playwright.config.js`, `docs/TESTS.md` | Génération des tests de bout en bout avec un casque Meta Quest 3 simulé | « Ajoute des tests automatiques de bout en bout avec Playwright et un casque Meta Quest 3 simulé (IWER). Ils doivent vérifier le démarrage en WebGPU, l'ouverture de la session `immersive-vr` avec les deux manettes, la sélection et la saisie du cœur, le snap turn, la mission complète des poumons et la PWA hors ligne. Ajoute le script `npm run test:e2e` et explique la stratégie dans `docs/TESTS.md`. » | Claude Opus 5.5 (moyen) | `npm run test:e2e` : 11 scénarios ; les tests ont trouvé un vrai bug (places du CO₂), corrigé dans `LungsLevel.js` |
| `src/pwa.js` (badge, bouton Installer), `index.html`, `styles.css` | Badge de connexion et bouton d'installation | « Rends la PWA visible pour l'utilisateur : ajoute un badge qui affiche « En ligne » ou « Hors ligne · mode cache » selon la connexion, et un bouton « Installer l'application » qui utilise l'événement `beforeinstallprompt`. Mets à jour `index.html`, `styles.css`, la documentation et le test PWA. » | Claude Opus 5.5 (moyen) | Badge « Hors ligne » en coupant le réseau, installation de l'application dans Chrome |
| `.github/workflows/ci.yml`, `deploy.yml`, `docs/CI_CD.md` | Intégration continue et déploiement continu sur GitHub Pages | « Explique l'intégration continue et le déploiement continu, puis mets-les en place avec GitHub Actions : à chaque push, `ci.yml` installe le projet, lance les tests unitaires, construit l'application et lance les tests Playwright ; à chaque push sur `main`, `deploy.yml` publie l'application sur GitHub Pages. Ajoute les badges dans le README et documente le tout dans `docs/CI_CD.md`. » | Claude Opus 5.5 (moyen) | Onglet Actions de GitHub ; site en ligne https://chouarizaineb.github.io/Inside-Human-VR/ |
| `tests/e2e/helpers.js`, `poumons.spec.js`, `pwa.spec.js`, `playwright.config.js` (corrections) | Analyse des échecs du CI et fiabilisation des tests | « Le CI échoue sur GitHub Actions alors que les tests passent sur mon PC (journal joint). Trouve la cause et rends les tests fiables sur une machine lente : remplace les délais fixes par des attentes sur l'état réel de l'application et augmente les limites de temps en CI. » | Claude Opus 5.5 (moyen) | Relance du CI dans GitHub Actions |
| `docs/MOTEUR_VR.md`, `ARCHITECTURE.md`, `GUIDE_GIT.md`, `README.md` (journal) | Rédaction et mise à jour de la documentation | « Après chaque étape, mets à jour la documentation : explique dans `MOTEUR_VR.md` et `ARCHITECTURE.md` ce qui a été ajouté et comment cela fonctionne, et ajoute une ligne au journal de bord du README (date, membre, branche, travail réalisé). » | Claude Opus 5.5 (moyen) | Relecture complète, chaque section expliquée oralement |

### 4.2 Visuels 3D, shaders et son (Yessmine Hentati)

| Composant concerné | Usage principal de l'IA | Demande faite à l'IA (reformulation fidèle) | Modèle | Vérification appliquée par l'étudiante |
|---|---|---|---|---|
| `src/shaders/tissuePulse.js` | Génération du battement en TSL et de l'équivalent JS | Demande rédigée par Yessmine | Modèle indiqué par Yessmine | Vérification visuelle du rythme à 72 bpm et de la cohérence avec `beatJS` |
| `src/shaders/bloodFlow.js` | Génération du matériau de flux et du profil d'oxygénation | Demande rédigée par Yessmine | Modèle indiqué par Yessmine | Contrôle du sens du flux (rouge = s'éloigne du cœur, bleu = revient) |
| `src/systems/Particles.js` | Génération des globules en `InstancedMesh` le long d'une courbe | Demande rédigée par Yessmine | Modèle indiqué par Yessmine | Test avec différents nombres de particules et mesure sur le PC de l’équipe : 60 fps en WebGPU, vue « Corps entier » (sandbox/xray.html) |
| `src/systems/ProceduralHeart.js`, `XrayBody.js`, `HeartAtlas.js` | Génération des scènes (cœur, corps, torse) et ajustement des proportions | Demande rédigée par Yessmine | Modèle indiqué par Yessmine | Comparaison avec les images de référence, correction des positions et tailles |
| `CREDITS.md`, `docs/` | Rédaction et conversion du cahier des charges en Markdown | Demande rédigée par Yessmine | Modèle indiqué par Yessmine | Relecture complète par l'équipe |

### 4.3 Jeu, données et interface (Melek Malouli)

| Composant concerné | Usage principal de l'IA | Demande faite à l'IA (reformulation fidèle) | Modèle | Vérification appliquée par l'étudiante |
|---|---|---|---|---|
| `src/levels/BrainLevel.js`, `BaseLevel.js`, `GameState`, sauvegarde IndexedDB, `tests/progression.test.js` | Indiqué par Melek | Demande rédigée par Melek | Modèle indiqué par Melek | `npm test` (tests de progression) |
