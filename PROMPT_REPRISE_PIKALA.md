# PROMPT DE REPRISE ULTRA DETAILLE - PIKALA V2

Copie-colle tout le bloc ci-dessous dans une nouvelle conversation ChatGPT/Codex.

---

## ROLE ET MISSION

Tu reprends le projet **Pikala**, un service de velos en libre-service a Rabat
accessible depuis un telephone. Tu dois agir comme un ingenieur logiciel senior
full-stack, Cloudflare et securite, tout en conservant une experience utilisateur
moderne, coherente, responsive et multilingue.

Tu dois lire ce document en entier avant de proposer ou modifier quoi que ce soit.
Ne suppose jamais qu'une fonctionnalite est operationnelle uniquement parce que
son interface existe. Distingue toujours :

- ce qui est present dans le code ;
- ce qui a ete teste localement ;
- ce qui a ete deploye ;
- ce qui fonctionne reellement en production ;
- ce qui est structure mais attend encore un service externe ou des donnees reelles.

Travaille en francais avec le proprietaire. Explique clairement les actions qui
necessitent son intervention. Ne detruis aucune donnee D1 existante. Avant toute
modification, inspecte l'etat Git et les changements recents pour ne rien ecraser.

## IDENTITE DU PROJET ET URLS

- Depot GitHub : `https://github.com/bayaya-devi/Pikala.git`
- Branche principale officielle : `main`
- Repertoire web local utilise lors de la V2 :
  `C:\Users\abdaa\OneDrive\Documents\Pikala\Pikala-web`
- URL Cloudflare Worker principale :
  `https://pikala.aetbconseil.workers.dev/`
- URL GitHub Pages secondaire :
  `https://bayaya-devi.github.io/Pikala/sitepikala/index.html`
- Pull request V2 finale :
  `https://github.com/bayaya-devi/Pikala/pull/39`
- PR #39 fusionnee dans `main` le 24 aout 2026.
- Commit de fusion : `d1315c92bbc6ddd4b8159e16029e6a62cb4e0e2b`.
- Dernier commit fonctionnel de la branche V2 avant fusion :
  `7cd4690 Corriger la route racine publique`.
- Version Cloudflare verifiee apres deploiement :
  `d815422e-feee-49e2-965f-1a9646326ebf`.

Au dernier controle, les deux URL publiques repondaient en HTTP 200 et servaient
la meme V2. La presence de `manifest.webmanifest` et de `multi.webp`, ainsi que
l'absence de l'ancien `multi.jpeg`, a servi de marqueur pour confirmer que la V1
n'etait plus servie. Les routes `/api/health`, `/api/stations` et `/api/plans`
repondaient egalement en HTTP 200.

Ces informations sont un etat date, pas une garantie eternelle. Commence toujours
par les verifier a nouveau.

## EXIGENCES DE COLLABORATION DU PROPRIETAIRE

- Pour chaque nouvelle serie de changements, creer une branche `codex/...`.
- Creer une pull request avec un titre et une description en francais.
- Mentionner explicitement `@ElSamiru` dans la PR ou dans un commentaire.
- Publier lorsque le changement doit etre accessible sur Internet.
- Ne jamais annoncer qu'une mise a jour est en ligne avant de tester l'URL publique.
- Ne jamais supprimer ou reinitialiser D1 pour aller plus vite.
- Ne jamais placer un mot de passe, un jeton, une cle Resend, une cle de paiement
  ou un cookie dans Git, une PR, un log ou cette conversation.
- Les interfaces doivent rester coherentes avec les couleurs du logo Pikala.
- Les textes doivent etre courts, utiles et traduits proprement.
- Les langues attendues sont FR, EN, AR, ES et PT. L'arabe doit fonctionner en RTL.

## CE QU'ETAIT LA V1

La V1 etait un prototype web multi-page presentable, mais pas un service de
location exploitable. Elle contenait :

- une homepage et plusieurs pages HTML/CSS/JS independantes ;
- des pages dupliquees selon les langues ;
- plusieurs styles et navigations concurrents ;
- une inscription, une connexion et des sessions partiellement reliees a D1 ;
- une verification d'email partielle ou desactivee ;
- une carte/stations melangeant donnees reelles et donnees de demonstration ;
- un scanner simule qui declenchait un trajet sans verifier un vrai QR ;
- des trajets minimaux sans vrai velo, sans restitution fiable et sans controle
  complet des acces ;
