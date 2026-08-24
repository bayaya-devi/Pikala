# Deploiement Cloudflare

## Ressources attendues

- Worker pikala ;
- binding ASSETS vers sitepikala ;
- binding D1 DB vers pikala-db ;
- observabilite Workers activee ;
- domaine HTTPS canonique dans PUBLIC_ORIGIN.

wrangler.toml ne contient aucun secret. Le database_id est un identifiant de ressource, pas une cle d'acces.

## Variables et secrets

Production obligatoire pour les emails : RESEND_API_KEY en secret, FROM_EMAIL et PUBLIC_ORIGIN. EMAIL_DEV_MODE doit etre absent. Un prestataire de paiement reel demandera PAYMENT_PROVIDER et ses secrets de signature. Tant qu'il n'est pas configure, le checkout payant retourne 503 et n'active rien.

~~~powershell
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put SECRET_DU_PRESTATAIRE_PAIEMENT
~~~

## Procedure de livraison

~~~powershell
npm ci
npm run test:static
npm audit
npm run deploy:dry-run
npx wrangler whoami
npm run db:migrations:list:remote
npx wrangler d1 export pikala-db --remote --output "$env:TEMP/pikala-before-deploy.sql" --skip-confirmation
npm run db:migrate:remote
npm run deploy
~~~

Appliquer D1 avant le Worker. Ne jamais lancer un seed avec --remote.

## Smoke tests

- GET /api/health retourne 200 ;
- homepage, manifest, favicon et service worker retournent 200 ;
- /dashboard.html anonyme redirige vers la connexion ;
- inscription et verification envoient un vrai email ;
- connexion conserve la session ;
- /api/stations et /api/plans lisent D1 ;
- utilisateur normal refuse sur /api/admin/overview ;
- compte admin charge les 14 vues ;
- logs Workers ne contiennent ni cookie, ni token, ni mot de passe.

## Rollback

Les migrations etant additives, le premier rollback est le redeploiement du Worker precedent, sans suppression de table. Pour une restauration de donnees, suspendre les ecritures, conserver la base courante, restaurer l'export ou D1 Time Travel dans une nouvelle base, executer PRAGMA foreign_key_check puis changer le binding seulement apres verification. Voir migrations/ROLLBACK.md.

## Blocages avant ouverture commerciale

- brancher et tester un prestataire de paiement reel ;
- configurer un domaine d'envoi email verifie et RESEND_API_KEY ;
- charger les vraies stations, velos, quais et QR d'exploitation ;
- definir comptes admin, procedure d'astreinte et suivi des Workers Logs.
