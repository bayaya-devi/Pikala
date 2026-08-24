# Deploiement Cloudflare

Le Worker `pikala` sert `src/worker.js`, les assets de `sitepikala` et la base
D1 `pikala-db` via le binding `DB`. Wrangler 4.125.0 est verrouille dans le
projet.

## Ordre obligatoire

```text
branche -> tests -> export D1 -> dry-run Worker -> migrations D1
        -> controles D1 -> deploy Worker -> smoke tests -> surveillance
```

Les migrations sont appliquees avant le code qui les exige. Les migrations V2
sont additives afin que le Worker precedent continue de fonctionner pendant
un rollback applicatif.

## Commandes

```powershell
npm install
npm run test:foundation
npm run test:data
npm run deploy:dry-run
npm run db:migrations:list:remote
npm run db:migrate:remote
npm run deploy
```

Ne jamais executer `seeds/development.sql` avec `--remote`.

## Verification apres publication

```powershell
curl.exe -sS https://pikala.aetbconseil.workers.dev/api/health
curl.exe -sS https://pikala.aetbconseil.workers.dev/api/stations
curl.exe -sS https://pikala.aetbconseil.workers.dev/api/plans
npx wrangler d1 execute pikala-db --remote `
  --command "PRAGMA foreign_key_check" --json
```

La procedure detaillee de sauvegarde, migration et restauration se trouve dans
`docs/database.md` et `migrations/ROLLBACK.md`.