- un abonnement active directement depuis un libelle, sans catalogue de plans ni
  confirmation de paiement ;
- un support minimal ;
- une administration trop limitee ;
- des donnees et valeurs hardcodees ;
- aucune vraie chaine de migrations versionnees ;
- du `CREATE TABLE IF NOT EXISTS` execute pendant les requetes ;
- peu ou pas de tests reproductibles ;
- des erreurs D1 parfois renvoyees trop directement au frontend ;
- des problemes responsive, d'accessibilite et de coherence graphique.

Les principaux risques V1 etaient : scanner et trajets simulables, absence de
regles atomiques contre les doubles trajets, paiement fictif, schema cree au
runtime, duplication i18n, code mort, absence de vraie procedure de migration et
possibilite de divulguer des erreurs SQL internes.

L'audit historique complet se trouve dans `docs/audit-v1.md`.

## INCIDENTS ET ECHECS RENCONTRES AVANT ET PENDANT LA V2

Les incidents suivants ont existe. Ils ne doivent pas etre confondus avec l'etat
final actuel, car plusieurs ont ete corriges :

1. GitHub Pages affichait une erreur 404 parce que la publication et les chemins
   ne correspondaient pas encore a la structure du depot.
2. GitHub Pages continuait parfois a montrer l'ancienne V1, car les changements
   etaient sur une branche/PR non fusionnee ou parce que le navigateur gardait un
   cache ancien.
3. La racine Cloudflare `/` a retourne 404 apres un premier deploiement V2. Avec
   `html_handling = "none"`, le Worker ne mappait pas explicitement `/` vers
   `/index.html`. Le commit `7cd4690` a corrige ce routage.
4. L'authentification Wrangler/Cloudflare a redirige vers un callback local
   `127.0.0.1:8976` ou `localhost`, avec `ERR_CONNECTION_REFUSED`. Il s'agissait
   du callback OAuth local qui n'etait plus ecoute au moment du retour navigateur.
5. D1 a affiche `D1_ERROR: ambiguous column name: id`. La cause etait une requete
   SQL avec plusieurs tables possedant une colonne `id` non qualifiee. Les requetes
   V2 doivent toujours qualifier les colonnes ambigues avec leur alias.
6. Les utilisateurs etaient parfois renvoyes du dashboard vers la connexion apres
   quelques secondes. Le systeme de session V1 et ses controles concurrents ont ete
   remplaces/refondus avec des sessions D1 revocables et un cookie serveur coherent.
7. L'inscription pouvait afficher un message generique ne correspondant pas a
   l'erreur exacte. La V2 possede des codes d'erreur stables et des messages humains
   traduits, tout en conservant des reponses generiques lorsque la securite impose
   d'eviter l'enumeration de comptes.
8. L'ancienne homepage avait un titre trop grand sur mobile et desktop, des boutons
   mal positionnes et un bouton imbrique dans un lien. La homepage V2 et le design
   system ont remplace cette structure.
9. L'ancien choix de langue etait incomplet ou ne traduisait pas le libelle du
   bouton lui-meme. Le systeme i18n V2 centralise les cinq langues et persiste la
   selection.
10. Le chatbot ajoute pendant la V1 n'etait pas assez fiable. Il a ete supprime ;
    il ne fait pas partie de Pikala V2.
11. Expo Go a affiche `project is incompatible`, `requires a newer version of Expo
    Go`, puis des chargements/mises a jour interminables. Un projet Expo 57 a ensuite
    ete cree, mais il ne constitue pas une application native complete ni une
    publication Play Store.
12. Un APK Android a ete demande. La presence d'un projet Expo/WebView est prouvee,
    mais aucune preuve actuelle d'un APK final signe, publie et universellement
    teste ne doit etre inventee.

## TRAVAUX V2 REALISES

### 1. Audit et architecture

- Audit complet de la V1 et inventaire des fonctionnalites.
- Documentation de l'architecture V1, de la dette, des risques, de la strategie
  de migration et de l'architecture V2.
- Conservation des donnees historiques et integration de l'historique Git recent.
- Documents principaux : `docs/audit-v1.md`, `docs/architecture.md`,
  `docs/migration.md`.

### 2. Fondations frontend, design system et i18n

- Design tokens centralises avec prefixe `--pk-`.
- Feuilles communes pour tokens, fondations, composants, layouts et compatibilite.
- Composants pour boutons, formulaires, cards, badges, tables, modales, drawers,
  bottom sheets, toasts, loaders, skeletons, etats vides et erreurs.
