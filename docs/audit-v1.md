# Audit complet de Pikala V1

Date de l'audit : 23 aout 2026.

## Perimetre et methode

L'audit couvre tous les fichiers suivis du depot, les points d'entree HTML,
CSS et JavaScript, le Worker, sa configuration, les routes API, les requetes
D1, Git, les parcours utilisateur, l'i18n, l'accessibilite et la securite.

Verifications realisees :

- inventaire de l'arborescence et comptage des lignes ;
- lecture des points d'entree et du code metier ;
- recherche des donnees statiques, simulations, appels externes et pages
  historiques ;
- verification syntaxique des quatre fichiers JavaScript actifs avec
  `node --check` ;
- verification de Git, de `origin/main` et de la PR ouverte no 30 ;
- comparaison avec les pratiques Cloudflare Workers, Static Assets et D1.

La lecture distante de la structure D1 n'a pas pu etre terminee : Wrangler
4.111.0 est present, mais son installation locale n'a pas de shim `.bin`, puis
son acces au compte Cloudflare a ete bloque par le reseau local. Le schema
ci-dessous est donc celui prouve par le Worker, pas un export certifie de la
production. Cette verification est obligatoire avant la premiere migration.

## Architecture V1 observee

Le frontend actif est un ensemble de pages HTML statiques servi par Workers
Static Assets. `app.js` gere la homepage et ses cinq langues, `auth.js` gere les
deux pages d'authentification, et `user-space.js` gere toutes les pages privees.
Les styles sont repartis entre `styles.css`, `auth.css` et `user-space.css`.

Le backend est entierement concentre dans `src/worker.js` (439 lignes). Ce
fichier cumule routage des pages, routage API, validation, mots de passe,
sessions, envoi d'email, creation du schema, acces D1 et logique metier.

## Inventaire fonctionnel

| Domaine | Etat reel | Source des donnees | Decision V2 |
| --- | --- | --- | --- |
| Splash screen | Fonctionnel | Statique | Conserver puis integrer au build |
| Homepage | Fonctionnelle visuellement | Chiffres et stations hardcodes | Reconstruire les donnees dynamiques |
| Langues homepage | FR, EN, ES, PT, AR | Dictionnaire `app.js` + localStorage | Conserver le comportement, centraliser |
| Inscription | API et session fonctionnelles si D1 est disponible | D1 | Conserver le flux, renforcer et tester |
| Connexion/deconnexion | API et cookie de session fonctionnels | D1 | Conserver le principe, refactoriser |
| Verification email | Code partiel, desactive | D1 + Resend optionnel | Terminer avec resend/reset/renvoi |
| Mot de passe oublie | Lien sans fonctionnalite | Aucun | Construire |
| Dashboard | Donnees stations/profil partielles | API + historique hardcode | Reconstruire |
| Carte stations | Leaflet + OpenStreetMap | API, avec coordonnees completees | Conserver l'UX, fiabiliser les donnees |
| Stations | Endpoint public fonctionnel | D1 ou stations de demonstration | Creer vraies stations/velos/docks |
| Scanner QR | Simulation par bouton | Aucun QR, aucune camera | Remplacer integralement |
| Trajets | Creation d'une ligne minimale | D1, sans velo ni restitution | Remplacer integralement |
| Abonnement | Activation directe d'un texte de plan | D1, sans table plans ni paiement | Remplacer integralement |
| Paiement | Bouton et anciennes interfaces seulement | Aucun prestataire | Construire sans faux succes |
| Profil | Lecture identite, abonnement, 5 trajets | D1 | Etendre |
| Support backend | Creation de ticket | D1 | Conserver puis enrichir |
| Support frontend | Casse a la soumission | Erreurs JS d'ordre des variables | Corriger en phase 2 |
| Administration | Tableau de synthese des stations | Endpoint stations public | Reconstruire en application admin |
| PWA | Absente | Aucun manifest/service worker | Construire |
| Tests | Absents | Aucun | Construire avant logique critique |

## Pages actives a conserver pendant la migration

- `accueil.html`, `index.html` ;
- `connexion.html`, `inscription.html` ;
- `dashboard.html`, `stations.html`, `scanner.html`, `profil.html`,
  `support.html`, `abonnement.html`, `admin.html` ;
- `mentions-legales.html`, `confidentialite.html`, `conditions.html` ;
- `styles.css`, `auth.css`, `user-space.css`, `app.js`, `auth.js`,
  `user-space.js` ;
- `logo.jpeg` et les photos de Rabat, apres optimisation et verification des
  droits d'utilisation.

## Elements historiques a retirer plus tard

Ces fichiers ne doivent etre supprimes qu'apres validation de leurs remplacements :

- `pikala-homepage.html` et `pikala-homepageen.html` : anciennes homepages
  d'environ 1,49 Mo chacune, avec medias integres ;
- `Pageuser.html` et `Pageuseren.html` : anciens espaces utilisateur ;
- `connexionen.html` et `inscriptionen.html` : anciennes pages anglaises
  dupliquees ;
- `abonement.html`, `abonementen.html` et `abonement.html` : ancien parcours
  de paiement et doublons orthographiques.

## Dix problemes prioritaires

