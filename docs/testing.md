# Strategie de tests Pikala V2

## Etat V1

Aucun test automatise n'est present. Les quatre fichiers JavaScript actifs ont
passe `node --check`, mais cela ne detecte pas les erreurs d'execution du
formulaire support ni les incoherences metier.

## Pyramide cible

- Tests unitaires : validation, i18n, calculs, transitions de statut et services.
- Tests d'integration Worker/D1 local : routes, sessions, contraintes et erreurs.
- Tests E2E navigateur : parcours publics, auth, carte, QR, abonnement, support
  et administration.
- Tests de concurrence : double scan, double demarrage, double restitution et
  webhooks de paiement repetes.

## Matrice critique

| Domaine | Cas minimum |
| --- | --- |
| Inscription | valide, email duplique, champs invalides, D1 indisponible |
| Connexion | valide, identifiants invalides, brute force, session expiree |
| Autorisation | anonyme, utilisateur, admin, acces a une ressource tierce |
| Stations | liste vide, station fermee, coordonnees absentes, fallback liste |
| Velos | disponible, reserve, en cours, maintenance, QR inconnu |
| Trajets | start, double start, concurrence, finish, double finish, incident |
| Abonnements | aucun plan, expire, actif, paiement absent ou refuse |
| Support | validation, creation, historique, reponse admin |
| i18n | cinq langues, cles manquantes, persistance, arabe RTL |
| Accessibilite | clavier, focus, labels, contraste, reduced motion |

## Viewports E2E

Tester au minimum 320, 375, 390, 430, 768, 1024, 1280 et 1440 pixels, avec
controle du scroll horizontal, des modales, de la navigation basse, des zones
sures mobiles et de la taille des cibles tactiles.

## Definition de validation d'une phase

- tests nouveaux et existants verts ;
- aucun message SQL/D1 expose ;
- verification locale avec D1 local ;
- smoke test sur staging ;
- capture desktop/mobile pour toute modification visuelle ;
- test du chemin heureux et d'au moins trois erreurs utilisateur realistes ;
- documentation et migration mises a jour.
