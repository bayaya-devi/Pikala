# Audit final du numerique existant - Pikala

Date de reference : 24 aout 2026.

## Perimetre

Cet audit couvre le depot officiel `bayaya-devi/Pikala`, la branche
`origin/main`, le Worker Cloudflare `pikala`, les Static Assets, la base D1
`pikala-db`, les migrations 0001 a 0011, les pages publiques et privees, les
API, l'administration, la PWA, l'i18n, la securite, l'observabilite et les
tests existants.

Les statuts utilises sont :

- **operationnel** : code, interface et backend existent et le parcours a ete
  teste ;
- **partiel** : le domaine existe mais ne couvre pas encore l'exploitation
  finale ;
- **prepare** : abstraction ou schema present, dependance externe manquante ;
- **absent** : aucun modele complet, API et interface coherents ;
- **test uniquement** : donnees ou provider interdits en production.

## Etat Git et publication

- `origin/main` pointe sur `47a6120`, fusion de la PR 43.
- Les PR 41, 42 et 43 corrigent respectivement PBKDF2 Cloudflare, le contenu
  invisible de la homepage et le cache PWA obsolete.
- La PR 40 reste ouverte pour un document de reprise.
- Les anciennes PR 37 et 38 restent ouvertes sur des branches intermediaires,
  alors que leur contenu utile est deja integre par la PR 39. Elles ne doivent
  pas etre fusionnees sans comparaison.
- URL principale : `https://pikala.aetbconseil.workers.dev/`.
- GitHub Pages est une publication secondaire ; Cloudflare Workers est la
  frontiere backend et la cible canonique.

## Etat Cloudflare

- Wrangler 4.125.0 est installe et authentifie.
- Le binding `DB` pointe vers `pikala-db`.
- Le binding `ASSETS` sert `sitepikala/`.
- L'observabilite Worker et les invocation logs sont actifs.
- Les 11 migrations distantes sont appliquees.
- Aucun secret Worker n'est actuellement configure.
- `PUBLIC_ORIGIN`, `RESEND_API_KEY`, `FROM_EMAIL` et un provider de
  paiement reel manquent donc en production.
- Le Worker utilise une date de compatibilite du 7 juillet 2026. Son evolution
  doit passer par une recette dediee, pas par une mise a jour opportuniste.

## Etat D1 de production

La production contient 24 tables visibles en incluant les tables techniques
`_cf_KV` et `d1_migrations`. Les migrations applicatives controlent 22
entites metier ou techniques.

Volumes observes :

| Entite | Volume | Observation |
|---|---:|---|
| users | 10 | 6 verifies, 4 non verifies, aucun admin |
| stations | 4 | aucune coordonnee, capacite non finalisee |
| bikes | 0 | aucun jumeau numerique exploitable |
| docks | 0 | aucun quai exploitable |
| rides | 3 | trois trajets V1 actifs sans bike_id depuis juillet 2026 |
| plans | 3 | un plan legacy et deux offres actives |
| subscriptions | 2 | donnees historiques |
| payments | 0 | aucun paiement reel |
| support_tickets | 1 | historique V1 |
| bike_incidents | 0 | workflow present mais non utilise |
| maintenance_records | 0 | workflow present mais non utilise |
| notifications | 0 | centre present mais sans activite |
| admin_audit_logs | 0 | aucun admin de production |

`PRAGMA foreign_key_check` ne retourne aucune violation. Les trois trajets
historiques actifs sans velo sont compatibles avec la conservation V1, mais
ils ne representent pas des trajets physiques valides. Ils doivent etre
classes et clos via une procedure de migration metier explicite, jamais
supprimes silencieusement.

## Matrice fonctionnelle

