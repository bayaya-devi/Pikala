# Cloudflare D1 - modele Pikala V2

## Etat de production observe le 24 aout 2026

La base inspectee est `pikala-db`, identifiant
`722e8b9a-dbb1-4b04-8635-8493603af869`, binding Worker `DB`.

Tables metier deja presentes avant V2 :

| Table | Lignes avant migration | Etat V1 |
|---|---:|---|
| `users` | 9 | comptes, roles et verification email |
| `sessions` | 13 | sessions par jeton hache |
| `email_verifications` | 2 | jetons de confirmation |
| `stations` | 4 | stations et compteur historique de velos |
| `bikes` | 0 | inventaire minimal deja cree |
| `subscriptions` | 2 | libelle de formule sans catalogue |
| `rides` | 3 | trajets, tous actuellement `active` |
| `support_tickets` | 1 | signalements utilisateur |

La table technique `d1_migrations` existait mais ne contenait aucune migration.
Le controle `PRAGMA foreign_key_check` ne retournait aucune violation. Aucun
doublon d'email normalise, statut inattendu ou coordonnee invalide n'a ete
detecte.

## Migrations versionnees

Wrangler lit les fichiers de `migrations/` et enregistre leur nom dans
`d1_migrations`.

1. `0001_v1_compatibility_baseline.sql`
   Reprend le schema V1 avec `CREATE TABLE IF NOT EXISTS`. Sur la production,
   cette migration ne modifie aucune table ni aucune ligne. Sur une base locale
   vide, elle cree le socle necessaire a la migration suivante.
2. `0002_v2_additive_model.sql`
   Ajoute les colonnes V2, cree les nouvelles tables et remplit uniquement les
   nouveaux champs. Les libelles `subscriptions.plan` sont conserves et relies
   a un plan `legacy` sans prix invente.
3. `0003_v2_indexes_and_guards.sql`
   Ajoute les index, les unicites partielles, les validations de statut des
   anciennes colonnes et la mise a jour automatique des timestamps.

Ces fichiers ne contiennent aucune instruction `DROP`, `DELETE` ou `TRUNCATE`.

## Modele V2

Tables ajoutees :

- `password_reset_tokens` : jetons de reinitialisation haches et expirables ;
- `docks` : emplacements numerotes d'une station et occupation par velo ;
- `plans` : catalogue tarifaire en unite monetaire mineure ;
- `payments` : paiements, idempotence et references prestataire ;
- `bike_incidents` : incidents, gravite, affectation et resolution ;
- `notifications` : notifications in-app, email ou push ;
- `admin_audit_logs` : journal append-only des actions administratives.

Tables completees :

- `users` : `status`, `locale`, `updated_at`, `last_login_at` ;
- `sessions` : `last_seen_at`, `device_name` ;
- `email_verifications` : `requested_ip` ;
- `stations` : `public_code`, `slug`, `capacity`, `timezone`, `updated_at` ;
- `bikes` : `public_code`, `model`, `serial_number`,
  `last_service_at`, `updated_at`, `retired_at` ;
- `subscriptions` : `plan_id`, periode courante, annulation, reference
  prestataire et `updated_at` ;
- `rides` : docks de depart/retour, duree, distance, montant et `updated_at` ;
- `support_tickets` : categorie, priorite, affectation, fermeture et
  `updated_at`.

Les identifiants et colonnes V1 restent disponibles. En particulier :

- `subscriptions.plan` reste la valeur de compatibilite lisible par la V1 ;
- `stations.bikes_available` reste utilise tant qu'une station ne possede
  aucun enregistrement dans `bikes` ;
- les trajets historiques sans `bike_id` restent valides et inchanges ;
- aucun prix n'est deduit du libelle historique d'un abonnement.

## Relations et contraintes

- D1 applique les cles etrangeres sur les nouvelles relations.
- Les suppressions sensibles utilisent `RESTRICT`; les references facultatives
  utilisent `SET NULL`; les jetons et notifications peuvent suivre leur compte
  avec `CASCADE`.
- Un utilisateur ne peut avoir qu'un abonnement `active`.
- Un velo ne peut avoir qu'un trajet `active`.
- Les identifiants prestataire et cles d'idempotence de paiement sont uniques
  lorsqu'ils existent.
- Les statuts, locales, montants, batteries et coordonnees sont controles.
- Les montants sont stockes en entier dans `amount_minor` pour eviter les
  erreurs d'arrondi. Pour MAD, `9900` represente `99,00 MAD`.

## Developpement local

```powershell
npm install
npm run db:migrate:local
npm run db:seed:local
npm run test:data
```

`seeds/development.sql` est exclusivement local. Il ne doit jamais etre lance
avec `--remote`. Il ne cree aucun compte utilisateur et ne contient aucun
secret.

## Procedure de migration production

Toujours appliquer les migrations avant le Worker V2 qui lit les nouvelles
colonnes.

```powershell
# 1. Verifier le compte et la cible.
npx wrangler whoami
npx wrangler d1 migrations list pikala-db --remote

# 2. Exporter une sauvegarde hors du depot Git.
npx wrangler d1 export pikala-db --remote `
  --output "$env:TEMP/pikala-before-v2.sql" `
  --skip-confirmation

# 3. Tester le Worker sans publier.
npm run test:data
npm run deploy:dry-run

# 4. Appliquer les migrations. Wrangler cree aussi une sauvegarde.
npm run db:migrate:remote

# 5. Controler les relations et les volumes.
npx wrangler d1 execute pikala-db --remote `
  --command "PRAGMA foreign_key_check" --json

# 6. Deployer le Worker et effectuer les smoke tests.
npm run deploy
```

Avant l'etape 4, comparer les volumes de toutes les tables V1. Apres l'etape 4,
les huit volumes doivent etre identiques. Le nombre de `plans` peut augmenter
car chaque ancien libelle d'abonnement devient un plan `legacy` sans tarif.

## Retour arriere

Les migrations sont additives : l'ancien Worker reste compatible avec le
schema etendu. Le premier retour arriere consiste donc a restaurer la version
precedente du Worker, sans modifier D1.

Si une restauration des donnees est necessaire :

1. arreter les ecritures applicatives ;
2. conserver la base actuelle pour analyse ;
3. restaurer l'export ou utiliser D1 Time Travel dans une nouvelle base ;
4. verifier les volumes et `PRAGMA foreign_key_check` ;
5. basculer le binding `DB` seulement apres validation.

Ne pas supprimer manuellement les nouvelles tables en production : elles
peuvent deja contenir des paiements, incidents ou journaux d'audit. La procedure
detaillee est aussi disponible dans `migrations/ROLLBACK.md`.

## Sources Cloudflare

- https://developers.cloudflare.com/d1/reference/migrations/
- https://developers.cloudflare.com/d1/sql-api/foreign-keys/
- https://developers.cloudflare.com/d1/best-practices/import-export-data/
