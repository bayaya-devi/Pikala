import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const base = process.argv[2] || 'http://127.0.0.1:8796';
const debug = process.env.CHROME_DEBUG || 'http://127.0.0.1:9334';
const origin = new URL(base).origin;
const stamp = Date.now();
const email = `visual-${stamp}@example.test`;
const password = 'Pikala visual browser secure password!';
let commandId = 0;

async function request(path, method = 'GET', body) {
  const headers = { accept: 'application/json' };
  if (body) { headers['content-type'] = 'application/json'; headers['x-pikala-request'] = 'web'; headers.origin = origin; }
  const response = await fetch(new URL(path, base), { method, headers, body: body ? JSON.stringify(body) : undefined, redirect: 'manual' });
  return { response, data: (response.headers.get('content-type') || '').includes('json') ? await response.json() : null };
}

async function openPage(url) {
  const response = await fetch(`${debug}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
  if (!response.ok) throw new Error(`Chrome DevTools ${response.status}`);
  const target = await response.json(); const socket = new WebSocket(target.webSocketDebuggerUrl); const pending = new Map();
  await new Promise((resolveOpen, reject) => { socket.addEventListener('open', resolveOpen, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  socket.addEventListener('message', (event) => { const message = JSON.parse(event.data); if (!message.id || !pending.has(message.id)) return; const pendingCommand = pending.get(message.id); pending.delete(message.id); message.error ? pendingCommand.reject(new Error(message.error.message)) : pendingCommand.resolve(message.result); });
  const send = (method, params = {}) => new Promise((resolveCommand, reject) => { const id = ++commandId; pending.set(id, { resolve: resolveCommand, reject }); socket.send(JSON.stringify({ id, method, params })); });
  return { target, socket, send };
}

let signup = await request('/api/signup', 'POST', { firstName: 'Visuel', lastName: 'Pikala', email, password, locale: 'fr' });
if (signup.response.status !== 202 || !signup.data.verificationUrl) throw new Error(`Inscription visuelle impossible: ${signup.response.status}`);
await fetch(signup.data.verificationUrl, { redirect: 'manual' });

const loginResponse = await fetch(new URL('/api/login', base), { method: 'POST', headers: { 'content-type': 'application/json', 'x-pikala-request': 'web', origin }, body: JSON.stringify({ email, password }) });
if (loginResponse.status !== 200) throw new Error(`Connexion navigateur impossible: ${loginResponse.status}`);
const setCookie = typeof loginResponse.headers.getSetCookie === 'function' ? loginResponse.headers.getSetCookie() : [loginResponse.headers.get('set-cookie')];
const sessionPair = setCookie.map((value) => value?.split(';')[0]).find((value) => value?.startsWith('__Host-pikala_session=') && value.length > '__Host-pikala_session='.length);
const sessionValue = sessionPair?.slice('__Host-pikala_session='.length);
if (!sessionValue) throw new Error('Cookie de session navigateur absent.');
let visualRideId = null;
if (['ride', 'summary'].includes(process.env.VISUAL_PAGE)) {
  const authHeaders = { 'content-type': 'application/json', 'x-pikala-request': 'web', origin, cookie: sessionPair };
  const subscription = await fetch(new URL('/api/subscriptions', base), { method: 'POST', headers: authHeaders, body: JSON.stringify({ plan: 'dev-monthly' }) });
  if (subscription.status !== 201) throw new Error(`Abonnement visuel impossible: ${subscription.status}`);
  const started = await fetch(new URL('/api/rides', base), { method: 'POST', headers: authHeaders, body: JSON.stringify({ qrPayload: 'dev-bike-001' }) });
  const startedData = await started.json();
  if (started.status !== 201) throw new Error(`Trajet visuel impossible: ${started.status} ${startedData.code || ''}`);
  visualRideId = startedData.ride.id;
  if (process.env.VISUAL_PAGE === 'summary') {
    const returned = await fetch(new URL('/api/rides/' + visualRideId + '/return', base), { method: 'POST', headers: authHeaders, body: JSON.stringify({ dockCode: 'dev-dock-oudayas-04' }) });
    if (returned.status !== 200) throw new Error('Résumé visuel impossible: ' + returned.status);
  }
}
const loginPage = await openPage(`${base}/connexion.html`); await loginPage.send('Network.enable');
const cookieResult = await loginPage.send('Network.setCookie', { name: '__Host-pikala_session', value: sessionValue, url: `${base}/`, path: '/', secure: true, httpOnly: true, sameSite: 'Lax' });
if (cookieResult.success === false) throw new Error('Cookie de session Chrome refusé.');
loginPage.socket.close(); await fetch(`${debug}/json/close/${loginPage.target.id}`);

let pages = [
  ['dashboard', '/dashboard.html'], ['map', '/stations.html'], ['station', '/station.html?id=dev-station-oudayas'],
  ['rides', '/trajets.html'], ['scanner', '/scanner.html'], ['profile', '/profil.html']
];
if (visualRideId) pages.push([process.env.VISUAL_PAGE === 'summary' ? 'summary' : 'ride', `/trajet.html?id=${visualRideId}`]);
let viewports = [{ name: 'mobile', width: 390, height: 844 }, { name: 'desktop', width: 1440, height: 900 }];
let locales = ['fr', 'en', 'es', 'pt', 'ar'];
if (process.env.VISUAL_PAGE) pages = pages.filter(([name]) => name === process.env.VISUAL_PAGE);
if (process.env.VISUAL_VIEWPORT) viewports = viewports.filter(({ name }) => name === process.env.VISUAL_VIEWPORT);
if (process.env.VISUAL_LOCALE) locales = locales.filter((locale) => locale === process.env.VISUAL_LOCALE);
const failures = []; const output = resolve(import.meta.dirname, '../tmp/user-space-screenshots'); await mkdir(output, { recursive: true });

for (const viewport of viewports) {
  for (const locale of locales) {
    for (const [name, path] of pages) {
      const separator = path.includes('?') ? '&' : '?'; const page = await openPage(`${base}${path}${separator}lang=${locale}`);
      await page.send('Page.enable'); await page.send('Runtime.enable');
      await page.send('Emulation.setDeviceMetricsOverride', { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: viewport.name === 'mobile' });
      let result; let lastResult;
      for (let attempt = 0; attempt < 24 && !result; attempt += 1) {
        await new Promise((resolveWait) => setTimeout(resolveWait, name === 'map' ? 550 : 350));
        try { const candidate = (await page.send('Runtime.evaluate', { returnByValue: true, expression: `(() => ({
        lang: document.documentElement.lang, dir: document.documentElement.dir,
        overflow: document.documentElement.scrollWidth-document.documentElement.clientWidth,
        heading: document.querySelector('h1')?.textContent.trim(),
        untranslated: [...document.querySelectorAll('[data-i18n]')].filter(el=>el.textContent.trim()===el.dataset.i18n).length,
        sidebar: document.querySelector('.user-sidebar') ? getComputedStyle(document.querySelector('.user-sidebar')).display : 'none',
        bottom: document.querySelector('.user-bottom-nav') ? getComputedStyle(document.querySelector('.user-bottom-nav')).display : 'none',
        skeletons: document.querySelectorAll('.skeleton-block,.skeleton-row').length,
        mapReady: ${name === 'map' ? "Boolean(document.querySelector('.leaflet-container') && document.querySelector('.bike-bubble'))" : 'true'}
      }))()` })).result.value; lastResult = candidate;
          const navigationReady = viewport.name === 'mobile' ? candidate?.bottom !== 'none' : candidate?.sidebar !== 'none';
          if (candidate?.lang === locale && candidate?.heading && navigationReady && candidate.skeletons === 0 && candidate.mapReady) result = candidate;
        } catch {}
      }
      result ||= lastResult;
      if (!result) { failures.push(`${viewport.name}/${locale}/${name}: page non chargée`); page.socket.close(); await fetch(`${debug}/json/close/${page.target.id}`); continue; }
      const label = `${viewport.name}/${locale}/${name}`;
      if (result.lang !== locale || result.dir !== (locale === 'ar' ? 'rtl' : 'ltr')) failures.push(`${label}: langue ou direction incorrecte`);
      if (!result.heading || result.untranslated) failures.push(`${label}: traduction ou titre incomplet`);
      if (result.overflow > 1) failures.push(`${label}: débordement horizontal ${result.overflow}px`);
      if (viewport.name === 'mobile' ? result.bottom === 'none' : result.sidebar === 'none') failures.push(`${label}: navigation responsive absente`);
      if (result.skeletons) failures.push(`${label}: chargement non terminé`);
      if (!result.mapReady) failures.push(`${label}: carte ou bulles absentes`);
      if ((viewport.name === 'mobile' && locale === 'ar' && name === 'map') || (viewport.name === 'desktop' && locale === 'fr' && name === 'dashboard')) {
        const capture = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
        await writeFile(resolve(output, `${viewport.name}-${locale}-${name}.png`), Buffer.from(capture.data, 'base64'));
      }
      page.socket.close(); await fetch(`${debug}/json/close/${page.target.id}`);
    }
  }
}

if (failures.length) { console.error(failures.map((failure) => `- ${failure}`).join('\n')); process.exit(1); }
console.log(`Interface utilisateur validée: ${viewports.length} formats × ${locales.length} langues × ${pages.length} pages.`);
