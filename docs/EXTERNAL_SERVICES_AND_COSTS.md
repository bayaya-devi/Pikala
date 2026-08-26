# Services externes et coûts

| Service | Fonction | Déjà implémenté | Reste à faire | Obligatoire | Gratuit | Limite gratuite | Estimation | Alternative | Quand payer |
|---|---|---|---|---|---|---|---|---|---|
| Cloudflare Workers | API et site | Oui | Exploitation et alertes | Oui | Oui | Selon offre Cloudflare | Variable selon trafic | Hébergement Node | Au-delà du quota gratuit |
| Cloudflare D1 | Base relationnelle | Oui | Sauvegarde et politique de rétention | Oui | Oui | Selon offre Cloudflare | Variable selon volume | PostgreSQL managé | Quand données et requêtes augmentent |
| Domaine | Adresse publique | Partiel | Acheter et relier un domaine final | Oui | Non | Aucune | Annuel | Sous-domaine Workers | Avant lancement commercial |
| Email transactionnel | Vérification et messages | Préparé | Configurer un fournisseur et DNS | Oui | Souvent | Selon fournisseur | Variable | Resend, Brevo, Mailgun | Avant ouverture publique des comptes |
| Paiement | Abonnements et remboursements | Architecture prête | Choisir, contractualiser et configurer un PSP | Oui pour vente | Non | Sandbox seulement | Commission par paiement | CMI, Stripe si éligible, PSP local | Avant encaissement réel |
| Cartographie | Fond de carte et itinéraires | OpenStreetMap affiché | Politique de tuiles et géocodage production | Oui | Oui avec limites | Usage raisonnable | Variable | Mapbox, Google Maps | Quand trafic carte important |
| SMS | Alertes critiques | Non | Choisir un fournisseur si nécessaire | Non | Rarement | Essai limité | Par message | Email, notifications PWA | Selon besoin opérationnel |
| IoT | Serrures, docks et télémétrie | Noyau et adapter test implémentés | Choisir constructeur, développer l'adapter et provisionner les certificats | Oui pour vélos connectés | Non | N/A | Dépend matériel et connectivité | API constructeur | Avant pilote matériel |
| Monitoring | Logs et alertes | Logs Workers activés | Alerting, rétention et tableaux d'exploitation | Recommandé | Souvent | Selon offre | Variable | Sentry, Better Stack | Avant pilote public |
| Stockage | Pièces jointes et preuves | Non | Choisir stockage privé et règles d'accès | Recommandé | Souvent | Selon volume | Variable | R2, S3 | Avant ajout de photos/factures |

Les prix et limites évoluent. Les vérifier sur les pages tarifaires des fournisseurs avant tout engagement.
