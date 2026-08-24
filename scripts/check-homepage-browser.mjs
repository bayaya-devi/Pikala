const base = process.env.PIKALA_URL || 'http://127.0.0.1:8788/index.html';
const debug = process.env.CHROME_DEBUG || 'http://127.0.0.1:9333';
const targets = [{ width: 390, height: 844, name: 'mobile' }, { width: 768, height: 1024, name: 'tablet' }, { width: 1440, height: 1000, name: 'desktop' }];
const locales = ['fr', 'en', 'es', 'pt', 'ar'];
let id = 0;

async function openPage(url) {
  const response = await fetch(`${debug}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
  if (!response.ok) throw new Error(`Chrome DevTools ${response.status}`);
  const target = await response.json();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map();
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  socket.addEventListener('message', (event) => { const message = JSON.parse(event.data); if (message.id && pending.has(message.id)) { const { resolve, reject } = pending.get(message.id); pending.delete(message.id); message.error ? reject(new Error(message.error.message)) : resolve(message.result); } });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const commandId = ++id; pending.set(commandId, { resolve, reject }); socket.send(JSON.stringify({ id: commandId, method, params })); });
  return { socket, send, target };
}

const failures = [];
for (const viewport of targets) {
  for (const locale of locales) {
    const page = await openPage('about:blank');
    await page.send('Page.enable');
    await page.send('Runtime.enable');
    await page.send('Emulation.setDeviceMetricsOverride', { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: viewport.width < 600 });
    await page.send('Page.navigate', { url: `${base}?lang=${locale}` });
    let evaluation;
    for (let attempt = 0; attempt < 24; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 180));
      evaluation = await page.send('Runtime.evaluate', { returnByValue: true, expression: `(() => ({
      lang: document.documentElement.lang,
      dir: document.documentElement.dir,
      title: document.querySelector('h1')?.textContent.trim(),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      heroOpacity: Number.parseFloat(getComputedStyle(document.querySelector('.hero-content')).opacity),
      untranslated: [...document.querySelectorAll('[data-i18n]')].filter(el => el.textContent.trim() === el.dataset.i18n).map(el => el.dataset.i18n),
      menuVisible: getComputedStyle(document.querySelector('[data-menu-button]')).display !== 'none',
      stationState: document.querySelector('[data-station-list]')?.textContent.trim().length > 0,
      ctaVisible: document.querySelector('.hero .button.primary')?.getBoundingClientRect().height >= 44
    }))()` });
      const candidate = evaluation.result.value;
      if (candidate?.lang === locale && candidate?.dir && candidate?.title && candidate.stationState && candidate.ctaVisible && candidate.heroOpacity > 0.9) break;
    }
    const result = evaluation?.result?.value;
    const label = `${viewport.name}/${locale}`;
    if (!result) { failures.push(`${label}: page non chargee`); page.socket.close(); await fetch(`${debug}/json/close/${page.target.id}`); continue; }
    if (result.lang !== locale) failures.push(`${label}: langue ${result.lang}`);
    if (result.dir !== (locale === 'ar' ? 'rtl' : 'ltr')) failures.push(`${label}: direction ${result.dir}`);
    if (!result.title || result.untranslated.length) failures.push(`${label}: traduction incomplète`);
    if (result.overflow > 1) failures.push(`${label}: débordement horizontal ${result.overflow}px`);
    if (viewport.width < 600 && !result.menuVisible) failures.push(`${label}: menu mobile absent`);
    if (!(result.heroOpacity > 0.9)) failures.push(`${label}: contenu hero invisible (opacité ${result.heroOpacity})`);
    if (viewport.width >= 1000 && result.menuVisible) failures.push(`${label}: menu desktop incorrect`);
    if (!result.stationState || !result.ctaVisible) failures.push(`${label}: état stations ou CTA invalide`);
    page.socket.close();
    await fetch(`${debug}/json/close/${page.target.id}`);
  }
}
if (failures.length) { console.error(failures.map((item) => `- ${item}`).join('\n')); process.exit(1); }
console.log(`Navigateur valide : ${targets.length} formats × ${locales.length} langues, sans débordement.`);
