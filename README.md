# Pikala V2

Pikala est une application de velos en libre-service a Rabat. Le meme Worker Cloudflare sert le site public, la PWA, les espaces utilisateur et administration, les API et les ressources statiques. Les donnees metier sont stockees dans Cloudflare D1.

## Fonctionnalites

- homepage publique, stations et plans alimentes par D1 ;
- inscription, verification email, connexion, sessions, reset et profil ;
- carte interactive, scanner QR reel avec saisie de secours, trajets et restitution ;
- plans, abonnements et cycle de paiement confirme par webhook ;
- support, incidents, maintenance et notifications ;
- administration protegee couvrant 14 vues ;
- cinq langues : francais, anglais, arabe RTL, espagnol et portugais ;
- PWA installable avec mode hors ligne limite et cache non critique ;
- logs structures Cloudflare sans secret ni jeton.

## Architecture

~~~text
sitepikala/       HTML, design system, i18n, PWA et bibliotheques navigateur locales
src/worker.js     Routage, auth, API publiques/privees et trajets
src/admin/        Services d'administration et operations
src/operations/   Support, incidents et notifications
src/payments/     Abstraction et cycle de paiement
migrations/       11 migrations D1 additives et versionnees
seeds/            Donnees exclusivement locales de developpement/test
scripts/          Controles statiques, navigateur et crash-tests API
docs/             Architecture, D1, securite, admin, paiement et exploitation
~~~

Voir aussi docs/architecture.md, docs/database.md, docs/deployment.md, docs/admin.md et docs/testing.md.

## Prerequis

- Node.js 24 LTS ou version compatible avec Wrangler 4 ;
- un compte Cloudflare pour les operations distantes ;
- Chrome pour les tests navigateur par CDP.

## Installation

~~~powershell
git clone https://github.com/bayaya-devi/Pikala.git
cd Pikala
npm ci
npm run db:migrate:local
npm run db:seed:local
~~~

Le lockfile est versionne. Les bibliotheques navigateur necessaires a la carte, au QR et aux icones sont servies depuis sitepikala/assets/vendor et ne dependent pas d'un CDN.

## Developpement local

~~~powershell
npm run dev
~~~

Ouvrir http://127.0.0.1:8787/. Pour tester les emails sans service externe :

~~~powershell
npx wrangler dev --local --var EMAIL_DEV_MODE:1 --var PUBLIC_ORIGIN:http://127.0.0.1:8787
~~~

EMAIL_DEV_MODE ne doit jamais etre active en production, car les liens de verification sont alors renvoyes par l'API.

## Base D1

~~~powershell
npm run db:migrations:list:local
npm run db:migrate:local
npm run db:seed:local
~~~

Les seeds sont locaux uniquement. Ne jamais executer seeds/development.sql, seeds/admin-test.sql ou seeds/real-rides-test.sql avec --remote.

## Tests

~~~powershell
npm run test:static
npm run test:responsive
npm audit
npm run deploy:dry-run
~~~

Les crash-tests complets demandent un Worker local et les seeds de test. La procedure exacte est dans docs/testing.md.

## Configuration Cloudflare

Le binding D1 DB et les Static Assets ASSETS sont declares dans wrangler.toml. Configurer en production :

- PUBLIC_ORIGIN : origine HTTPS canonique ;
- RESEND_API_KEY : secret Wrangler pour l'envoi email ;
- FROM_EMAIL : expediteur valide chez le prestataire ;
- PAYMENT_PROVIDER et les secrets propres au prestataire lorsque celui-ci existe.

Ajouter les secrets avec npx wrangler secret put NOM_DU_SECRET. Ne jamais les placer dans Git, wrangler.toml ou les logs.

## Deploiement

1. Verifier le compte avec npx wrangler whoami.
2. Exporter une sauvegarde D1 distante hors du depot.
3. Executer les tests, npm audit et npm run deploy:dry-run.
4. Lister puis appliquer les migrations distantes.
5. Deployer avec npm run deploy.
6. Tester /api/health, inscription, connexion, stations, trajet et admin.

La migration D1 doit toujours preceder le Worker qui utilise son schema. La procedure de retour arriere est documentee dans docs/deployment.md et migrations/ROLLBACK.md.
