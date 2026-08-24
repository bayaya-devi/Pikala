const base = process.argv[2] || 'http://127.0.0.1:8788';
const debug = process.env.CHROME_DEBUG || 'http://127.0.0.1:9334';
const widths = [320, 375, 390, 430, 768, 1024, 1280, 1440];
const pages = ['/index.html','/connexion.html','/inscription.html','/dashboard.html','/stations.html','/scanner.html','/profil.html','/support.html','/admin.html'];
let commandId = 0;

async function createPage() {
  const response = await fetch(`${debug}/json/new?${encodeURIComponent('about:blank')}`, { method: 'PUT' });
  if (!response.ok) throw new Error(`Chrome DevTools ${response.status}`);
  const target = await response.json();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map();
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  socket.addEventListener('message', (event) => { const message = JSON.parse(event.data); if (!message.id || !pending.has(message.id)) return; const task = pending.get(message.id); pending.delete(message.id); message.error ? task.reject(new Error(message.error.message)) : task.resolve(message.result); });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++commandId; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
  return { target, socket, send };
}

async function inspect(page, width, locale, path) {
  await page.send('Page.enable');
  await page.send('Runtime.enable');
  await page.send('Emulation.setDeviceMetricsOverride', { width, height: width < 768 ? 844 : 900, deviceScaleFactor: 1, mobile: width < 768 });
  await page.send('Page.navigate', { url: `${base}${path}?lang=${locale}&responsive=${width}` });
  let result;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, path.includes('stations') ? 180 : 100));
    result = (await page.send('Runtime.evaluate', { returnByValue: true, expression: `(() => ({
      ready: document.readyState,
      overflow: Math.max(0, ...[...document.querySelectorAll('body *')].filter((el) => !el.closest('.leaflet-container') && getComputedStyle(el).position !== 'fixed' && getComputedStyle(el).visibility !== 'hidden').map((el) => { const r=el.getBoundingClientRect(); return r.width>0&&r.height>0 ? Math.max(0,r.right-innerWidth,-r.left) : 0; })),
      mapLeak: [...document.querySelectorAll('.leaflet-container')].some((el) => { const r=el.getBoundingClientRect(); const overflow=getComputedStyle(el).overflow; return r.left < -1 || r.right > innerWidth + 1 || !['hidden','clip'].includes(overflow); }),
      lang: document.documentElement.lang,
      dir: document.documentElement.dir,
      heading: Boolean(document.querySelector('h1')),
      unlabeled: [...document.querySelectorAll('button,input,select,textarea')].filter((el) => {
        if (el.matches('input[type=hidden]')) return false;
        const explicit = el.id && document.querySelector('label[for="'+CSS.escape(el.id)+'"]');
        const wrapped = el.closest('label');
        const name = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.title || el.textContent.trim();
        return !explicit && !wrapped && !name;
      }).length,
      smallTargets: [...document.querySelectorAll('button,input:not([type=hidden]):not([type=checkbox]):not([type=radio]),select,textarea,a.button,.icon-button,.user-bottom-link')].filter((el) => { const r=el.getBoundingClientRect(); return r.width>0&&r.height>0&&(r.width<32||r.height<32); }).length
    }))()` })).result.value;
    if (attempt >= 6 && result?.ready === 'complete' && result.lang === locale && result.heading) break;
  }
  return result;
}

const failures = [];
for (const width of widths) {
  for (const locale of ['fr','ar']) {
    for (const path of pages) {
      const page = await createPage();
      const result = await inspect(page, width, locale, path);
      const label = `${width}px/${locale}${path}`;
      if (result.overflow > 1) failures.push(`${label}: débordement horizontal ${result.overflow}px`);
      if (result.mapLeak) failures.push(`${label}: conteneur de carte non confiné`);
      if (result.lang !== locale || result.dir !== (locale === 'ar' ? 'rtl' : 'ltr')) failures.push(`${label}: langue/RTL incorrect`);
      if (!result.heading) failures.push(`${label}: h1 absent`);
      if (result.unlabeled) failures.push(`${label}: ${result.unlabeled} contrôle(s) sans nom accessible`);
      if (result.smallTargets) failures.push(`${label}: ${result.smallTargets} cible(s) essentielle(s) sous 32 px`);
      page.socket.close();
      await fetch(`${debug}/json/close/${page.target.id}`);
    }
  }
}

if (failures.length) { console.error(failures.map((failure) => `- ${failure}`).join('\n')); process.exit(1); }
console.log(`Responsive validé: ${widths.length} largeurs × 2 directions × ${pages.length} écrans, sans débordement ni contrôle sans nom.`);
