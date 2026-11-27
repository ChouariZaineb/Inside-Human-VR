# Inside Human VR

[![CI/CD](https://github.com/ChouariZaineb/Inside-Human-VR/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/ChouariZaineb/Inside-Human-VR/actions/workflows/ci-cd.yml)

**Démo en ligne : https://chouarizaineb.github.io/Inside-Human-VR/** (Chrome ou Edge récent, WebGPU obligatoire)

Voyage immersif à l'intérieur du corps humain : une application éducative en réalité virtuelle
(WebXR + Three.js `WebGPURenderer`), projet SUP'COM Cycle Ingénieur.

**Équipe** : Chouari Zaineb (moteur et VR) · Hentati Yessmine (visuels, shaders et son) · Malouli Melek (jeu, données et interface)
**Encadrement** : Dr. Ing. Mohamed-Bécha Kaâniche

---

## 1. Installation et lancement

Prérequis : Node.js 26.13.1 LTS ou plus (version indiquée dans `.nvmrc`, utilisée par la CI), Chrome ou Edge récent.

```powershell
npm install        # installe Vite et Three.js
npm run dev        # serveur de développement : http://localhost:5173
npm run build      # build de production dans dist/
npm run preview    # teste le build de production en local
```

Au démarrage, l'application affiche la **scène du corps humain** (`src/scripts/scenes/BodyScene.mjs`) :
le corps « radio » avec le cœur qui bat et le sang qui circule, sur lequel on peut se téléporter.
Ajouter `?test` à l'adresse (`http://localhost:5173/?test`) charge la scène de test du moteur.

### Tester la VR sans casque (Immersive Web Emulator)

Avec la version 2.0 de l'extension, l'émulation s'active **site par site** depuis la barre d'outils
(il n'y a plus de contrôles dans l'onglet WebXR des outils de développement) :

1. Installer l'extension Chrome **Immersive Web Emulator** (Meta).
2. L'épingler : icône 🧩 Extensions de Chrome → punaise 📌 à côté de « Immersive Web Emulator ».
3. Ouvrir `http://localhost:5173`, puis cliquer sur l'icône de l'extension : elle passe du **bleu**
   (inactive) au **vert** (activée) et la page se recharge.
4. La console (F12) affiche `[XR] immersive-vr disponible` et le bouton **Entrer en VR** devient actif. Cliquer dessus.
5. Avec les contrôles flottants affichés **sur la page** (casque, manettes), orienter une manette vers
   un **disque bleu** puis appuyer sur la **gâchette** (trigger) pour s'y téléporter.
   Viser une sphère + gâchette affiche son nom dans la console.

Le panneau WebXR des outils de développement (F12) ne sert plus qu'aux réglages par défaut
(appareil, environnement, IPD, champ de vision).

### Mode bureau (sans VR)

| Action | Commande |
|--------|----------|
| Démarrer | Bouton **Mode bureau** (capture la souris) |
| Regarder | Souris |
| Se téléporter | Viser un disque bleu au réticule + clic gauche, ou touches **1** à **9** |
| Sélectionner un objet | Viser au réticule + clic gauche |
| Quitter | **Échap** |

En développement, un compteur d'images/s s'affiche en haut à gauche, et les objets du moteur sont
accessibles dans la console du navigateur via `window.app` (`app.engine`, `app.teleport`…).

---

### Tests

```
npm test                 # tests unitaires (progression, Melek)
npm run test:e2e         # 13 tests de bout en bout : WebGPU, VR simulée (Meta Quest 3), interactions, PWA hors ligne
npm run test:e2e:report  # rapport HTML du dernier passage
```

Détails : [`docs/TESTS.md`](docs/TESTS.md). Ces tests sont aussi lancés **automatiquement par GitHub Actions** (workflow unique
`ci-cd.yml`) à chaque push et à chaque pull request ; sur `main`, l'application est mise en ligne **seulement si tous les tests
passent** : voir [`docs/CI_CD.md`](docs/CI_CD.md).

---

## 2. Choix technique : WebGPU, WebXR et PWA

**Tout le rendu se fait avec le `WebGPURenderer` de Three.js, en mode bureau comme en VR.**

- **WebGPU** : la scène est dessinée par WebGPU (shaders TSL compilés en WGSL), aucun WebGL ni GLSL écrit à la main.
  WebGPU est **obligatoire** : sans WebGPU, l'application affiche un message au lieu de passer en WebGL 2.
- **WebXR Device API** : `XRManager` ouvre la session lui-même avec `navigator.xr.requestSession('immersive-vr')`
  (`local-floor` obligatoire), et `XRPresenter` lit à chaque image la pose de la tête (`frame.getViewerPose`),
  celle de chaque œil (`view.projectionMatrix`, `view.transform`) et celle des manettes (`frame.getPose`).
- **Les deux yeux en une passe WebGPU** grâce à une `ArrayCamera` (une sous-caméra et un viewport par œil).
- **Sortie vers le casque** : WebXR n'accepte aujourd'hui que des couches WebGL (`XRWebGLLayer`) ; la couche
  WebGPU (`XRGPUBinding`) est encore expérimentale dans Chrome et absente d'Immersive Web Emulator.
  L'image WebGPU est donc seulement **copiée** dans la couche (`texImage2D` + `blitFramebuffer`) : WebGL ne dessine rien.
- **Interactions** : sélection (gâchette / clic gauche) et **saisie** d'objets (bouton grip / clic droit maintenu).
- **PWA** : `src/manifest.webmanifest`, Service Worker `src/sw.mjs` (fonctionne hors ligne), icônes, enregistrement dans `src/scripts/pwa.mjs`
  (voir `docs/MOTEUR_VR.md`, section 14, et `docs/ARCHITECTURE.md`, section 8).

Pour l'équipe : importez toujours `import * as THREE from 'three/webgpu';`. Les addons de Three.js importent `'three'` :
`vite.config.mjs` redirige `'three'` vers `'three/webgpu'`.

---

## 3. Arborescence et répartition

```
Inside-Human-VR/
├── .github/workflows/
│   └── ci-cd.yml               CI/CD : build → tests e2e → déploiement GitHub Pages → Zaineb
├── docs/                       Documentation du projet
│   ├── ARCHITECTURE.md           Architecture générale et arborescence     → Zaineb
│   ├── MOTEUR_VR.md              Explication du moteur et de la VR         → Zaineb
│   ├── PIPELINE_XR.md            Formalisation mathématique du moteur      → Zaineb
│   ├── TESTS.md                  Stratégie de tests (unitaires, bout en bout) → Zaineb
│   ├── CI_CD.md                  Intégration et déploiement continus        → Zaineb
│   ├── GUIDE_GIT.md              Méthode de travail Git de l'équipe        → Zaineb
│   ├── VISUELS.md                Shaders, particules, modèles procéduraux  → Yessmine
│   └── CAHIER_DES_CHARGES.md     Cahier des charges                        → Yessmine
├── tools/                      Outils de développement (non publiés sur le site)
│   ├── blender/                  Script Blender et source .blend des modèles biologiques
│   ├── migrate-to-mjs.mjs        Passage de tous les fichiers JavaScript en .mjs
│   └── restructure-src.mjs       Passage à l'arborescence src/ actuelle
├── src/                        Tout le code de l'application (racine de Vite)
│   ├── index.html                Page d'accueil                            → Zaineb, puis Melek
│   ├── manifest.webmanifest      Manifeste de la PWA (nom, icônes, affichage) → Zaineb
│   ├── sw.mjs                    Service Worker : cache et hors ligne      → Zaineb
│   ├── assets/                   Fichiers servis tels quels (ni hachés, ni transformés)
│   │   ├── models/               Modèles GLB                               → Yessmine
│   │   │   └── draco/            Décodeur Draco (fichiers tiers de Three.js)
│   │   ├── missions/
│   │   │   └── missions.json     Textes, explications et missions de chaque organe → Melek
│   │   ├── icons/                Icônes de l'application                   → Zaineb
│   │   └── audio/                Sons (CC0)                                → Yessmine
│   ├── pages/                    Pages d'essai : atlas, biologie, body, organs, xray → Yessmine
│   ├── styles/
│   │   └── styles.css            Styles de la page d'accueil               → Zaineb, puis Melek
│   └── scripts/                  Tout le JavaScript de l'application (.mjs)
│       ├── main.mjs              Assemble le moteur, les systèmes et la scène → Zaineb
│       ├── pwa.mjs               Enregistrement du Service Worker (PWA)    → Zaineb
│       ├── core/                 Moteur                                    → Zaineb
│       │   ├── Engine.mjs          API centrale (scene, camera, player, onUpdate, isVR)
│       │   ├── Renderer.mjs        WebGPURenderer, scène, caméra, lumières, rendu stéréo
│       │   ├── XRManager.mjs       Session immersive-vr (API WebXR Device), manettes, rayons
│       │   ├── XRPresenter.mjs     Rendu WebGPU des deux yeux et copie vers le casque
│       │   ├── DesktopControls.mjs Mode bureau (PointerLockControls, réticule)
│       │   ├── LevelManager.mjs    Chargement des niveaux et passage de l'un à l'autre
│       │   ├── AudioManager.mjs    Sons (Web Audio)                        → Yessmine
│       │   └── Voice.mjs           Lecture à voix haute des textes         → Yessmine
│       ├── scenes/
│       │   └── BodyScene.mjs       Scène de départ : le corps humain en VR → Zaineb
│       ├── debug/
│       │   └── TestScene.mjs       Scène de test du moteur (?test)         → Zaineb
│       ├── systems/              Interaction, Manipulation, Teleport, XrayBody, RealBody, HeartAtlas,
│       │                         Particles, EventBus, UIPanel, Dashboard… → Zaineb, Yessmine, Melek
│       ├── shaders/              Shaders TSL (bloodFlow, tissuePulse, breathing, neuronSignal) → Yessmine
│       ├── levels/               BaseLevel, HeartLevel, BrainLevel → Melek ; LungsLevel → Zaineb
│       ├── data/                 GameState (machine à états, score), Storage (IndexedDB) → Melek
│       ├── pages/                Scripts des pages d'essai de src/pages/   → Yessmine
│       └── tests/                Tests unitaires (*.test.mjs, Melek) et de bout en bout (e2e/, Zaineb)
├── README.md, CREDITS.md, ATTRIBUTION.md  Présentation, licences des ressources
├── package.json, package-lock.json        Dépendances et commandes npm
├── vite.config.mjs             Configuration Vite (root src, CDN Three.js, fichiers statiques, HTTPS local) → Zaineb, Yessmine
├── playwright.config.mjs       Configuration des tests de bout en bout     → Zaineb
└── .nvmrc, .gitignore, .gitattributes
```

Les fichiers de configuration restent à la racine : npm, Vite et Playwright les cherchent à cet endroit.
`tools/` reste aussi à la racine : ce sont des outils de développement, ils ne doivent pas être publiés sur le site.
Détails : [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), section « Arborescence du projet ».

---

## 4. API du moteur

`main.mjs` crée les objets suivants et les passe aux scènes / niveaux :

| Objet | Rôle | API principale |
|-------|------|----------------|
| `engine` | Moteur | `scene`, `camera`, `renderer`, `player`, `onUpdate(cb)`, `isVR()`, `resetCameraPose()` |
| `xr` | VR | `supported`, `isPresenting`, `controllers`, `enter()`, `exit()` ; événements `sessionstart`, `sessionend`, `select` |
| `desktop` | Mode bureau | `isLocked`, `lock()`, `unlock()`, `setEnabled(bool)` ; événements `lock`, `unlock`, `select` |
| `interaction` | Pointage | `addSelectable(obj, { onHover, onSelect, highlight })`, `removeSelectable(obj)`, `clear()` |
| `teleport` | Déplacement | `setPoints([{ position, rotationY }])`, `teleportTo(point, { instant })`, `clear()` |

Points importants :

- **`engine.player`** est un `THREE.Group` qui contient la caméra et les manettes.
  Pour déplacer l'utilisateur, on déplace `player` (c'est ce que fait `teleport`), **jamais la caméra**.
- **`engine.onUpdate((delta, elapsed) => …)`** renvoie une fonction de désinscription : appelez-la dans `dispose()`.
- **`interaction`** fonctionne à l'identique en VR (rayon de la manette + gâchette) et en bureau
  (réticule + clic). `onHover({ object, hovered })` et `onSelect({ object, point, source })`.
  `highlight: true` (par défaut) allume l'objet au survol via la couleur émissive de son matériau.

### Exemple : un niveau minimal

```js
// src/levels/ExampleLevel.js
import * as THREE from 'three/webgpu';

export function createExampleLevel( { engine, interaction, teleport } ) {

	// 1. Décor
	const heart = new THREE.Mesh(
		new THREE.SphereGeometry( 0.5, 32, 16 ),
		new THREE.MeshStandardMaterial( { color: 0xc0182a } )
	);
	heart.name = 'Cœur';
	heart.position.set( 0, 1.5, - 3 );
	engine.scene.add( heart );

	// 2. Animation à chaque image
	const stopUpdate = engine.onUpdate( ( delta, elapsed ) => {

		heart.scale.setScalar( 1 + Math.sin( elapsed * 6 ) * 0.05 ); // battement

	} );

	// 3. Objet sélectionnable (manette ou souris)
	interaction.addSelectable( heart, {
		onHover: ( { hovered } ) => console.log( hovered ? 'Survol du cœur' : 'Fin du survol' ),
		onSelect: ( { object } ) => console.log( `Sélection : ${object.name}` )
	} );

	// 4. Points de téléportation (au sol, regard vers -Z quand rotationY = 0)
	const points = [
		{ position: new THREE.Vector3( 0, 0, 0 ), rotationY: 0 },
		{ position: new THREE.Vector3( 2, 0, - 2 ), rotationY: Math.PI / 2 }
	];
	teleport.setPoints( points );
	teleport.teleportTo( points[ 0 ], { instant: true } );

	// 5. Libération (appelée en quittant le niveau)
	return function dispose() {

		stopUpdate();
		interaction.removeSelectable( heart );
		teleport.clear();
		engine.scene.remove( heart );
		heart.geometry.dispose();
		heart.material.dispose();

	};

}
```

Pour l’essayer, remplacer dans `src/main.mjs` l’appel `createBodyScene( … )` par `createExampleLevel( … )`.
`src/debug/TestScene.mjs` est un exemple complet qui suit le même modèle.

---

## 5. Règles Git de l'équipe

Le prof regarde la contribution de chacun dans Git : chacun travaille **sur sa propre branche** et fait
**ses propres commits**, avec son propre compte.

- Configurer son nom une seule fois :
  `git config user.name "Prénom Nom"` et `git config user.email "son-email-github"`.
- Chaque semaine, créer sa branche à partir de `develop` (le nom est indiqué dans sa tâche) :
  `git checkout develop` → `git pull origin develop` → `git checkout -b feature/<nom>`.
- Faire **au moins un commit par jour de travail**, petit et clair.
- Format des messages : `feat: ...` (nouveauté), `fix: ...` (correction), `docs: ...` (documentation),
  `chore: ...` (configuration). Exemple : `feat: mission du globule rouge`.
- Avant de commencer chaque jour : `git pull origin develop` pour récupérer le travail des autres.
- Vérifier que `npm run build` passe avant chaque `git push`.
- À la fin de la semaine : ouvrir une **pull request** vers `develop` ; un autre membre la relit puis la fusionne.
- Ne jamais travailler directement sur `main`. Le vendredi, `develop` est fusionnée dans `main` pour la démonstration.

Branches : `main` (version stable) · `develop` (intégration) · `feature/<nom>` (une par fonctionnalité).

---

## 6. Journal des tâches

Sprint 1 : du 4 au 8 novembre 2026 · Sprint 2 : du 9 au 15 novembre 2026.

### Sprint 1 : socle technique et niveau du cœur

| Date | Membre | Branche | Tâche | État |
|------|--------|---------|-------|------|
| 2026-11-04 | Chouari Zaineb | `main` | Initialisation du projet Vite, installation de Three.js r187, arborescence, branches `main` et `develop` | Fait |
| 2026-11-04 | Chouari Zaineb | `feature/moteur-vr` | `Renderer.mjs` : WebGPURenderer, scène, caméra, lumières, repli WebGL officiel pour la XR | Fait |
| 2026-11-04 | Chouari Zaineb | `feature/moteur-vr` | `Engine.mjs` : API centrale (`player`, `onUpdate`, `isVR`, boucle `setAnimationLoop`) | Fait |
| 2026-11-04 | Chouari Zaineb | `feature/moteur-vr` | `XRManager.mjs` : session `immersive-vr` en `local-floor`, deux manettes avec modèles et rayon | Fait |
| 2026-11-04 | Chouari Zaineb | `feature/moteur-vr` | `DesktopControls.mjs` : mode bureau (PointerLockControls, réticule, Échap) | Fait |
| 2026-11-04 | Chouari Zaineb | `feature/moteur-vr` | `Interaction.mjs` : raycasting unifié manette/souris (patron Strategy), survol et sélection | Fait |
| 2026-11-04 | Chouari Zaineb | `feature/moteur-vr` | `Teleport.mjs` : points de téléportation animés, fondu au noir, touches 1 à 9 | Fait |
| 2026-11-04 | Chouari Zaineb | `feature/moteur-vr` | `TestScene.mjs`, page d'accueil, compteur d'images/s, README (API du moteur, règles Git) | Fait |
| 2026-11-05 | Chouari Zaineb | `feature/moteur-vr` | Vérification VR non bloquante, message précis « VR non disponible », instructions Immersive Web Emulator 2.0 | Fait |
| 2026-11-05 | Malouli Melek | `feature/jeu-coeur` | `levels.json` : textes, questions et missions des 3 niveaux en français | Fait |
| 2026-11-05 | Malouli Melek | `feature/jeu-coeur` | `EventBus.mjs` et `GameState.mjs` : bus d'événements, machine à états et score | Fait |
| 2026-11-05 | Malouli Melek | `feature/jeu-coeur` | `BaseLevel.mjs` et `UIPanel.mjs` : classe de base des niveaux, panneaux 3D flottants | Fait |
| 2026-11-05 | Malouli Melek | `feature/jeu-coeur` | `HeartLevel.mjs` : mission du globule rouge (niveau 1) | Fait |
| 2026-11-05 | Hentati Yessmine | `feature/visuels-coeur` | Recherche des modèles 3D ; choix de modèles procéduraux (légers, sans contrainte de licence) | Fait |

### Sprint 2 : intégration, scène du corps humain et niveaux suivants

| Date | Membre | Branche | Tâche | État |
|------|--------|---------|-------|------|
| 2026-11-10 | Hentati Yessmine | `feature/visuels-coeur` | Shaders TSL `bloodFlow.mjs` (flux du sang) et `tissuePulse.mjs` (battement du cœur) | Fait |
| 2026-11-10 | Hentati Yessmine | `feature/visuels-coeur` | `Particles.mjs` (globules rouges), `ProceduralHeart.mjs`, `XrayBody.mjs` (corps humain), `HeartAtlas.mjs` | Fait |
| 2026-11-10 | Hentati Yessmine | `feature/visuels-coeur` | Pages d'essai `sandbox/`, `CREDITS.md`, `docs/VISUELS.md`, `docs/CAHIER_DES_CHARGES.md` | Fait |
| 2026-11-11 | Malouli Melek | `develop`, `main` | Fusion de `feature/jeu-coeur` dans `develop` puis dans `main` (PR #1 et #4) | Fait |
| 2026-11-11 | Chouari Zaineb | `feature/integration-sprint2` | Synchronisation des trois branches (moteur, jeu, visuels) et résolution des conflits (`README.md`, `vite.config.mjs`) | Fait |
| 2026-11-11 | Chouari Zaineb | `feature/integration-sprint2` | Correction du moteur : `delta` borné entre 0 et 0,1 s (le premier delta pouvait être négatif) | Fait |
| 2026-11-11 | Chouari Zaineb | `feature/integration-sprint2` | `BodyScene.mjs` : corps humain en `immersive-vr`, 3 points de téléportation, cœur sélectionnable | Fait |
| 2026-11-11 | Chouari Zaineb | `feature/integration-sprint2` | Dossier `docs/` : `ARCHITECTURE.md`, `MOTEUR_VR.md`, `GUIDE_GIT.md` ; journal des Sprints 1 et 2 | Fait |
| 2026-11-12 | Malouli Melek | `feature/niveau-cerveau` | Tester `HeartLevel` dans l'application (lancé par `LevelManager` depuis le cœur de `BodyScene`) et ajuster textes et positions | En cours |
| 2026-11-12 | Hentati Yessmine | `feature/visuels-niveau-coeur` | Remplacer les formes provisoires de `HeartLevel` par le cœur procédural (`registerElement`) | En cours |
| 2026-11-12 | Chouari Zaineb | `feature/niveau-poumons` | `LevelManager.mjs` : un niveau en mémoire à la fois, transitions, lien `Interaction` → `EventBus` pour les niveaux de `BaseLevel` | Fait |
| 2026-11-12 | Chouari Zaineb | `feature/niveau-poumons` | `LungsLevel.mjs` : alvéole, bronche, capillaire, mission des échanges gazeux (O₂ et CO₂), sang qui passe du bleu au rouge | Fait |
| 2026-11-12 | Chouari Zaineb | `feature/niveau-poumons` | `main.mjs` : parcours scène de départ → cœur → poumons → retour, adresse `?level=` pour les tests | Fait |
| 2026-11-12 | Chouari Zaineb | `feature/niveau-poumons` | Documentation de `LevelManager` et `LungsLevel` dans `docs/MOTEUR_VR.md` | Fait |
| 2026-11-14 | Hentati Yessmine | `feature/visuels-poumons-cerveau` | Respiration, changement de couleur du sang, shader `neuronSignal.mjs`, `AudioManager.mjs` | À faire |
| 2026-11-12 | Malouli Melek | `feature/niveau-cerveau` | `BrainLevel.mjs`, `Storage.mjs` (IndexedDB), déblocage des niveaux, écran d'accueil final, tests de progression (PR #9) | Fait |
| 2026-11-12 | Chouari Zaineb | `feature/webgpu-xr-pwa` | VR avec l'API WebXR Device rendue en WebGPU : `XRPresenter.mjs` (ArrayCamera, copie vers `XRWebGLLayer`), `XRManager.mjs` (session, `inputSources`, `getPose`), WebGPU obligatoire | Fait |
| 2026-11-12 | Chouari Zaineb | `feature/webgpu-xr-pwa` | Saisie d'objets : grip en VR, clic droit en bureau (`Interaction.mjs`) ; molécules à déposer (`LungsLevel`), cœur à sortir du corps (`BodyScene`) | Fait |
| 2026-11-12 | Chouari Zaineb | `feature/webgpu-xr-pwa` | PWA : `manifest.webmanifest`, Service Worker `sw.mjs` (réseau d'abord, cache en secours, hors ligne), icônes, `src/pwa.mjs` | Fait |
| 2026-11-12 | Chouari Zaineb | `feature/webgpu-xr-pwa` | Documentation : `MOTEUR_VR.md`, `ARCHITECTURE.md`, README | Fait |
| 2026-11-12 | Chouari Zaineb | `feature/interactivite-vr` | Retour haptique (vibration des manettes), `Manipulation.mjs` : rotation sur soi par paliers, rotation et distance de l'objet tenu (joystick, molette, Q / E) | Fait |
| 2026-11-12 | Chouari Zaineb | `feature/pipeline-maths` | `docs/PIPELINE_XR.md` : formalisation mathématique du moteur (poses WebXR, matrices de vue et de projection, raycasting, saisie, téléportation, snap turn, interpolations, zones de dépôt) | Fait |
| 2026-11-12 | Chouari Zaineb | `feature/tests-e2e` | Tests de bout en bout Playwright + iwer (casque Meta Quest 3 simulé) : 11 scénarios (WebGPU, session VR, gâchette, grip, joystick, snap turn, mission des poumons, PWA hors ligne) | Fait |
| 2026-11-12 | Chouari Zaineb | `feature/tests-e2e` | Correction trouvée par les tests : places d'arrivée du CO₂ hors de la zone de dépôt de l'alvéole (`LungsLevel`) | Fait |
| 2026-11-12 | Chouari Zaineb | `feature/tests-e2e` | `docs/TESTS.md` : stratégie de tests et scénarios | Fait |
| 2026-11-12 | Chouari Zaineb | `feature/pwa-badge` | PWA visible : badge de connexion (« En ligne » / « Hors ligne · mode cache »), bouton « Installer l'application » (`beforeinstallprompt`), test automatique du badge ; section PWA rétablie dans `MOTEUR_VR.md` | Fait |
| 2026-11-12 | Chouari Zaineb | `feature/ci-cd` | Intégration continue (GitHub Actions, `ci.yml`) : installation, tests unitaires, build et 11 tests de bout en bout à chaque push et pull request | Fait |
| 2026-11-12 | Chouari Zaineb | `feature/ci-cd` | Déploiement continu (`deploy.yml`) : publication automatique sur GitHub Pages (HTTPS) à chaque fusion dans `main` ; `docs/CI_CD.md` ; badges et lien de démo | Fait |
| 2026-11-28 | Chouari Zaineb | `feature/restructuration-src` | Arborescence demandée par le superviseur : tout le code dans `src/` (`assets/`, `scripts/`, `pages/`, `styles/`), suppression de `public/`, `sandbox/` et `tests/` (script `tools/restructure-src.mjs`, `git mv`) ; contenu des missions dans `src/assets/missions/missions.json` ; un seul workflow `ci-cd.yml` (build → e2e → déploiement seulement si tous les tests passent), Ubuntu 26.04, Node 26.13.1 LTS ; documentation mise à jour | Fait |
