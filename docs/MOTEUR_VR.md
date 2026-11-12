# Le moteur et la VR (partie de Chouari Zaineb)

Ce document explique chaque fichier du moteur : ce qu'il fait, comment il le fait et pourquoi.

| Fichier | En une phrase |
|---|---|
| `vite.config.js` | Configure l'outil de développement Vite |
| `src/main.js` | Assemble toutes les pièces et lance l'application |
| `src/core/Renderer.js` | Crée la scène, la caméra, les lumières et le WebGPURenderer |
| `src/core/Engine.js` | L'API centrale que tout le monde utilise, et la boucle de rendu |
| `src/core/XRManager.js` | Ouvre la session VR avec l'API WebXR Device et suit les deux manettes |
| `src/core/XRPresenter.js` | Rend les deux yeux en WebGPU et envoie l'image au casque |
| `src/core/DesktopControls.js` | Le mode bureau : regarder à la souris, viser au réticule |
| `src/systems/Interaction.js` | Savoir ce que l'utilisateur vise et sélectionne (raycasting) |
| `src/systems/Teleport.js` | Se déplacer par téléportation, avec un fondu au noir |
| `src/systems/Manipulation.js` | Joysticks : tourner sur soi, faire tourner et approcher l'objet tenu |
| `src/scenes/BodyScene.js` | La scène de départ : le corps humain |
| `src/core/LevelManager.js` | Charge un niveau à la fois et passe de l'un à l'autre |
| `src/levels/LungsLevel.js` | Le niveau 2 : les poumons et les échanges gazeux |
| `src/debug/TestScene.js` | Une scène de test du moteur, sans modèle |

---

## 1. `vite.config.js` : la configuration

**Vite** est l'outil qui lance le serveur de développement (`npm run dev`) et fabrique la version finale (`npm run build`).

| Réglage | Explication |
|---|---|
| `base: './'` | Les chemins sont relatifs : le site marche aussi dans un sous-dossier, comme sur GitHub Pages. |
| `alias three → three/webgpu` | Les modules complémentaires de Three.js (« addons ») importent `'three'`. On les redirige vers `'three/webgpu'` pour n'avoir qu'**une seule copie** de Three.js. Deux copies casseraient le rendu. |
| `target: 'esnext'` | On produit du JavaScript moderne : WebGPU n'existe de toute façon que dans les navigateurs récents. |
| `server.https` | Ajouté par Yessmine : si un certificat existe dans `certs/`, le serveur passe en HTTPS (utile pour un vrai casque en réseau). |

## 2. `src/main.js` : l'assemblage

C'est le point d'entrée, chargé par `index.html`. Il crée les objets dans l'ordre :

1. `new Engine(...)` puis `await engine.init()` : le moteur et le renderer.
2. `new XRManager(engine, bouton)` puis `xr.init()` : la VR (vérification en parallèle, sans bloquer).
3. `new DesktopControls(engine, réticule)` : le mode bureau, relié au bouton « Mode bureau ».
4. `new Interaction(engine, xr, desktop)` et `new Teleport(engine, interaction)` : les systèmes.
5. Il cache l'écran d'accueil quand on entre en VR ou en mode bureau, et le réaffiche en sortant.
6. Il charge `createBodyScene(...)`, ou `createTestScene(...)` si l'adresse contient `?test`.
7. En développement seulement : un compteur d'images/s et `window.app` pour déboguer dans la console.
8. `engine.start()` lance la boucle.

`await` au niveau du module (« top-level await ») est possible grâce à `target: 'esnext'`.

## 3. `src/core/Renderer.js` : le rendu