| Domaine | Etat | Donnees reelles | Limite principale |
|---|---|---|---|
| Homepage | operationnel | stations/plans D1 | stations non geolocalisees |
| Design system | operationnel | sans objet | quelques styles de compatibilite V1 |
| I18n FR/EN/AR/ES/PT | operationnel | dictionnaires centralises | recette humaine encore necessaire |
| RTL arabe | operationnel | sans objet | carte Leaflet reste techniquement LTR |
| PWA | operationnel | assets publics | usage appareil reel a poursuivre |
| Inscription | partiel | users D1 | aucun email de verification n'est envoye |
| Connexion/session | operationnel | users/sessions D1 | comptes non verifies bloques |
| Reset mot de passe | prepare | tokens D1 | email Resend absent |
| Profil | operationnel | users D1 | preferences et suppression de compte absentes |
| Carte | partiel | stations D1 | 4 coordonnees nulles |
| Stations | partiel | stations D1 | pas de docks ni inventaire physique |
| Velos | partiel | schema/API/admin | zero velo en production |
| Docks | partiel | schema/admin station | zero dock et pas de telemetrie |
| Scanner QR | operationnel dans le code | ZXing + API | aucun QR/velo/dock de production |
| Demarrage trajet | operationnel dans le code | transaction D1 | pas de confirmation serrure IoT |
| Restitution | operationnel dans le code | transaction D1 | pas de confirmation physique IoT |
| Historique trajets | operationnel | rides D1 | trois actifs historiques incoherents |
| Plans | operationnel | plans D1 | prix non relies a un provider reel |
| Abonnements | partiel | subscriptions D1 | activation commerciale impossible |
| Paiements | prepare | schema, idempotence, webhook | provider reel absent |
| Support utilisateur | operationnel dans le code | tickets/messages D1 | aucune equipe support geree |
| Incidents | operationnel dans le code | incidents/workflows D1 | aucune flotte reelle |
| Maintenance | partiel | maintenance/workflows D1 | diagnostic, pieces, couts et tests incomplets |
| Notifications in-app | operationnel dans le code | notifications D1 | aucun push/email externe |
| Administration V2 | partiel | 14 vues/API D1 | aucun admin de production, RBAC trop grossier |
| Audit logs | operationnel dans le code | table append-only | zero activite faute d'admin |
| Logs Worker | operationnel | JSON + requestId | pas de tableau de sante global |
| Employes | absent | aucun modele dedie | role limite a user/admin |
| Missions terrain | absent | aucune table/API/UI | aucun workflow agent |
| Inspections | absent | aucune checklist historisee | aucun calendrier |
| Reequilibrage | absent | aucun moteur | aucune recommandation/mission |
| Finance | partiel | paiements/abonnements | pas de remboursement, facture, reconciliation |
| Automatisations | absent | app_settings limite | aucun moteur de regles |
| IoT | absent | aucun device/provider | scan assimile au demarrage logique |
| Telemetrie | absent | aucune table | aucun last_seen/connectivite |
| Jobs planifies | absent | aucun cron | expiration/anomalies non orchestrees |

## Ce qui est reellement fonctionnel

- le Worker sert les pages, assets et API depuis une origine HTTPS ;
- les routes privees sont gardees avant les assets ;
- l'authentification utilise des sessions D1 revocables et des cookies
  `__Host-` ;
- les mots de passe PBKDF2 utilisent le facteur 100 000 compatible avec le
  runtime Cloudflare ;
- les controles CSRF, Fetch Metadata, validation serveur et RBAC admin sont
  presents ;
- les API publiques lisent D1 ;
- la homepage, les cinq langues, le RTL, la PWA et le cache reseau prioritaire
  sont implementes ;
- le QR est lu par la camera et le backend controle le trajet ;
- les invariants trajet, abonnement paye, maintenance et audit sont proteges
  par des contraintes, index ou triggers D1 ;
- support, incidents, notifications et maintenance disposent de workflows
  persistants ;
- les paiements ne peuvent pas etre marques payes depuis le frontend ou
  l'administration.

## Ce qui est partiel ou uniquement prepare

