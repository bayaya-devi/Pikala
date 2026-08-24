# Retour arriere D1 V2

Il n'existe volontairement aucun script SQL inverse automatique. Un tel script
devrait supprimer des tables ou colonnes et pourrait detruire des paiements,
notifications, incidents ou journaux crees apres la migration.

## Incident juste apres migration

1. Ne pas deployer, ou restaurer la version precedente du Worker.
2. Verifier `PRAGMA foreign_key_check` et les volumes V1.
3. Laisser les tables additives en place : elles ne genent pas le Worker V1.
4. Corriger par une nouvelle migration versionnee et testee sur un clone.

## Donnees alterees apres mise en service

1. Bloquer temporairement les ecritures.
2. Creer un export de la base incidente.
3. Restaurer l'export pre-migration ou un point D1 Time Travel dans une base
   separee, jamais par-dessus l'unique copie de production.
4. Comparer les comptes de lignes et executer `PRAGMA foreign_key_check`.
5. Reconfigurer le binding `DB` vers la base restauree.
6. Conserver la base incidente le temps de l'analyse et de l'audit.

Cette procedure privilegie la conservation. Aucun `DROP TABLE` n'est fourni.
