import { access, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dictionaries, RTL_LOCALES, SUPPORTED_LOCALES } from '../sitepikala/assets/js/i18n/index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const activePages = ['index.html', 'connexion.html', 'inscription.html', 'mot-de-passe-oublie.html', 'reinitialiser-mot-de-passe.html', 'dashboard.html', 'stations.html', 'station.html', 'trajets.html', 'trajet.html', 'scanner.html', 'profil.html', 'support.html', 'abonnement.html', 'admin.html'];
const errors = [];

function check(condition, message) {
  if (!condition) errors.push(message);
}

check(JSON.stringify(SUPPORTED_LOCALES) === JSON.stringify(['fr', 'en', 'es', 'pt', 'ar']), 'Les cinq langues attendues ne sont pas déclarées.');
check(RTL_LOCALES.includes('ar'), "L'arabe n'est pas déclaré RTL.");

const referenceKeys = Object.keys(dictionaries.fr).sort();
for (const locale of SUPPORTED_LOCALES) {
  const keys = Object.keys(dictionaries[locale]).sort();
  const missing = referenceKeys.filter((key) => !keys.includes(key));
  check(missing.length === 0, `${locale}: clés absentes: ${missing.join(', ')}`);
}

for (const page of activePages) {
  const html = await readFile(resolve(root, 'sitepikala', page), 'utf8');
  check(html.includes('assets/css/foundation.css'), `${page}: design system absent.`);
  const localScript = html.match(/<script[^>]+src="(app|auth|user-space|admin)\.js"[^>]*>/)?.[0];
  check(Boolean(localScript?.includes('type="module"')), `${page}: script principal non modulaire.`);
  for (const match of html.matchAll(/data-i18n="([^"]+)"/g)) {
    check(referenceKeys.includes(match[1]), `${page}: clé i18n inconnue ${match[1]}.`);
  }
  for (const match of html.matchAll(/data-i18n-attr="([^"]+)"/g)) {
    for (const declaration of match[1].split(',')) {
      const key = declaration.split(':')[1]?.trim();
      check(referenceKeys.includes(key), `${page}: clé d'attribut inconnue ${key}.`);
    }
  }
}

for (const asset of ['tokens.css', 'base.css', 'components.css', 'layouts.css', 'compatibility.css']) {
  await access(resolve(root, 'sitepikala/assets/css', asset));
}
const layouts = await readFile(resolve(root, 'sitepikala/assets/css/layouts.css'), 'utf8');
const components = await readFile(resolve(root, 'sitepikala/assets/css/components.css'), 'utf8');
check(layouts.includes('[dir="rtl"]'), 'Les adaptations RTL du layout sont absentes.');
for (const component of ['pk-button', 'pk-input', 'pk-card', 'pk-badge', 'pk-table', 'pk-modal', 'pk-drawer', 'pk-sheet', 'pk-tooltip', 'pk-toast', 'pk-loader', 'pk-skeleton', 'pk-state']) {
  check(components.includes(`.${component}`), `Composant absent: ${component}.`);
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Fondations valides: ${activePages.length} pages, ${SUPPORTED_LOCALES.length} langues, ${referenceKeys.length} clés.`);
}
