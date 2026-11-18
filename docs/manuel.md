# Inside Human VR — Manuel utilisateur

**Projet :** Inside Human VR
**Livrable :** Semaine 3 — Malouli Melek (jeu, données et interface)
**Public :** étudiants et enseignants souhaitant découvrir trois organes par des missions interactives.

## 1. Démarrage

Ouvrir l'application dans une version récente de **Chrome** ou **Edge**, sur un appareil
compatible **WebGPU**. Aucune création de compte n'est nécessaire.

Pour lancer le projet sur son ordinateur de développement :

```powershell
npm install
npm run dev
```

Ouvrir l'adresse affichée par Vite (en général `http://localhost:5173/`).

À l'accueil, choisir **Mode bureau** ou **Entrer en VR** lorsque ce second mode est pris en
charge. Le bouton VR peut rester désactivé si le navigateur ne détecte pas de casque.

## 2. Commandes

| Action | Mode bureau | Mode VR |
|---|---|---|
| Regarder autour de soi | Déplacer la souris | Bouger le casque |
| Sélectionner un objet ou un bouton 3D | Viser avec le réticule puis clic gauche | Pointer avec la manette puis gâchette |
| Se téléporter | Viser un disque bleu et cliquer, ou touches 1 à 9 | Pointer le disque bleu et presser la gâchette |
| Saisir / déplacer un objet compatible | Clic droit maintenu puis relâcher | Bouton grip de la manette |
| Ajuster un objet tenu | Molette, touches Q / E | Joystick selon le contexte |
| Afficher l'accueil / libérer la souris | Échap | Quitter la session VR |
| Activer ou couper le son | Touche M | Selon les commandes disponibles dans la session |

**Attention :** en mode bureau, Échap libère la souris et affiche l'écran d'accueil ;
cela ne signifie pas nécessairement que le niveau chargé en arrière-plan a changé.

## 3. Parcours pédagogique

### Niveau 1 — Le cœur

Cliquer sur **Explorer**, puis **Lancer la mission** sur les panneaux 3D.
Guider un globule rouge dans cet ordre : **veine cave → oreillette droite →
ventricule droit → artère pulmonaire**. Une mauvaise sélection ajoute une erreur.
La réussite enregistre le score et débloque les poumons. Cliquer sur **Continuer**.

### Niveau 2 — Les poumons

Explorer l'alvéole, le capillaire et les molécules, puis démarrer la mission.
Déplacer les molécules **O₂ vers le sang** et **CO₂ vers l'air**.
On peut utiliser le clic droit / grip pour saisir et déposer la molécule,
ou la sélectionner puis sélectionner sa destination. La réussite débloque le cerveau.

### Niveau 3 — Le cerveau

Explorer les neurones, puis lancer la mission. Activer dans l'ordre le
**neurone sensoriel → neurone relais → neurone moteur**.
À la fin, cliquer sur **Terminer**.

## 4. Résultats et tableau de bord

À l'accueil, ouvrir **Mon tableau de bord — Scores, temps et notions**.
Le tableau contient :

- le nombre de missions réussies sur trois ;
- le score moyen des missions réussies (sur 100) ;
- le temps cumulé passé dans les missions terminées ;
- pour chaque organe, son score, son temps, son nombre d'erreurs et sa notion abordée.

**Score :** 100 points au départ, moins 10 points par erreur, minimum 0.
**Temps :** durée mesurée depuis le lancement de la mission jusqu'à sa réussite.
Les missions non terminées n'ont pas de score : un tiret « — » est affiché.
Les « notions abordées » indiquent les thèmes parcourus, pas un diplôme ni un test de connaissances.

## 5. Sauvegarde et reprise

La progression et les résultats sont enregistrés **localement dans le navigateur** via
IndexedDB. Actualiser la page permet normalement de conserver les missions terminées.
Le bouton **Reprendre mon parcours** peut apparaître pour accéder au prochain niveau débloqué.

Les résultats ne sont pas automatiquement synchronisés avec d'autres appareils ou profils
Chrome/Edge. Effacer les données du site peut supprimer la progression enregistrée.

## 6. Installation et mode hors ligne

La possibilité d'installer l'application ainsi que le mode hors ligne sont fournis
par la **PWA déjà développée par Chouari Zaineb**. Si le navigateur propose
**Installer l'application**, suivre l'invite. La disponibilité hors ligne dépend de la
mise en cache préalable des ressources : effectuer d'abord une visite en ligne.

## 7. Dépannage

| Problème | Vérification |
|---|---|
| « WebGPU est obligatoire » | Utiliser Chrome/Edge récent et un appareil compatible ; vérifier l'accélération graphique |
| Bouton « Entrer en VR » désactivé | Utiliser Mode bureau ou vérifier la présence d'un casque / émulateur |
| Aucun son | Vérifier la sortie audio, le volume et la touche M ; cliquer dans la page pour autoriser l'audio |
| Niveau suivant verrouillé | Terminer la mission précédente et cliquer sur Continuer |
| Tableau de bord vide | Vérifier qu'au moins une mission est réussie ; ouvrir le tableau depuis l'accueil |
| Progression disparue | Vérifier le profil de navigateur ; éviter la suppression des données du site |

## 8. Confidentialité et limites

L'application n'exige aucun compte et ne transmet pas les scores à un serveur de comptes.
Les informations de progression sont stockées dans le navigateur utilisé.
Ce projet a un objectif pédagogique et ne doit pas être utilisé comme outil de diagnostic médical.
