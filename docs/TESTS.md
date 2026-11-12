# Tests d'Inside Human VR

**Auteur** : Chouari Zaineb · **Date** : 12 novembre 2026 · **Rôle** : qualité, tests d'intégration de bout en bout

Le projet a deux niveaux de tests :

| Niveau | Outil | Commande | Ce qui est testé |
|---|---|---|---|
| Tests unitaires | `node --test` (intégré à Node.js) | `npm test` | La logique de progression : score, déblocage des niveaux, reprise du parcours (`tests/progression.test.js`, Melek) |
| **Tests de bout en bout** | **Playwright** + **iwer** | `npm run test:e2e` | L'application complète dans un vrai Chrome : WebGPU, VR simulée, interactions, mission complète, PWA hors ligne (`tests/e2e/`, Zaineb) |

---

## 1. Principe des tests de bout en bout

1. Playwright démarre **deux serveurs** : le serveur de développement (port 5173) et la version de production (`npm run build`, puis port 4173).
2. Il ouvre un **vrai navigateur Chrome** (fenêtre visible : on voit le test jouer).
3. Avant le chargement de la page, il installe **un casque Meta Quest 3 simulé** avec **iwer** (*Immersive Web Emulation Runtime*, de Meta) : c'est le moteur de l'extension Immersive Web Emulator. Il fournit une implémentation complète de l'**API WebXR Device** : sessions, poses de la tête, manettes, boutons, joysticks.
4. Le test **pilote les manettes** comme un utilisateur : il oriente le rayon vers un objet, appuie sur la gâchette ou le grip, bouge le joystick, déplace la main.
5. Il **vérifie l'état de l'application** : niveau chargé, objet tenu, score, couleur du sang, vibrations demandées, etc.

## 2. Les 11 scénarios

| Fichier | Scénario | Exigence du cahier des charges |
|---|---|---|
| `demarrage.spec.js` | Le rendu utilise le backend **WebGPU** de Three.js r187 | ENF-03 |
| `demarrage.spec.js` | La scène de départ affiche le **corps humain** | EF-01, EF-03 |
| `demarrage.spec.js` | La page déclare le **manifeste** et enregistre le **Service Worker** | ENF-04 |
| `vr.spec.js` | La session **`immersive-vr`** est rendue en **WebGPU**, avec les deux manettes suivies | EF-02 |
| `vr.spec.js` | La **gâchette** sur le cœur ouvre le niveau du cœur, et la manette **vibre** | EF-05 |
| `vr.spec.js` | Le **grip** saisit le cœur, le **joystick** le fait tourner, il revient à sa place une fois lâché | Interactivité |
| `vr.spec.js` | Le joystick fait **tourner l'utilisateur de 30°** (*snap turn*) | ENF-06 (confort) |
| `poumons.spec.js` | Déposer les **6 molécules** au bon endroit termine la mission avec **100 points** et un sang **rouge** | EF-07, EF-09 |
| `poumons.spec.js` | Une molécule lâchée **hors des zones** retourne à sa place sans changer le score | EF-07 |
| `pwa.spec.js` | Le manifeste décrit une application **installable** (nom, `standalone`, icônes 192 et 512 accessibles) | ENF-04 |
| `pwa.spec.js` | Après une première visite, l'application **démarre hors ligne** | ENF-04 |

## 3. Lancer les tests

Une seule fois, après avoir récupéré le projet :

```
npm install
```

Puis :

```
npm run test:e2e           # lance les 11 scénarios (environ 3 minutes)
npm run test:e2e:report    # ouvre le rapport HTML du dernier passage
npx playwright test vr     # lance seulement les tests d'un fichier (ici vr.spec.js)
```

- Sous **Windows** et **macOS**, Playwright utilise le **Chrome installé** sur la machine (`channel: 'chrome'`) : rien à télécharger, et WebGPU utilise la vraie carte graphique.
- Sous **Linux** (machine d'intégration continue), WebGPU passe par SwiftShader (rendu logiciel) : `HEADLESS=1 npm run test:e2e`.
- Si le dossier `certificates/` contient un certificat mkcert, les tests passent automatiquement en HTTPS.
- En cas d'échec, Playwright garde une **capture d'écran** et une **trace** (`npx playwright show-trace …`) de chaque test raté.

## 4. Un bug trouvé par les tests

Au premier passage, le scénario « 6 molécules » a échoué : 2 des 3 places d'arrivée du CO₂ dans l'alvéole étaient à
1,28 m de son centre, alors que la zone de dépôt de l'alvéole s'arrête à 1,25 m (`LungsLevel._zoneAt`). Une molécule
déposée à ces places n'était donc pas reconnue. Les places ont été rapprochées de la paroi (15 cm au lieu de 25 cm) :
toutes sont maintenant à moins de 1,20 m du centre (voir `docs/PIPELINE_XR.md`, section 11).
