# Architecture d'Inside Human VR

Inside Human VR est une application web (PWA) de réalité virtuelle construite avec **Three.js** et son
**`WebGPURenderer`**. Elle fonctionne dans Chrome ou Edge sur PC, en mode VR (testé avec Immersive Web Emulator)
ou en mode bureau (souris et clavier).

## 1. Technologies

| Technologie | Version | Rôle |
|---|---|---|
| Three.js (`three/webgpu`) | r187 | Moteur 3D : scène, caméra, géométries, matériaux, chargement, XR |
| WebGPU | API du navigateur | Rendu graphique de toute la scène, en mode bureau comme en VR |
| TSL (Three Shading Language) | inclus dans Three.js | Shaders écrits en JavaScript, compilés en WGSL pour WebGPU |
| WebXR Device API | API du navigateur | Session `immersive-vr`, `local-floor`, pose de la tête, des yeux et des manettes, événements gâchette et grip |
| Service Worker + Web App Manifest | API du navigateur | PWA : installation et fonctionnement hors ligne |
| Immersive Web Emulator | extension Chrome 2.0 | Simule un casque Meta Quest et ses manettes sur PC |
| Vite | 8 | Serveur de développement et build de production |
| JavaScript (ES modules) | ES2022 | Langage de tout le projet, sans framework |

