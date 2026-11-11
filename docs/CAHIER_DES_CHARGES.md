# Inside Human VR – Cahier des charges

> Version Markdown du fichier `cahier-des-charges.docx` (même dossier), pour la lecture directement sur GitHub.

**SUP'COM – Cycle Ingénieur**

Projet : Réalité Étendue – WebXR VR & WebGPU

**INSIDE HUMAN VR**

*Voyage immersif à l’intérieur du corps humain*

**CAHIER DES CHARGES**

*« Et si vous pouviez devenir un globule rouge et voyager jusqu’au cœur ? »*

| **Équipe**       |
|------------------|
| Chouari Zaineb   |
| Hentati Yessmine |
| Malouli Melek    |

| **Encadrement**                 |
|---------------------------------|
| Dr. Ing. Mohamed-Bécha Kaâniche |

Sommaire

**1.** Présentation du concept

**2.** Clients, besoins et périmètre

**3.** Exigences fonctionnelles et non fonctionnelles

**4.** Technologies et architecture

**5.** Modèle commercial

**6.** Stratégie de démonstration et validation

**7.** Livrables

**8.** Gestion de projet et planning

**9.** Hypothèses et risques

**10.** Concepts clés et patrons de conception

**11.** Directives de développement

**12.** Conclusion

# 1 Présentation du concept

> *Inside Human VR est une application éducative en réalité virtuelle où l’utilisateur, miniaturisé, voyage dans trois organes (le cœur, les poumons, le cerveau) et réussit une mission dans chacun pour avancer.*

## 1.1 Contexte du projet

Ce projet académique du Cycle Ingénieur à Sup’Com vise à concevoir une expérience de réalité virtuelle (VR) accessible depuis un simple navigateur web. Il est réalisé en 6 semaines par une équipe de 3 étudiants, avec la pile technique vue en cours : WebXR, Three.js, WebGPU et PWA.

Le projet respecte trois contraintes strictes :

- **Aucun budget** : uniquement des outils open source et gratuits, et des modèles 3D sous licence libre.

- **Aucun matériel dédié** : pas de casque VR ni de manettes. Le développement et la démonstration se font sur un PC standard, avec l’extension gratuite Immersive Web Emulator pour simuler le casque.

- **Rendu moderne** : le moteur graphique s’appuie sur WebGPU (via le WebGPURenderer de Three.js et des shaders TSL compilés en WGSL), et non sur du WebGL écrit à la main.

## 1.2 Problématique

Le fonctionnement du corps humain s’enseigne surtout avec des schémas en 2D et des textes. Les mécanismes les plus importants, comme le trajet du sang, les échanges d’oxygène ou la transmission d’un signal nerveux, sont dynamiques et invisibles à l’œil nu. Les élèves les apprennent par cœur sans vraiment se les représenter.

> *Comment permettre à un apprenant de vivre de l’intérieur le fonctionnement de ses organes, de façon active et ludique, depuis un simple navigateur, sans casque et sans installation ?*

## 1.3 Pourquoi la réalité virtuelle

La VR n’est pas ici un simple affichage 3D. Elle apporte ce qu’un écran ou la réalité augmentée ne permettent pas :

- **Changer d’échelle** : l’utilisateur devient minuscule et se retrouve à l’intérieur d’un vaisseau sanguin ou d’une alvéole pulmonaire.

- **Être entouré par le phénomène** : le sang circule autour de lui, le cœur bat autour de lui, les neurones s’allument dans toutes les directions.

- **Apprendre en agissant** : chaque notion est une mission à réussir, et non un texte à lire.

## 1.4 Ambitions

- Développer une Progressive Web App (PWA) de réalité virtuelle fonctionnant en mode immersive-vr de l’API WebXR.

- Proposer un **mode bureau** (souris et clavier) quand aucun casque n’est disponible.

- Construire trois niveaux (cœur, poumons, cerveau), chacun avec une mission interactive qui débloque le suivant.

- Rendre visibles les phénomènes invisibles grâce à des particules et des shaders WebGPU (sang oxygéné et désoxygéné, influx nerveux).

- Guider l’utilisateur avec des panneaux d’information flottants dans la scène et un son spatialisé.

- Sauvegarder les scores et la progression en local, et les résumer dans un tableau de bord final.

- Fonctionner hors ligne grâce au Service Worker.

