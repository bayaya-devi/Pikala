# Deploiement Cloudflare

## Etat V1

Le Worker `pikala` sert `src/worker.js` et le dossier `sitepikala` via Workers
Static Assets. Le binding D1 est `DB` et pointe vers `pikala-db`.

Points a corriger avant une V2 de production :

- declarer Wrangler dans les devDependencies et versionner un lockfile ;
- separer `staging` et `production` ;
- ajouter `migrations_dir` a la configuration D1 ;
- activer l'observabilite avec un taux adapte ;
- ajouter les en-tetes de securite aux assets et aux reponses Worker ;
- conserver `RESEND_API_KEY` et autres secrets dans Cloudflare Secrets ;
- ajouter un deploiement dry-run et des tests dans la CI.

## Flux recommande

```text
branche -> tests -> build -> wrangler deploy --dry-run
        -> environnement staging -> tests E2E
        -> approbation -> migrations production -> deploy production
        -> smoke tests -> surveillance des logs
```

Les migrations sont appliquees avant le code qui les exige, tout en restant
compatibles avec la version precedente pendant le deploiement.

## Verification locale et distante

```powershell
node --version
npm ci
npx wrangler --version
npx wrangler whoami
npx wrangler deploy --dry-run
npx wrangler d1 migrations list pikala-db --remote
```

Le poste audite possede Wrangler 4.111.0 dans `node_modules`, mais le shim
`node_modules/.bin/wrangler` manque et l'acces Cloudflare a echoue sur une erreur
reseau. Une reinstall propre apres ajout de la dependance et du lockfile est
necessaire.

## Publication

Les assets et le Worker sont deployes ensemble. Une modification de
documentation n'exige pas de deploiement du Worker pour fonctionner, mais doit
etre poussee et fusionnee sur GitHub. Les changements de code ou d'assets sont
publies uniquement apres dry-run, tests et validation D1.
