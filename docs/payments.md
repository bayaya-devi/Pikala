# Paiements et abonnements Pikala V2

## Règle principale

Un plan payant ne crée jamais directement un abonnement actif. Le checkout crée
un paiement `pending` ou `processing`. Seul un événement signé et vérifié du
provider peut passer le paiement à `paid` et activer l'abonnement. Cette règle
est aussi imposée par un trigger D1.

Les statuts exposés sont : `pending`, `processing`, `paid`, `failed`,
`cancelled` et `refunded`.

## Provider

`src/payments/provider.js` définit le contrat provider : disponibilité,
création de checkout et vérification de webhook. Sans `PAYMENT_PROVIDER`, le
Worker répond `PAYMENT_PROVIDER_UNAVAILABLE` et ne crée aucun paiement.

Le provider `test` est réservé au développement. Il nécessite simultanément :

- `PAYMENT_PROVIDER=test` ;
- `ENVIRONMENT=development` ;
- `PAYMENT_TEST_SECRET` défini.

Il ne confirme jamais un paiement automatiquement. Les tests envoient un
webhook HMAC signé pour faire évoluer le paiement.

## Intégration d'un provider réel

1. Ajouter une implémentation dans `src/payments/provider.js`.
2. Créer le checkout avec `public_reference` comme clé d'idempotence provider.
3. Ne jamais accepter un montant ou une devise venant du frontend.
4. Vérifier la signature sur le corps brut du webhook.
5. Retourner un identifiant d'événement provider stable pour bloquer les replays.
6. Mapper les événements uniquement vers les six statuts Pikala.
7. Définir les secrets avec `wrangler secret put`, jamais dans Git.
8. Tester paiement, échec, annulation, remboursement, replay et événement hors ordre.

## Déploiement

Sauvegarder D1, appliquer les migrations dans l'ordre, configurer les secrets du
provider puis déployer. Sans provider configuré, les offres restent visibles
mais le paiement est volontairement indisponible et aucun abonnement payant
n'est activé.