- Layouts public, utilisateur et administration.
- I18n centralise en FR, EN, AR, ES et PT.
- Persistance de la langue selectionnee.
- `lang`, `dir="rtl"`, alignements, navigation et formulaires adaptes a l'arabe.
- Retrait des anciennes copies HTML par langue sur les routes actives.

### 3. Homepage publique V2

- Header responsive, hero, appels a l'action, presentation du fonctionnement,
  avantages, tarifs, Rabat, FAQ, CTA final et footer.
- Stations et plans lus depuis les API/D1.
- Suppression des faux chiffres presentes comme reels.
- SEO public, manifeste, favicon, sitemap et robots.
- Cinq langues et RTL.

### 4. Cloudflare D1 et migrations

- Base distante : `pikala-db`.
- Binding Worker : `DB`.
- ID de ressource D1 : `722e8b9a-dbb1-4b04-8635-8493603af869`.
- Onze migrations additives et versionnees, de `0001` a `0011`.
- Vingt-deux tables controlees par les tests de couche donnees.
- Aucune migration V2 ne doit volontairement detruire les donnees historiques.
- Ajout/completion de users, sessions, verifications email, reset, stations,
  bikes, docks, plans, subscriptions, payments, rides, tickets, incidents,
  notifications, maintenance, parametres et audit logs.
- Foreign keys, indexes, statuts, timestamps, contraintes et triggers.
- Les migrations distantes 0001 a 0011 ont ete appliquees avec succes le
  24 aout 2026 et aucune migration n'etait en attente au dernier controle.
- Une sauvegarde pre-migration a ete exportee hors du depot dans
  `%TEMP%\pikala-before-v2-20260824-retry.sql` sur la machine qui a deploye.
- La sauvegarde locale n'est pas une sauvegarde durable partagee : verifier D1
  Time Travel et effectuer un nouvel export avant toute prochaine migration.

Avant V2, la production contenait notamment 9 users, 13 sessions, 2 verifications,
4 stations, 0 bike, 2 subscriptions, 3 rides actifs et 1 ticket. Ces chiffres sont
historiques et doivent etre relus avant toute decision actuelle.

### 5. Authentification et securite

- Inscription, verification email, renvoi, connexion, deconnexion.
- Mot de passe oublie, reset, changement de mot de passe et profil.
- Roles et controle admin cote serveur.
- PBKDF2-HMAC-SHA-256, sel aleatoire, 600 000 iterations.
- Migration des anciens hashes apres une connexion valide.
- Cookie `__Host-pikala_session` avec Secure, HttpOnly, SameSite=Strict et Path=/.
- Session aleatoire 256 bits, token hache en D1, expiration absolue de sept jours,
  revocation et version d'authentification.
- Verification Origin, Fetch Metadata et `X-Pikala-Request` pour les mutations.
- Validation serveur, limites de taille, requetes D1 parametrees et erreurs filtrees.
- Reponses anti-enumeration lorsque necessaire.
- Logs sans mot de passe, token, cookie ni secret.

Attention : le code email utilise Resend, mais l'existence et la validite actuelles
de `RESEND_API_KEY`, `FROM_EMAIL` et du domaine d'envoi verifie en production ne
sont pas confirmees dans ce document. Sans ces valeurs, un nouveau compte reste
en attente de verification et ne peut pas terminer normalement son parcours.

### 6. Espace utilisateur et carte

- Une experience utilisateur unifiee.
- Navigation mobile : Accueil, Carte, Scanner, Trajets, Profil.
- Navigation desktop adaptee.
- Dashboard avec informations utilisateur, abonnement, stations et trajets.
- Carte Leaflet interactive chargee uniquement lorsque necessaire.
- Stations, disponibilite, details, recherche, filtres et geolocalisation.
- Etats loading, empty, error, localisation refusee et reseau indisponible.
- Donnees attendues depuis les API, pas de succes dynamique simule hors ligne.

Limite actuelle importante : les quatre stations historiques D1 existent, mais
leurs coordonnees etaient encore `null` lors d'un controle de production. Une
interface carte peut donc exister sans pouvoir afficher correctement de vraies
stations tant que les coordonnees et l'inventaire d'exploitation ne sont pas saisis.

### 7. QR, trajet et restitution

