# Trajets réels Pikala V2

## Identifiants QR

Chaque vélo utilise `bikes.public_code`, protégé par un index unique. Les QR
acceptés contiennent soit ce code, soit `pikala://bike/<code>`, soit une URL
Pikala terminant par `/bike/<code>`. Les docks utilisent leur `public_code`
unique avec le même principe (`pikala://dock/<code>`).

Un QR n'est pas un secret. Toutes les autorisations et transitions d'état sont
revérifiées côté Worker.

## Invariants

- un utilisateur ne peut créer qu'un trajet actif ;
- un vélo ne peut appartenir qu'à un trajet actif ;
- tout nouveau trajet actif possède un vélo, une station et un dock de départ ;
- le départ libère le dock et passe le vélo en `in_use` ;
- la restitution occupe un dock disponible, clôt le trajet et rend le vélo
  disponible dans la même transaction D1 ;
- les routes détail, restitution et incident vérifient toujours le propriétaire.

## Migrations 0005 et 0006

Ces migrations ne modifient aucune ligne existante. Elles ajoutent des triggers qui
refusent les nouveaux états incohérents et un index de lecture pour le contrôle
des trajets actifs. La migration 0006 interdit aussi toute collision entre `code` et `public_code` de deux vélos. Aucun `DROP`, `DELETE` ou backfill n'est exécuté.

Avant production, exporter D1 et appliquer les migrations dans l'ordre. En cas
d'incident, suivre `migrations/ROLLBACK.md` et restaurer vers une base séparée.
