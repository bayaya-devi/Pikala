import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const base = process.argv[2] || 'http://127.0.0.1:8831';
const debug = process.env.CHROME_DEBUG || 'http://127.0.0.1:9335';
const origin = new URL(base).origin;
const views = ['dashboard','users','employees','stations','docks','bikes','rides','inspections','missions','rebalancing','plans','subscriptions','payments','incidents','maintenance','support','notifications','alerts','automations','devices','entitlements','overrides','settings','audit','system'];
const locales = ['fr','en','es','pt','ar'];
const viewports = [{ name:'desktop', width:1440, height:900 }, { name:'tablet', width:800, height:900 }];
const output = resolve(import.meta.dirname, '../tmp/admin-screenshots');
let commandId = 0;

async function openPage(url) {
  const response = await fetch(`${debug}/json/new?${encodeURIComponent(url)}`, { method:'PUT' });
  if (!response.ok) throw new Error(`Chrome DevTools ${response.status}`);
  const target = await response.json();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map();
  await new Promise((resolveOpen, reject) => {
    socket.addEventListener('open', resolveOpen, { once:true });
    socket.addEventListener('error', reject, { once:true });
  });
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const operation = pending.get(message.id); pending.delete(message.id);
    message.error ? operation.reject(new Error(message.error.message)) : operation.resolve(message.result);
  });
  const send = (method, params = {}) => new Promise((resolveCommand, reject) => {
    const id = ++commandId; pending.set(id, { resolve:resolveCommand, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  return { target, socket, send };
}

const login = await fetch(new URL('/api/login', base), {
  method:'POST',
  headers:{ 'content-type':'application/json', 'x-pikala-request':'web', origin },
  body:JSON.stringify({ email:'rbac-super@example.test', password:'Pikala admin phase nine password!' }),
});
if (login.status !== 200) throw new Error(`Connexion admin navigateur impossible: ${login.status}`);
const cookies = typeof login.headers.getSetCookie === 'function' ? login.headers.getSetCookie() : [login.headers.get('set-cookie')];
const cookieHeader = cookies.filter(Boolean).join(',');
const sessionValue = cookieHeader.match(/(?:^|[,;]\s*)__Host-pikala_session=([^;,]+)/)?.[1];
if (!sessionValue) throw new Error('Cookie admin navigateur absent.');

const bootstrap = await openPage(`${base}/connexion.html`);
await bootstrap.send('Network.enable');
const cookieResult = await bootstrap.send('Network.setCookie', {
  name:'__Host-pikala_session', value:sessionValue, url:`${base}/`, path:'/', secure:true, httpOnly:true, sameSite:'Lax',
});
if (cookieResult.success === false) throw new Error('Cookie admin refusé par Chrome.');
bootstrap.socket.close(); await fetch(`${debug}/json/close/${bootstrap.target.id}`);

await mkdir(output, { recursive:true });
const failures = [];
const cases = [
  ...views.map((view) => ({ viewport:viewports[0], locale:'fr', view })),
  ...views.map((view) => ({ viewport:viewports[1], locale:'ar', view })),
  ...viewports.flatMap((viewport) => locales.map((locale) => ({ viewport, locale, view:'dashboard' }))),
].filter((item, index, all) => all.findIndex((candidate) => candidate.viewport.name === item.viewport.name && candidate.locale === item.locale && candidate.view === item.view) === index);
for (const { viewport, locale, view } of cases) {
      const page = await openPage('about:blank');
      await page.send('Page.enable'); await page.send('Runtime.enable');
      await page.send('Emulation.setDeviceMetricsOverride', {
        width:viewport.width, height:viewport.height, deviceScaleFactor:1, mobile:false,
      });
      await page.send('Page.navigate', { url:`${base}/admin.html?view=${view}&lang=${locale}` });
      let result;
      for (let attempt = 0; attempt < 60; attempt += 1) {
        await new Promise((resolveWait) => setTimeout(resolveWait, 180));
        result = (await page.send('Runtime.evaluate', { returnByValue:true, expression:`(() => ({
          path: location.pathname,
          lang: document.documentElement.lang,
          dir: document.documentElement.dir,
          busy: document.querySelector('[data-admin-view]')?.getAttribute('aria-busy'),
          heading: document.querySelector('[data-admin-heading]')?.textContent.trim(),
          error: document.querySelector('.admin-state')?.textContent.trim() || '',
          navCount: document.querySelectorAll('[data-admin-nav] button').length,
          active: document.querySelector('[data-admin-nav] button.is-active')?.dataset.view,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          menuDisplay: getComputedStyle(document.querySelector('[data-admin-menu]')).display,
          sidebarTransform: getComputedStyle(document.querySelector('[data-admin-sidebar]')).transform,
          untranslated: [...document.querySelectorAll('[data-i18n]')].filter((node) => node.textContent.trim() === node.dataset.i18n).length
        }))()` })).result.value;
        if (result?.busy === 'false' || result?.error) break;
      }
      const label = `${viewport.name}/${locale}/${view}`;
      if (result?.path !== '/admin.html') failures.push(`${label}: redirection inattendue vers ${result?.path}`);
      if (result?.lang !== locale || result?.dir !== (locale === 'ar' ? 'rtl' : 'ltr')) failures.push(`${label}: langue ou direction incorrecte`);
      if (result?.busy !== 'false' || result?.error) failures.push(`${label}: vue non chargée ${result?.error || ''}`);
      if (!result?.heading || result.navCount !== 25 || result.active !== view) failures.push(`${label}: navigation ou titre incomplet`);
      if (result?.overflow > 1) failures.push(`${label}: débordement horizontal ${result.overflow}px`);
      if (result?.untranslated) failures.push(`${label}: ${result.untranslated} traduction(s) brute(s)`);
      if (viewport.name === 'desktop' && result?.menuDisplay !== 'none') failures.push(`${label}: bouton menu desktop visible`);
      if (viewport.name === 'tablet' && result?.menuDisplay === 'none') failures.push(`${label}: bouton menu tablette absent`);
      if ((viewport.name === 'desktop' && locale === 'fr' && view === 'dashboard') || (viewport.name === 'tablet' && locale === 'ar' && view === 'stations')) {
        const capture = await page.send('Page.captureScreenshot', { format:'png', captureBeyondViewport:false });
        await writeFile(resolve(output, `${viewport.name}-${locale}-${view}.png`), Buffer.from(capture.data, 'base64'));
      }
      page.socket.close(); await fetch(`${debug}/json/close/${page.target.id}`);
}

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}
console.log(`Administration visuelle valide: ${cases.length} parcours couvrant 25 vues, 5 langues, desktop et tablette.`);
