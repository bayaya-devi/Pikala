# Bilan final détaillé Pikala Digital Core

Date de certification : 26 août 2026. Dépôt : `bayaya-devi/Pikala`. Production : `https://pikala.aetbconseil.workers.dev/`.

## 1. État avant cette mission

`main` était au SHA `add9872bdf3959b5f1370d65f04ee3bbca865683`, après les PR #47 à #49. D1 production contenait les migrations `0001` à `0016`. La supervision `0017` était locale, le backend IoT sécurisé n'existait pas, aucun secret Cloudflare n'était configuré, et les providers email et paiement réels étaient absents. L'estimation documentée était 65 %.

## 2. État Git final

- Commit fonctionnel : `9e03e07` (`feat: finaliser la supervision et le noyau IoT Pikala`).
- Branche de travail : `codex/pikala-anomaly-engine`.
- PR fonctionnelle : #50, fusionnée le 26 août 2026.
- SHA de fusion `main` : `1081b2cb60e41678cc6dc2ce7d669933740d02f4`.
- Le rapport final est publié par une PR documentaire distincte afin de conserver les preuves post-déploiement.

## 3. Publication Cloudflare

- Build Workers GitHub de la PR #50 : `SUCCESS`.
- Déploiement manuel après migrations : réussi.
- Worker : `pikala`.
- Version déployée : `c9aba560-5306-4372-80b9-e573f7c2dd13`.
- URL : `https://pikala.aetbconseil.workers.dev`.
- Cron : `0 4 * * *`.
- Premier essai manuel : timeout API Cloudflare lié au réseau ; second essai : réussi.

## 4. État D1

- Base : `pikala-db`, ID `722e8b9a-dbb1-4b04-8635-8493603af869`.
- Bookmark Time Travel pré-migration : `00000048-00000000-000050d3-979413e43bba34d30e711b68f8b81d7e`.
- `0017_supervision_engine.sql` : appliquée en production.
- `0018_iot_core.sql` : appliquée en production.
- Vérification finale Wrangler : `No migrations to apply`.
- Base neuve locale : 18 migrations, 58 tables, aucune instruction destructive détectée.
- Production : 9 règles de supervision présentes, 0 device physique, 0 membre staff actif.

## 5. Supervision

Statut : **IMPLEMENTED, LOCAL TESTED, PRODUCTION DEPLOYED, PRODUCTION DATA VERIFIED, PARTIAL FOR OPERATIONS**.

Le moteur couvre station presque vide/pleine, trajet long, incidents répétés, maintenance en retard, ticket urgent, incohérence vélo/dock, mission terrain en retard et device hors ligne. Il gère pagination, filtres, déduplication, cooldown, historique, recommandations, action automatique réversible, RBAC et audit. États : `new`, `acknowledged`, `in_progress`, `resolved`, `ignored`. Les 9 règles existent dans D1 production. Les actions admin authentifiées n'ont pas été rejouées en production faute de compte staff autorisé.

## 6. Noyau IoT

Statut : **IMPLEMENTED, LOCAL TESTED, READY FOR ADAPTER, BLOCKED BY HARDWARE**.

La migration `0018` ajoute ou étend devices, credentials, commands, command results, events, telemetry et rate limits. Les devices ont identité matérielle, type, provider, affectation unique, connectivité, batterie, firmware, dernière présence et cycle de mise en service. Les contraintes empêchent les affectations multiples et les transitions de commande invalides.

`DeviceProvider` expose `sendCommand`, `getDeviceStatus`, `verifyIncomingEvent`, `normalizeTelemetry` et `handleAcknowledgement`. Les modes sont `disabled`, `test`, `production`. Le mode production échoue explicitement tant que l'adapter constructeur n'existe pas ; il ne bascule jamais vers le simulateur.

## 7. Sécurité IoT

Statut : **IMPLEMENTED, LOCAL TESTED, NOT HARDWARE TESTED**.

- secret device unique, généré aléatoirement et affiché une fois ;
- secret chiffré AES-GCM avec `IOT_CREDENTIAL_KEK` ;
- rotation et révocation ;
- HMAC-SHA256 et comparaison constante ;
- timestamp toléré sur 5 minutes ;
- nonce et event ID uniques ;
- anti-replay et déduplication ;
- limite 120 événements signés/device/minute ;
- payload 32 KiB maximum et métadonnées filtrées ;
- idempotence des commandes ;
- expiration et libération de réservation ;
- logs et audits sans secret.

