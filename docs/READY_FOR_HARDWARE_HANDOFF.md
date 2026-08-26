# Passage au matériel

## Contrat logiciel disponible

Un constructeur peut être intégré sans reconstruire les trajets, l'administration ou D1. Il doit fournir un adapter conforme à `DeviceProvider` : `sendCommand`, `getDeviceStatus`, `verifyIncomingEvent`, `normalizeTelemetry` et `handleAcknowledgement`.

Le backend gère déjà `unlock`, `lock`, `ping`, `status`, `locate` et `reboot`, leurs transitions, délais, identifiants de corrélation et clés d'idempotence. Les événements entrants sont signés, horodatés, limités et protégés contre le rejeu. Les secrets device sont chiffrés avec `IOT_CREDENTIAL_KEK`, rotatifs et affichés une seule fois à la création.

## À fournir par le constructeur

| Élément | Exigence minimale | Validation pilote |
|---|---|---|
| Serrure vélo | identité unique, unlock/lock, accusé signé, état | ouverture et fermeture physiques confirmées |
| Dock | détection présence, verrouillage, événement signé | aucune double occupation, retour confirmé |
| Contrôleur station | connectivité, horloge fiable, retransmission | perte réseau et reprise testées |
| Connectivité | TLS, couverture, latence et SLA | tests terrain Rabat |
| Gestion secrets | provisionnement protégé et rotation | révocation et anti-replay testés |

## Configuration de production

1. Développer l'adapter du fournisseur dans `src/iot/provider.js` ou un module dédié.
2. Configurer `IOT_MODE=production`, `DEVICE_PROVIDER` et `IOT_CREDENTIAL_KEK` comme secrets Cloudflare.
3. Provisionner uniquement des devices physiques identifiés.
4. Tester timeout, offline, mauvaise signature, replay, double accusé et reprise réseau.
5. Ouvrir un pilote fermé avant tout client commercial.

Le mode `test` reste réservé au développement et ne constitue jamais une preuve de matériel réel.
