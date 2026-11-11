# Fichier d'attribution et d'origine des ressources (ATTRIBUTION.md)

**Projet :** Inside Human VR : voyage en VR à l'intérieur du corps humain (cœur, poumons, cerveau)
**Équipe :** Melek Mallouli, Yessmine Hentati, Zaineb Chouaru
**Version :** 1.0 — Évaluation SUP'COM (2026/2027)

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
| Three.js (`three`, module `three/webgpu` + TSL) | 0.187.0 | https://www.npmjs.com/package/three/v/0.187.0 | MIT | Moteur de rendu WebGPU (repli WebGL 2), shaders TSL, chargeurs GLTF/Draco |
| Draco (décodeur, fourni avec Three.js) | version incluse dans three 0.187.0 | `public/draco/` (copié depuis `node_modules/three/examples/jsm/libs/draco/`) | Apache 2.0 | Décompression des modèles GLB |
| Vite | 8.3.6 | https://www.npmjs.com/package/vite/v/8.3.6 | MIT | Serveur de développement HTTPS et build |
| mkcert | v1.4.4 | https://github.com/FiloSottile/mkcert | BSD-3 | Certificat local HTTPS (hors dépôt, dossier `certificates/` ignoré par git) |
| MediaPipe Tasks Vision | [à renseigner si la partie vision par ordinateur est ajoutée] | – | Apache 2.0 | Suivi de main / tête (optionnel) |

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

---

## 4. Déclaration de l'usage des assistants IA (Claude)

| Composant ou shader concerné | Usage principal | Axe de vérification appliqué par l'étudiant |
|---|---|---|
| `src/shaders/tissuePulse.js` | Génération du battement en TSL et de l'équivalent JS | Vérification visuelle du rythme à 72 bpm et de la cohérence avec `beatJS` |
| `src/shaders/bloodFlow.js` | Génération du matériau de flux et du profil d'oxygénation | Contrôle du sens du flux (rouge = s'éloigne du cœur, bleu = revient) |
| `src/systems/Particles.js` | Génération des globules en `InstancedMesh` le long d'une courbe | Test avec différents nombres de particules et mesure des fps sur le PC de l'équipe Test avec différents nombres de particules ; mesure sur le PC de l’équipe : 60 fps en WebGPU, vue « Corps entier » (sandbox/xray.html) |
| `src/systems/ProceduralHeart.js`, `XrayBody.js`, `HeartAtlas.js` | Génération des scènes (cœur, corps, torse) et ajustement des proportions | Comparaison avec les images de référence, correction des positions et tailles, essai en `?webgl` |
| `CREDITS.md`, `docs/` | Rédaction et conversion du cahier des charges en Markdown | Relecture complète par l'équipe |