## 2. Les couches de l'application

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ PRÉSENTATION   src/index.html, src/styles/styles.css,                        │
│                scripts/systems/UIPanel.mjs (panneaux 3D)                     │
├──────────────────────────────────────────────────────────────────────────────┤
│ SCÈNES ET NIVEAUX   scripts/scenes/BodyScene.mjs, scripts/debug/TestScene.mjs, │
│                     scripts/levels/ (BaseLevel, HeartLevel, LungsLevel, BrainLevel) │
├──────────────────────────────────────────────────────────────────────────────┤
│ LOGIQUE DE JEU   scripts/data/GameState.mjs (machine à états, score),         │
│                  scripts/systems/EventBus.mjs                                │
├──────────────────────────────────────────────────────────────────────────────┤
│ SYSTÈMES   scripts/systems/ (Interaction, Teleport, Manipulation, Particles) │
│ VISUELS    scripts/systems/ (XrayBody, RealBody, HeartAtlas), scripts/shaders/ │
├──────────────────────────────────────────────────────────────────────────────┤
│ MOTEUR   scripts/core/ (Engine, Renderer, XRManager, XRPresenter,             │
│          DesktopControls, LevelManager, AudioManager, Voice)                 │
├──────────────────────────────────────────────────────────────────────────────┤
│ DONNÉES  src/assets/ (missions/missions.json, models/*.glb, icons/)          │
├──────────────────────────────────────────────────────────────────────────────┤
│ PLATEFORME   Navigateur · WebGPU · WebXR Device API · Service Worker (src/sw.mjs) │
└──────────────────────────────────────────────────────────────────────────────┘
```

Les chemins `scripts/…` sont relatifs à `src/` (par exemple `src/scripts/core/Engine.mjs`).

Chaque couche n'utilise que les couches situées en dessous. Une scène ou un niveau ne crée jamais
de renderer ni de session VR : il reçoit `engine`, `interaction` et `teleport` et s'en sert.

## 3. Démarrage de l'application (`src/scripts/main.mjs`)

1. `Engine` crée la scène, la caméra et le `WebGPURenderer`, puis attend `renderer.init()`.
2. `XRManager` vérifie en parallèle si la VR est disponible (au maximum 3 secondes d'attente) et prépare les manettes.
3. `DesktopControls` prépare le mode bureau (bouton « Mode bureau »).
4. `Interaction` (pointage) et `Teleport` (déplacement) sont créés.
5. La scène de départ est chargée : `BodyScene` (le corps humain), ou `TestScene` avec `?test` dans l'adresse.
6. `engine.start()` lance la boucle de rendu (`setAnimationLoop`).

## 4. Une image de la boucle de rendu

```
setAnimationLoop  →  Engine._loop(timestamp)
                       ├─ calcule delta (borné entre 0 et 0,1 s) et elapsed
                       ├─ appelle chaque fonction enregistrée avec engine.onUpdate :
                       │     Interaction.update()   → raycasting, survol
                       │     Teleport._update()     → animation des disques, fondu
                       │     BodyScene              → battement du cœur, flux du sang
                       └─ Renderer.render()       → dessine la scène
```

## 5. WebGPU et VR : comment la scène arrive dans le casque

```
navigator.xr.requestSession('immersive-vr', { requiredFeatures: ['local-floor'] })   ← XRManager
        │
        ▼  à chaque image du casque : session.requestAnimationFrame(onFrame)          ← XRPresenter
frame.getViewerPose(localFloor)  → tête (engine.camera) + 2 vues (projection, position de chaque œil)
frame.getPose(inputSource.targetRaySpace / gripSpace) → rayon et main de chaque manette
        │
        ▼
engine.step()      → Interaction, Teleport, niveaux (même code qu'en mode bureau)
WebGPURenderer.render(scene, ArrayCamera)   → les deux yeux en UNE passe WebGPU (shaders WGSL)
        │
        ▼
copie de l'image : texImage2D(canvas WebGPU) + blitFramebuffer → XRWebGLLayer → casque
```

- Le rendu est **entièrement WebGPU**. La couche WebGL (`XRWebGLLayer`) ne sert que de sortie : elle ne dessine rien.
- Pourquoi une couche WebGL ? La couche WebGPU (`XRGPUBinding`, module *WebXR/WebGPU Binding*) est encore un brouillon
  du W3C, derrière des drapeaux expérimentaux de Chrome, et Immersive Web Emulator ne la propose pas.
  Quand elle sera disponible, seule la méthode `XRPresenter._present()` changera.
- Pendant la VR, la boucle du mode bureau est arrêtée : c'est le casque qui rythme les images.

## 6. Communication entre les modules

| Mécanisme | Utilisé pour | Exemple |
|---|---|---|
| `engine.onUpdate(cb)` | Code exécuté à chaque image | animer le cœur, mettre à jour le raycasting |
| Événements `THREE.EventDispatcher` | Signaux du moteur | `sessionstart`, `sessionend`, `select`, `squeezestart`, `squeezeend` |
| `EventBus` (Melek) | Événements du jeu | `missionSuccess`, `levelUnlocked`, `objectSelected` |
| Callbacks d'`interaction.addSelectable` | Réaction à un objet visé, sélectionné ou saisi | `onHover`, `onSelect`, `onGrab`, `onRelease` |

## 7. Patrons de conception

| Patron | Où | Pourquoi |
|---|---|---|
| Façade | `Engine.mjs` | Une seule API simple cache le renderer, la scène et la boucle |
| Strategy | `Interaction.mjs` | Même code de sélection et de saisie avec deux entrées : manette VR ou souris |
| Observer | `EventDispatcher`, `EventBus`, `onUpdate` | Les modules réagissent sans dépendre les uns des autres |
| Template Method | `BaseLevel.mjs` | Déroulé commun des niveaux (`load`, `start`, `update`, `dispose`) |
| State | `GameState.mjs` | Phases d'un niveau : arrivée, exploration, mission, résultat, terminé |

## 8. Progressive Web App

| Élément | Fichier | Rôle |
|---|---|---|
| Manifeste | `src/manifest.webmanifest` | Nom, icônes, couleurs, `display: standalone` : l'application est installable |
| Service Worker | `src/sw.mjs` (servi à la racine du site : `./sw.mjs`) | Stratégie « réseau d'abord, cache en secours » : hors ligne, tout est servi depuis le cache |
| Enregistrement | `src/scripts/pwa.mjs` | `navigator.serviceWorker.register('./sw.mjs', { type: 'module' })`, puis envoi des fichiers déjà chargés au cache |
| Icônes | `src/assets/icons/` | 192 et 512 px, version « maskable », icône Apple |

Vérification : Chrome → F12 → onglet **Application** → *Manifest* et *Service Workers* ; cocher *Offline* puis recharger.

## 9. Déploiement

`npm run build` produit le dossier `dist/` avec des chemins relatifs (`base: './'`), prêt pour GitHub Pages,
qui fournit le HTTPS obligatoire pour WebXR. En développement, `localhost` est accepté sans HTTPS.

## 10. Arborescence du projet

Toute l'application est dans `src/`, qui est la **racine de Vite** (`root: 'src'` dans `vite.config.mjs`) :
l'adresse d'un fichier sur le site est son chemin à partir de `src/` (`src/assets/models/heart.glb` → `/assets/models/heart.glb`).

```
src/
├── index.html              Page d'accueil (point d'entrée du site)
├── manifest.webmanifest    Manifeste de la PWA
├── sw.mjs                  Service Worker
├── assets/                 Fichiers servis tels quels
│   ├── models/             Modèles 3D .glb, et draco/ (décodeur Draco de Three.js)
│   ├── missions/           missions.json : textes, explications et missions de chaque organe
│   ├── icons/              Icônes de l'application
│   └── audio/              Sons
├── pages/                  Pages d'essai des visuels (atlas, biologie, body, organs, xray)
├── styles/                 styles.css
└── scripts/                Tout le JavaScript de l'application (.mjs)
    ├── main.mjs, pwa.mjs   Point d'entrée et enregistrement du Service Worker
    ├── core/               Moteur (Engine, Renderer, XRManager, XRPresenter, LevelManager…)
    ├── systems/            Systèmes réutilisables (Interaction, Teleport, Particles, UIPanel…)
    ├── levels/             Niveaux (BaseLevel, HeartLevel, LungsLevel, BrainLevel)
    ├── scenes/             Scène de départ (BodyScene)
    ├── data/               État du jeu et sauvegarde (GameState, Storage)
    ├── shaders/            Shaders TSL
    ├── debug/              Scène de test du moteur
    ├── pages/              Scripts des pages de src/pages/
    └── tests/              Tests unitaires (*.test.mjs) et de bout en bout (e2e/*.spec.mjs)
```

| Dossier | Pourquoi |
|---|---|
| `src/index.html`, `src/pages/` | Les pages HTML. Le build construit l'accueil et les 5 pages d'essai (`build.rollupOptions.input`). |
| `src/sw.mjs`, `src/manifest.webmanifest` | Restent à la racine de `src/`, donc à la racine du site : la portée d'un Service Worker est limitée au dossier d'où il est servi, il doit être à la racine pour contrôler toute l'application. |
| `src/assets/` | Remplace l'ancien dossier `public/`. Ces fichiers sont chargés par leur nom pendant l'exécution (`assets/models/heart.glb`, `assets/missions/missions.json`, décodeur Draco) : leur adresse doit rester fixe. Le plugin `inside-human-static-files` de `vite.config.mjs` les sert sans transformation en développement et les copie tels quels dans `dist/` au build. |
| `src/scripts/` | Tout le code JavaScript, rangé par rôle (moteur, systèmes, niveaux…). Les noms des fichiers qui exportent une classe sont en PascalCase (`Engine.mjs`). |
| `src/scripts/tests/` | Les tests sont à côté du code qu'ils vérifient. Ils ne sont importés par aucune page : ils n'arrivent jamais dans `dist/`. |
| `src/styles/` | Feuilles de style ; Vite les regroupe et les minifie au build. |

**Ce qui reste à la racine du projet, et pourquoi :**

- `package.json`, `package-lock.json`, `vite.config.mjs`, `playwright.config.mjs`, `.nvmrc` : npm, Vite et Playwright
  cherchent leur configuration à la racine du projet (c'est aussi de là que sont lancées toutes les commandes `npm`).
- `tools/` : outils de développement (script Blender, scripts de migration). Ils ne font pas partie de l'application
  et ne doivent pas être publiés sur le site : hors de `src/`, ils ne peuvent pas se retrouver dans `dist/`.
- `docs/` et les fichiers `.md` : documentation du projet.
- `.github/workflows/ci-cd.yml` : GitHub Actions ne lit les workflows qu'à cet emplacement.
- `dist/` (non suivi par git) : résultat du build, publié sur GitHub Pages.
