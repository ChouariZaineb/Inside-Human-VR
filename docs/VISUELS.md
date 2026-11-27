# Visuels du cœur et de la circulation (shaders, particules, scènes)

Branche : `feature/visuels-coeur`. Aucun modèle 3D externe : tout est généré par code (voir `CREDITS.md`).

## Modules

| Fichier | Rôle | À importer |
|---|---|---|
| `src/scripts/shaders/tissuePulse.mjs` | Battement « lub-dub » du cœur (TSL) | `heartbeatMaterial()`, `heartRate`, `beatNode`, `beatJS(t)` |
| `src/scripts/shaders/bloodFlow.mjs` | Flux du sang sur la paroi des vaisseaux, rouge/bleu | `vesselMaterial()`, `oxygen`, `makeProfile(stops)` |
| `src/scripts/systems/Particles.mjs` | Globules rouges (`InstancedMesh`) le long d'une courbe | `BloodParticles` |
| `src/scripts/systems/ProceduralHeart.mjs` | Cœur anatomique généré par code | `createAnatomicalHeart({ palette })` |
| `src/scripts/systems/XrayBody.mjs` | Corps « radio » : silhouette, côtes, poumons, vaisseaux, flèches | `createXrayBody()`, `bodyGeometry()` |
| `src/scripts/systems/HeartAtlas.mjs` | Torse + cœur + gros vaisseaux, et schéma de la circulation | `createHeartAtlas()` |

```js
// Exemple pour un niveau : sang qui circule dans un vaisseau
const curve = new THREE.CatmullRomCurve3(points, true);
const vessel = new THREE.Mesh(new THREE.TubeGeometry(curve, 200, 0.5, 16, true), vesselMaterial());
const blood = new BloodParticles(curve, { radius: 0.5, count: 1500 });   // + update(dt) dans la boucle, dispose() à la sortie
```

## Pages d'essai (`npm run dev`, puis en https)

- `/pages/xray.html` : corps en « radio » bleu avec circulation (touches 1, 2, 3 = vues).
- `/pages/atlas.html` : torse et cœur (H = gros plan), bouton *Schéma* pour la circulation simplifiée.

Ajouter `?webgl` à l'adresse pour forcer le repli WebGL 2. Une erreur de chargement s'affiche dans un encadré rouge.
