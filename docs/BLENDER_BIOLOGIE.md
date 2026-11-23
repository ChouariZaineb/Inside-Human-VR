# Inside Human VR — réaliste biologique et pipeline Blender

## Remarques du professeur

- **Globule rouge** : disque *biconcave* (creux central sur les deux faces). Un globule rouge n'est pas une boule.
- **Plaquette** : fragment irrégulier, nettement plus petit et moins abondant que les globules rouges.
- **O₂** : deux atomes O (rouges selon la convention pédagogique CPK), représentés par une double liaison.
- **CO₂** : un atome C (gris) au centre et deux O (rouges), **molécule linéaire O=C=O, angle 180°**.
- **Couleur du sang** : oxygéné = rouge plus vif ; désoxygéné = rouge plus sombre. Le bleu des schémas reste une **convention pédagogique**, pas la couleur réelle du sang.

## État de l'application

La **mission principale des poumons** utilise `BloodParticles` (`src/systems/Particles.js`) pour animer des globules biconcaves et des plaquettes dans le capillaire, sans changer la logique des transferts. Les modèles O₂/CO₂ sont générés dans `src/levels/LungsLevel.js` pour rester sélectionnables en VR. Les niveaux et le score restent identiques.

## Générer des modèles éditables dans Blender

1. Installer Blender 4.x sur l'ordinateur de travail.
2. Depuis la racine du dépôt, dans PowerShell :

   ```powershell
   blender --background --python tools/blender/build_biology.py
   ```

   Si la commande `blender` n'est pas reconnue, lancer l'exécutable avec son chemin complet, par exemple :

   ```powershell
   & 'C:\Program Files\Blender Foundation\Blender 4.5\blender.exe' --background --python tools/blender/build_biology.py
   ```

3. Les fichiers créés sont :

   - `public/assets/models/erythrocyte.glb`
   - `public/assets/models/platelet.glb`
   - `public/assets/models/oxygen_o2.glb`
   - `public/assets/models/carbon_dioxide_co2.glb`
   - `tools/blender/biologie_source.blend` (source rééditable)

4. Ouvrir le `.blend` dans Blender : vérifier la forme, les matériaux, les dimensions et les normales. La source est générée localement à partir du script, sans fichier externe.
5. Lancer `npm run dev`, puis ouvrir `/sandbox/biologie.html` pour inspecter les quatre GLB. Tester les molécules en tournant la caméra.

**Important :** ces quatre GLB constituent des modèles de référence créés avec Blender et visibles dans la page de contrôle. La **mission principale** utilise actuellement ses géométries procédurales correspondantes, déjà animées et interactives ; remplacer les instances par des GLB exige une intégration et une validation VR supplémentaires.

## Vérification avant chaque commit

- `npm test`, `npm run build`, `npm run test:e2e`.
- Vérifier dans Chrome la mission des poumons en VR simulée : 6 molécules, 100 points sans erreur, aucune gêne au ciblage.
- Vérifier le contenu de `public/assets/models/` après la génération Blender.
- Garder les modèles existants du cœur, des poumons, du cerveau et du squelette, avec leurs crédits dans `ATTRIBUTION.md` / `CREDITS.md`.
- Si l'éditeur modifie un GLB externe existant, respecter sa licence. Les quatre nouveaux modèles générés ici sont créés uniquement avec des géométries basiques.
