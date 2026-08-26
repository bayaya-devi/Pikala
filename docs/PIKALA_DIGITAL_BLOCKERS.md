# Bloquants numériques restants

## P0 avant client commercial

- Configurer un fournisseur email réel avec `RESEND_API_KEY`, `FROM_EMAIL`, domaine expéditeur et DNS validé.
- Choisir et intégrer un PSP réel dans l'abstraction existante, puis valider checkout, webhook, remboursement et rapprochement en production.
- Choisir les serrures, docks, contrôleurs et la connectivité ; développer leur adapter `DeviceProvider` et effectuer un pilote physique.
- Exécuter les parcours authentifiés de production avec des comptes `TEST_` autorisés. Aucun seed dangereux ne doit être injecté en production.

## P1 d'exploitation

- Contractualiser une politique de tuiles cartographiques adaptée au trafic réel.
- Configurer alerting, rétention de logs et procédure de sauvegarde/restauration D1.
- Finaliser factures réglementaires, rapprochement PSP et traitement fournisseur des remboursements.
- Compléter SLA, notes internes et escalades avancées du support si le volume opérationnel le justifie.

## Dépendances externes

Le code ne peut pas inventer les secrets, contrats et équipements absents. L'email, le PSP et l'adapter matériel restent donc explicitement indisponibles tant qu'ils ne sont pas configurés. Le mode IoT de production ne retombe jamais sur le simulateur.
