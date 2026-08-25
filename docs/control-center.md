# Pikala Control Center

## Périmètre

Le Control Center centralise les utilisateurs, employés, stations, docks, vélos, trajets, inspections, missions, rééquilibrage, maintenance, incidents, support, notifications, automatisations, devices IoT, avantages manuels, overrides et audit logs.

## Sécurité opérationnelle

- Toutes les routes `/api/admin/*` exigent un utilisateur authentifié avec le rôle `admin` côté Worker.
- Une commande sensible exige un motif de 10 à 500 caractères, une confirmation exacte `PIKALA <ACTION>` et une clé d’idempotence.
- Chaque commande sensible écrit dans `admin_overrides` et `admin_audit_logs`.
- Les anciennes routes permettant de contourner une commande forte refusent désormais les changements sensibles.
- Aucun endpoint du Control Center ne peut passer un paiement à `paid`.
- Un avantage manuel utilise `manual_entitlements`, avec justification et audit, sans modifier les paiements.

## Exploitation

Le tableau de bord calcule ses métriques depuis D1. La section « À votre attention » agrège stations faibles ou pleines, trajets longs, maintenances et missions en retard, tickets urgents, devices hors ligne et alertes persistantes.

Les états de fournisseurs indiquent uniquement si une configuration est présente. Aucun secret n’est retourné au frontend.

## Déploiement

1. Exporter la base D1 de production.
2. Appliquer `0012_control_center.sql` à distance.
3. Vérifier les migrations et les foreign keys.
4. Déployer le Worker.
5. Smoke-tester les routes publiques, le refus RBAC et l’interface admin.

En cas d’échec du Worker, restaurer immédiatement la version Worker précédente. La migration 0012 est additive : ses tables peuvent rester inutilisées jusqu’au correctif, sans suppression de données.

## Tests

- `npm run test:static`
- `npm run test:control-center`
- `node scripts/control-center-crash-test.mjs http://127.0.0.1:8840`
- `node scripts/admin-crash-test.mjs http://127.0.0.1:8840`
- `node scripts/check-admin-browser.mjs http://127.0.0.1:8831`
- `npm run deploy:dry-run`