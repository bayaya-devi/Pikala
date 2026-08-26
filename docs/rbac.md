# Employés, rôles et permissions

Pikala sépare désormais les comptes utilisateurs des profils professionnels. Un compte ne reçoit aucun accès interne tant qu’un profil `staff_members` actif ne lui est pas associé. Le rôle professionnel est porté uniquement par ce profil; `users.role` reste un niveau de compte compatible avec la V1.

## Rôles

`super_admin`, `admin`, `operations_manager`, `station_manager`, `technician`, `field_agent`, `support_agent`, `finance` et `analyst`.

Les permissions par défaut sont stockées dans `staff_role_permissions`. Les exceptions individuelles sont versionnées dans `staff_permission_overrides`; un refus individuel prime sur un droit de rôle. Les zones sont reliées par `staff_member_zones`.

## Contrôles

- Le Worker charge le profil, son statut, ses zones et ses permissions à chaque accès interne.
- Chaque route admin exige une permission précise.
- Chaque commande forte vérifie une permission distincte après lecture de l’action.
- Les techniciens et agents terrain ne voient que leurs missions assignées.
- Le support reçoit une vue utilisateur limitée sans téléphone, langue ni abonnement.
- Les sessions sont révoquées après changement de rôle ou suspension.
- Le dernier `super_admin` ne peut pas être suspendu ou rétrogradé.
- Toutes les mutations du personnel sont auditées dans `admin_audit_logs` et `staff_activity_logs`.

## Création d’un employé

Le compte Pikala doit déjà exister, être actif et posséder un email vérifié. Le gestionnaire renseigne ensuite le matricule, le rôle, les zones et la date d’arrivée. Aucun mot de passe temporaire n’est créé ou communiqué par un administrateur.