## 8. Workflow unlock/lock

Statut : **IMPLEMENTED, LOCAL TESTED, BLOCKED BY HARDWARE**.

En IoT actif, le scan crée une réservation et une commande `unlock`. Le trajet ne devient `active` qu'après accusé physique `completed`. Au retour, une commande `lock` est créée ; le trajet ne devient `completed` et le vélo disponible qu'après confirmation de verrouillage. Le frontend attend la confirmation au lieu d'annoncer prématurément un succès. Timeout, offline, échec et rejeu ont des états contrôlés.

## 9. Simulateur IoT

Statut : **IMPLEMENTED, LOCAL TESTED, NEVER CLIENT ACCESSIBLE**.

Il exige simultanément `IOT_MODE=test`, `ENVIRONMENT=development` et `devices.manage`. Il simule ack, succès, échec, timeout, offline, batterie faible et doublon. Il est inaccessible en production avec la configuration actuelle.

## 10. Email

Statut : **IMPLEMENTED ADAPTER, LOCAL TESTED, BLOCKED BY PROVIDER, REAL EMAIL NO**.

Adapter Resend, validation de configuration, timeout 8 s, une relance transitoire maximum, vérification, renvoi et reset sont codés. L'anti-énumération ne révèle pas si une adresse existe en cas d'échec fournisseur. Aucun secret Cloudflare n'est configuré : l'inscription production renvoie explicitement `503 EMAIL_PROVIDER_UNAVAILABLE` et aucun faux email n'est annoncé.

À fournir : `RESEND_API_KEY`, `FROM_EMAIL`, domaine expéditeur et enregistrements DNS validés.

## 11. Paiement et finance

Statut : **IMPLEMENTED ARCHITECTURE, LOCAL TESTED, BLOCKED BY PSP, REAL PAYMENT NO**.

L'abstraction existante couvre intention, états, webhook signé, idempotence, activation après confirmation, échec, annulation et remboursement préparé. Le crash-test paiement valide 26 contrôles et le test sans provider 5 contrôles. Aucun PSP réel ni secret n'est configuré ; aucun paiement production ne peut devenir `paid` artificiellement. Facture réglementaire, rapprochement et remboursement provider restent à terminer avec le PSP choisi.

## 12. Authentification

Statut : **IMPLEMENTED, LOCAL TESTED, PUBLIC PRODUCTION PARTIAL**.

PBKDF2, sessions HttpOnly/Secure/SameSite, CSRF, rate limits, révocation, expiration, reset à usage unique et protections anti-énumération passent 27 scénarios locaux. Les pages et routes publiques sont déployées. Un parcours authentifié production n'a pas été exécuté : aucun compte de test fiable avec mot de passe connu n'a été injecté, et l'email réel est absent.

## 13. Admin et employés

Statut admin : **IMPLEMENTED, LOCAL TESTED, PRODUCTION DEPLOYED, PRODUCTION AUTH NOT TESTED**.

Statut staff : **IMPLEMENTED RBAC, LOCAL TESTED, PRODUCTION NOT PROVISIONED**.

Les 9 rôles sont super_admin, admin, operations_manager, station_manager, technician, field_agent, support_agent, finance et analyst. Les routes et actions vérifient les permissions côté serveur. Les tests RBAC valident 52 contrôles, l'admin 38 et le navigateur admin 58 parcours sur 25 vues. D1 production ne contient actuellement aucun `staff_member` actif ; aucun privilège n'a été accordé manuellement sans preuve d'identité.

## 14. Maintenance

Statut : **IMPLEMENTED, LOCAL TESTED, PRODUCTION AUTH NOT TESTED**.

Workflow atelier, inspections, pièces, rappels, restrictions de location et interface technicien sont présents. Le crash-test atelier passe 35 contrôles. Le crash-test admin adapté au workflow professionnel passe 38 contrôles.

## 15. Terrain et rééquilibrage

Statut : **IMPLEMENTED, LOCAL TESTED, PRODUCTION AUTH NOT TESTED**.

Missions, scans, possession opérationnelle, déplacements, recommandations et transitions sont implémentés. Le test isolé passe 59 contrôles. Aucun agent terrain n'est provisionné en production.

## 16. Support et opérations

Statut : **IMPLEMENTED CORE, LOCAL TESTED, PARTIAL ADVANCED SUPPORT**.

