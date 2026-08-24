# Strategie de tests Pikala V2

## Tests statiques

~~~powershell
npm run test:static
npm audit
npm run deploy:dry-run
~~~

test:static couvre fondations, 5 langues, D1, auth, espace utilisateur, abonnements, admin, operations, PWA, SEO et observabilite.

## Responsive et navigateur

Demarrer le serveur statique et Chrome avec un port DevTools, puis lancer npm run test:responsive. Le test couvre 320, 375, 390, 430, 768, 1024, 1280 et 1440 pixels, en LTR et RTL, sur 9 ecrans.

Les scripts check-homepage-browser, check-user-space-browser, check-admin-browser et check-operations-browser couvrent la homepage, 7 ecrans utilisateur, 14 vues admin et les ecrans operationnels. Ils verifient traductions, debordements, navigation, carte, donnees chargees et comportement hors ligne.

## Crash-tests API

Preparer D1 locale :

~~~powershell
npm run db:migrate:local
npm run db:seed:local
npm run db:seed:rides-test:local
npx wrangler d1 execute pikala-db --local --file seeds/admin-test.sql
~~~

Demarrer un Worker local avec EMAIL_DEV_MODE=1. Pour l'auth, utiliser AUTH_TEST_SESSION_TTL_SECONDS=2. Pour les tests paiement uniquement, definir ENVIRONMENT=development, PAYMENT_PROVIDER=test et un PAYMENT_TEST_SECRET local d'au moins 24 caracteres.

Executer ensuite les scripts test:auth:crash, test:rides:crash, test:subscriptions:crash, test:admin:crash et test:operations:crash avec l'URL locale en argument. Relancer test:subscriptions:no-provider sur un Worker sans PAYMENT_PROVIDER.

## Invariants verifies

- un seul trajet actif par velo et par utilisateur ;
- double start et double restitution refuses ;
- ownership des trajets, tickets, incidents, notifications et paiements ;
- utilisateur normal refuse par les pages et API admin ;
- abonnement payant active uniquement par webhook signe ;
- incident critique rend le velo non louable ;
- restitution avec maintenance conserve le velo hors service ;
- aucune action hors ligne presente un faux succes.

## Controle D1 apres tests

~~~sql
PRAGMA foreign_key_check;
SELECT bike_id, COUNT(*) FROM rides WHERE status='active' GROUP BY bike_id HAVING COUNT(*) > 1;
SELECT user_id, COUNT(*) FROM rides WHERE status='active' GROUP BY user_id HAVING COUNT(*) > 1;
~~~

Les trois resultats doivent etre vides.
