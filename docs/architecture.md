# Architecture cible Pikala V2

## Principes

- Un seul frontend source, sans page dupliquee par langue.
- Une API versionnee dont les routes sont minces.
- Toute regle critique validee cote Worker.
- D1 modifie uniquement par migrations versionnees.
- Donnees reelles ou etat vide explicite, jamais de faux succes.
- Migration progressive avec compatibilite des URLs V1.

## Structure cible

```text
src/
  client/
    pages/
      public/
      auth/
      user/
      admin/
    components/
    styles/
    i18n/
      fr.json
      en.json
      es.json
      pt.json
      ar.json
    services/
      api.ts
      auth.ts
      geolocation.ts
      scanner.ts
    state/
    utils/
    main.ts
  worker/
    index.ts
    router.ts
    middleware/
      auth.ts
      authorization.ts
      security.ts
      errors.ts
      rate-limit.ts
    routes/
      auth.ts
      stations.ts
      bikes.ts
      rides.ts
      plans.ts
      subscriptions.ts
      payments.ts
      support.ts
      notifications.ts
      admin.ts
    services/
      auth-service.ts
      ride-service.ts
      subscription-service.ts
      support-service.ts
    repositories/
    validation/
    observability/
migrations/
tests/
  unit/
  integration/
  e2e/
docs/
public/
```

## Frontend

La cible recommandee est Vite + TypeScript avec des modules de pages et des
composants reutilisables. Cette evolution reste proche de la V1 et evite
d'introduire immediatement un framework lourd. Le choix pourra etre revalue
apres un prototype du dashboard V2.

Le frontend doit fournir :

- un shell public, un shell utilisateur et un shell admin coherents ;
- une source i18n unique avec persistance locale puis synchronisation du profil ;
- `dir="rtl"` applique a toute l'application en arabe ;
- chargement conditionnel de Leaflet et du scanner ;
- etats loading, vide, erreur, hors ligne et session expiree ;
- routes privees cote UX, sans confondre cette protection avec l'autorisation API ;
- design tokens communs et composants accessibles.

## Backend

Le Worker devient un adaptateur HTTP : il parse la requete, applique les
middlewares, valide un DTO et appelle un service. Les services portent les
regles metier et les repositories isolent D1.

Toutes les reponses API suivent un format stable :

```json
{
  "data": {},
  "error": null,
  "meta": { "requestId": "..." }
}
```

Les erreurs exposees utilisent un code public et un message localisable. Les
details D1 sont uniquement journalises cote Cloudflare avec un identifiant de
correlation.

## Routes cibles principales

```text
POST   /api/v2/auth/signup
POST   /api/v2/auth/login
POST   /api/v2/auth/logout
GET    /api/v2/auth/session
POST   /api/v2/auth/password/forgot
POST   /api/v2/auth/password/reset
GET    /api/v2/stations
GET    /api/v2/stations/:code
GET    /api/v2/bikes/:code
POST   /api/v2/rides/start
POST   /api/v2/rides/:id/finish
GET    /api/v2/rides
GET    /api/v2/plans
POST   /api/v2/subscriptions/checkout
GET    /api/v2/support/tickets
POST   /api/v2/support/tickets
/api/v2/admin/*
```

Les routes V1 restent disponibles pendant la transition et deleguent
progressivement aux nouveaux services.

## Demarrage atomique d'un trajet

Le service `ride-service.ts` doit verifier dans une seule operation coherente :

1. session et statut de l'utilisateur ;
2. abonnement donnant droit a rouler ;
3. QR et velo exacts ;
4. station/dock et disponibilite ;
5. absence de trajet actif de l'utilisateur ;
6. absence d'utilisation concurrente du velo ;
7. creation du trajet et passage du velo a `in_use` ;
8. journalisation `ride.start`.

Des contraintes uniques partielles ou une table de verrous metier doivent
completer la transaction pour resister aux requetes concurrentes.

## i18n

Les cinq dictionnaires ont les memes cles et sont controles au build. L'ordre
de resolution est : parametre explicite, locale du profil, choix persiste,
langue du navigateur, francais. La detection IP ne doit etre qu'un indice et ne
doit jamais remplacer le choix de l'utilisateur.

## Observabilite

Chaque log est structure : `event`, `requestId`, `userId` si disponible,
`status`, `durationMs` et contexte non sensible. Les evenements prioritaires
sont l'authentification, les trajets, les paiements, les incidents, le support,
les actions admin et les erreurs API.