Tickets, incidents, notifications, réponses et actions opérationnelles passent 56 contrôles API et 28 écrans navigateur. Restent en P1 : SLA formalisé, notes internes complètes et escalades avancées support vers opérations, maintenance et finance.

## 17. PWA, langues et responsive

Statut : **IMPLEMENTED, LOCAL AND PUBLIC PRODUCTION TESTED**.

Les cinq langues FR/EN/AR/ES/PT, RTL arabe, manifest, service worker et exclusion du cache critique sont présents. Tests locaux : 8 largeurs de 320 à 1440+, 2 directions et 9 écrans. Test homepage production : 3 formats x 5 langues, contenu visible, CTA présent et aucun débordement.

## 18. Tests exécutés et preuves PASS

- `npm ci` : réussi, 34 packages installés dans l'environnement de travail.
- `npm run test:static` : réussi intégralement.
- D1 fresh : 18 migrations, 58 tables.
- Auth : 27 scénarios.
- Trajets : 35 scénarios, exécutés deux fois.
- Paiement : 26 scénarios ; sans provider : 5.
- Admin : 38 ; RBAC : 52 ; opérations : 56 ; Control Center : 40.
- Jumeaux numériques : 20 ; atelier : 35 ; terrain isolé : 59.
- Supervision : 12 ; IoT : 29.
- Admin navigateur : 58 parcours, 25 vues, 5 langues, desktop/tablette.
- Opérations navigateur : 28 écrans, 5 langues, mobile/desktop, RTL et offline.
- Homepage production : 15 combinaisons format/langue.
- `npm audit --json` : 0 info, 0 low, 0 moderate, 0 high, 0 critical.
- `wrangler deploy --dry-run` : 111 assets, 375.44 KiB, gzip 78.24 KiB.

## 19. Production testée

- `/api/health` : 200.
- `/api/stations` : 200 avec données.
- `/api/plans` : 200 avec données.
- `/api/admin/session` : 401 anonyme.
- `/api/admin/supervision/alerts` : 401 anonyme.
- `/api/admin/iot/commands` : 401 anonyme.
- `/dashboard.html` et `/admin.html` : redirection 302 sans session.
- `/api/signup` : 503 explicite sans provider email.
- Homepage : rendu Chrome validé sur FR/EN/ES/PT/AR et mobile/tablette/desktop.

## 20. Tests FAIL rencontrés puis corrigés

- Test admin navigateur : compte admin limité utilisé alors que le scénario attendait toutes les vues ; passage au compte super-admin de test, puis 58 parcours PASS.
- Test admin maintenance : ancien scénario tentait une résolution directe incompatible avec le workflow atelier ; scénario mis à jour, puis 38 PASS.
- Test IoT : doublon simulateur et attente timeout incorrects ; logique/scénario corrigés, puis 29 PASS.
- Test terrain sur base polluée : échec d'isolation ; relance sur base dédiée, puis 59 PASS.
- Deux relances auth ont échoué car la variable de test était mal nommée ; relance avec `AUTH_TEST_SESSION_TTL_SECONDS=2`, puis 27 PASS. Aucun défaut production de session n'a été trouvé.
- Premier déploiement manuel : timeout réseau Cloudflare ; second déploiement réussi.

## 21. Tests SKIP ou non réalisables

- Authentification production avec comptes client/admin/staff : SKIP, aucun credential de test fiable et aucun staff actif.
- Simulation réseau reproductible 100 users/50 bikes/10 stations/100 docks : SKIP dans cette mission ; les suites métier isolées ont été privilégiées. Aucun seed de charge n'a été envoyé en production.
- Matériel réel, connectivité terrain, latence serrure et reprise réseau physique : BLOCKED BY HARDWARE.
- Email réel et paiement réel : BLOCKED BY PROVIDERS.

## 22. Erreurs et bugs corrigés

- Supervision locale non raccordée à l'admin, RBAC et cron.
- Alertes historiques incompatibles avec les nouveaux états.
- Absence de commandes/events/credentials IoT sécurisés.
- Scan considéré comme suffisant avant confirmation physique.
- Double commandes et double accusés sans idempotence complète.
- Signature/replay/timestamp/rate limit absents.
- Simulateur insuffisamment séparé de la production.
- Envoi email silencieusement faux lorsque le provider manquait.
- Risque d'énumération d'adresse lors d'une panne email.
- Quota device consommé avant validation HMAC.
- Interface trajet annonçant un succès avant confirmation matérielle.

## 23. Bugs et dette restant

