# Migration V1 vers V2

## Strategie

La migration suit le principe du remplacement progressif. Chaque nouvelle
brique est construite, testee et deployee derriere une route ou un adaptateur
compatible avant le retrait de la V1.

## Phases recommandees

1. **Fondations.** Lockfile, dependances declarees, scripts dev/test, TypeScript,
   Vite, environnements Cloudflare, format d'erreur et design tokens.
2. **Homepage et i18n.** Source unique pour cinq langues, RTL complet, donnees
   stations/plans reelles et suppression des faux compteurs.
3. **D1.** Export, migrations versionnees, nouvelles entites et backfills.
4. **Auth.** Validation centralisee, rate limiting, verification email, reset de
   mot de passe, sessions et journalisation.
5. **Espace utilisateur.** Dashboard, carte, profil, historique et notifications.
6. **Velos et trajets.** Inventaire reel, QR, demarrage et restitution atomiques.
7. **Abonnements/paiements.** Plans D1, prestataire reel, webhooks idempotents.
8. **Administration.** RBAC serveur, CRUD, incidents, maintenance et audit logs.
9. **Qualite production.** PWA, accessibilite, performance, SEO, observabilite,
   tests de charge et crash test final.
10. **Nettoyage.** Suppression des anciennes pages uniquement apres validation
    des redirections, des donnees et des parcours.

## Garde-fous

- Une sauvegarde D1 et un plan de retour arriere avant chaque phase de donnees.
- Une PR coherente par phase, avec tests et description en francais.
- Un deploiement de preproduction avant production.
- Des drapeaux de fonctionnalite pour QR, paiement et restitution.
- Une periode de double lecture controlee quand un ancien et un nouveau modele
  doivent coexister.
- Aucune suppression de fichier historique dans les phases 1 a 8.

## Critere de passage en phase 2

Le depot est pret pour la phase 2 quand cet audit est fusionne, que la PR no 30
est integree ou prise en compte, et que le schema D1 distant a ete exporte. Le
premier changement de phase 2 doit rendre l'installation locale reproductible.
