# Jumeaux numériques Pikala

## Périmètre

La migration `0014_infrastructure_digital_twins.sql` enrichit sans suppression les vélos, stations et docks. Elle ajoute la connectivité, le dernier contact, l'état des serrures et les agrégats d'usage. Les vélos disposent aussi de coordonnées GPS futures, kilométrage, durée d'utilisation et nombre de trajets.

`infrastructure_events` conserve un historique append-only des changements d'état. Les incidents, maintenances, inspections, trajets et devices restent dans leurs tables métier et sont réunis dans les fiches du Control Center.

## Invariants D1

- `docks.bike_id` est unique: un vélo ne peut occuper deux docks.
- `(station_id, position)` est unique: une position physique ne peut être dupliquée.
- Un dock `occupied` doit contenir un vélo et réciproquement.
- Un vélo `in_use` ne peut rester rattaché à une station ou un dock.
- Un vélo `maintenance` doit avoir `maintenance_required=1` et ne peut être loué.
- Le nombre de docks actifs ne peut dépasser la capacité de la station.
- Les événements d'infrastructure ne peuvent être ni modifiés ni supprimés.

## Administration

Les listes vélos, stations et docks offrent recherche, filtres, pagination, sélection multiple et fiches détaillées. Les actions disponibles selon le RBAC sont: télémétrie, export CSV, prévalidation/import CSV, changement de statut, assignation de station et génération QR par lot.

Les imports sont limités à 100 lignes et prévalidés contre D1. Ils exigent un motif, la confirmation `PIKALA BULK.IMPORT` et une clé d'idempotence. Aucun import n'est lancé par le déploiement et aucun import production ne doit être exécuté sans confirmation explicite de l'opérateur.

Les modifications groupées exigent `PIKALA BULK.UPDATE`; elles sont consignées dans `admin_overrides` et `admin_audit_logs`. Les exports neutralisent les valeurs pouvant être interprétées comme des formules par un tableur.

## Exploitation

1. Sauvegarder un bookmark D1 Time Travel.
2. Exécuter les tests statiques et crash-tests locaux.
3. Exécuter le dry-run Worker.
4. Appliquer la migration D1 distante.
5. Déployer le Worker puis effectuer les smoke-tests.

Les futures trames IoT devront appeler une API de télémétrie avec une identité device dédiée; l'interface admin actuelle est un outil opérateur et non un protocole IoT public.