# 2 Clients, besoins et périmètre

> *Le produit vise d’abord les élèves et leurs enseignants de SVT et de biologie ; le MVP couvre trois organes et exclut toute simulation médicale réaliste.*

## 2.1 Qui va adopter la solution

| **Catégorie**           | **Utilisateurs**                                                    | **Usage principal**                                 |
|-------------------------|---------------------------------------------------------------------|-----------------------------------------------------|
| **Clients primaires**   | Collégiens, lycéens, étudiants en 1re année de santé ou de biologie | Comprendre et réviser le fonctionnement des organes |
| **Clients primaires**   | Enseignants de SVT et de biologie                                   | Illustrer un cours, animer une séance en classe     |
| **Clients secondaires** | Écoles, centres de formation, musées et centres de sciences         | Ateliers, expositions, journées portes ouvertes     |
| **Public d’évaluation** | Jury académique et enseignants de Sup’Com                           | Validation du projet                                |

## 2.2 Besoins spécifiques

- **Comprendre un mécanisme, pas seulement une forme** : voir le sang circuler, l’oxygène passer, le signal nerveux voyager.

- **Apprendre en faisant** : des missions courtes avec un retour immédiat (bonne ou mauvaise réponse, explication).

- **Suivre sa progression** : score, temps, organes visités et notions acquises.

- **Explications accessibles** : textes courts en français, voix et sons d’ambiance.

- **Accessibilité matérielle** : fonctionner sur un PC ordinaire, sans casque, sans compte et sans installation, même hors ligne.

## 2.3 Occasions d’utilisation

- Cours et travaux pratiques de SVT, projeté en classe ou utilisé en salle informatique.

- Révision individuelle à la maison avant un contrôle.

- Ateliers de vulgarisation scientifique, fêtes de la science, journées portes ouvertes.

- Démonstration lors de la soutenance du projet.

## 2.4 Périmètre du MVP : les trois niveaux

| **Niveau**          | **Environnement**                                       | **Notion apprise**                                          | **Mission à réussir**                                                                                          |
|---------------------|---------------------------------------------------------|-------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------|
| **1 – Le cœur**     | Vaisseaux sanguins, puis les quatre cavités du cœur     | La circulation sanguine, le rôle des cavités et des valves  | Guider un globule rouge dans le bon ordre : veine cave, oreillette droite, ventricule droit, artère pulmonaire |
| **2 – Les poumons** | Bronches, puis une alvéole pulmonaire et son capillaire | Les échanges gazeux entre l’air et le sang                  | Faire passer l’oxygène vers le sang et le dioxyde de carbone vers l’air                                        |
| **3 – Le cerveau**  | Un réseau de neurones                                   | La transmission de l’influx nerveux et le rôle des synapses | Activer les neurones dans le bon ordre pour transmettre un signal jusqu’à sa cible                             |

Chaque niveau suit le même déroulé : arrivée et explication, exploration par téléportation, mission, résultat, déblocage du niveau suivant. Un tableau de bord final résume les scores, les organes visités et les notions acquises.

## 2.5 Limites fonctionnelles (hors périmètre)

- Outil pédagogique, **pas un outil médical** : aucun diagnostic, aucune donnée de patient.

- Trois organes seulement pour le MVP ; les autres (estomac, reins, foie) sont des extensions futures.

- Pas de simulation physiologique réaliste ni de moteur physique : les animations sont simplifiées et pédagogiques.

- Pas de navigation libre en vol : les déplacements se font par points de téléportation.

- Pas de multijoueur, pas de compte utilisateur, pas de serveur.

- Pas de modélisation 3D originale : des modèles existants sous licence libre sont adaptés dans Blender.

- Pas de publication sur un store : l’application est une PWA accessible par un lien.

# 3 Exigences fonctionnelles et non fonctionnelles

> *Le MVP compte 14 exigences fonctionnelles, dont 10 obligatoires, et 8 exigences non fonctionnelles mesurables. La priorité suit la méthode MoSCoW : M = obligatoire, S = souhaitable, C = optionnel.*

## 3.1 Exigences fonctionnelles