**Ce qu'il crée :**
- `scene` : la scène 3D, avec une couleur de fond.
- `camera` : une `PerspectiveCamera` (champ de vision 70°, `near` = 0,01 m car on est miniaturisé, `far` = 200 m), placée à 1,6 m (hauteur des yeux).
- deux lumières : une `HemisphereLight` (lumière d'ambiance ciel/sol) et une `DirectionalLight` (comme le soleil).
- le **`WebGPURenderer`** : `antialias` (bords lisses), `pixelRatio` limité à 2 en mode bureau. Son gestionnaire XR intégré est désactivé (`xr.enabled = false`) : la VR passe par `XRManager` et `XRPresenter`.

**Points importants :**
- `await renderer.init()` : WebGPU s'initialise de façon **asynchrone** (il faut demander la carte graphique). La console affiche `[Renderer] Backend : WebGPU`.
- **WebGPU obligatoire** : le `WebGPURenderer` de Three.js sait repasser tout seul sur WebGL 2 quand le navigateur n'a pas WebGPU. Nous refusons ce repli : si `navigator.gpu` n'existe pas, ou si le backend obtenu n'est pas WebGPU, `init()` lève une erreur, et `main.js` l'affiche sur l'écran d'accueil en bloquant les boutons.
- `render()` : mode bureau, une caméra, via `DirectRenderPipeline`.
- `renderStereo(arrayCamera)` : mode VR, **les deux yeux en une seule passe WebGPU**. L'`ArrayCamera` contient une sous-caméra par œil, chacune avec son `viewport` (moitié gauche, moitié droite de l'image).
- `setXRSize(l, h)` / `restoreSize()` : en VR, le canvas prend la taille de l'image du casque (pixel ratio 1) ; on revient à la taille de la fenêtre en sortant.

## 4. `src/core/Engine.js` : l'API centrale

C'est une **façade** : une seule entrée simple pour tout le moteur.

| Membre | Rôle |
|---|---|
| `engine.scene`, `engine.camera`, `engine.renderer` | Accès aux objets du rendu |
| `engine.player` | Un `Group` qui contient la caméra et les manettes. **On déplace le joueur en déplaçant ce groupe**, car en VR la position de la caméra est imposée par le casque. |
| `engine.onUpdate(cb)` | Enregistre une fonction appelée à chaque image avec `(delta, elapsed)`. Renvoie une fonction pour se désabonner. |
| `engine.isVR()` | Vrai pendant une session VR (`engine.xrActive`, mis à jour par `XRManager`). |
| `engine.step(t)` | Met à jour la logique d'une image (toutes les fonctions `onUpdate`). Appelé par la boucle du bureau ET par celle du casque. |
| `engine.renderStereo(cam)` | Rendu VR des deux yeux (voir `Renderer`). |
| `engine.pauseDesktopLoop(oui/non)` | Arrête la boucle de la fenêtre pendant la VR, la relance après. |
| `engine.resetCameraPose()` | Remet la caméra à 1,6 m, regard droit devant (en sortie de VR). |
| `engine.start()` | Lance la boucle du mode bureau avec `setAnimationLoop`. |

