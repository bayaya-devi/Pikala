# Strategie administration V2

L'administration V1 est une page de lecture des stations. Elle masque l'acces
aux utilisateurs non admin cote client, mais ne possede aucun endpoint CRUD.

## Cible

L'application admin partage le design system et les composants de base, mais
utilise des routes et services dedies. Chaque endpoint `/api/v2/admin/*` exige
une session, un role autorise et une permission explicite cote Worker.

Sections : dashboard, utilisateurs, stations, velos, trajets, plans,
abonnements, paiements, incidents, maintenance, support, notifications,
parametres et logs.

## Regles

- deny by default et controles serveur sur chaque action ;
- pagination, recherche et filtres cote API ;
- confirmation et re-authentification pour les actions sensibles ;
- aucune suppression physique immediate des utilisateurs, stations ou velos ;
- journal `admin_audit_logs` append-only avec acteur, cible, action, date et
  resultat ;
- aucune donnee ou statistique inventee ;
- export limite, trace et protege ;
- formulaires valides cote serveur avec codes d'erreur stables.

## Ordre de construction

1. Middleware RBAC et audit logs.
2. Dashboard reel en lecture seule.
3. Stations et velos.
4. Utilisateurs et abonnements.
5. Trajets, incidents et maintenance.
6. Support, notifications, plans, paiements et parametres.
