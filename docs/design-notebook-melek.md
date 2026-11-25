# Inside Human VR — Design Notebook, semaine 3 (Malouli Melek)

Ce document présente les **deux diagrammes demandés** : séquence et états d'un niveau.
Les diagrammes Mermaid sont affichables directement dans GitHub et documentent le code réel.

## 1. Diagramme de séquence — réussite de la mission du cœur

```mermaid
sequenceDiagram
    autonumber
    actor Joueur
    participant LM as LevelManager
    participant HL as HeartLevel
    participant I as Interaction
    participant GS as GameState
    participant EB as EventBus
    participant ST as Storage (IndexedDB)
    participant DB as Dashboard

    Joueur->>LM: Choisir le cœur depuis la scène de départ
    LM->>HL: load() puis start()
    HL->>GS: startLevel("heart")
    GS-->>EB: LEVEL_STARTED
    Joueur->>HL: Cliquer sur « Explorer »
    HL->>GS: setPhase(EXPLORATION)
    Joueur->>HL: Cliquer sur « Lancer la mission »
    HL->>GS: setPhase(MISSION)
    loop Pour chaque élément pointé
        Joueur->>I: Sélection (clic / gâchette)
        I-->>EB: OBJECT_SELECTED
        EB-->>HL: onSelect(objet)
        alt Bonne étape
            HL->>GS: recordCorrect()
        else Mauvaise étape
            HL->>GS: recordError(elementId)
            GS-->>EB: MISSION_ERROR
        end
        GS-->>EB: SCORE_CHANGED
    end
    HL->>GS: finishLevel({nextLevelId:"lungs"})
    GS-->>EB: MISSION_SUCCESS (score, erreurs, temps)
    EB-->>ST: Sauvegarder GameState.toJSON()
    EB-->>DB: Rafraîchir l'affichage
    GS-->>EB: LEVEL_UNLOCKED (lungs)
    EB-->>ST: Sauvegarder la progression débloquée
    EB-->>DB: Rafraîchir l'affichage
    HL-->>Joueur: Score et bouton « Continuer »
    Joueur->>HL: Cliquer sur « Continuer »
    HL->>GS: completeLevel()
    GS-->>EB: LEVEL_COMPLETED
    EB-->>LM: Charger le niveau suivant débloqué
```

### Comment lire le diagramme

- **Interaction** transforme un clic ou une gâchette en événement `OBJECT_SELECTED`.
- **HeartLevel** vérifie le bon ordre des cavités ; il ne gère pas lui-même IndexedDB.
- **GameState** contrôle les étapes, compte les erreurs et calcule le résultat.
- **EventBus** distribue les événements sans coupler directement les classes.
- **Storage** enregistre les instantanés de progression après une réussite ou un déblocage.
- **Dashboard** affiche ces résultats sur l'écran d'accueil lorsque celui-ci est ouvert.

Le détail des actions peut varier selon le niveau : le cœur utilise une séquence,
les poumons déplacent des molécules, le cerveau suit une séquence de neurones.

## 2. Diagramme d'états — cycle de vie d'un niveau

```mermaid
stateDiagram-v2
    [*] --> IDLE: Niveau non démarré
    IDLE --> ARRIVAL: startLevel(levelId)
    ARRIVAL --> EXPLORATION: Explorer
    EXPLORATION --> MISSION: Lancer la mission
    MISSION --> MISSION: recordCorrect() / recordError()
    MISSION --> RESULT: finishLevel()
    RESULT --> DONE: completeLevel()
    DONE --> [*]: Changement de niveau

    note right of MISSION
        Le temps commence ici.
        Score = max(0, 100 - 10 x erreurs).
    end note
    note right of RESULT
        Score et temps enregistrés.
        Émission de MISSION_SUCCESS.
        Déblocage éventuel du niveau suivant.
    end note
```

### Contraintes et invariants

1. Les transitions sont contrôlées par `GameState._transition()` : impossible de passer
   directement de `ARRIVAL` à `MISSION` ou de `MISSION` à `DONE`.
2. La saisie des bonnes/mauvaises réponses est autorisée uniquement pendant `MISSION`.
3. Le compteur de temps commence à l'entrée dans `MISSION`.
4. La réussite stocke `{levelId, score, correct, errors, timeSeconds}` dans
   `GameState.results`, puis l'auto-sauvegarde écrit cet état dans IndexedDB.
5. `LevelManager` charge le niveau suivant après `LEVEL_COMPLETED`.
6. Au démarrage d'un **nouveau** niveau, `GameState.startLevel()` réinitialise la phase à
   `IDLE` avant le passage à `ARRIVAL` ; cela ne constitue pas une transition utilisateur
   directe de `DONE` à `IDLE` au sein d'un même niveau.

## 3. Correspondance avec les fichiers source

| Élément du diagramme | Fichier |
|---|---|
| États, score, résultats et transitions | `src/data/GameState.mjs` |
| Distribution des événements | `src/systems/EventBus.mjs` |
| Logique commune et interactions | `src/levels/BaseLevel.mjs` |
| Mission du cœur | `src/levels/HeartLevel.mjs` |
| Enchaînement des niveaux | `src/core/LevelManager.mjs` |
| Sauvegarde locale | `src/data/Storage.mjs` |
| Agrégation et affichage des résultats | `src/systems/Dashboard.mjs` |

Ces diagrammes peuvent être insérés dans le Design Notebook de l'équipe, ou exportés
en image depuis un outil Mermaid si le professeur demande un fichier image.