**La boucle**, à chaque image :
1. `Timer` calcule `delta` (temps depuis l'image précédente) et `elapsed` (temps total).
2. `delta` est **borné entre 0 et 0,1 s** : au premier affichage, il pouvait être légèrement négatif (ce qui faisait planter l'animation du sang), et après une pause il peut être énorme.
3. Toutes les fonctions `onUpdate` sont appelées (`step`).
4. La scène est dessinée : `render()` en bureau, `renderStereo()` en VR.

**Deux rythmes d'images** : en mode bureau, `setAnimationLoop` suit l'écran ; en VR, c'est `session.requestAnimationFrame` (le casque, 72 à 120 images par seconde) qui appelle `step` puis `renderStereo`.

## 5. `src/core/XRManager.js` : la session VR avec l'API WebXR Device

**Vérification du support (`init`)** :
- Si `navigator.xr` n'existe pas, la VR est impossible (navigateur non compatible ou page non sécurisée).
- `navigator.xr.isSessionSupported('immersive-vr')` demande si un casque est disponible. Cette promesse pouvait ne jamais répondre : on la met en **course** (`Promise.race`) avec un minuteur de 3 secondes.
- L'événement `devicechange` relance la vérification si un casque (ou l'émulateur) apparaît plus tard.

**Démarrer la VR (`enter`)** :
1. `navigator.xr.requestSession('immersive-vr', { requiredFeatures: ['local-floor'] })` : la session immersive.
2. Écoute des événements de la session : `inputsourceschange` (manettes ajoutées ou retirées), `selectstart` (gâchette), `squeezestart` / `squeezeend` (bouton grip).
3. Arrêt de la boucle du bureau, puis `presenter.start(session)` (voir `XRPresenter`).
4. En fin de session (`end`), la caméra reprend sa pose du mode bureau et la boucle de la fenêtre repart.

**Les manettes** :
- Deux groupes par manette, créés une fois et placés dans `engine.player` (ils suivent les téléportations) : le **rayon** (`targetRaySpace`) et la **main** (`gripSpace`, avec le modèle 3D officiel de la manette, `XRControllerModelFactory`).
- `session.inputSources` : la manette gauche prend l'index 0, la droite l'index 1.
- À chaque image : `frame.getPose(source.targetRaySpace, localFloor)` et `frame.getPose(source.gripSpace, localFloor)` donnent la matrice de chaque manette.
- Événements émis pour les autres modules : `select`, `squeezestart`, `squeezeend`, `sessionstart`, `sessionend`.

## 6. `src/core/DesktopControls.js` : le mode bureau

- `PointerLockControls` (addon de Three.js) : la souris est **capturée** par la page et oriente le regard. Échap la libère (comportement du navigateur).
- Un **réticule** (petit point au centre de l'écran) sert de viseur.
- **Clic gauche** : émet `select`. **Clic droit maintenu** : émet `grabstart`, puis `grabend` au relâchement (saisir un objet, comme le grip en VR). Le menu contextuel du navigateur est bloqué pendant la capture.
- `setEnabled(false)` désactive tout pendant la VR.
- `lock()` doit être appelé depuis un clic de l'utilisateur : c'est une règle de sécurité du navigateur.

## 7. `src/systems/Interaction.js` : viser et sélectionner

**Le raycasting** : on lance un rayon invisible et on cherche le premier objet touché.
- En VR : un rayon par manette (`raycaster.setFromXRController(controller)`).
- En bureau : un rayon depuis le centre de l'écran (`raycaster.setFromCamera(centre, camera)`).

C'est le **patron Strategy** : la même logique avec deux sources d'entrée différentes.

**À chaque image (`update`)** :
1. Pour chaque pointeur actif, on lance le rayon sur les objets enregistrés.
2. On compare avec l'image précédente : début de survol → `onHover({ hovered: true })`, fin → `onHover({ hovered: false })`.
3. Par défaut, l'objet survolé s'allume (couleur `emissive` du matériau).
4. En VR, la ligne du rayon s'arrête sur l'objet touché.

**La sélection** : quand `xr` ou `desktop` émet `select`, on prend l'objet visé par ce pointeur et on appelle son `onSelect({ object, point, source })`.

**La saisie (grab)** :
- Un objet enregistré avec `grabbable: true` peut être saisi : bouton **grip** en VR (`squeezestart`), **clic droit maintenu** en bureau.
- L'objet visé est accroché à la manette (ou à la caméra) avec `holder.attach(objet)`, qui garde sa position dans le monde : il suit la main.
- Au relâchement, il est rendu à son parent d'origine (`parent.attach(objet)`) et `onRelease({ object, position })` reçoit l'endroit du lâcher, pour que le niveau décide quoi faire.

**API** : `addSelectable(objet, { onHover, onSelect, highlight, grabbable, onGrab, onRelease })`, `removeSelectable(objet)`, `clear()`, `isHeld(objet)`.
Un objet enregistré l'est avec tous ses enfants : viser un enfant compte comme viser le parent.

## 8. `src/systems/Teleport.js` : se déplacer

- `setPoints([{ position, rotationY }])` crée un **disque bleu** au sol pour chaque point et l'enregistre dans `Interaction`.
- Viser un disque le fait grossir et tourner ; le sélectionner lance `teleportTo(point)`.
- **Fondu au noir** : une petite sphère noire collée à la caméra devient opaque en 0,15 s, le joueur est déplacé, puis elle redevient transparente en 0,15 s. C'est une sphère et non un effet d'écran pour que le fondu soit visible aussi dans le casque.
- **Déplacement (`_move`)** : on déplace `engine.player`. En VR, la tête de l'utilisateur n'est pas forcément au centre du groupe (il peut s'être déplacé dans sa pièce) : on corrige pour que **la tête** arrive exactement sur le point.
- Touches 1 à 9 en mode bureau : téléportation directe vers le point n°1 à 9.
- **Pourquoi la téléportation ?** Un déplacement continu en VR provoque le mal des transports (les yeux voient bouger, le corps ne sent rien).

## 9. `src/scenes/BodyScene.js` : la scène du corps humain

C'est la scène affichée au démarrage. Elle répond à la demande : *afficher le modèle 3D du corps humain dans l'environnement immersive-vr*.

1. Elle appelle `createXrayBody()` (module de Yessmine) : un corps humain « radio » généré par code, avec la cage thoracique, les poumons, le cœur, les artères et les veines.
2. Le corps mesure environ 10 unités ; on le met à l'échelle 0,35, donc environ **3,5 m** : l'utilisateur se sent déjà petit devant lui. Ses pieds sont posés sur le sol, 4 m devant le point de départ.
3. Une plateforme ronde bleu nuit avec un anneau lumineux.
4. Trois points de téléportation : vue d'ensemble, devant le thorax, vue de côté.
5. Le **cœur est sélectionnable** : il grossit au survol, et sa sélection lance le niveau 1 (`HeartLevel` de Melek).
   Il est aussi **saisissable** : il vient dans la main, à taille réelle (environ 35 cm), pour l'observer sous tous les angles ; lâché, il revient en 0,8 s à sa place dans la poitrine (`lerp` de la position, `slerp` de la rotation).
6. `engine.onUpdate((delta) => body.update(delta))` : le cœur bat et les flèches du sang avancent à chaque image.
7. La fonction `dispose()` renvoyée libère tout proprement (utile quand on changera de niveau).

## 10. `src/debug/TestScene.js` : la scène de test

Une scène sans modèle externe pour tester le moteur seul : un tunnel (`TubeGeometry`) qui évoque un vaisseau sanguin,
un sol, 3 points de téléportation et 3 sphères sélectionnables (globule rouge, globule blanc, plaquette).
Elle sert aussi d'exemple d'utilisation de l'API du moteur. On l'ouvre avec `http://localhost:5173/?test`.

## 11. `src/core/LevelManager.js` : passer d'un niveau à l'autre

Il garde **un seul niveau en mémoire** à la fois. Pour charger un niveau (`load(id)`) :

1. il libère le niveau courant : ses objets pointables sont retirés d'`Interaction`, ses points de téléportation effacés, puis son `dispose()` est appelé ;
2. il crée le nouveau niveau avec la « fabrique » enregistrée par `register(id, fabrique)`, puis attend `load()` ;
3. il installe ses points de téléportation (`getTeleportPoints()`) et place le joueur sur le premier ;
4. il relie ses objets pointables (`getInteractables()`) à `Interaction` ;
5. il appelle `start()`, puis `update(delta, elapsed)` à chaque image.

**Le lien avec le code de Melek** : `BaseLevel` attend l'événement `EVENTS.OBJECT_SELECTED` sur l'`EventBus`. Quand `Interaction` signale une sélection, `LevelManager` émet cet événement : les niveaux de Melek fonctionnent donc avec le moteur sans modification.

**La suite des niveaux** : quand un niveau émet `EVENTS.LEVEL_COMPLETED`, `LevelManager` charge le niveau qu'il débloque (champ `unlocks` de `levels.json`) s'il existe, sinon il revient à la scène de départ (`home`).

Dans `main.js` : `home` (le corps humain), `heart` (`HeartLevel` de Melek) et `lungs` (`LungsLevel`) sont enregistrés. Sélectionner le cœur dans la scène de départ lance le niveau 1. Pour tester un niveau directement : `http://localhost:5173/?level=lungs`.

## 12. `src/levels/LungsLevel.js` : le niveau des poumons

Il **hérite de `BaseLevel`** (classe de Melek, patron Template Method) : il ne redéfinit que les « crochets » `onLoad`, `onStart`, `onSelect`, `onUpdate` et `onDispose`. Les textes viennent de `levels.json`.

- **Décor généré par code** : une bronche (cylindre), une alvéole (sphère rose transparente qui « respire ») et un capillaire (demi-anneau autour de l'alvéole).
- **Molécules** : 3 O₂ (deux atomes rouges) devant l'alvéole et 3 CO₂ (un atome gris entre deux rouges) devant le capillaire.
- **Déroulé** (machine à états `GameState` de Melek) : arrivée (bouton « Explorer ») → exploration (pointer un élément affiche son rôle) → mission → résultat (bouton « Continuer ») → terminé.
- **Mission, deux façons de jouer**, en VR comme en bureau :
  - **saisir** une molécule (grip ou clic droit), la porter et la **lâcher** dans l'alvéole ou dans le capillaire : `_zoneAt()` regarde dans quelle zone elle se trouve (distance au centre de l'alvéole, distance à l'arc du capillaire) ; hors zone, elle retourne à sa place ;
  - ou sélectionner une molécule (elle grossit et s'allume en jaune), puis sélectionner sa destination.
  - Bonne destination : `gameState.recordCorrect()`, la molécule traverse la paroi en 0,8 s.
  - Mauvaise destination : `gameState.recordError()` et message d'erreur de `levels.json` (−10 points).
  - Même endroit que le départ : la molécule est simplement relâchée.
- **Le sang change de couleur** : la couleur du capillaire passe du bleu au rouge selon le nombre d'O₂ arrivés (`Color.lerp`).
- À la fin : `gameState.finishLevel()` enregistre le score et débloque le niveau du cerveau.

## 13. `src/core/XRPresenter.js` : la VR rendue en WebGPU

Il fait le lien entre la session WebXR et le `WebGPURenderer`.

**Au démarrage (`start`)** :
1. un contexte WebGL compatible XR (`xrCompatible: true`) et une couche `XRWebGLLayer`, déclarée avec `session.updateRenderState({ baseLayer })` ;
2. l'espace de référence `session.requestReferenceSpace('local-floor')` (origine au sol) ;
3. la boucle du casque : `session.requestAnimationFrame(onFrame)`.

**À chaque image (`_onFrame`)** :
1. `frame.getViewerPose(localFloor)` : la pose de la tête, copiée dans `engine.camera` (enfant de `player`) ;
2. pour chaque vue (œil) : `layer.getViewport(view)` → viewport de la sous-caméra, `view.projectionMatrix` → sa projection, `view.transform` → sa position (multipliée par la matrice de `player`, pour suivre les téléportations) ;
3. les manettes sont placées (événement `frame` → `XRManager`) ;
4. `engine.step()` : toute la logique (Interaction, Teleport, niveaux), comme en mode bureau ;
5. `engine.renderStereo(arrayCamera)` : **rendu WebGPU des deux yeux en une passe** ;
6. `_present()` : **copie** de l'image vers le casque, avec `texImage2D` (canvas WebGPU → texture) puis `blitFramebuffer` (texture → framebuffer de la couche). L'image est retournée à la copie (`UNPACK_FLIP_Y_WEBGL`), car le canvas a son origine en haut et WebGL en bas.

**Pourquoi copier vers une couche WebGL ?** Aujourd'hui, WebXR n'affiche dans le casque que des couches WebGL. La couche WebGPU (`XRGPUBinding`, module *WebXR/WebGPU Binding* du W3C) n'est encore qu'un brouillon, derrière des drapeaux expérimentaux de Chrome, et Immersive Web Emulator ne la propose pas. Le rendu reste donc 100 % WebGPU ; seule la copie finale passe par WebGL, sans aucun dessin. Le jour où `XRGPUBinding` sera disponible, seule `_present()` changera.

**Avec l'émulateur** : la taille de l'image peut changer après le démarrage (l'émulateur adapte le canvas à la fenêtre) ; elle est relue à chaque image.

## 15. Interactivité avancée : vibrations et joysticks

**Retour haptique (`XRManager.pulse`)** : chaque manette WebXR expose un `gamepad` (API Gamepad). Sa méthode `hapticActuators[0].pulse(intensité, durée)` la fait vibrer. `Interaction` l'appelle :

| Action | Intensité | Durée |
|---|---|---|
| Le rayon arrive sur un nouvel objet | 0,15 | 15 ms |
| Sélection (gâchette) | 0,6 | 50 ms |
| Saisie (grip) | 0,8 | 70 ms |
| Lâcher | 0,3 | 30 ms |
| Palier de rotation sur soi | 0,3 | 30 ms |

**Joysticks (`XRManager.getThumbstick`)** : avec le mapping standard des manettes (`xr-standard`), le joystick correspond aux axes 2 (gauche-droite) et 3 (haut-bas) de `gamepad.axes`, entre -1 et 1.

**`src/systems/Manipulation.js`** utilise ces axes à chaque image :
- **mains libres** : joystick à gauche ou à droite → **rotation sur soi de 30°** (*snap turn*). Un palier est déclenché au-delà de 0,7 et le suivant seulement après un retour sous 0,3 (hystérésis), pour ne pas enchaîner les rotations. La rotation se fait **autour de la tête** : on ramène la tête à l'origine, on fait tourner `player`, puis on remet la tête en place ;
- **objet en main** : gauche-droite → l'objet **tourne** sur lui-même (`rotateY`, 2,5 rad/s) ; haut-bas → il **s'éloigne ou se rapproche** de la main (de 0,15 m à 3 m, 1,2 m/s) ;
- **en mode bureau** : la **molette** règle la distance de l'objet tenu (clic droit), les touches **Q** et **E** le font tourner.

Une zone morte de 0,15 ignore les petits mouvements involontaires du joystick.

---

## Vocabulaire

| Terme | Définition |
|---|---|
| WebGPU | API graphique moderne du navigateur, qui succède à WebGL |
| WGSL | Langage de shaders de WebGPU |
| TSL | Langage de shaders de Three.js, écrit en JavaScript, traduit en WGSL ou en GLSL |
| WebXR Device API | API du navigateur pour la réalité virtuelle et augmentée (session, poses, manettes) |
| `XRWebGLLayer` | Couche par laquelle WebXR affiche une image dans le casque |
| Retour haptique | Vibration de la manette pour confirmer une action |
| Snap turn | Rotation sur soi par paliers (ici 30°), plus confortable qu'une rotation continue |
| `ArrayCamera` | Caméra de Three.js qui regroupe plusieurs sous-caméras (ici, une par œil) |
| `immersive-vr` | Mode de session WebXR où l'on est entièrement dans le monde virtuel |
| `local-floor` | Espace de référence dont l'origine est au niveau du sol |
| Raycasting | Lancer un rayon pour savoir quel objet il touche |
| Shader | Petit programme exécuté par la carte graphique pour calculer formes et couleurs |
| InstancedMesh | Dessiner des milliers de copies d'un même objet en un seul appel |
| Façade, Strategy, Observer | Patrons de conception utilisés dans le moteur (voir `ARCHITECTURE.md`) |