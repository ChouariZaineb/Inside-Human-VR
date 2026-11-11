# Inside Human VR

Voyage immersif à l'intérieur du corps humain — application éducative en réalité virtuelle
(WebXR + Three.js `WebGPURenderer`), projet SUP'COM Cycle Ingénieur.

Équipe : Chouari Zaineb · Hentati Yessmine · Malouli Melek — Encadrement : Dr. Ing. Mohamed-Bécha Kaâniche

## Lancement rapide

```powershell
npm install
npm run dev
```

## Journal des tâches

| Date | Auteur | Tâche |
|------|--------|-------|
| 2026-11-04 | Chouari Zaineb | Initialisation du projet Vite (vanilla JS), installation de `three`, arborescence des dossiers, branches `main` / `develop`. |
| 2026-11-05 | Malouli Melek | Création de `levels.json` : textes, questions et missions des 3 niveaux en français |
| 2026-11-05 | Malouli Melek | `EventBus.js` et `GameState.js` : bus d'événements, machine à états et score |
| 2026-11-05 | Malouli Melek | `BaseLevel.js` et `UIPanel.js` : classe de base des niveaux, panneaux 3D flottants |
| 2026-11-05 | Malouli Melek | `HeartLevel.js` : mission du globule rouge (niveau 1) |
| 2026-11-11 | Malouli Melek | Fusion de `feature/jeu-coeur` dans `develop` puis `main` (PR #1 et #4) |
