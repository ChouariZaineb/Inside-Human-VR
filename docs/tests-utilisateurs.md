# Inside Human VR — Tests utilisateurs (semaine 3, Malouli Melek)

> **Statut : protocole et modèle de compte rendu prêts.** Les cinq séances n'ont pas été
> réalisées dans ce document : renseigner les résultats uniquement après les essais réels.

## 1. Objectif et périmètre

Évaluer si cinq étudiants parviennent à lancer Inside Human VR, à comprendre les consignes,
à terminer les missions du cœur, des poumons et du cerveau, et à consulter le tableau de bord.
Vérifier aussi la reprise des résultats après actualisation du navigateur. Ne pas modifier
la PWA développée par Zaineb : le fonctionnement hors ligne est testé, si nécessaire,
comme une fonctionnalité existante.

## 2. Préparation

- Sur un ordinateur compatible WebGPU, ouvrir Chrome ou Edge récent.
- Lancer `npm run dev`, puis ouvrir l'adresse locale affichée.
- Vérifier le son et les contrôles bureau ; prévoir éventuellement un casque VR ou l'émulateur.
- Pour chaque session, noter si la progression précédente est présente. Utiliser un profil
  de navigateur distinct pour chaque participant si l'on veut repartir de zéro.
- Utiliser uniquement les identifiants anonymes P01 à P05. Ne pas noter de nom, email ou
  autre donnée personnelle. Demander l'accord du participant pour le test.

## 3. Scénario standard (à répéter cinq fois)

| Étape | Tâche demandée au participant | Critère de réussite |
|---|---|---|
| T1 | Lancer **Mode bureau** | Entrée dans la scène 3D sans aide |
| T2 | Se déplacer et sélectionner un objet | Téléportation + sélection réussies |
| T3 | Terminer le cœur | Ordre des cavités compris ; score enregistré |
| T4 | Terminer les poumons | O₂ déposé dans le sang, CO₂ dans l'air |
| T5 | Terminer le cerveau | Activation correcte des neurones |
| T6 | Quitter avec Échap, ouvrir le tableau de bord | Trois résultats, scores, temps et notions visibles |
| T7 | Actualiser la page et retourner au tableau de bord | Progression conservée grâce à IndexedDB |

Noter le temps total, le nombre d'erreurs observées, toute aide apportée et les éventuels
problèmes de rendu/son. Ne jamais compléter des résultats à partir de suppositions.

## 4. Grille des cinq participants — à remplir après les séances

| Étudiant | Date | Navigateur / mode | T1–T7 réussies (nombre / 7) | Temps total | Difficultés rencontrées | Commentaire |
|---|---|---|---|---|---|---|
| P01 | À compléter | À compléter | À compléter | À compléter | À compléter | À compléter |
| P02 | À compléter | À compléter | À compléter | À compléter | À compléter | À compléter |
| P03 | À compléter | À compléter | À compléter | À compléter | À compléter | À compléter |
| P04 | À compléter | À compléter | À compléter | À compléter | À compléter | À compléter |
| P05 | À compléter | À compléter | À compléter | À compléter | À compléter | À compléter |

### Résultats par organe — à compléter

| Étudiant | Score cœur /100 | Temps cœur | Score poumons /100 | Temps poumons | Score cerveau /100 | Temps cerveau |
|---|---|---|---|---|---|---|
| P01 | — | — | — | — | — | — |
| P02 | — | — | — | — | — | — |
| P03 | — | — | — | — | — | — |
| P04 | — | — | — | — | — | — |
| P05 | — | — | — | — | — | — |

## 5. Questionnaire (réponse de 1 = très difficile à 5 = très facile)

1. Les consignes des missions étaient-elles compréhensibles ? (1–5)
2. Les interactions avec les organes étaient-elles faciles à effectuer ? (1–5)
3. Le tableau de bord permet-il de comprendre sa progression ? (1–5)
4. Quel élément du jeu était le plus utile pour apprendre ? (réponse libre)
5. Quel problème faudrait-il corriger en priorité ? (réponse libre)

## 6. Bilan après les cinq tests — à rédiger, pas à inventer

- **Séances réellement effectuées :** ___ / 5
- **Participants ayant réussi T1–T7 :** ___ / 5
- **Tâche la plus difficile :** ___
- **Problèmes de navigation et d'ergonomie :** ___
- **Problèmes audio/visuels :** ___
- **Corrections proposées (priorité haute/moyenne/basse) :** ___
- **Conclusion :** ___

Un résultat « non testé » est distinct d'un résultat « échoué ». Le compte rendu final
ne doit indiquer « cinq tests réalisés » qu'après cinq séances effectives.