- l'email est code avec Resend, mais aucun secret n'est configure ;
- le paiement dispose d'une abstraction et d'un provider de test strictement
  reserve au developpement, mais aucun provider commercial ;
- l'administration gere l'exploitation V2 actuelle, pas encore le futur
  Control Center multi-metiers ;
- la maintenance ne gere pas encore diagnostic detaille, pieces, temps,
  inspections et cout total ;
- la flotte et les quais disposent d'un socle, pas d'un jumeau numerique
  complet ;
- les disponibilites sont desormais calculees uniquement depuis les vrais
  enregistrements `bikes` et `docks`, jamais depuis le compteur V1 ;
- les scripts de navigateur utilisent des donnees factices exclusivement dans
  le serveur de test local.

## Fonctions absentes pour le reseau final

- employes, equipes, permissions fines et separation des responsabilites ;
- missions terrain, redistribution, interventions et preuves ;
- inspections periodiques et checklists ;
- jumeaux numeriques enrichis pour velos, stations et docks ;
- devices, credentials, commandes, resultats, evenements et telemetrie IoT ;
- moteur de regles, anomalies, alertes et overrides ;
- jobs planifies et reprise des traitements ;
- remboursement, facturation, reconciliation et cloture finance ;
- sanctions, suppression de compte et preferences utilisateur completes ;
- system health consolide et interface d'astreinte ;
- simulation coherente d'une journee a 100 utilisateurs, 50 velos, 10 stations
  et 100 docks.

## Donnees hardcodees ou de compatibilite

- `seeds/*.sql` et `scripts/test-server.mjs` contiennent des donnees de
  test locales et ne doivent jamais etre executes avec `--remote` ;
- `contact@pikala.ma` est present dans le footer sans preuve de routage email ;
- `publicOrigin()` possede un fallback vers le domaine workers.dev ;
- `stations.bikes_available` reste conserve pour compatibilite V1, mais ne
  doit plus alimenter les disponibilites actives ;
- le provider de paiement `test` exige explicitement
  `ENVIRONMENT=development` ;
- les anciens trajets sans velo restent conserves pour historique.

## Risques critiques

1. **Acquisition bloquee** : sans email, quatre comptes sont deja non verifies
   et un nouveau client ne peut pas terminer son inscription.
2. **Vente bloquee** : sans provider de paiement, aucune offre payante ne peut
   etre activee.
3. **Exploitation bloquee** : zero velo, zero dock et zero coordonnee station.
4. **Administration bloquee** : aucun compte admin de production.
5. **Historique a assainir** : trois trajets actifs V1 sans velo.
6. **RBAC insuffisant** : seulement `user` et `admin`, incompatible avec les
   futurs metiers.
7. **IoT absent** : aucune confirmation physique de verrouillage/deverrouillage.
8. **Automatisation absente** : aucun moteur d'anomalies ou de missions.
9. **Architecture backend concentree** : `src/worker.js` orchestre encore trop
   de domaines et doit etre progressivement decoupe.
10. **Pas de staging explicite** : le fichier Wrangler ne definit pas
    d'environnement de preproduction distinct.

## Corrections non destructrices realisees pendant cet audit

- suppression du fallback public vers `stations.bikes_available` ;
- disponibilites calculees uniquement a partir des vrais velos et docks ;
- ajout d'un test empechant le retour du compteur V1 dans les API actives ;
- integration du test homepage dans `npm run test:static` ;
- mise a jour de l'architecture finale dans `docs/architecture.md`.

## Decision de passage au message 2

Le depot est pret pour la phase 2 en tant que **socle V2 stable et audite**.
Il n'est pas encore pret pour une exploitation commerciale ou physique. La
phase suivante doit commencer par le modele d'identites employes/RBAC et les
jumeaux numeriques, puis seulement les interfaces correspondantes. Toute
migration doit rester additive, etre testee sur une copie locale et etre
precedee d'un export D1 distant.