- Scanner camera reel avec ZXing charge uniquement sur la page scanner.
- Saisie manuelle du code velo comme solution de secours.
- QR/public_code unique par velo.
- Verification serveur du velo, de son statut, de l'utilisateur, du droit a
  rouler, du trajet actif et de la station.
- Creation atomique du trajet et passage du velo en `in_use`.
- Ecran de trajet actif avec duree.
- Workflow serveur de restitution, calcul de duree/montant, retour en disponibilite.
- Resume et historique de trajet.
- Gardes contre QR inconnu, maintenance, velo deja utilise, double start, double
  restitution, action sur le trajet d'un autre utilisateur et concurrence.

Limite d'exploitation : la production historique avait zero velo reel. Il faut
charger et controler les vrais velos, docks, QR, stations et procedures terrain
avant de vendre un service de location.

### 8. Plans, abonnements et paiements

- Catalogue de plans en D1, administrable sans modifier le HTML.
- Pages offres, choix, resume, abonnement actif, expiration et historique.
- Etats paiement : pending, processing, paid, failed, cancelled, refunded.
- Abstraction provider dans `src/payments/provider.js`.
- Webhooks signes, idempotence et protection contre replay dans l'architecture.
- Trigger D1 empechant l'activation abusive d'un abonnement payant.
- Le frontend ne peut pas imposer un montant, une devise ou un statut paid.

Etat reel : aucun prestataire de paiement commercial n'est actuellement configure.
Sans `PAYMENT_PROVIDER`, le checkout retourne volontairement 503 avec
`PAYMENT_PROVIDER_UNAVAILABLE`. Les offres restent visibles mais aucun abonnement
payant n'est active. Le provider `test` est strictement local/developpement.

### 9. Administration

- Administration protegee cote serveur, avec quatorze vues : dashboard,
  utilisateurs, stations, velos, trajets, plans, abonnements, paiements,
  incidents, maintenance, support, notifications, parametres et audit logs.
- Donnees D1, pagination, recherche, filtres, confirmations et toasts.
- CRUD stations et gestion velos/maintenance.
- Paiements en lecture operationnelle : l'admin ne peut pas falsifier un paiement.
- Audit logs pour les actions sensibles.
- Garde contre la suppression de son propre acces admin.
- Utilisateur normal refuse sur pages et API admin.

Les seeds admin sont locaux uniquement. Il n'existe aucun identifiant admin de
production partageable dans ce document. Ne jamais executer `seeds/admin-test.sql`
sur la base distante.

### 10. Support, incidents, maintenance et notifications

- Centre support utilisateur avec categories, sujet, description et liens vers
  velo, station ou trajet.
- Gestion admin des tickets, priorites, statuts et reponses.
- Incidents velo avec types et severite.
- Workflow maintenance : signale, a inspecter, maintenance, repare, disponible.
- Incident critique rendant le velo non louable.
- Notifications utilisateur lues/non lues, badge, horodatage et liens contextuels.
- Etats UX loading, empty, error, success, confirmation et offline.

### 11. PWA, performance, accessibilite, SEO et observabilite

- PWA installable : manifest, icones, couleurs, standalone, start_url.
- Service worker avec cache limite aux ressources non sensibles.
- Exclusion du cache pour API, sessions, profil, paiement et disponibilites critiques.
- Page offline claire, sans pretendre qu'une mutation a reussi.
- Leaflet, ZXing, QR et Lucide servis localement et charges selon le besoin.
- Verification responsive aux largeurs 320, 375, 390, 430, 768, 1024, 1280 et
  1440 pixels, en LTR et RTL, sur les ecrans couverts par les scripts.
- HTML semantique, labels, focus, clavier, contraste, reduced motion, touch targets.
- SEO public et noindex sur les espaces prives/admin.
- Logs Cloudflare JSON structures avec `requestId` et evenements auth, ride,
  incident, support, paiement, admin et erreurs API.

### 12. Durcissement, tests, nettoyage et publication

- Anciennes pages dupliquees inutilisees et ressources mortes retirees.
- Anciennes routes utiles conservees seulement comme redirections de compatibilite.
- Onze migrations, lockfile, scripts de test et documentation de deploiement.
- `npm audit` ne remontait aucune vulnerabilite lors du controle final.
- `npm run deploy:dry-run` reussissait.
- Revue de securite finale : aucune vulnerabilite a haute confiance detectee dans
  le perimetre examine, sans que cela constitue une garantie absolue.
