# Architecture Pikala V2

## Vue generale

Pikala V2 est une application web multi-page servie par Cloudflare Workers Static Assets. Le Worker est l'unique frontiere de confiance : il protege les pages privees, valide les entrees, applique le RBAC, execute les transactions D1 et retourne des erreurs JSON stables.

## Frontend

- design system central dans sitepikala/assets/css ;
- i18n centralisee et persistante pour fr, en, ar, es et pt ;
- dir=rtl et adaptations directionnelles pour l'arabe ;
- layouts public, authentification, utilisateur et admin ;
- composants DOM construits avec textContent pour les donnees externes ;
- Leaflet, Lucide, ZXing et QR servis localement et charges seulement sur les ecrans utiles ;
- service worker limite aux ressources statiques non sensibles.

Les pages V1 dupliquees par langue ont ete retirees. Les URLs actives utilisent une page par fonction et le parametre de langue commun.

## Backend

src/worker.js orchestre les routes publiques, l'authentification, les abonnements et les trajets. Les domaines complexes sont separes dans src/admin, src/operations et src/payments. Toutes les requetes D1 utilisent bind, sauf des fragments SQL constants issus d'allowlists internes.

Les garde-fous principaux sont : CSRF par origine et en-tete applicatif, cookie __Host Secure/HttpOnly/SameSite, sessions stockees et revocables, ownership dans les requetes, requireRole pour admin, validations de taille/type/statut et transactions D1 pour les changements concurrents.

## Donnees

Le schema est gere uniquement par les migrations 0001 a 0011. Les migrations sont additives et preservent les colonnes historiques necessaires. Les contraintes et index empechent notamment deux trajets actifs par utilisateur ou par velo, plusieurs abonnements actifs et plusieurs maintenances ouvertes incompatibles.

## PWA et cache

Le manifest, les icones et le service worker rendent l'application installable. Le cache exclut /api, les pages privees, les sessions, paiements, profils et disponibilites critiques. Une navigation hors ligne affiche une page explicite sans simuler la reussite d'une action.

## Observabilite

Les evenements auth, trajets, paiements, incidents, support, admin et erreurs API sont journalises en JSON avec requestId. L'allowlist de champs interdit mots de passe, secrets et jetons. Les audit logs D1 conservent les actions administratives sensibles et des metadonnees limitees.

## Etat audite et trajectoire finale

L'etat detaille et les volumes de production sont consignes dans
`docs/audit-final-numerique.md`. La V2 actuelle est le socle transactionnel ;
elle ne constitue pas encore le Control Center final, le moteur de missions ou
la couche IoT.

## Principes de l'architecture finale

1. **D1 reste la source de verite metier.** Aucun etat critique ne depend du
   DOM, du cache PWA ou d'une reponse de device non persistee.
2. **Le Worker reste la frontiere de confiance.** Autorisations, transitions
   d'etat, idempotence et ownership sont verifies cote serveur.
3. **Les domaines sont separes.** Une route HTTP orchestre un service metier ;
   elle ne porte pas directement toute la logique SQL.
4. **Les transitions sont explicites.** Trajet, mission, maintenance, paiement
   et commande IoT ont des machines a etats documentees.
5. **Chaque action sensible est auditee.** Acteur, permission, ressource,
   ancien/nouvel etat, requestId et metadonnees non sensibles sont conserves.
6. **Les providers sont interchangeables.** Email, paiement, notification,
   carte et device exposent une interface stable avec un etat de disponibilite.
7. **Aucun mode test n'est implicite.** Mock, seed et simulation exigent un
   environnement non production et restent clairement identifies.
8. **Les migrations sont additives.** Les suppressions ou renommages passent
   par creation, backfill, double lecture, bascule, puis retrait ulterieur.
9. **Les traitements sont idempotents.** Webhooks, commandes, jobs et actions
   admin possedent une cle stable et tolerent les replays.
10. **L'indisponibilite est un etat produit.** Une fonction sans provider ou
    materiel est masquee ou annoncee indisponible, jamais simulee comme reussie.

## Domaines cibles

### Identite et acces

Responsabilites :

- utilisateurs clients ;
- employes et equipes ;
- roles et permissions fines ;
- sessions, verification, reset et securite ;
- suspension, sanctions, preferences et suppression de compte ;
- separation des responsabilites sensibles.

Entites cibles :

- `users` conserve l'identite commune ;
- `employee_profiles` porte les donnees RH operationnelles minimales ;
- `roles`, `permissions`, `role_permissions` et
  `user_role_assignments` remplacent progressivement le role texte unique ;
- `teams` et `team_members` structurent operations, maintenance, support et
  finance.

Le Worker doit utiliser `requirePermission()` pour les nouvelles routes.
`requireRole('admin')` reste un adaptateur de transition.

### Flotte et jumeaux numeriques

`bikes` devient le registre du jumeau numerique avec identite, etats
physique/logique, connectivite, localisation, compteurs d'usage, dates
d'inspection, maintenance, mise en service et retrait.

L'historique est separe du snapshot courant :

- `bike_state_events` ;
- `bike_movements` ;
- `bike_metrics_daily` ;
- `bike_notes`.

Un snapshot facilite l'affichage ; les evenements expliquent toujours comment
il a ete obtenu.

### Stations et docks

`stations` porte configuration, horaires, connectivite et statut de service.
`docks` porte position, verrou, occupation et derniere communication.

Historisation cible :

- `station_state_events` ;
- `dock_state_events` ;
- `station_interventions` ;
- `station_metrics_hourly`.

Les invariants imposent :

- un velo dans au plus un dock ;
- un dock occupe par exactement un velo ;
- coherence station du velo/dock ;
- aucun depart depuis station fermee ;
- aucune restitution dans dock indisponible.