| **ID**    | **Exigence**                                                                                                   | **Priorité** |
|-----------|----------------------------------------------------------------------------------------------------------------|--------------|
| **EF-01** | Afficher un écran d’accueil avec le titre, les instructions et les boutons « Entrer en VR » et « Mode bureau » | M            |
| **EF-02** | Démarrer une session WebXR immersive-vr si elle est disponible, sinon basculer en mode bureau                  | M            |
| **EF-03** | Charger les modèles 3D des organes (glTF/GLB) avec un écran de chargement                                      | M            |
| **EF-04** | Se déplacer par téléportation vers des points prédéfinis (manette en VR, clic en mode bureau)                  | M            |
| **EF-05** | Sélectionner un élément en le pointant (raycasting) et afficher son nom et sa fonction sur un panneau flottant | M            |
| **EF-06** | Niveau 1 : animer le battement du cœur et la circulation du sang, et valider le trajet du globule rouge        | M            |
| **EF-07** | Niveau 2 : animer la respiration et valider le déplacement des molécules d’O₂ et de CO₂                        | M            |
| **EF-08** | Niveau 3 : animer l’influx nerveux et valider l’ordre d’activation des neurones                                | M            |
| **EF-09** | Calculer un score par niveau (bonnes réponses, erreurs, temps) et débloquer le niveau suivant                  | M            |
| **EF-10** | Sauvegarder la progression et les scores en local (IndexedDB) et les restaurer au retour                       | M            |
| **EF-11** | Afficher un tableau de bord final : score par organe, temps, notions acquises                                  | S            |
| **EF-12** | Jouer des sons spatialisés : battements du cœur, respiration, ambiance                                         | S            |
| **EF-13** | Lire les explications à voix haute (synthèse vocale du navigateur)                                             | C            |
| **EF-14** | Proposer un mode « exploration libre » sans score, pour l’enseignant                                           | C            |

## 3.2 Exigences non fonctionnelles

| **ID**     | **Catégorie**  | **Exigence et critère de mesure**                                                                              |
|------------|----------------|----------------------------------------------------------------------------------------------------------------|
| **ENF-01** | Performance    | 72 images/s minimum en mode VR émulé, 60 images/s en mode bureau, sur un PC portable standard                  |
| **ENF-02** | Chargement     | Premier chargement en moins de 10 s ; chaque organe pèse moins de 5 Mo après compression                       |
| **ENF-03** | Compatibilité  | Chrome et Edge récents sur PC ; repli automatique de WebGPU vers WebGL 2 géré par Three.js                     |
| **ENF-04** | Hors ligne     | L’application complète fonctionne sans connexion après la première visite                                      |
| **ENF-05** | Sécurité       | Servie en HTTPS (obligatoire pour WebXR) ; aucune donnée personnelle collectée ni envoyée                      |
| **ENF-06** | Confort        | Aucun déplacement continu (téléportation uniquement) pour éviter le mal des transports ; textes lisibles à 2 m |
| **ENF-07** | Utilisabilité  | Un nouvel utilisateur termine le niveau 1 sans aide en moins de 5 minutes                                      |
| **ENF-08** | Maintenabilité | Code modulaire en ES modules ; contenu pédagogique séparé du code dans des fichiers JSON                       |

# 4 Technologies et architecture

> *L’application est une PWA en JavaScript construite sur Three.js avec le WebGPURenderer et des shaders TSL compilés en WGSL ; aucune ligne de WebGL n’est écrite à la main.*

## 4.1 Choix technologiques

| **Couche**            | **Technologie**                  | **Rôle dans le projet**                                                                        |
|-----------------------|----------------------------------|------------------------------------------------------------------------------------------------|
| **Rendu 3D**          | Three.js (three/webgpu)          | Scène, caméra, lumières, chargement des modèles, animations                                    |
| **API graphique**     | WebGPU                           | Rendu moderne et performant ; repli automatique vers WebGL 2 si le matériel ne le supporte pas |
| **Shaders**           | TSL compilé en WGSL              | Flux sanguin, pulsation des tissus, influx nerveux lumineux, brouillard organique              |
| **Particules**        | InstancedMesh + TSL              | Des milliers de globules rouges, molécules et impulsions en un seul appel de dessin            |
| **Réalité virtuelle** | WebXR Device API                 | Session immersive-vr, suivi de la tête et des manettes                                         |
| **Test sans casque**  | Immersive Web Emulator           | Simulation d’un casque Meta Quest et de ses manettes sur PC                                    |
| **Mode bureau**       | PointerLockControls              | Navigation à la souris et au clavier sans VR                                                   |
| **Interface 3D**      | three-mesh-ui                    | Consignes, explications et résultats affichés dans la scène                                    |
| **Audio**             | Web Audio API                    | Battements du cœur, respiration et ambiance spatialisés (PositionalAudio)                      |
| **Voix**              | Web Speech API                   | Lecture des explications à voix haute                                                          |
| **Sauvegarde**        | IndexedDB                        | Scores, temps et progression par niveau                                                        |
| **Hors ligne**        | Service Worker                   | Mise en cache des fichiers et des modèles ; installation comme une application                 |
| **Modèles 3D**        | Blender, glTF/GLB, Draco         | Adaptation et allègement des modèles d’organes sous licence libre                              |
| **Outillage**         | Vite, VS Code, Git, GitHub Pages | Développement, build, versionnement, hébergement HTTPS gratuit                                 |

