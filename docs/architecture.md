# Architecture Pikala V2

## Vue generale

Pikala V2 est une application web multi-page servie par Cloudflare Workers Static Assets. Le Worker est l'unique frontiere de confiance : il protege les pages privees, valide les entrees, applique le RBAC, execute les transactions D1 et retourne des erreurs JSON stables.

## Frontend

- design system central dans sitepikala/assets/css ;
- i18n centralisee et persistante pour fr, en, ar, es et pt ;
- dir=rtl et adaptations directionnelles pour l'arabe ;
- layouts public, authentification, utilisateur et admin ;
- composants DOM construits avec textContent pour les donnees externes ;
- Leaflet, Lucide, ZXing et QR servis localement et charges seulement sur les ecrans utiles ;
- service worker limite aux ressources statiques non sensibles.

Les pages V1 dupliquees par langue ont ete retirees. Les URLs actives utilisent une page par fonction et le parametre de langue commun.

## Backend

src/worker.js orchestre les routes publiques, l'authentification, les abonnements et les trajets. Les domaines complexes sont separes dans src/admin, src/operations et src/payments. Toutes les requetes D1 utilisent bind, sauf des fragments SQL constants issus d'allowlists internes.

Les garde-fous principaux sont : CSRF par origine et en-tete applicatif, cookie __Host Secure/HttpOnly/SameSite, sessions stockees et revocables, ownership dans les requetes, requireRole pour admin, validations de taille/type/statut et transactions D1 pour les changements concurrents.

## Donnees

Le schema est gere uniquement par les migrations 0001 a 0011. Les migrations sont additives et preservent les colonnes historiques necessaires. Les contraintes et index empechent notamment deux trajets actifs par utilisateur ou par velo, plusieurs abonnements actifs et plusieurs maintenances ouvertes incompatibles.

## PWA et cache

Le manifest, les icones et le service worker rendent l'application installable. Le cache exclut /api, les pages privees, les sessions, paiements, profils et disponibilites critiques. Une navigation hors ligne affiche une page explicite sans simuler la reussite d'une action.

## Observabilite

Les evenements auth, trajets, paiements, incidents, support, admin et erreurs API sont journalises en JSON avec requestId. L'allowlist de champs interdit mots de passe, secrets et jetons. Les audit logs D1 conservent les actions administratives sensibles et des metadonnees limitees.
