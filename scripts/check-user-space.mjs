import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import userCopy from '../sitepikala/assets/js/i18n/user-space/copy.js';
import realRideCopy from '../sitepikala/assets/js/i18n/real-rides/copy.js';

const root = resolve(import.meta.dirname, '..');
const errors = [];
const check = (condition, message) => { if (!condition) errors.push(message); };
const pages = ['dashboard.html', 'stations.html', 'station.html', 'trajets.html', 'trajet.html', 'scanner.html', 'profil.html', 'support.html', 'abonnement.html'];
const expectedDestinations = ['dashboard', 'stations', 'scanner', 'rides', 'profile'];

for (const page of pages) {
  const html = await readFile(resolve(root, 'sitepikala', page), 'utf8');
  check(html.includes('data-user-shell'), `${page}: coque utilisateur absente.`);
  check(html.includes('assets/vendor/lucide.min.js'), `${page}: icônes locales absentes.`);
  check(html.includes('user-space.js'), `${page}: contrôleur utilisateur absent.`);
}

const shell = await readFile(resolve(root, 'sitepikala/assets/js/user-shell.js'), 'utf8');
for (const destination of expectedDestinations) check(shell.includes(`['${destination}'`), `Navigation absente: ${destination}.`);
check(!shell.includes('support.html\', \'message-circle'), 'Le support remplace encore un onglet principal.');

const dashboard = await readFile(resolve(root, 'sitepikala/dashboard.html'), 'utf8');
check(!/Kasbah des Oudayas|Tour Hassan|18 min|24 min/.test(dashboard), 'Le dashboard contient encore des trajets simulés.');

const controller = await readFile(resolve(root, 'sitepikala/user-space.js'), 'utf8');
const rideController = await readFile(resolve(root, 'sitepikala/assets/js/real-rides.js'), 'utf8');
for (const endpoint of ['/api/dashboard', '/api/user/stations', '/api/rides', '/api/stations/']) check(controller.includes(endpoint), `API frontend absente: ${endpoint}.`);
check(rideController.includes('JSON.stringify({ qrPayload:'), 'Le scanner ne transmet pas le contenu QR.');
check(rideController.includes('BrowserQRCodeReader') && rideController.includes('controls.stop()'), 'Le vrai scanner ZXing ou son arrêt propre est absent.');
check(!rideController.includes('BarcodeDetector'), "L'ancien scanner BarcodeDetector est encore présent.");
for (const endpoint of ['/api/rides/active', '/return', '/incidents']) check(rideController.includes(endpoint), `Flux trajet frontend absent: ${endpoint}.`);
check(!controller.includes("body: '{}'" ) || controller.includes('/api/logout'), 'Un trajet vide semble encore possible.');

const worker = await readFile(resolve(root, 'src/worker.js'), 'utf8');
for (const endpoint of ['/api/dashboard', '/api/user/stations', '/api/rides', "/api/stations/"]) check(worker.includes(endpoint), `Route Worker absente: ${endpoint}.`);
for (const code of ['QR_INVALID', 'QR_UNKNOWN', 'SUBSCRIPTION_REQUIRED', 'RIDE_ALREADY_ACTIVE', 'BIKE_MAINTENANCE', 'BIKE_UNAVAILABLE', 'DOCK_UNKNOWN', 'DOCK_UNAVAILABLE', 'RIDE_ALREADY_ENDED']) check(worker.includes(code), `Erreur métier absente: ${code}.`);
check(!worker.includes("ORDER BY id LIMIT 1').first();\n  const result = await DB.prepare(\"INSERT INTO rides"), 'Ancienne simulation de trajet encore présente.');

const reference = [...Object.keys(userCopy.fr), ...Object.keys(realRideCopy.fr)].sort();
for (const locale of ['fr', 'en', 'es', 'pt', 'ar']) {
  const keys = [...Object.keys(userCopy[locale]), ...Object.keys(realRideCopy[locale])].sort();
  check(reference.every((key) => keys.includes(key)), `${locale}: traduction utilisateur incomplète.`);
}

const css = await readFile(resolve(root, 'sitepikala/user-space.css'), 'utf8');
check(css.includes('[dir=rtl]'), 'Adaptations RTL utilisateur absentes.');
check(css.includes('@media(max-width:720px)'), 'Responsive mobile utilisateur absent.');
check(css.includes('.user-bottom-nav'), 'Navigation mobile absente.');

for (const removed of ['Pageuser.html', 'Pageuseren.html']) {
  try { await access(resolve(root, 'sitepikala', removed)); errors.push(`${removed}: ancienne interface encore présente.`); } catch {}
}

if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`Espace utilisateur valide: ${pages.length} pages, 5 destinations, 5 langues.`);