## 4.2 Justification du choix de Three.js

- **A-Frame** repose sur l’ancien moteur WebGL de Three.js et ne permet pas d’utiliser WebGPU.

- **Le WGSL écrit à la main** obligerait à recoder tout un moteur (caméra, chargement de modèles, gestion de la VR), ce qui dépasse le cadre de 6 semaines.

- **Three.js avec \`WebGPURenderer\`** offre le meilleur équilibre : un moteur complet, la VR intégrée, et des shaders écrits en TSL puis traduits automatiquement en WGSL.

> **Note technique.** Le support de WebXR par le backend WebGPU est récent. Pendant une session VR, Three.js peut utiliser son backend WebGL 2 de façon transparente ; le code de l’application reste identique et entièrement basé sur l’API Three.js WebGPU.

## 4.3 Architecture logicielle

L’application est organisée en couches. Chaque couche n’utilise que celle qui se trouve juste en dessous : les niveaux ne parlent jamais directement au moteur, ce qui permet de développer les trois organes en parallèle.

*Figure 1 – Architecture en couches de l’application*

| **Présentation**   | Écran d’accueil (VR ou mode bureau) · Panneaux 3D flottants · Tableau de bord final                  |
|--------------------|------------------------------------------------------------------------------------------------------|
| **Logique de jeu** | Niveaux (BaseLevel → cœur, poumons, cerveau) · GameState (machine à états, score) · Bus d’événements |
| **Systèmes**       | Téléportation · Interaction (raycasting) · Particules (InstancedMesh + TSL) · Audio spatialisé       |
| **Moteur**         | Three.js \`WebGPURenderer\` · Shaders TSL compilés en WGSL · Entrées WebXR ou souris/clavier         |
| **Données**        | levels.json · Modèles GLB (Draco) · IndexedDB · Service Worker (cache hors ligne)                    |
| **Plateforme**     | Navigateur Chrome ou Edge sur PC · WebGPU (repli WebGL 2) · Immersive Web Emulator                   |

## 4.4 Organisation du code

| **Fichier ou dossier** | **Contenu**                                                    |
|------------------------|----------------------------------------------------------------|
| index.html             | Structure de la PWA, écran d’accueil, boutons d’entrée         |
| src/main.js            | Initialisation du moteur et de la boucle de rendu              |
| src/core/              | Renderer.js, XRManager.js, DesktopControls.js, AudioManager.js |
| src/levels/            | BaseLevel.js, HeartLevel.js, LungsLevel.js, BrainLevel.js      |
| src/systems/           | Teleport.js, Interaction.js, Particles.js, UIPanel.js          |
| src/shaders/           | Effets TSL : bloodFlow.js, tissuePulse.js, neuronSignal.js     |
| src/data/              | GameState.js, Storage.js (IndexedDB)                           |
| public/assets/models/  | heart.glb, lungs.glb, brain.glb, vessel.glb                    |
| public/assets/content/ | levels.json : missions, questions et explications en français  |
| public/assets/audio/   | Sons d’ambiance sous licence CC0                               |
| manifest.json, sw.js   | Installation et fonctionnement hors ligne                      |

## 4.5 Contraintes techniques

- **HTTPS obligatoire** : le navigateur refuse une session WebXR sur une connexion non sécurisée. GitHub Pages fournit le HTTPS ; en développement, localhost est accepté.

- **Budget de rendu** : moins de 300 000 triangles affichés et moins de 100 appels de dessin par image, pour tenir 72 images/s.

- **Un seul organe en mémoire** à la fois : chaque niveau est chargé à l’entrée puis libéré à la sortie.

# 5 Modèle commercial

> *Le modèle est freemium : le niveau du cœur est gratuit pour tous, et les établissements paient une licence annuelle pour l’ensemble des organes et les outils enseignant.*

| **Élément**               | **Description**                                                                                                                                                                     |
|---------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Proposition de valeur** | Voir et vivre de l’intérieur le fonctionnement du corps, sans casque, sans installation, en français, même hors ligne                                                               |
| **Différenciation**       | Les solutions existantes sont des applications natives payantes qui exigent un casque ; Inside Human VR fonctionne dans un navigateur, sur le matériel déjà présent dans les écoles |
| **Offre gratuite**        | Niveau 1 (le cœur) complet, pour les élèves et les particuliers                                                                                                                     |
| **Offre Établissement**   | Licence annuelle : tous les organes, mode enseignant, suivi de classe                                                                                                               |
| **Extensions payantes**   | Packs d’organes supplémentaires (système digestif, reins, squelette) et packs de quiz par niveau scolaire                                                                           |
| **Distribution**          | Un lien web ou un QR code, sans store ; démonstrations dans les écoles et les salons de l’éducation                                                                                 |
| **Communication**         | Vidéo de démonstration, réseaux sociaux des enseignants, partenariats avec des clubs scientifiques                                                                                  |
| **Lancement**             | MVP à la semaine 6, pilote avec une classe de SVT, puis ajout progressif d’organes                                                                                                  |
| **Coûts**                 | Quasi nuls : hébergement statique gratuit, aucun serveur, aucune base de données distante                                                                                           |

# 6 Stratégie de démonstration et validation

> *La démonstration de soutenance tient en 5 minutes sur un seul PC : un membre du jury guide un globule rouge jusqu’au cœur en mode VR émulé, avec le mode bureau en secours.*

## 6.1 Scénario de démonstration

1.  L’utilisateur ouvre le lien de la PWA dans Chrome sur PC. L’écran d’accueil propose « Entrer en VR » ou « Mode bureau ».

2.  Il entre en VR via Immersive Web Emulator. Il se retrouve miniaturisé dans une veine, entouré de globules rouges, avec le son des battements du cœur.

3.  Un panneau flottant explique la mission. Il se téléporte de point en point et guide le globule rouge jusqu’aux bonnes cavités du cœur.

4.  En cas d’erreur, la cavité s’allume en rouge avec une explication ; en cas de réussite, le niveau des poumons se débloque.

5.  Dans les poumons, il fait passer l’oxygène vers le sang et le dioxyde de carbone vers l’air ; le sang passe du bleu au rouge.

6.  Dans le cerveau, il active les neurones dans le bon ordre et voit l’influx nerveux voyager jusqu’à sa cible.

7.  Le tableau de bord final affiche le score par organe, le temps et les notions acquises.

## 6.2 Environnement de test

| **Élément**              | **Configuration**                                                                        |
|--------------------------|------------------------------------------------------------------------------------------|
| **Matériel**             | PC portable de l’équipe, sans casque ni manette                                          |
| **Navigateur principal** | Google Chrome récent (Edge en secours), WebGPU activé par défaut                         |
| **Simulation VR**        | Extension Immersive Web Emulator (casque Meta Quest simulé, deux manettes)               |
| **Mode de repli**        | Mode bureau (souris et clavier) si la session VR ne démarre pas                          |
| **Hébergement**          | GitHub Pages (HTTPS) ; copie locale lancée avec npm run preview en cas de coupure réseau |

## 6.3 Plan de tests

| **Type de test**  | **Méthode**                                                    | **Critère de réussite**                                           |
|-------------------|----------------------------------------------------------------|-------------------------------------------------------------------|
| **Fonctionnels**  | Exécution manuelle de chaque exigence EF-01 à EF-14            | Toutes les exigences M validées                                   |
| **Performance**   | Compteur d’images/s (stats.js) et onglet Performance de Chrome | ENF-01 et ENF-02 respectées                                       |
| **Hors ligne**    | Mode « Offline » des outils de développement de Chrome         | Application complète sans réseau                                  |
| **Compatibilité** | Chrome et Edge, avec et sans WebGPU                            | Repli WebGL 2 fonctionnel                                         |
| **Utilisateurs**  | 5 étudiants hors équipe, questionnaire court                   | Niveau 1 terminé sans aide en moins de 5 min par au moins 4 sur 5 |
| **Pédagogique**   | Relecture des contenus par un enseignant de biologie           | Aucune erreur scientifique                                        |

# 7 Livrables

> *Huit livrables sont remis en fin de semaine 6, tous hébergés ou référencés dans le dépôt GitHub du projet.*

| **Livrable**                            | **Contenu**                                                                                                                   |
|-----------------------------------------|-------------------------------------------------------------------------------------------------------------------------------|
| **Cahier des charges**                  | Le présent document                                                                                                           |
| **Cahier conceptuel (Design Notebook)** | Diagrammes UML de cas d’utilisation, de séquence, de classes, de composants et de déploiement ; diagramme d’états d’un niveau |
| **Code source**                         | Dépôt GitHub structuré (section 4.4), avec historique de commits par membre                                                   |
| **Application déployée**                | PWA en ligne sur GitHub Pages (HTTPS), installable et utilisable hors ligne                                                   |
| **Documentation technique**             | Guide d’installation, de build et de déploiement ; description de l’architecture                                              |
| **Manuel utilisateur**                  | Prise en main en mode VR émulé et en mode bureau ; description des trois missions                                             |
| **Supports marketing**                  | Affiche, dossier de presse court, captures d’écran                                                                            |
| **Vidéo de démonstration**              | 5 minutes maximum, voix off, sans fond sonore, diapositive de garde                                                           |

# 8 Gestion de projet et planning

> *Le projet se déroule en 6 sprints d’une semaine, pour 52 hommes-jour estimés sur une capacité de 90 ; chaque fin de semaine donne lieu à une démonstration fonctionnelle.*

## 8.1 Méthodologie

L’équipe suit une approche itérative de type eXtreme Programming (XP) : sprints d’une semaine, programmation en binôme sur les parties critiques (VR, shaders), intégration continue sur la branche develop et démonstration chaque fin de semaine. Les tâches sont suivies sur un tableau GitHub Projects.

## 8.2 Planning d’exécution

*Figure 2 – Diagramme de Gantt sur 6 semaines*

| **Tâche**                       | **S1** | **S2** | **S3** | **S4** | **S5** | **S6** |
|---------------------------------|--------|--------|--------|--------|--------|--------|
| Structure PWA et scène WebGPU   |        |        |        |        |        |        |
| VR, mode bureau, interaction    |        |        |        |        |        |        |
| Niveau 1 : le cœur              |        |        |        |        |        |        |
| Niveau 2 : les poumons          |        |        |        |        |        |        |
| Score, sauvegarde, audio        |        |        |        |        |        |        |
| Niveau 3 : le cerveau           |        |        |        |        |        |        |
| Hors ligne, optimisation, tests |        |        |        |        |        |        |
| Documentation et vidéo          |        |        |        |        |        |        |
| Version finale et soutenance    |        |        |        |        |        |        |

| **Semaine** | **Objectifs**                                                                                                                            | **Résultat de fin de semaine**                        |
|-------------|------------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------|
| **S1**      | Structure PWA avec Vite ; scène Three.js avec WebGPURenderer ; chargement d’un modèle GLB ; préparation des modèles dans Blender         | Scène 3D affichant le cœur dans le navigateur         |
| **S2**      | Session WebXR immersive-vr, manettes, tests avec Immersive Web Emulator ; mode bureau ; téléportation ; raycasting et panneaux flottants | Navigation VR et bureau fonctionnelle                 |
| **S3**      | Niveau 1 : vaisseaux, battement du cœur, particules de sang en TSL, mission du globule rouge, score                                      | Niveau 1 jouable de bout en bout                      |
| **S4**      | Niveau 2 : respiration, alvéole, molécules O₂/CO₂, changement de couleur du sang ; sauvegarde IndexedDB                                  | Niveaux 1 et 2 enchaînés avec progression sauvegardée |
| **S5**      | Niveau 3 : réseau de neurones, influx nerveux en TSL ; son spatialisé ; tableau de bord final                                            | Parcours complet des trois niveaux                    |
| **S6**      | Service Worker ; optimisation (Draco, budget de rendu) ; tests utilisateurs ; documentation ; vidéo                                      | Version finale déployée et livrables                  |

## 8.3 Répartition des rôles

| **Membre**           | **Responsabilité principale**                                                   | **Responsabilité secondaire** |
|----------------------|---------------------------------------------------------------------------------|-------------------------------|
| **Chouari Zaineb**   | Moteur et VR : rendu WebGPU, session WebXR, téléportation, mode bureau          | Niveau 1 (le cœur)            |
| **Hentati Yessmine** | Effets visuels : shaders TSL, particules, animations, son spatialisé            | Niveau 2 (les poumons)        |
| **Malouli Melek**    | Jeu et données : missions, score, IndexedDB, interface 3D, tableau de bord, PWA | Niveau 3 (le cerveau)         |

La documentation, les tests et la vidéo de démonstration sont réalisés conjointement par les trois membres.

## 8.4 Estimation de la charge en hommes-jour

| **Lot** | **Contenu**                                                       | **Hommes-jour** |
|---------|-------------------------------------------------------------------|-----------------|
| 1       | Structure PWA, scène Three.js WebGPU, préparation des modèles     | 6               |
| 2       | Session VR, mode bureau, téléportation, interaction, panneaux 3D  | 8               |
| 3       | Niveau 1 : le cœur                                                | 8               |
| 4       | Niveau 2 : les poumons                                            | 7               |
| 5       | Niveau 3 : le cerveau                                             | 7               |
| 6       | Score, sauvegarde IndexedDB, tableau de bord, audio               | 5               |
| 7       | Service Worker, optimisation, tests                               | 5               |
| 8       | Documentation, vidéo, supports marketing                          | 6               |
|         | Total estimé (capacité : 3 personnes × 30 jours = 90 hommes-jour) | 52              |

La marge d’environ 40 % couvre les aléas, l’apprentissage de WebGPU et de TSL, et les itérations demandées par le superviseur. Cette estimation est consolidée par le modèle COCOMO vu en cours.

# 9 Hypothèses et risques

> *Le risque principal est technique : le couple WebXR et WebGPU est récent. Il est couvert par le repli automatique de Three.js et par le mode bureau.*

## 9.1 Hypothèses

- Les membres de l’équipe disposent d’un PC récent avec Chrome ou Edge à jour.

- L’extension Immersive Web Emulator reste disponible et compatible avec la version de Three.js utilisée.

- Des modèles 3D du cœur, des poumons et du cerveau sous licence libre (CC0 ou CC BY) sont disponibles, notamment sur Sketchfab et NIH 3D.

- Les connaissances scientifiques nécessaires restent au niveau du lycée et sont vérifiables par un enseignant.

- L’équipe consacre en moyenne 3 jours par semaine et par personne au projet.

## 9.2 Risques et mesures d’atténuation

| **Risque**                                               | **Probabilité** | **Impact** | **Mesure d’atténuation**                                                               |
|----------------------------------------------------------|-----------------|------------|----------------------------------------------------------------------------------------|
| **Session VR instable avec le backend WebGPU**           | Moyenne         | Élevé      | Repli automatique sur le backend WebGL 2 de Three.js ; mode bureau toujours disponible |
| **Courbe d’apprentissage de TSL et WebGPU**              | Élevée          | Moyen      | Partir des exemples officiels de Three.js ; prototyper les shaders dès la semaine 1    |
| **Modèles 3D trop lourds**                               | Moyenne         | Élevé      | Simplification dans Blender, compression Draco, un seul organe chargé à la fois        |
| **Absence de modèle libre adapté (vaisseau, alvéole)**   | Moyenne         | Moyen      | Construction des décors avec des formes simples (tubes, sphères) et des shaders        |
| **Retard sur un niveau**                                 | Moyenne         | Moyen      | Niveaux indépendants ; le niveau 3 peut être simplifié sans bloquer les autres         |
| **Erreur scientifique dans les contenus**                | Faible          | Élevé      | Relecture par un enseignant de biologie ; sources citées dans levels.json              |
| **Panne réseau ou d’émulateur le jour de la soutenance** | Faible          | Élevé      | Version locale prête, mode bureau, vidéo de démonstration en dernier recours           |
| **Mal des transports**                                   | Faible          | Moyen      | Téléportation uniquement, aucun mouvement de caméra imposé                             |

# 10 Concepts clés et patrons de conception

> *Le projet mobilise les concepts essentiels de la réalité virtuelle et de l’informatique graphique, organisés autour de six patrons de conception.*

## 10.1 Concepts clés

| **Concept**                                   | **Utilisation dans le projet**                                 |
|-----------------------------------------------|----------------------------------------------------------------|
| **Session WebXR et espace** local-floor       | Placer l’utilisateur à hauteur réelle dans la scène VR         |
| **Boucle de rendu XR (**setAnimationLoop**)** | Mettre à jour la scène à chaque image, à 72 images/s           |
| **Rendu stéréoscopique**                      | Une image par œil, gérée par Three.js                          |
| **Raycasting**                                | Pointer un élément avec la manette ou la souris                |
| **Téléportation**                             | Se déplacer sans provoquer de mal des transports               |
| **Graphe de scène**                           | Organiser organes, particules et panneaux en hiérarchie        |
| **Instanciation (**InstancedMesh**)**         | Afficher des milliers de particules en un seul appel de dessin |
| **Shaders par nœuds (TSL vers WGSL)**         | Créer les effets visuels sans écrire de WGSL à la main         |
| **Audio spatialisé**                          | Donner une direction et une distance aux sons                  |
| **Interface diégétique**                      | Afficher les consignes sur des panneaux 3D dans la scène       |
| **Progressive Web App**                       | Installation, mise en cache et fonctionnement hors ligne       |

## 10.2 Patrons de conception

| **Patron**             | **Application**                                                                                              |
|------------------------|--------------------------------------------------------------------------------------------------------------|
| **State**              | Cycle de vie d’un niveau : Arrivée, Exploration, Mission, Résultat, Terminé                                  |
| **Template Method**    | BaseLevel définit le déroulé commun (load, start, update, dispose) ; chaque organe en redéfinit les étapes   |
| **Observer**           | Bus d’événements : les modules réagissent à missionSuccess ou levelUnlocked sans dépendre les uns des autres |
| **Singleton**          | Un seul GameState, un seul AudioManager, un seul Storage                                                     |
| **Strategy**           | Le même code d’interaction fonctionne avec deux stratégies d’entrée : manette VR ou souris                   |
| **Data-driven design** | Missions, questions et textes sont dans levels.json, séparés du code                                         |

# 11 Directives de développement

> *Le code est hébergé dans un dépôt GitHub unique, avec des branches par fonctionnalité et une revue croisée avant chaque fusion.*

## 11.1 Documentation interne

- Chaque module JavaScript commence par un commentaire qui décrit son rôle.

- Les fonctions publiques sont documentées en JSDoc (paramètres, valeur de retour).

- Le contenu pédagogique de levels.json cite ses sources scientifiques.

- Les licences de chaque modèle 3D et de chaque son sont listées dans CREDITS.md.

## 11.2 GitHub

- Branches : main (version stable déployée), develop (intégration), feature/\<nom\> (une par fonctionnalité).

- Commits courts et explicites, au format type: description (par exemple feat: mission du globule rouge).

- Chaque fusion vers develop passe par une pull request relue par un autre membre.

- Déploiement automatique sur GitHub Pages à chaque fusion vers main (GitHub Actions).

- README.md : présentation, captures, lien de la démonstration, instructions d’installation (npm install, npm run dev).

## 11.3 Vidéo de démonstration

- Durée de 5 minutes maximum, voix off claire, sans musique de fond.

- Diapositive de garde avec le titre, l’équipe et le superviseur.

- Plan : problématique (30 s), parcours des trois niveaux (3 min), architecture et technologies (1 min), conclusion (30 s).

- Enregistrement de l’écran du PC en mode VR émulé.

# 12 Conclusion

Inside Human VR transforme l’anatomie en voyage : au lieu de lire comment le sang circule, l’élève le suit de l’intérieur. Le projet exploite ce que seule la réalité virtuelle permet (changer d’échelle, être entouré par le phénomène, apprendre en agissant) tout en restant accessible sur un simple PC, sans casque et sans budget.

Sur le plan technique, il couvre la pile étudiée en cours : WebXR pour la VR, Three.js avec WebGPU et des shaders TSL compilés en WGSL pour le rendu, IndexedDB pour la sauvegarde et une PWA pour le fonctionnement hors ligne. Son périmètre (trois organes, des missions simples, la téléportation) le rend réalisable en 6 semaines, avec des extensions naturelles : nouveaux organes, mode enseignant et quiz par niveau scolaire.
