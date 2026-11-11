# Architecture d'Inside Human VR

Inside Human VR est une application web (PWA) de réalité virtuelle construite avec **Three.js** et son
**`WebGPURenderer`**. Elle fonctionne dans Chrome ou Edge sur PC, en mode VR (testé avec Immersive Web Emulator)
ou en mode bureau (souris et clavier).

## 1. Technologies

| Technologie | Version | Rôle |
|---|---|---|
| Three.js (`three/webgpu`) | r187 | Moteur 3D : scène, caméra, géométries, matériaux, chargement, XR |
| WebGPU | API du navigateur | Rendu graphique moderne (mode bureau) |
| TSL (Three Shading Language) | inclus dans Three.js | Shaders écrits en JavaScript, compilés en WGSL (WebGPU) ou GLSL (repli WebGL 2) |
| WebXR Device API | API du navigateur | Session `immersive-vr`, suivi de la tête et des manettes |
| Immersive Web Emulator | extension Chrome 2.0 | Simule un casque Meta Quest et ses manettes sur PC |
| Vite | 8 | Serveur de développement et build de production |
| JavaScript (ES modules) | ES2022 | Langage de tout le projet, sans framework |

## 2. Les couches de l'application

```
┌──────────────────────────────────────────────────────────────────────┐
│ PRÉSENTATION   index.html, styles.css, UIPanel.js (panneaux 3D)        │
├──────────────────────────────────────────────────────────────────────┤
│ SCÈNES ET NIVEAUX   BodyScene.js, TestScene.js, BaseLevel.js, HeartLevel.js │
├──────────────────────────────────────────────────────────────────────┤
│ LOGIQUE DE JEU   GameState.js (machine à états, score), EventBus.js    │
├──────────────────────────────────────────────────────────────────────┤
│ SYSTÈMES   Interaction.js, Teleport.js, Particles.js                   │
│ VISUELS    XrayBody.js, ProceduralHeart.js, HeartAtlas.js, shaders TSL │
├──────────────────────────────────────────────────────────────────────┤
│ MOTEUR   Engine.js, Renderer.js, XRManager.js, DesktopControls.js      │
├──────────────────────────────────────────────────────────────────────┤
│ PLATEFORME   Navigateur · WebGPU (repli WebGL 2) · WebXR               │
└──────────────────────────────────────────────────────────────────────┘
```

Chaque couche n'utilise que les couches situées en dessous. Une scène ou un niveau ne crée jamais
de renderer ni de session VR : il reçoit `engine`, `interaction` et `teleport` et s'en sert.

## 3. Démarrage de l'application (`src/main.js`)

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

## 5. WebGPU et VR : le repli WebGL 2

- En mode bureau, le rendu se fait en **WebGPU**.
- La VR native en WebGPU demande l'API `XRGPUBinding`, que Chrome ne fournit pas encore.
- Comme dans l'exemple officiel `webgpu_xr_cubes` de Three.js, `setupWebGLXRFallback` remplace le renderer,
  au moment d'entrer en VR, par un `WebGPURenderer({ forceWebGL: true })`.
- Le code reste entièrement écrit avec l'API `three/webgpu` ; les shaders TSL fonctionnent sur les deux backends.
- Conséquence : il ne faut jamais garder `engine.renderer` dans une variable ; l'événement `rendererchange` signale le changement.

## 6. Communication entre les modules

| Mécanisme | Utilisé pour | Exemple |
|---|---|---|
| `engine.onUpdate(cb)` | Code exécuté à chaque image | animer le cœur, mettre à jour le raycasting |
| Événements `THREE.EventDispatcher` | Signaux du moteur | `sessionstart`, `sessionend`, `select`, `rendererchange` |
| `EventBus` (Melek) | Événements du jeu | `missionSuccess`, `levelUnlocked`, `objectSelected` |
| Callbacks d'`interaction.addSelectable` | Réaction à un objet visé ou sélectionné | `onHover`, `onSelect` |

## 7. Patrons de conception

| Patron | Où | Pourquoi |
|---|---|---|
| Façade | `Engine.js` | Une seule API simple cache le renderer, la scène et la boucle |
| Strategy | `Interaction.js` | Même code de sélection avec deux entrées : manette VR ou souris |
| Observer | `EventDispatcher`, `EventBus`, `onUpdate` | Les modules réagissent sans dépendre les uns des autres |
| Template Method | `BaseLevel.js` | Déroulé commun des niveaux (`load`, `start`, `update`, `dispose`) |
| State | `GameState.js` | Phases d'un niveau : arrivée, exploration, mission, résultat, terminé |

## 8. Déploiement

`npm run build` produit le dossier `dist/` avec des chemins relatifs (`base: './'`), prêt pour GitHub Pages,
qui fournit le HTTPS obligatoire pour WebXR. En développement, `localhost` est accepté sans HTTPS.
