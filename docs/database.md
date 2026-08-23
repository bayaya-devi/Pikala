# Strategie Cloudflare D1

## Schema V1 prouve par le code

`ensureSchema()` cree actuellement :

- `users` ;
- `sessions` ;
- `email_verifications` ;
- `stations` ;
- `subscriptions` ;
- `rides` ;
- `support_tickets`.

Le schema distant doit encore etre exporte et compare. Aucune migration V2 ne
doit etre appliquee avant cette verification.

## Schema V2 cible

Tables principales : `users`, `sessions`, `email_verifications`,
`password_reset_tokens`, `stations`, `bikes`, `docks`, `rides`, `plans`,
`subscriptions`, `payments`, `support_tickets`, `support_messages`,
`bike_incidents`, `maintenance_events`, `notifications`, `admin_audit_logs` et
`app_settings`.

Les identifiants internes peuvent rester numeriques, mais chaque objet expose
doit avoir un `public_code` non devinable ou un UUID public. Les statuts sont
contraints avec `CHECK`, les relations avec des cles etrangeres, et les champs
de recherche frequents avec des index.

## Regles de conservation

- Migrations additives par defaut : nouvelles tables, nouvelles colonnes
  nullables, index et backfills controles.
- Jamais de `DROP TABLE` dans les premieres phases.
- Conserver les IDs V1 et ajouter les nouvelles references autour d'eux.
- Copier les anciennes valeurs `subscriptions.plan` vers de vrais `plans`
  apres creation d'une table de correspondance.
- Conserver les trajets V1 sans `bike_id` comme donnees historiques marquees
  `legacy`, sans les presenter comme trajets complets.
- Ne pas confondre `bikes_available` de V1 avec un inventaire reel de velos.
- Sauvegarde/export D1 avant chaque migration distante et test de restauration.

## Ordre des migrations

1. Capturer le schema distant et les volumes par table.
2. Introduire `d1_migrations` et une migration de reference non destructive.
3. Completer `users` et `stations` avec colonnes nullables.
4. Creer `plans`, `bikes`, `docks` et les tables de securite.
5. Ajouter les nouvelles colonnes de `rides`, `subscriptions` et `support`.
6. Backfiller et valider par requetes de controle.
7. Ajouter les contraintes/index impossibles a poser avant le backfill.
8. Basculer les services V2, puis retirer `ensureSchema()`.

## Controles avant production

```sql
SELECT name, sql
FROM sqlite_schema
WHERE type IN ('table', 'index')
ORDER BY type, name;

PRAGMA foreign_key_check;
PRAGMA integrity_check;
```

Pour chaque table, relever aussi `COUNT(*)`, les valeurs nulles inattendues,
les doublons d'email/code/QR et les trajets actifs multiples.

## Risques critiques D1

- divergence entre le schema suppose par `ensureSchema()` et le schema distant ;
- echec partiel d'un backfill sur des donnees historiques inattendues ;
- double location en cas de validations separees ;
- ajout de contrainte impossible a cause de doublons existants ;
- confusion entre stations de demonstration et stations operationnelles ;
- migration lancee sur la mauvaise base ou le mauvais environnement.
