# Validation locale de Three.js via CDN (sans push)

Cette version de test est issue du commit `a1d0ba2`. Elle ne modifie pas la règle `.js/.mjs`.

## Fonctionnement

- `vite.config.js`: plugin `inside-human-three-cdn` remplaçant les imports Three.js de `src/` et `sandbox/` par des URLs jsDelivr **pendant le dev et le build**.
- `index.html` et `sandbox/*.html`: import map pour les dépendances internes des addons Three.js distants.
- `src/pwa.js`, `public/sw.js`: cache limité au domaine jsDelivr et au package `three@0.187.0`.
- `tests/e2e/cdn.spec.js`: vérification des requêtes réseau réellement émises.
- `tests/e2e/pwa.spec.js`: vérification du cache des scripts CDN avant l'essai hors ligne.
- Three.js reste **temporairement dans `package.json`** comme filet de sécurité, à retirer après validation dans un vrai navigateur et en CI.

## Ordre de test sur une branche dédiée (aucun push)

1. `npm ci`
2. `npm test`
3. `npm run build`
4. `npm run dev` puis Chrome -> F12 -> Network (disable cache décoché pour le premier essai), recharger, filtrer `cdn.jsdelivr.net` et vérifier que `three.webgpu.js` et `three.tsl.js` sont bien récupérés.
5. Vérifier qu'il n'y a pas d'erreurs rouges ; entrer dans cœur, poumons, cerveau, tester audio et Dashboard.
6. `npm run test:e2e` (nécessite une connexion Internet et Chromium/Chrome compatible WebGPU).
7. `npm run preview`, ouvrir le site publié localement, recharger une fois en ligne, passer dans DevTools -> Network -> Offline, recharger pour tester la PWA.
8. En cas d'échec, **ne pas pousser** et conserver la sortie de console.

Limite : les URL distantes du CDN ne peuvent pas être vérifiées ni les tests Playwright exécutés dans cet environnement déconnecté ; ces tests sont obligatoires avant la fusion.

## Après validation seulement

`npm uninstall three`, refaire tests + build + e2e. Si tout est vert, examiner `git diff` puis `git push` sur la branche dédiée.
