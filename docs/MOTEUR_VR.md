# Le moteur et la VR (partie de Chouari Zaineb)

Ce document explique chaque fichier du moteur : ce qu'il fait, comment il le fait et pourquoi.

| Fichier | En une phrase |
|---|---|
| `vite.config.js` | Configure l'outil de développement Vite |
| `src/main.js` | Assemble toutes les pièces et lance l'application |
| `src/core/Renderer.js` | Crée la scène, la caméra, les lumières et le WebGPURenderer |
| `src/core/Engine.js` | L'API centrale que tout le monde utilise, et la boucle de rendu |
| `src/core/XRManager.js` | Démarre la VR et gère les deux manettes |
| `src/core/DesktopControls.js` | Le mode bureau : regarder à la souris, viser au réticule |
| `src/systems/Interaction.js` | Savoir ce que l'utilisateur vise et sélectionne (raycasting) |
| `src/systems/Teleport.js` | Se déplacer par téléportation, avec un fondu au noir |
| `src/scenes/BodyScene.js` | La scène de départ : le corps humain |
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
- le `WebGPURenderer` : `antialias` (bords lisses), `pixelRatio` limité à 2 (performances), `xr.enabled = true`, espace de référence `local-floor` (le sol est à y = 0).

**Points importants :**
- `await renderer.init()` : WebGPU s'initialise de façon **asynchrone** (il faut demander la carte graphique).
- `DirectRenderPipeline` : l'objet qui dessine la scène avec la caméra à chaque image.
- **Le repli WebGL pour la VR** : `setupWebGLXRFallback` (fonction officielle de Three.js) surveille l'entrée en VR. Si le navigateur ne fournit pas `XRGPUBinding`, il crée un nouveau `WebGPURenderer({ forceWebGL: true })` ; `_install()` remplace alors le canvas dans la page et émet l'événement `rendererchange`.
- `_onResize` : quand la fenêtre change de taille, on adapte la caméra et le canvas (sauf en VR, où c'est le casque qui impose la taille).

## 4. `src/core/Engine.js` : l'API centrale

C'est une **façade** : une seule entrée simple pour tout le moteur.

| Membre | Rôle |
|---|---|
| `engine.scene`, `engine.camera`, `engine.renderer` | Accès aux objets du rendu (le renderer peut changer en VR : toujours le relire) |
| `engine.player` | Un `Group` qui contient la caméra et les manettes. **On déplace le joueur en déplaçant ce groupe**, car en VR la position de la caméra est imposée par le casque. |
| `engine.onUpdate(cb)` | Enregistre une fonction appelée à chaque image avec `(delta, elapsed)`. Renvoie une fonction pour se désabonner. |
| `engine.isVR()` | Vrai pendant une session VR (`renderer.xr.isPresenting`). |
| `engine.resetCameraPose()` | Remet la caméra à 1,6 m, regard droit devant (en sortie de VR). |
| `engine.start()` | Lance la boucle avec `setAnimationLoop`. |

**La boucle (`_loop`)**, à chaque image :
1. `Timer` calcule `delta` (temps depuis l'image précédente) et `elapsed` (temps total).
2. `delta` est **borné entre 0 et 0,1 s** : au premier affichage, il pouvait être légèrement négatif (ce qui faisait planter l'animation du sang), et après une pause il peut être énorme.
3. Toutes les fonctions `onUpdate` sont appelées.
4. La scène est dessinée.

**Pourquoi `setAnimationLoop` et pas `requestAnimationFrame` ?** En VR, c'est le casque qui fixe le rythme des images (72 à 120 par seconde). `setAnimationLoop` utilise automatiquement le bon rythme : celui de l'écran en mode bureau, celui du casque en VR.

## 5. `src/core/XRManager.js` : la réalité virtuelle

**Vérification du support (`init`)** :
- Si `navigator.xr` n'existe pas, la VR est impossible (navigateur non compatible ou page non sécurisée).
- `navigator.xr.isSessionSupported('immersive-vr')` demande si un casque est disponible. Cette promesse pouvait ne jamais répondre : on la met en **course** (`Promise.race`) avec un minuteur de 3 secondes.
- L'événement `devicechange` relance la vérification si un casque (ou l'émulateur) apparaît plus tard.

**Démarrer la VR (`enter`)** :
- `navigator.xr.requestSession('immersive-vr', { requiredFeatures: ['local-floor'], optionalFeatures: [...] })`.
- `renderer.xr.setSession(session)` relie la session au renderer (c'est ici que le repli WebGL peut se produire).
- En fin de session, la caméra reprend sa pose du mode bureau.

**Les manettes (`_setupControllers`)** :
- `renderer.xr.getController(i)` : l'objet qui donne l'**origine et la direction du rayon** de la manette i (0 ou 1).
- `renderer.xr.getControllerGrip(i)` : la position de la **main**, où l'on affiche le modèle 3D officiel de la manette (`XRControllerModelFactory`).
- Chaque manette reçoit une ligne (le rayon visible, 5 m par défaut).
- Événements écoutés : `connected`, `disconnected`, `selectstart` (gâchette), retransmis sous le nom `select`.
- Les manettes sont ajoutées dans `engine.player` pour suivre l'utilisateur quand il se téléporte. Elles sont recréées si le renderer change.

## 6. `src/core/DesktopControls.js` : le mode bureau

- `PointerLockControls` (addon de Three.js) : la souris est **capturée** par la page et oriente le regard. Échap la libère (comportement du navigateur).
- Un **réticule** (petit point au centre de l'écran) sert de viseur.
- Un clic gauche pendant la capture émet `select`.
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

**API** : `addSelectable(objet, { onHover, onSelect, highlight })`, `removeSelectable(objet)`, `clear()`.
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
5. Le **cœur est sélectionnable** : il grossit au survol, et sa sélection annonce l'entrée dans le niveau 1 (relié plus tard aux niveaux de Melek).
6. `engine.onUpdate((delta) => body.update(delta))` : le cœur bat et les flèches du sang avancent à chaque image.
7. La fonction `dispose()` renvoyée libère tout proprement (utile quand on changera de niveau).

## 10. `src/debug/TestScene.js` : la scène de test

Une scène sans modèle externe pour tester le moteur seul : un tunnel (`TubeGeometry`) qui évoque un vaisseau sanguin,
un sol, 3 points de téléportation et 3 sphères sélectionnables (globule rouge, globule blanc, plaquette).
Elle sert aussi d'exemple d'utilisation de l'API du moteur. On l'ouvre avec `http://localhost:5173/?test`.

---

## Vocabulaire

| Terme | Définition |
|---|---|
| WebGPU | API graphique moderne du navigateur, qui succède à WebGL |
| WGSL | Langage de shaders de WebGPU |
| TSL | Langage de shaders de Three.js, écrit en JavaScript, traduit en WGSL ou en GLSL |
| WebXR | API du navigateur pour la réalité virtuelle et augmentée |
| `immersive-vr` | Mode de session WebXR où l'on est entièrement dans le monde virtuel |
| `local-floor` | Espace de référence dont l'origine est au niveau du sol |
| Raycasting | Lancer un rayon pour savoir quel objet il touche |
| Shader | Petit programme exécuté par la carte graphique pour calculer formes et couleurs |
| InstancedMesh | Dessiner des milliers de copies d'un même objet en un seul appel |
| Façade, Strategy, Observer | Patrons de conception utilisés dans le moteur (voir `ARCHITECTURE.md`) |
