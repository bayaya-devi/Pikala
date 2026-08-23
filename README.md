# Pikala

Pikala est un prototype de service de velos en libre-service a Rabat. Le depot
reunit un site statique, un espace utilisateur et une API Cloudflare Worker
connectee a Cloudflare D1.

## Etat actuel

La V1 fournit une homepage, une inscription, une connexion, des sessions, une
liste de stations, un profil, un abonnement simplifie et un formulaire de
support. Le scanner, le paiement, les trajets complets et l'administration
metier ne sont pas encore reels.

Le diagnostic complet et la cible V2 sont documentes ici :

- [Audit V1](docs/audit-v1.md)
- [Architecture V2](docs/architecture.md)
- [Base D1](docs/database.md)
- [Migration V1 vers V2](docs/migration.md)
- [Administration](docs/admin.md)
- [Deploiement Cloudflare](docs/deployment.md)
- [Strategie de tests](docs/testing.md)

## Architecture V1

```text
sitepikala/       Pages, styles, scripts et medias statiques
src/worker.js     Routage, API, auth, logique metier et acces D1
wrangler.toml     Worker, Static Assets et binding D1
index.html        Redirection vers le splash screen
```

## Commandes actuelles

```powershell
npm install
npm run deploy
```

L'installation n'est pas encore reproductible : `package.json` ne declare pas
Wrangler et aucun lockfile n'est versionne. Cette dette doit etre corrigee avant
la premiere modification structurelle de V2.

## Regles de migration

- Ne jamais supprimer ou recreer la base D1 de production.
- Exporter le schema et sauvegarder D1 avant toute migration.
- Remplacer `ensureSchema()` par des migrations versionnees et additives.
- Conserver les URLs V1 jusqu'a validation de leurs remplacements.
- Ne retirer une page historique qu'apres equivalence fonctionnelle testee.
- Ne jamais enregistrer de secret dans Git.
