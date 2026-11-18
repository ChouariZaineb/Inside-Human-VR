# Vidéo de démonstration — script (5 minutes, voix off, sans musique)

Format : capture d'écran de l'application (mode bureau ou casque) + voix off enregistrée par un membre de l'équipe. **Pas de musique** ; seuls les sons de l'application (battements, souffle) restent audibles, à faible volume.
Débit : environ 140 mots/minute → ce texte fait ~700 mots (≈ 5 min).

| # | Durée | Image | Voix off |
|---|-------|-------|----------|
| 0 | 0:00–0:15 | **Diapositive de titre** : « Inside Human VR — Explorer le corps humain en réalité virtuelle ». Noms de l'équipe, Sup'Com, année. | (silence ou) « Inside Human VR, une application de réalité virtuelle pour explorer le corps humain. » |
| 1 | 0:15–0:50 | Accueil : trois organes, Entrer en VR / Mode bureau. | « Notre projet est une application web WebXR : elle fonctionne dans un casque autonome ou dans un simple navigateur, sans installation. Trois niveaux, trois organes : le cœur, les poumons et le cerveau. Chaque niveau se débloque quand on réussit le précédent. » |
| 2 | 0:50–1:50 | Niveau cœur : vue d'ensemble, battements, globules dans les vaisseaux, pointage des chambres. | « Premier niveau : le cœur. Il bat au rythme d'un cœur au repos, et ce rythme pilote à la fois l'animation du muscle, le flux des globules rouges et le son. Le sang bleu, pauvre en oxygène, arrive par la veine cave ; il traverse l'oreillette et le ventricule droits, puis part vers les poumons. Pointe un élément pour afficher son rôle. La mission : suivre le chemin du sang dans le bon ordre. » |
| 3 | 1:50–2:50 | Niveau poumons : respiration, bronches, circulation bleu → rouge ; clic « Réussite » (lueur dorée). | « Deuxième niveau : les poumons. Ils se gonflent à l'inspiration et se vident à l'expiration, avec un souffle sonore synchronisé. Dans chaque poumon, le sang passe du bleu au rouge : c'est l'hématose, l'échange gazeux entre l'air et le sang. La mission consiste à déplacer l'oxygène vers le sang et le dioxyde de carbone vers l'air. » |
| 4 | 2:50–3:50 | Niveau cerveau : cortex translucide, neurones, impulsion lumineuse qui traverse la chaîne sensoriel → relais → moteur. | « Troisième niveau : le cerveau. Un message nerveux est une impulsion électrique qui voyage le long des neurones. Ici, elle traverse le neurone sensoriel, le neurone relais, puis le neurone moteur. À toi de les sélectionner dans l'ordre. Une erreur déclenche un flash rouge et retire des points. » |
| 5 | 3:50–4:25 | Démo de la voix : bouton « Lire à voix haute » ; son spatialisé (casque : tourner la tête). | « Les explications peuvent être lues à voix haute grâce à la synthèse vocale du navigateur. Le son est spatialisé : en casque, on entend le cœur battre à sa position dans l'espace. » |
| 6 | 4:25–4:50 | Schéma d'architecture (docs/design-notebook/classes.png). | « Côté technique : Three.js avec WebGPU, des shaders écrits en TSL pour la respiration, le flux sanguin et l'influx nerveux, un bus d'événements qui relie les niveaux, le son et les effets. » |
| 7 | 4:50–5:00 | Diapositive finale : lien du dépôt, noms, « Contenu à valider par un enseignant de biologie ». | « Merci de votre attention. » |

## Conseils de tournage
- Résolution 1920×1080, 30 i/s ; masquer la barre de favoris ; fermer les notifications.
- Enregistrer la voix à part (Audacity) dans une pièce calme, puis la caler sur l'image ; vérifier que le volume des sons de l'application ne couvre pas la voix.
- Capturer la scène du casque avec la diffusion (cast) du casque, ou en mode bureau si indisponible.
- Pour la scène 4, la page `/sandbox/organs.html?o=brain` lance une impulsion toutes les 4 s.
- Vérifier tous les faits avec `public/assets/content/levels.json` (déjà relu par l'équipe, relecture enseignant à faire).
