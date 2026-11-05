# Inside Human VR

Voyage immersif à l'intérieur du corps humain : une application éducative en réalité virtuelle
(WebXR + Three.js `WebGPURenderer`), projet SUP'COM Cycle Ingénieur.

**Équipe** : Chouari Zaineb (moteur et VR) · Hentati Yessmine (visuels, shaders et son) · Malouli Melek (jeu, données et interface)
**Encadrement** : Dr. Ing. Mohamed-Bécha Kaâniche

---

## 1. Installation et lancement

Prérequis : Node.js 20 ou plus, Chrome ou Edge récent.

```powershell
npm install        # installe Vite et Three.js
npm run dev        # serveur de développement : http://localhost:5173
npm run build      # build de production dans dist/
npm run preview    # teste le build de production en local
```

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

## 2. Choix technique : WebGPU et VR

- Tout le code utilise l'API `three/webgpu` (`WebGPURenderer`), sans aucun WebGL ni GLSL écrit à la main.
- Three.js r187 sait faire de la XR native en WebGPU, mais seulement si le navigateur expose
  `XRGPUBinding` (feature de session `"webgpu"`), ce qui n'est pas encore le cas de Chrome + Immersive Web Emulator.
- On suit donc l'exemple officiel `webgpu_xr_cubes.html` : `setupWebGLXRFallback` remplace, au moment
  d'entrer en VR, le renderer par un `WebGPURenderer({ forceWebGL: true })`. En mode bureau, le rendu reste en WebGPU.

Conséquences pour l'équipe :

- Les **shaders TSL** fonctionnent sur les deux backends (WebGPU et WebGL 2) : rien à faire.
- Ne **gardez jamais** `engine.renderer` dans une variable : relisez-le à chaque fois
  (il peut changer à l'entrée en VR). L'événement `engine.addEventListener('rendererchange', …)` signale ce changement.
- Les addons de Three.js importent `'three'` : `vite.config.js` redirige `'three'` vers `'three/webgpu'`.
  Dans notre code, importez toujours `import * as THREE from 'three/webgpu';`.

---

## 3. Arborescence et répartition

```
Inside-Human-VR/
├── index.html              Page d'accueil (provisoire)              → Zaineb, puis Melek (écran final)
├── styles.css              Styles de la page                        → Zaineb, puis Melek
├── vite.config.js          Configuration Vite (alias three/webgpu)   → Zaineb
├── src/
│   ├── main.js             Assemble le moteur et les systèmes        → Zaineb
│   ├── core/               Moteur                                    → Zaineb
│   │   ├── Engine.js         API centrale (scene, camera, player, onUpdate, isVR)
│   │   ├── Renderer.js       WebGPURenderer, scène, caméra, lumières, repli XR
│   │   ├── XRManager.js      Session immersive-vr, manettes, rayons
│   │   └── DesktopControls.js Mode bureau (PointerLockControls, réticule)
│   ├── systems/
│   │   ├── Interaction.js    Pointage et sélection (manette ou souris) → Zaineb
│   │   ├── Teleport.js       Points de téléportation, fondu au noir    → Zaineb
│   │   ├── Particles.js      Globules rouges (InstancedMesh)            → Yessmine
│   │   └── UIPanel.js        Panneaux 3D flottants                      → Melek
│   ├── debug/
│   │   └── TestScene.js      Scène de test du moteur (sans modèle)     → Zaineb
│   ├── levels/             BaseLevel, HeartLevel, LungsLevel, BrainLevel → Melek
│   ├── data/               GameState, EventBus, Storage (IndexedDB)  → Melek
│   └── shaders/            Shaders TSL (bloodFlow, tissuePulse…)     → Yessmine
└── public/assets/
    ├── models/             Modèles GLB (Draco)                       → Yessmine
    ├── audio/              Sons (CC0)                                 → Yessmine
    └── content/            levels.json (textes, missions)             → Melek
```

---

## 4. API du moteur

`main.js` crée les objets suivants et les passe aux scènes / niveaux :

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

Pour l'essayer, remplacer dans `src/main.js` l'appel `createTestScene( … )` par `createExampleLevel( … )`.
`src/debug/TestScene.js` est un exemple complet qui suit le même modèle.

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

| Date | Auteur | Branche | Tâche |
|------|--------|---------|-------|
| 2026-11-04 | Chouari Zaineb | `main` | Initialisation du projet Vite (vanilla JS), installation de `three` r187, arborescence des dossiers, branches `main` et `develop`. |
| 2026-11-04 | Chouari Zaineb | `feature/moteur-vr` | `Renderer.js` : WebGPURenderer, scène, caméra, lumières, redimensionnement, repli WebGL officiel pour la XR. |
| 2026-11-04 | Chouari Zaineb | `feature/moteur-vr` | `Engine.js` : API centrale (`player`, `onUpdate`, `isVR`, boucle `setAnimationLoop`). |
| 2026-11-04 | Chouari Zaineb | `feature/moteur-vr` | `XRManager.js` : session `immersive-vr` en `local-floor`, deux manettes avec modèles et rayon, message « VR non disponible ». |
| 2026-11-04 | Chouari Zaineb | `feature/moteur-vr` | `DesktopControls.js` : mode bureau avec PointerLockControls, réticule, Échap, désactivé en VR. |
| 2026-11-04 | Chouari Zaineb | `feature/moteur-vr` | `Interaction.js` : raycasting unifié manette/souris (patron Strategy), survol et sélection. |
| 2026-11-04 | Chouari Zaineb | `feature/moteur-vr` | `Teleport.js` : disques de téléportation animés, fondu au noir, touches 1 à 9 en bureau. |
| 2026-11-04 | Chouari Zaineb | `feature/moteur-vr` | `TestScene.js` : tunnel « vaisseau sanguin », 3 points de téléportation, 3 sphères sélectionnables. |
| 2026-11-04 | Chouari Zaineb | `feature/moteur-vr` | Page d'accueil simple, compteur d'images/s en développement, vérification VR non bloquante. |
| 2026-11-04 | Chouari Zaineb | `feature/moteur-vr` | README : installation, test avec Immersive Web Emulator, API du moteur, règles Git. |
