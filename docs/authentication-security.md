# Authentification et securite Pikala V2

## Parcours disponibles

- `POST /api/signup` cree un compte en attente et envoie un lien de verification.
- `GET /api/verify-email` consomme un jeton a usage unique puis redirige vers la connexion.
- `POST /api/verification/resend` renouvelle le lien sans reveler si le compte existe.
- `POST /api/login` cree une nouvelle session apres verification des identifiants et de l'email.
- `POST /api/logout` revoque la session cote D1 et efface les cookies.
- `POST /api/password/forgot` retourne toujours une reponse generique.
- `POST /api/password/reset` consomme un jeton a usage unique valable une heure.
- `POST /api/password/change` exige le mot de passe actuel, revoque les autres sessions et renouvelle la session courante.
- `PATCH /api/profile` autorise uniquement le prenom, le nom, le telephone et la langue.
- `GET /api/admin/overview` exige le role `admin` cote Worker.

## Protections

- mots de passe PBKDF2-HMAC-SHA-256, sel aleatoire et 100 000 iterations, soit
  la limite acceptee par Web Crypto dans le runtime Cloudflare Workers ;
- migration automatique des anciens hashes apres une connexion valide ;
- cookie `__Host-pikala_session`, `Secure`, `HttpOnly`, `SameSite=Strict`, `Path=/` ;
- identifiants de session aleatoires de 256 bits et hashes en base ;
- expiration absolue de sept jours et revocation serveur ;
- version d'authentification commune a l'utilisateur et a ses sessions ;
- limitation D1 par compte sur les routes sensibles ;
- reponses generiques contre l'enumeration des comptes ;
- verification `Origin`, Fetch Metadata et en-tete `X-Pikala-Request` pour les mutations JSON ;
- validation serveur avec tailles maximales ;
- requetes D1 parametrees ;
- pages privees et administration gardees avant les assets Cloudflare ;
- journaux de securite append-only sans mot de passe, jeton ni secret ;
- erreurs internes filtrees avec un identifiant de requete non sensible.

## Configuration email obligatoire

La verification et la reinitialisation utilisent Resend. Avant de deployer le Worker de cette phase :

```powershell
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put FROM_EMAIL
```

`FROM_EMAIL` doit etre une adresse autorisee par le domaine verifie chez Resend. Les valeurs ne doivent jamais etre placees dans Git, `wrangler.toml`, un log ou une issue.

Verifier uniquement la presence des noms de secrets :

```powershell
npx wrangler secret list
```

## Ordre de mise en production

1. Exporter une sauvegarde D1 distante.
2. Appliquer les migrations D1 versionnees.
3. Configurer `RESEND_API_KEY` et `FROM_EMAIL`.
4. Vérifier le domaine expéditeur dans Resend, ajouter les enregistrements DNS demandés, puis tester inscription, renvoi et mot de passe oublié en production. Sans ces deux valeurs, l'API répond explicitement `EMAIL_PROVIDER_UNAVAILABLE` et ne prétend pas avoir envoyé un message.
4. Executer `npm run test:auth`, `npm run test:data` et le dry-run Wrangler.
5. Deployer le Worker.
6. Tester inscription, reception du mail, verification, connexion, reset et acces admin refuse.

Ne jamais deployer ce Worker sans service email : un nouveau compte resterait volontairement non verifie et ne pourrait pas se connecter.

## Tests locaux

```powershell
npm run db:migrate:local
npx wrangler dev --local --ip 127.0.0.1 --port 8795 --var EMAIL_DEV_MODE:1 --var PUBLIC_ORIGIN:http://127.0.0.1:8795 --var AUTH_TEST_SESSION_TTL_SECONDS:2
npm run test:auth:crash -- http://127.0.0.1:8795
```

`EMAIL_DEV_MODE=1` expose les liens uniquement dans la reponse locale de test. Cette variable ne doit jamais etre configuree en production.
