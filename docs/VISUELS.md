# Visuels du cœur et de la circulation (shaders, particules, scènes)

Branche : `feature/visuels-coeur`. Aucun modèle 3D externe : tout est généré par code (voir `CREDITS.md`).

## Modules

| Fichier | Rôle | À importer |
|---|---|---|
| `src/shaders/tissuePulse.js` | Battement « lub-dub » du cœur (TSL) | `heartbeatMaterial()`, `heartRate`, `beatNode`, `beatJS(t)` |
| `src/shaders/bloodFlow.js` | Flux du sang sur la paroi des vaisseaux, rouge/bleu | `vesselMaterial()`, `oxygen`, `makeProfile(stops)` |
| `src/systems/Particles.js` | Globules rouges (`InstancedMesh`) le long d'une courbe | `BloodParticles` |
| `src/systems/ProceduralHeart.js` | Cœur anatomique généré par code | `createAnatomicalHeart({ palette })` |
| `src/systems/XrayBody.js` | Corps « radio » : silhouette, côtes, poumons, vaisseaux, flèches | `createXrayBody()`, `bodyGeometry()` |
| `src/systems/HeartAtlas.js` | Torse + cœur + gros vaisseaux, et schéma de la circulation | `createHeartAtlas()` |

```js
// Exemple pour un niveau : sang qui circule dans un vaisseau
const curve = new THREE.CatmullRomCurve3(points, true);
const vessel = new THREE.Mesh(new THREE.TubeGeometry(curve, 200, 0.5, 16, true), vesselMaterial());
const blood = new BloodParticles(curve, { radius: 0.5, count: 1500 });   // + update(dt) dans la boucle, dispose() à la sortie
```

## Pages d'essai (`npm run dev`, puis en https)

- `/sandbox/xray.html` : corps en « radio » bleu avec circulation (touches 1, 2, 3 = vues).
- `/sandbox/atlas.html` : torse et cœur (H = gros plan), bouton *Schéma* pour la circulation simplifiée.

Ajouter `?webgl` à l'adresse pour forcer le repli WebGL 2. Une erreur de chargement s'affiche dans un encadré rouge.