### Trajets et IoT

Le flux sans IoT actuel reste un provider de developpement clairement marque.
Le flux final est :

```text
scan QR
  -> validation utilisateur/abonnement/velo/dock
  -> creation ride_intent idempotente
  -> commande unlock persistante
  -> envoi au device
  -> confirmation physique
  -> trajet active et dock libere
```

La restitution finale suit le chemin inverse et n'est terminee qu'apres une
confirmation physique de verrouillage. Les entites cibles sont
`ride_intents`, `rides`, `device_commands` et
`device_command_results`.

En cas de timeout, l'etat reste `unlock_pending` ou `return_pending` et une
alerte operationnelle est creee. Le frontend ne transforme jamais un timeout
en succes.

### Operations et travailleurs

Le moteur de missions utilise :

- `field_missions` ;
- `mission_assignments` ;
- `mission_bikes` ;
- `mission_events` ;
- `mission_proofs`.

Etats : `created -> assigned -> accepted -> in_progress -> completed`, avec
`cancelled` et `failed` controles.

Les interfaces employes sont filtrees par permission et proposent missions,
scan velo/station/dock, inspections, incidents assignes, maintenance et
reequilibrage.

### Maintenance et inspections

Le domaine maintenance separe :

- incident initial ;
- inspection ;
- diagnostic ;
- ordre de travail ;
- pieces et couts ;
- temps technicien ;
- test de sortie ;
- remise en service.

Entites cibles : `inspections`, `inspection_items`,
`maintenance_work_orders`, `maintenance_parts`,
`maintenance_labor_entries` et `maintenance_events`.

Aucun velo ne repasse `available` sans resultat de test lorsque le type de
maintenance l'exige.

### Reequilibrage et automatisations

Le moteur de regles utilise :

- `automation_rules` ;
- `automation_runs` ;
- `network_anomalies` ;
- `alerts` ;
- `rule_overrides`.

Chaque evaluation recoit un snapshot versionne. Une action automatique cree
une commande ou une mission idempotente, jamais une modification opaque.

Regles initiales : station presque vide/pleine, trajet trop long, maintenance
en retard, connectivite perdue, incoherence dock/velo, incident recurrent,
ticket urgent et mission en retard.

Les evaluations periodiques seront declenchees par un Cron Trigger Worker. Les
actions longues ou avec reprise seront migrees vers Cloudflare Workflows ou
Queues uniquement lorsque leur besoin est prouve.

### Paiements et finance

Le domaine cible conserve l'abstraction provider et ajoute :

- payment intents ;
- remboursements ;
- factures/recus ;
- ledger de transactions ;
- reconciliation ;
- exports finance ;
- journal des webhooks.

Aucun statut financier n'est modifiable directement par une interface admin.
Les corrections manuelles creent des operations compensees et auditees.

### Support et notifications

Les tickets/messages/workflow existants sont conserves. Le domaine cible
ajoute SLA, files d'affectation, macros, pieces jointes via stockage dedie et
escalades.

`notifications` reste le journal canonique. Les canaux email, push ou SMS
sont des deliveries separees avec statut, tentative, provider et erreur.

### Devices et telemetrie

Entites cibles :

- `devices` ;
- `device_credentials` avec references chiffrees ou secrets externes ;
- `device_events` ;
- `device_commands` ;
- `device_command_results` ;
- `telemetry_samples` ;
- `connectivity_events`.

`DEVICE_PROVIDER=local` est reserve au developpement. En production, un
provider absent rend unlock/return indisponibles et affiche
`CONFIGURATION MANQUANTE` dans l'administration.

La telemetrie volumineuse ne doit pas necessairement rester integralement dans
D1. Une politique de retention et un stockage adapte seront choisis apres
mesure du volume reel.

### Observabilite et sante

Le Control Center consolide :

- sante Worker et D1 ;
- derniere migration ;
- providers email/paiement/device ;
- jobs et automatisations ;
- devices/stations hors ligne ;
- commandes en timeout ;
- erreurs API par requestId ;
- files de missions et SLA support.

Les details sensibles restent dans les logs proteges. L'interface ne montre que
des etats, identifiants de correlation et actions autorisees.

## Decoupage backend cible

```text
src/
  worker.js                 routage et composition
  auth/                     identite, sessions, permissions
  fleet/                    velos et mouvements
  stations/                 stations, docks et disponibilites
  rides/                    intents, trajets et restitution
  devices/                  providers, commandes et telemetrie
  workforce/                employes, equipes et permissions
  missions/                 missions terrain et reequilibrage
  maintenance/              incidents, inspections et ordres
  payments/                 checkout, webhooks, finance
  support/                  tickets, messages et SLA
  notifications/            centre et deliveries
  automation/               regles, anomalies et jobs
  admin/                    facades Control Center
  observability/            logs, audit et system health
```

Le decoupage sera progressif. Une phase ne deplace un domaine que si ses tests
restent verts et si l'API publique conserve son contrat.

## Ordre de construction recommande

1. identites employes, roles et permissions fines ;
2. jumeaux numeriques velo/station/dock et historiques ;
3. devices, commandes et etats IoT sans materiel reel ;
4. missions terrain, inspections et maintenance complete ;
5. moteur de regles et reequilibrage ;
6. finance, remboursements, recus et reconciliation ;
7. Control Center final et system health ;
8. simulation d'une journee complete ;
9. recette de preproduction puis publication progressive.

Chaque etape cree une migration additive, des API protegees, une interface, des
tests statiques et crash-tests, puis un deploiement uniquement si les smoke
tests production passent.
