# Méthode de travail Git de l'équipe

## Les branches

```
main      ← version stable, présentée au professeur (fusion de develop en fin de sprint)
  └─ develop   ← intégration : toutes les branches de travail y sont fusionnées
        ├─ feature/moteur-vr, feature/integration-sprint2, feature/niveau-poumons   (Zaineb)
        ├─ feature/visuels-coeur, feature/visuels-poumons-cerveau                   (Yessmine)
        └─ feature/jeu-coeur, feature/niveau-cerveau                                (Melek)
```

- Personne ne travaille directement sur `main` ni sur `develop`.
- Chaque membre travaille sur ses propres branches `feature/...`, avec son propre compte GitHub.
- Tout ce qui est présenté en séance doit être fusionné dans `main` avant la séance.

## Configuration (une seule fois par ordinateur)

```powershell
git config --global user.name "Prénom Nom"
git config --global user.email "email-du-compte-github"
```

L'e-mail doit être celui du compte GitHub (GitHub → Settings → Emails), sinon les commits ne sont pas
comptés dans les contributions du membre.

## Commencer une nouvelle tâche

```powershell
git checkout develop
git pull origin develop
git checkout -b feature/nom-de-la-tache
npm install
```

## Pendant le travail

```powershell
git add .
git commit -m "feat: description courte"
git push -u origin feature/nom-de-la-tache     # le premier push ; ensuite simplement : git push
```

- Un commit par étape qui fonctionne, au moins un par jour de travail.
- Préfixes : `feat:` nouveauté · `fix:` correction · `docs:` documentation · `chore:` configuration.
- Vérifier `npm run build` avant chaque push.

## Récupérer le travail des autres

```powershell
git checkout feature/ma-branche
git pull origin develop
```

En cas de conflit, Git indique les fichiers concernés. On ouvre chaque fichier dans VS Code, on choisit le bon
contenu (« Accept Current », « Accept Incoming » ou « Accept Both »), puis :

```powershell
git add .
git commit -m "chore: synchronisation avec develop"
```

## Terminer une tâche

1. `git push`.
2. Sur GitHub : **Pull requests → New pull request**, base `develop` ← compare `feature/ma-branche`.
3. Un autre membre relit (**Files changed → Review changes → Approve**).
4. **Merge pull request**.
5. En fin de sprint : une pull request `develop` → `main`, puis **Merge**.

## Vérifier les contributions

- **Insights → Contributors** : commits par membre sur `main`.
- **Commits** : historique complet, avec l'auteur de chaque commit.
- **Pull requests → Closed** : toutes les fusions réalisées.
