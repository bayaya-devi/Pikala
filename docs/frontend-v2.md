# Fondations frontend Pikala V2

## Objectif

La phase 2 introduit une couche frontend commune sans changer le mode de déploiement Cloudflare Static Assets. Les pages V1 restent accessibles pendant la migration, mais les pages actives utilisent désormais les mêmes tokens, composants, layouts et traductions.

## Arborescence

```text
sitepikala/
  assets/
    css/
      foundation.css       point d'entrée CSS
      tokens.css           couleurs, typo, espacements, rayons, ombres, z-index
      base.css             normalisation, focus, accessibilité, reduced motion
      components.css       composants réutilisables
      layouts.css          layouts public, utilisateur, admin et RTL
      compatibility.css    pont temporaire avec les CSS V1
    js/
      i18n/
        index.js           détection, persistance, traduction et direction
        page-copy.js       textes fonctionnels communs
        locales/           fr, en, es, pt, ar
      ui/components.js     toast, dialog, layers, tooltips, reveals
      layouts.js           initialisation des trois layouts et navigation partagée
scripts/
  check-foundations.mjs    contrôle des pages, clés et composants
  test-server.mjs          serveur local avec API factice pour tests visuels
```

## Design system

Les tokens utilisent le préfixe `--pk-`. Les anciens noms (`--green`, `--ink`, etc.) restent des alias temporaires afin de ne pas casser les feuilles V1.

Les composants disponibles sont : boutons, boutons icône, champs, select, textarea, checkbox, cards, badges, tables responsives, modales, drawers, bottom sheets, tooltips, toasts, loaders, skeletons, empty states et error states.

Les layouts disponibles sont :

- `.pk-public-layout` avec header et footer publics ;
- `.pk-user-layout` avec page applicative et navigation basse ;
- `.pk-admin-layout` avec largeur adaptée aux données d'administration.

Les rayons des cards sont limités à 8 px. Les focus clavier, zones tactiles de 44 px et `prefers-reduced-motion` sont pris en charge.

## I18n

Le moteur `assets/js/i18n/index.js` est l'unique point d'entrée pour le français, l'anglais, l'espagnol, le portugais et l'arabe.

Usage HTML :

```html
<h1 data-i18n="dashboardHeading">Prêt à rouler.</h1>
<input data-i18n-attr="placeholder:supportSubject">
```

Usage JavaScript :

```js
import { t } from './assets/js/i18n/index.js';

element.textContent = t('helloName', { name: user.first_name });
```

La priorité de détection est : paramètre `?lang=`, choix persisté, langue du navigateur, français. Un événement `pikala:localechange` permet aux données chargées par API d'être recalculées après un changement de langue.

## Arabe RTL

L'arabe active `lang="ar"`, `dir="rtl"` et la classe `is-rtl`. Les layouts utilisent les propriétés logiques CSS (`inline`, `block`, `inset-inline`) pour adapter les formulaires, menus, modales, drawers et navigations. Le hero public inverse ses colonnes sur desktop. Les cartes Leaflet restent en LTR, tandis que leur contenu textuel suit le RTL.

## Compatibilité V1

Les fichiers `styles.css`, `auth.css` et `user-space.css` sont encore chargés pour les styles spécifiques aux pages. `foundation.css` est chargé après eux et devient la source d'autorité pour les primitives communes. `compatibility.css` contient uniquement les ajustements nécessaires pendant cette transition.

Les pages historiques dupliquées (`*en.html`, `pikala-homepage*`, `Pageuser*`, `abonement*`) ne sont pas migrées. Elles seront supprimées après redirection et validation des routes pendant une phase ultérieure. La splash page et les textes juridiques restent temporairement compatibles V1.

## Vérification

Commande principale :

```powershell
npm run test:foundation
```

Le contrôle vérifie les dix pages actives, les cinq langues, la parité des 220 clés, les scripts ES modules, les attributs i18n, les feuilles CSS et les composants requis.

Tests visuels réalisés :

- accueil français, mobile 390 x 844 ;
- dashboard anglais, tablette 768 x 1024 ;
- accueil arabe RTL, desktop 1440 x 900 ;
- support arabe RTL, mobile 390 x 844 ;
- changement français, espagnol et arabe ;
- persistance de l'espagnol après rechargement ;
- absence de débordement horizontal à 390 px.
