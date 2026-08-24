import { access, readFile, readdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const web = resolve(root, 'sitepikala');
const errors = [];
const check = (condition, message) => { if (!condition) errors.push(message); };
const privatePages = ['dashboard.html','stations.html','station.html','scanner.html','trajets.html','trajet.html','profil.html','support.html','ticket.html','incidents.html','notifications.html','abonnement.html','admin.html','connexion.html','inscription.html','mot-de-passe-oublie.html','reinitialiser-mot-de-passe.html'];

for (const asset of ['manifest.webmanifest','sw.js','offline.html','robots.txt','sitemap.xml','_headers','icons/pikala-192.png','icons/pikala-512.png','icons/pikala-maskable-512.png']) await access(resolve(web, asset));
const manifest = JSON.parse(await readFile(resolve(web, 'manifest.webmanifest'), 'utf8'));
check(manifest.display === 'standalone', 'Manifest: display standalone absent.');
check(manifest.start_url?.startsWith('/'), 'Manifest: start_url invalide.');
check(manifest.icons?.some((icon) => icon.sizes === '192x192') && manifest.icons?.some((icon) => icon.sizes === '512x512'), 'Manifest: icônes 192/512 absentes.');

const serviceWorker = await readFile(resolve(web, 'sw.js'), 'utf8');
check(!serviceWorker.includes('return cached || refresh'), 'Service worker: les fichiers en ligne ne doivent pas rester bloqués sur un ancien cache.');
check(serviceWorker.includes('const response = await fetch(request)') && serviceWorker.includes('return cached || Response.error()'), 'Service worker: stratégie réseau prioritaire absente.');
for (const token of ["url.pathname.startsWith('/api/')", 'PRIVATE_PATHS.has(url.pathname)', "request.method !== 'GET'", 'request.mode === \'navigate\'', 'offline.html']) check(serviceWorker.includes(token), `Service worker: garde absente (${token}).`);
check(!/caches\.put\([^\n]*(?:api|profile|payment|station)/i.test(serviceWorker), 'Service worker: donnée critique mise en cache.');

for (const page of privatePages) {
  const html = await readFile(resolve(web, page), 'utf8');
  check(/name="robots" content="noindex(?:,nofollow)?"/.test(html), `${page}: noindex absent.`);
  check(/rel="manifest"/.test(html), `${page}: manifest absent.`);
}

for (const page of (await readdir(web)).filter((name) => name.endsWith('.html'))) {
  const html = await readFile(resolve(web, page), 'utf8');
  check(!html.includes('fonts.googleapis.com') && !html.includes('fonts.gstatic.com'), `${page}: police Google encore chargée.`);
}

const index = await readFile(resolve(web, 'index.html'), 'utf8');
for (const marker of ['rel="canonical"','property="og:title"','property="og:description"','property="og:image"','application/ld+json','rel="manifest"']) check(index.includes(marker), `Accueil: métadonnée absente (${marker}).`);

const worker = await readFile(resolve(root, 'src/worker.js'), 'utf8');
const observe = await readFile(resolve(root, 'src/observability.js'), 'utf8');
for (const event of ['auth.signup.success','auth.signup.failure','auth.login.success','auth.login.failure','ride.start','ride.end','payment.updated','api.error']) check((worker + observe).includes(event), `Observabilité: ${event} absent.`);
for (const event of ['incident.created','support.created','admin.action']) check((await readFile(resolve(root, 'src/operations/service.js'),'utf8') + await readFile(resolve(root, 'src/admin/service.js'),'utf8') + observe).includes(event), `Observabilité: ${event} absent.`);
check(observe.includes('SAFE_FIELDS') && !observe.includes("'password'") && !observe.includes("'token'"), 'Observabilité: allowlist sensible incorrecte.');

const jpegBytes = (await stat(resolve(web, 'logo.jpeg'))).size;
const webpBytes = await Promise.all(['multi.webp','oudaya.webp'].map(async (name) => (await stat(resolve(web,name))).size));
check(webpBytes.every((bytes) => bytes < 180 * 1024), 'Images: une image WebP dépasse 180 Ko.');
check(jpegBytes < 80 * 1024, 'Logo: ressource trop lourde.');

if (errors.length) { console.error(errors.map((error) => `- ${error}`).join('\n')); process.exit(1); }
console.log(`Durcissement valide: PWA installable, ${privatePages.length} pages privées non indexées, cache critique exclu et observabilité structurée.`);