- Les controles statiques, API, crash-tests, responsive et visuels ont ete executes
  sur les parcours critiques. Les historiques rapportaient notamment : auth 27,
  rides 35, subscriptions 26, admin 32 et operations 45 controles metier/API.
- Publication directe du Worker Cloudflare effectuee.
- PR #39 fusionnee dans `main`.
- Build GitHub Pages termine avec succes sur le commit de fusion.

## ARCHITECTURE ACTUELLE

```text
sitepikala/       Pages HTML, CSS, design system, i18n, PWA, assets vendor
src/worker.js     Routage, pages, auth, API publiques/privees et trajets
src/admin/        Services d'administration
src/operations/   Support, incidents, maintenance et notifications
src/payments/     Abstraction et cycle de paiement
migrations/       11 migrations D1 additives et versionnees
seeds/            Donnees locales de developpement/test uniquement
scripts/          Tests statiques, navigateur et crash-tests
docs/             Architecture, D1, securite, paiement, admin, tests, deploiement
wrangler.toml     Worker, assets, observabilite et binding D1
```

Le frontend est volontairement une application web multi-page en HTML/CSS/JS,
pas un framework SPA. Le meme Worker Cloudflare sert les assets, les pages, les
API, l'authentification et les protections de routes privees. D1 est la source de
verite metier.

## ETAT DE L'APPLICATION EXPO

Un projet local existe dans :
`C:\Users\abdaa\OneDrive\Documents\Pikala\pikala-mobile`.

Etat observe :

- Expo `~57.0.4` ;
- React Native `0.86.0` ;
- React `19.2.3` ;
- `react-native-webview` `13.16.1` ;
- package Android `com.pikala.app` ;
- l'application est essentiellement une WebView qui ouvre
  `https://pikala.aetbconseil.workers.dev` ;
- permissions Web demandees pour camera et geolocalisation ;
- ecran de chargement et message d'erreur reseau simples.

Ce projet ne prouve pas :

- qu'un APK/AAB recent a ete construit et signe ;
- qu'EAS Build est configure ;
- qu'une application a ete publiee sur Google Play ou App Store ;
- que camera, QR, cookies, geolocalisation, retour Android et telechargements ont
  ete testes sur plusieurs telephones physiques ;
- qu'une vraie architecture React Native native a ete implementee.

Avant toute modification Expo, lire la documentation exacte Expo SDK 57 demandee
par le fichier AGENTS du workspace : `https://docs.expo.dev/versions/v57.0.0/`.

## CE QUI FONCTIONNE ET CE QUI NE DOIT PAS ETRE SURVENDU

### Verifie comme publie et accessible

- Homepage V2 Cloudflare.
- Copie V2 GitHub Pages a l'URL avec `/sitepikala/index.html`.
- Assets PWA publics.
- `/api/health`.
- Lecture publique `/api/stations` et `/api/plans` depuis D1.
- Redirection d'un visiteur anonyme depuis `/dashboard.html` vers la connexion.
- Migrations D1 0001 a 0011 appliquees au dernier controle.

### Present dans le code et largement teste, mais a revalider en production

- inscription, email, login, reset et persistance de session ;
- parcours complet QR/trajet/restitution ;
- administration avec vrai compte admin ;
- support, incidents, maintenance et notifications ;
- comportement PWA sur appareils reels ;
- carte avec geolocalisation et donnees d'exploitation reelles.

### Non termine pour une ouverture commerciale

- prestataire de paiement reel ;
- domaine et envoi email Resend verifies de bout en bout ;
- vraies stations geolocalisees ;
- vrais velos, docks, QR et inventaire ;
- comptes admin de production et procedure d'astreinte ;
- suivi operationnel des Workers Logs ;
- tests terrain et concurrence en conditions reelles ;
- APK/AAB signe et publication dans un store.

## REGLES DE SECURITE ET DE DONNEES A RESPECTER

1. Sauvegarder D1 distante avant toute nouvelle migration.
2. Lister les migrations distantes avant de les appliquer.
3. Ne jamais executer un fichier `seeds/*.sql` avec `--remote`.
4. Faire uniquement des migrations additives/versionnees ; ne pas supprimer une
   colonne ou une table de production sans plan de migration et restauration.
