# Administration Pikala V2

L'administration est une application privee servie par `admin.html`. Elle
partage le design system et l'i18n Pikala, tout en utilisant une navigation et
des services API dedies aux operations. Elle comporte 14 vues : dashboard,
utilisateurs, stations, velos, trajets, plans, abonnements, paiements,
incidents, maintenance, support, notifications, parametres et audit logs.

## Autorisation

- La page exige une session active avec le role `admin`.
- Toutes les routes `/api/admin/*` appliquent `requireRole(..., ['admin'])`
  dans le Worker avant d'appeler le service admin.
- Une verification visuelle cote client ameliore l'experience, mais ne remplace
  jamais la protection serveur.
- Un utilisateur normal recoit `403` sur l'API et une redirection `303` vers
  son dashboard pour la page.
- Un administrateur ne peut pas retirer son propre acces ni supprimer le
  dernier administrateur actif.
- Une modification de role ou statut revoque les sessions concernees.

## Fonctions

- Dashboard : compteurs D1 reels et activite des trajets sur sept jours.
- Utilisateurs : pagination, recherche, filtres, fiche, role et statut.
- Stations : creation, lecture, modification, desactivation, quais et carte.
- Velos : creation, modification, station, statut, QR imprimable et maintenance.
- Trajets : liste, filtres, detail et signalement des trajets actifs longs.
- Plans : CRUD via les routes de la phase 8.
- Abonnements et paiements : lecture et filtres. Les paiements sont strictement
  en lecture seule et ne peuvent pas etre marques payes depuis l'admin.
- Incidents, maintenance et support : listes et transitions de workflow.
- Notifications : message de service vers comptes actifs, tous les comptes ou
  une liste limitee d'identifiants.
- Parametres : uniquement `service_status`, `support_contact` et
  `ride_monitoring` avec validation serveur.
- Audit : lecture paginee des actions sensibles, sans secrets ni jetons.

La suppression d'une station est logique : elle desactive la station apres le retrait de tous ses velos. Les
donnees historiques restent conservees. Les velos en trajet ne peuvent pas
etre places en maintenance.

## Donnees

Les migrations `0008_admin_operations.sql`, `0009_admin_concurrency_guards.sql` et `0010_admin_bike_dock_guards.sql` sont additives. Elles ajoutent les champs
d'exploitation, les tables `maintenance_records` et `app_settings`, leurs
index et une contrainte protegeant les velos en trajet. Elle ne supprime aucune
donnee existante.

`seeds/admin-test.sql` cree uniquement le compte admin local utilise par les
tests. Ne jamais executer ce fichier avec `--remote`.

## Tests locaux

```powershell
npm run db:migrate:local
npm run db:seed:local
npx wrangler d1 execute pikala-db --local --file seeds/admin-test.sql
npm run test:admin
npm run test:admin:crash -- http://127.0.0.1:8830
npm run test:admin:browser -- http://127.0.0.1:8831
```

Le crash-test couvre 32 controles serveur et metier. Le test navigateur couvre
les 14 vues, les cinq langues, le RTL arabe, desktop et tablette. Les deux
tests d'execution necessitent un Worker local ; le test navigateur necessite
aussi Chrome avec le port DevTools configure par le script de lancement.

## Mise en production

1. Sauvegarder D1 distante.
2. Executer les tests statiques et `npm run deploy:dry-run`.
3. Appliquer les migrations D1 distantes.
4. Deployer le Worker apres la migration.
5. Tester un compte utilisateur et un compte admin sur l'environnement cible.
6. Verifier les audit logs et l'absence d'erreur D1.

Le Worker V2 ne doit pas etre publie avant les migrations `0008`, `0009` et `0010`, car il lit les
nouvelles colonnes et tables d'exploitation.