- Aucun adapter constructeur réel.
- Aucun provider email ni PSP réel configuré.
- Aucun staff production provisionné et aucun test authentifié production.
- Support avancé, facturation réglementaire et rapprochement provider partiels.
- Monitoring externe, alerting et politique de rétention/restauration à contractualiser.
- Simulation de charge réseau complète absente.
- Cartographie OSM à encadrer avant trafic commercial important.

## 24. Services externes et éléments payants

- Email transactionnel : compte/provider, domaine expéditeur et DNS ; offre gratuite éventuelle selon fournisseur.
- PSP : contrat, conformité, clés, webhook et commissions par transaction.
- Matériel/connectivité : serrures, docks, contrôleurs, SIM ou réseau et maintenance.
- Cartographie : tuiles/géocodage adaptés au volume.
- Monitoring : alertes, conservation et astreinte.
- Domaine final : achat et DNS si le sous-domaine Workers ne suffit pas.

## 25. Matériel nécessaire

Vélos, QR durables, serrures commandables, docks avec présence/verrouillage, contrôleurs station, connectivité, horloge fiable, identité device et mécanisme sécurisé de provisionnement/rotation. Le fournisseur doit documenter commandes, accusés, erreurs, reprise et signature.

## 26. P0 restants

- Provider email réel et test de délivrabilité.
- PSP réel et cycle financier production.
- Adapter du matériel choisi et pilote physique.
- Comptes staff autorisés et crash-tests authentifiés production.

## 27. P1 restants

- SLA/support avancé.
- Factures, rapprochement et remboursement provider.
- Monitoring/alerting/rétention.
- Politique cartographique et sauvegarde D1 formalisée.
- Simulation réseau complète reproductible.

## 28. Pourcentage et décision

Avancement numérique estimé : **82 %**. Le socle logiciel indépendant du matériel est prêt ; les 18 % restants représentent surtout providers externes, validation authentifiée production, fonctions d'exploitation avancées et intégration physique.

**PIKALA DIGITAL CORE READY : OUI**, au sens où un matériel choisi peut être connecté par adapter sans reconstruire les trajets, l'admin ou le modèle D1.

**CLIENT COMMERCIAL : NON**, car inscription email, paiement et location physique ne sont pas disponibles de bout en bout.

**MATÉRIEL PEUT COMMENCER : OUI**, par sélection fournisseur, prototype d'adapter et pilote fermé technique.

## Verdict final

PIKALA DIGITAL CORE READY :
OUI

AVANCEMENT NUMÉRIQUE :
82 %

CLIENT COMMERCIAL :
NON

PILOTE FERMÉ :
NON

ADMIN PRODUCTION :
PARTIEL

STAFF PRODUCTION :
NON

MAINTENANCE :
PARTIEL

TERRAIN :
PARTIEL

SUPERVISION :
PARTIEL

IOT BACKEND READY FOR HARDWARE :
OUI

EMAIL RÉEL :
NON

PAIEMENT RÉEL :
NON

MATÉRIEL PEUT COMMENCER :
OUI

P0 RESTANTS :
- configurer et tester l'email réel ;
- intégrer et tester le PSP réel ;
- développer l'adapter du matériel choisi et effectuer un pilote physique ;
- provisionner les rôles staff et exécuter les tests authentifiés production.

ÉLÉMENTS QUI NE PEUVENT ÊTRE TERMINÉS SANS MATÉRIEL :
- ouverture et fermeture physiques ;
- détection réelle dock/vélo ;
- télémétrie, batterie et connectivité terrain ;
- tests de latence, couverture, panne et reprise.

ÉLÉMENTS QUI NÉCESSITENT DE PAYER / CONTRACTER UN SERVICE :
- PSP et commissions ;
- matériel et connectivité ;
- domaine, email, cartographie ou monitoring au-delà de leurs offres gratuites éventuelles.

5 RISQUES RESTANTS :
1. Adapter constructeur ou protocole matériel incompatible avec les garanties attendues.
2. Absence d'email empêchant aujourd'hui l'ouverture normale des comptes.
3. Absence de PSP empêchant tout abonnement payant réel.
4. Aucun staff production actif ni parcours authentifié de production certifié.
5. Charge, réseau terrain et exploitation 24/7 non encore éprouvés.

PROCHAINE ÉTAPE :
Choisir une serrure et un dock documentés, contractualiser email/PSP, implémenter l'adapter fournisseur, provisionner une équipe test et exécuter un pilote fermé instrumenté avant toute ouverture commerciale.
