# Semaine 2 — Malouli Melek (jeu, données et interface)

Branche prévue par la répartition : `feature/niveau-cerveau`.

## Livrables développés

1. **`src/levels/BrainLevel.js`** : niveau 3, clic/raycasting sur les neurones
   sensoriel, relais et moteur dans l'ordre. Indices, erreurs (−10 points),
   signaux visuels simples, écran de résultat, retour à l'accueil. Le contenu
   reste issu de `public/assets/content/levels.json` et l'animation graphique
   pourra être remplacée par le shader de Yessmine.
2. **`src/data/Storage.js`** : enregistrement de `GameState.toJSON()` dans
   IndexedDB. Restauration au démarrage et sauvegardes ordonnées lors de
   `missionSuccess` et `levelUnlocked`. Si IndexedDB est indisponible,
   la session demeure jouable mais n'est pas persistée.
3. **`src/main.js` et `src/core/LevelManager.js`** : déclaration du niveau
   `brain`, restauration préalable des droits d'accès, interdiction d'ouvrir un
   niveau verrouillé (même via `?level=brain`), transition entre niveaux.
4. **`index.html` et `styles.css`** : accueil définitif avec boutons
   **Entrer en VR** / **Mode bureau**, trois organes, états accessibles /
   verrouillés / réussis, reprise de partie en mode bureau.

## Vérification

Sur un PC avec Node.js installé :

```powershell
npm ci
npm test
npm run build
npm run dev
```

1. Ouvrir l'application et cliquer sur « Mode bureau » (Échap pour revenir à l'accueil).
2. Cliquer sur le cœur dans la scène d'accueil, puis valider le parcours pour
   débloquer les poumons.
3. Réussir la mission des poumons : le cerveau doit être débloqué.
4. Dans le cerveau, cliquer successivement sur le neurone sensoriel, le relais
   puis le moteur. Une erreur doit retirer 10 points.
5. Actualiser le navigateur (F5). L'accueil doit afficher les niveaux et scores
   déjà réussis et proposer « Reprendre : … » quand une mission reste à faire.
6. Vérifier la base dans DevTools → Application → IndexedDB → `inside-human-vr`.
7. Tester le mode VR avec Immersive Web Emulator selon le guide de l'équipe.

**Important :** le ZIP fourni ne contient pas les dépendances `node_modules` ;
le build Vite nécessite `npm ci` avec accès à un registre npm. Les tests Node
pour GameState et IndexedDB peuvent être lancés sans ces dépendances.

## Points d'intégration avec l'équipe

- `src/main.js` est partagé avec l'intégration de Zaineb ; conserver ses ajouts
  lors des conflits et lui faire relire la pull request.
- `src/core/LevelManager.js` contient un petit contrôle d'accès au début de
  `load()` : éviter de supprimer ce contrôle lors d'une fusion.
- L'animation de l'influx nerveux est un **placeholder** Three.js. Yessmine
  pourra l'améliorer avec `neuronSignal.js` / modèles du cerveau.
- Le **tableau de bord complet**, le **Service Worker** et le **manifest PWA**
  restent des tâches de semaine 3, non incluses ici.

## Git

```powershell
git switch develop
git pull origin develop
git switch -c feature/niveau-cerveau
# Copier les fichiers du ZIP livré vers ce dépôt, ou appliquer les patchs dans l'ordre.
npm ci
npm test
npm run build
git add src/levels/BrainLevel.js src/data/Storage.js src/main.js src/core/LevelManager.js index.html styles.css tests/progression.test.js package.json docs/MELEK_SEMAINE2.md
git commit -m "feat: missions cerveau et progression persistante semaine 2"
git push -u origin feature/niveau-cerveau
```

Puis ouvrir une pull request **`feature/niveau-cerveau` → `develop`**.
Pour conserver **cinq commits distincts**, appliquer les patchs numérotés un
par un (commande `git apply`) et faire un commit après chaque patch.