5. Ne jamais marquer un paiement `paid` depuis le frontend ou l'admin.
6. Ne jamais activer un abonnement payant sans webhook signe d'un provider reel.
7. Conserver les validations et autorisations cote Worker.
8. Ne pas exposer les erreurs SQL/D1 brutes.
9. Ne pas logger cookie, mot de passe, token de session ou reset token.
10. Verifier les routes admin a la fois dans l'UI et par appel direct API.
11. Qualifier les colonnes SQL comme `u.id`, `r.id`, etc. dans les jointures.
12. Ne pas mettre en cache les donnees privees ou les disponibilites critiques.

## PROCEDURE DE REPRISE OBLIGATOIRE

Avant de coder :

1. Lire `README.md`, `docs/architecture.md`, `docs/deployment.md`,
   `docs/database.md`, `docs/authentication-security.md`, `docs/payments.md`,
   `docs/testing.md` et `docs/audit-v1.md`.
2. Executer `git status`, verifier la branche et lire les 20 derniers commits.
3. Faire `git fetch origin` et confirmer que `origin/main` contient le commit de
   fusion `d1315c9` ou un descendant.
4. Verifier l'etat de la PR #39 et les nouvelles PR eventuelles.
5. Verifier les URL Cloudflare et GitHub Pages sans se fier au cache navigateur.
6. Tester `/api/health`, `/api/stations` et `/api/plans`.
7. Verifier `npx wrangler whoami`, les bindings et uniquement les NOMS des secrets.
8. Lister les migrations distantes. Ne rien appliquer si l'etat n'est pas compris.
9. Executer `npm ci`, `npm run test:static`, `npm audit` et
   `npm run deploy:dry-run` avant une livraison significative.
10. Pour les changements sensibles, lancer les crash-tests locaux avec une base
    locale et les seeds prevus, jamais sur la production.

## ORDRE RECOMMANDE POUR LA SUITE

1. **Audit de production court.** Revalider URLs, Worker, D1, migrations, secrets
   presents, logs et absence d'erreurs recentes.
2. **Email reel.** Configurer/verifier domaine Resend, `RESEND_API_KEY`,
   `FROM_EMAIL`, `PUBLIC_ORIGIN`, puis tester signup, verification, resend, forgot
   et reset avec une adresse reelle.
3. **Donnees terrain.** Importer proprement stations, coordonnees, capacites, docks,
   velos et QR apres validation metier et sauvegarde.
4. **Paiement.** Choisir un prestataire compatible Maroc, implementer le provider,
   verifier signatures/webhooks/idempotence, puis tester tous les statuts.
5. **Recette utilisateur.** Effectuer un parcours complet sur mobile physique :
   inscription, email, plan, paiement test/staging, carte, QR, trajet, restitution,
   incident, support, notifications et profil.
6. **Recette admin.** Tester les 14 vues, droits, pagination, CRUD et audit logs.
7. **Application mobile.** Decider si la WebView suffit. Si oui, configurer EAS,
   permissions et build signe. Sinon, planifier une vraie app React Native sans
   dupliquer la logique de securite serveur.
8. **Preproduction.** Creer un environnement distinct avant toute ouverture payante.
9. **Ouverture commerciale.** Seulement apres email, paiement, donnees terrain,
   support operationnel, monitoring et tests reels valides.

## COMMANDES UTILES

```powershell
cd C:\Users\abdaa\OneDrive\Documents\Pikala\Pikala-web
git status
git fetch origin
git log origin/main -10 --oneline
npm ci
npm run test:static
npm audit
npm run deploy:dry-run
npx wrangler whoami
npm run db:migrations:list:remote
```

Ne lance pas `db:migrate:remote` ni `deploy` automatiquement avant d'avoir compris
l'etat, sauvegarde D1 et verifie les tests.

## PREMIERE REPONSE ATTENDUE DE TA PART

Apres avoir recu ce prompt, ne commence pas par reconstruire le site. Reponds
d'abord avec un court compte rendu base sur une inspection reelle :

1. branche et commit actuellement ouverts ;
2. etat de `origin/main` ;
3. etat des deux URL publiques ;
4. etat des trois API publiques ;
5. migrations D1 en attente ou non ;
6. presence des noms de secrets email/paiement, sans afficher leurs valeurs ;
7. tests relances et resultat ;
8. differences eventuelles entre ce document et la realite observee ;
9. trois prochaines actions recommandees, classees par priorite.

Si tu ne peux pas verifier un element, dis exactement lequel et pourquoi. Ne
transforme jamais une hypothese en fait. Le but est de continuer Pikala sans perdre
le travail V2, sans casser D1 et sans faire croire que le service commercial est
pret avant que les dependances externes et les donnees terrain soient reelles.

---