1. **Trajet non securise fonctionnellement.** `src/worker.js:408` cree un trajet
   sans velo, QR, abonnement, controle de trajet actif, verrouillage ni
   transaction metier. Des requetes repetees creent plusieurs trajets actifs.
2. **Schema D1 cree pendant les requetes.** `src/worker.js:148` execute des DDL et
   un peuplement de stations depuis le Worker. Cela augmente la latence, masque
   l'etat reel du schema et rend les evolutions risquées.
3. **Paiement et abonnement fictifs.** `src/worker.js:374` accepte un nom de plan
   fourni par le client et active directement l'abonnement. Aucune table `plans`,
   aucune preuve de paiement et aucun prestataire ne sont verifies.
4. **Scanner simule.** `scanner.html:26` declenche directement `/api/rides` sans
   camera, QR ou identifiant de velo.
5. **Donnees commerciales presentees comme reelles.** `index.html:68-77`, les
   cartes de stations, le tarif 99 MAD, les horaires et l'historique du
   dashboard sont hardcodes.
6. **Backend monolithique.** Le Worker regroupe plus de huit responsabilites et
   n'offre aucune separation route/service/repository/validation.
7. **Aucun test ni installation reproductible.** Aucun test, aucune migration,
   aucun lockfile, et Wrangler n'est pas declare dans `package.json`. `npm audit`
   echoue avec `ENOLOCK`.
8. **Support utilisateur casse.** `user-space.js:245-251` utilise `button` avant
   sa declaration et envoie une variable `subject` non declaree.
9. **i18n incoherente.** La homepage et l'auth utilisent cinq langues, mais
   l'espace utilisateur, l'administration et les pages legales restent en
   francais. Les dictionnaires sont dupliques entre deux scripts.
10. **Erreurs internes exposees.** `src/worker.js:434` retourne directement
    `error.message`, ce qui peut reveler des erreurs SQL/D1 comme l'erreur
    `ambiguous column name` deja observee.

## Dette technique complementaire

- `FALLBACK_STATIONS` est presente comme une reponse degradee mais injecte aussi
  des donnees de demonstration dans une base vide.
- Les coordonnees absentes sont devinees depuis le nom de station.
- Les anciennes pages contiennent CSS, JavaScript et medias dans le HTML.
- La homepage charge des chiffres avant tout appel API.
- Leaflet est charge par CDN sur la page stations et Google Fonts sur presque
  toutes les pages, sans strategie locale ni politique CSP.
- Les pages privees sont des fichiers publics ; les donnees API sont protegees,
  mais l'affichage initial et la redirection reposent sur JavaScript.
- Le Worker n'offre pas de pagination, version d'API, validation structurelle,
  identifiant de correlation, journalisation structuree ou limitation de debit.
- La page admin n'est qu'une vue de stations. Il n'existe aucun CRUD admin.
- Les CSS ont des breakpoints et `prefers-reduced-motion`, mais aucune matrice de
  tests aux largeurs demandees n'existe.
- `user-space.css` ne definit pas de strategie globale de focus visible aussi
  complete que la homepage.
- La PWA, le SEO avance, `robots.txt`, `sitemap.xml`, les donnees structurees et
  les balises `noindex` des pages privees sont absents.

## Securite

### Constats a haute confiance

- **Contournement du workflow de location (eleve).** Tout utilisateur connecte
  peut creer des trajets actifs illimites sans velo ni abonnement via
  `POST /api/rides`.
- **Enumeration de comptes (moyen).** `/api/login` distingue compte absent et
  mauvais mot de passe ; `/api/signup` confirme qu'un email existe.
- **Absence de protection contre la force brute (moyen).** Aucun rate limiting,
  verrouillage ou ralentissement n'est applique a l'inscription/connexion.
- **Divulgation d'erreurs internes (moyen).** Les exceptions D1 sont renvoyees au
  client par le gestionnaire global.

### Points positifs a conserver

- requetes D1 parametrees avec `.bind()` ; aucune injection SQL prouvee ;
- tokens de session aleatoires, stockes sous forme de hash ;
- cookie `HttpOnly`, `Secure`, `SameSite=Lax` et expiration serveur ;
- comparaison du hash de mot de passe sans sortie anticipee ;
- listes de champs utilisateur explicitement filtrees ;
- endpoints profil, abonnement, support et trajet relies a l'utilisateur de la
  session ;
- donnees de station echappees avant insertion dans le HTML dynamique.

### A renforcer

- remplacer PBKDF2 100 000 iterations par un parametre actuel valide et migrable ;
- ajouter CSRF explicite ou controle Origin/Fetch Metadata sur les mutations ;
- ajouter CSP, `frame-ancestors`, HSTS, Referrer-Policy et Permissions-Policy ;
- ne jamais exposer une URL de verification ou un token dans les logs ;
- journaliser les evenements securite sans mot de passe, token ou PII excessive ;
- verifier tous les roles et permissions dans les futurs endpoints admin.

## Conclusion

La V1 est un prototype presentable avec une vraie base d'authentification et de
sessions, mais pas encore un service de location exploitable. Le depot est pret
pour la phase 2 a condition de commencer par rendre l'outillage reproductible,
exporter D1 et poser l'architecture modulaire avant toute nouvelle interface.
