# Pikala Digital Core

## Capacités livrées

- D1 versionné par 18 migrations additives et contrôlé sur une base neuve.
- Supervision déterministe : 9 règles, déduplication, cooldown, historique, audit, RBAC et états `new`, `acknowledged`, `in_progress`, `resolved`, `ignored`.
- Noyau IoT neutre : devices, credentials chiffrés, commandes, résultats, événements, télémétrie, signatures HMAC, nonces, anti-replay, expiration, rate limit et idempotence.
- Flux physique préparé : un trajet reste `reserved` jusqu'à confirmation `unlock`, puis reste actif jusqu'à confirmation `lock`.
- Modes `disabled`, `test` et `production`. Le simulateur exige le mode test, l'environnement développement et la permission `devices.manage`.
- Email abstrait avec Resend, erreurs explicites et aucune simulation en production.
- Paiement abstrait avec états, webhook signé et idempotence ; aucun paiement n'est déclaré payé sans confirmation fiable.

## Validation locale du 26 août 2026

- `npm ci` et `npm audit` : 0 vulnérabilité connue.
- Suite statique : 18 migrations, 58 tables, 5 langues, RTL, auth, RBAC, opérations, maintenance, terrain, supervision, IoT et PWA validés.
- Crash-tests : auth 27, trajets 35, paiement 26, admin 38, RBAC 52, opérations 56, Control Center 40, jumeaux 20, atelier 35, terrain 59, supervision 12 et IoT 29 contrôles.
- Navigateur : admin 58 parcours sur 25 vues ; opérations 28 écrans ; responsive 8 largeurs ; espace utilisateur 5 langues.

## Limites strictes

L'architecture est prête à recevoir un adapter constructeur, mais aucune serrure réelle n'est intégrée. Aucun secret email ni PSP réel n'est configuré. Le site ne peut donc pas encore être qualifié de service commercial de location physique. La certification finale doit être complétée par les preuves de migration et de smoke-test de production.
