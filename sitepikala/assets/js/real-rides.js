let scannerControls = null;
let scannerVideo = null;
let actionPending = false;

function node(tag, className, value) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (value !== undefined) element.textContent = value;
  return element;
}

function cameraErrorKey(error) {
  if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') return 'scannerPermissionDenied';
  return 'scannerCameraUnavailable';
}

export function createRealRideFlows({ api, requireUser, t, showToast, refreshIcons, formatDate, formatDuration, errorState, emptyState }) {
  async function stopCamera() {
    try { scannerControls?.stop(); } catch {}
    scannerControls = null;
    const video = scannerVideo;
    scannerVideo = null;
    if (video?.srcObject) {
      video.srcObject.getTracks?.().forEach((track) => track.stop());
      video.srcObject = null;
    }
    document.querySelectorAll('[data-camera-placeholder]').forEach((item) => item.classList.remove('is-hidden'));
    document.querySelectorAll('[data-camera-toggle] span, [data-return-camera-toggle] span').forEach((label) => { label.textContent = t('scannerCameraStart'); });
  }

  async function startCamera({ video, placeholder, button, message, onResult }) {
    if (scannerControls) { await stopCamera(); return; }
    message.textContent = '';
    message.classList.remove('is-error');
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || !window.ZXingBrowser?.BrowserQRCodeReader) {
        throw Object.assign(new Error('camera unavailable'), { name: 'NotSupportedError' });
      }
      const reader = new window.ZXingBrowser.BrowserQRCodeReader();
      scannerVideo = video;
      scannerControls = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: 'environment' } }, audio: false },
        video,
        async (result, error, controls) => {
          if (!result || actionPending) return;
          const payload = result.getText?.() || result.text || '';
          controls.stop();
          scannerControls = null;
          await stopCamera();
          if (payload) await onResult(payload);
        }
      );
      placeholder?.classList.add('is-hidden');
      const label = button.querySelector('span');
      if (label) label.textContent = t('scannerCameraStop');
    } catch (error) {
      await stopCamera();
      message.textContent = t(cameraErrorKey(error));
      message.classList.add('is-error');
    }
  }

  async function startRide(payload, form, message) {
    if (actionPending) return;
    if (!String(payload || '').trim()) {
      message.textContent = t('scannerCodeRequired');
      message.classList.add('is-error');
      return;
    }
    actionPending = true;
    const button = form?.querySelector('[type=submit]');
    if (button) button.disabled = true;
    message.textContent = t('scannerChecking');
    message.classList.remove('is-error');
    try {
      const data = await api('/api/rides', { method: 'POST', body: JSON.stringify({ qrPayload: String(payload).trim() }) });
      await stopCamera();
      showToast(t('scannerRideStarted'));
      location.assign(`trajet.html?id=${encodeURIComponent(data.ride.id)}`);
    } catch (error) {
      message.textContent = error.message;
      message.classList.add('is-error');
    } finally {
      actionPending = false;
      if (button) button.disabled = false;
    }
  }

  async function loadScanner() {
    if (!(await requireUser())) return;
    const video = document.querySelector('[data-scanner-video]');
    const placeholder = document.querySelector('[data-camera-placeholder]');
    const toggle = document.querySelector('[data-camera-toggle]');
    const message = document.querySelector('[data-scanner-message]');
    const form = document.querySelector('[data-ride-form]');
    toggle?.addEventListener('click', () => startCamera({ video, placeholder, button: toggle, message, onResult: (payload) => startRide(payload, form, message) }));
    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      startRide(form.elements.bikeCode.value, form, message);
    });
  }

  function fact(label, value) {
    const item = node('div', 'ride-fact');
    item.append(node('span', '', label), node('strong', '', value || t('commonUnavailableV2')));
    return item;
  }

  function liveDuration(startedAt, target) {
    const render = () => {
      const start = new Date(String(startedAt).endsWith('Z') ? startedAt : `${String(startedAt).replace(' ', 'T')}Z`);
      const total = Math.max(0, Math.floor((Date.now() - start.valueOf()) / 1000));
      const hours = Math.floor(total / 3600);
      const minutes = Math.floor((total % 3600) / 60);
      const seconds = total % 60;
      target.textContent = [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
    };
    render();
    const timer = window.setInterval(render, 1000);
    window.addEventListener('pagehide', () => window.clearInterval(timer), { once: true });
  }

  function incidentPanel(ride) {
    const details = node('details', 'surface ride-incident');
    const summary = node('summary', '', t('rideReportIncident'));
    const form = node('form', 'ride-incident-form');
    const categoryLabel = node('label');
    categoryLabel.append(node('span', '', t('incidentCategory')));
    const select = node('select'); select.name = 'category'; select.required = true;
    ['mechanical', 'battery', 'lock', 'damage', 'safety', 'missing', 'other'].forEach((value) => {
      const option = node('option', '', t(`incidentCategory_${value}`)); option.value = value; select.append(option);
    });
    categoryLabel.append(select);
    const descriptionLabel = node('label'); descriptionLabel.append(node('span', '', t('incidentDescription')));
    const textarea = node('textarea'); textarea.name = 'description'; textarea.minLength = 5; textarea.maxLength = 1000; textarea.required = true; textarea.rows = 4; descriptionLabel.append(textarea);
    const message = node('p', 'inline-message'); message.setAttribute('role', 'status');
    const submit = node('button', 'button secondary', t('incidentSend')); submit.type = 'submit';
    form.append(categoryLabel, descriptionLabel, message, submit);
    form.addEventListener('submit', async (event) => {
      event.preventDefault(); submit.disabled = true;
      try {
        await api(`/api/rides/${ride.id}/incidents`, { method: 'POST', body: JSON.stringify({ category: select.value, description: textarea.value.trim() }) });
        form.reset(); message.textContent = t('incidentSent'); message.classList.remove('is-error'); showToast(t('incidentSent'));
      } catch (error) { message.textContent = error.message; message.classList.add('is-error'); }
      finally { submit.disabled = false; }
    });
    details.append(summary, form); return details;
  }

  function returnPanel(ride, host) {
    const section = node('section', 'surface return-panel');
    section.append(node('h2', '', t('returnHeading')), node('p', 'muted', t('returnHelp')));
    const camera = node('div', 'return-camera camera-surface');
    const video = node('video'); video.dataset.returnVideo = ''; video.muted = true; video.playsInline = true;
    const placeholder = node('div', 'camera-placeholder'); placeholder.dataset.cameraPlaceholder = '';
    const placeholderIcon = node('i'); placeholderIcon.dataset.lucide = 'scan-line'; placeholder.append(placeholderIcon); camera.append(video, placeholder);
    const toggle = node('button', 'button secondary'); toggle.type = 'button'; toggle.dataset.returnCameraToggle = '';
    const cameraIcon = node('i'); cameraIcon.dataset.lucide = 'camera'; toggle.append(cameraIcon, node('span', '', t('scannerCameraStart')));
    const message = node('p', 'inline-message'); message.setAttribute('role', 'status'); message.setAttribute('aria-live', 'polite');
    const form = node('form', 'return-form');
    const label = node('label'); label.append(node('span', '', t('returnDockLabel')));
    const input = node('input'); input.name = 'dockCode'; input.maxLength = 300; input.autocomplete = 'off'; input.required = true; input.placeholder = t('returnDockPlaceholder'); label.append(input);
    const submit = node('button', 'button primary', t('returnAction')); submit.type = 'submit'; form.append(label, submit);
    const completeReturn = async (payload) => {
      if (actionPending) return;
      if (!String(payload || '').trim()) { message.textContent = t('returnDockRequired'); message.classList.add('is-error'); return; }
      actionPending = true; submit.disabled = true; message.textContent = t('returnChecking'); message.classList.remove('is-error');
      try {
        const data = await api(`/api/rides/${ride.id}/return`, { method: 'POST', body: JSON.stringify({ qrPayload: String(payload).trim() }) });
        await stopCamera(); showToast(t('returnSuccess')); renderRide(data.ride, host, data.pricing);
      } catch (error) { message.textContent = error.message; message.classList.add('is-error'); }
      finally { actionPending = false; submit.disabled = false; }
    };
    toggle.addEventListener('click', () => startCamera({ video, placeholder, button: toggle, message, onResult: completeReturn }));
    form.addEventListener('submit', (event) => { event.preventDefault(); completeReturn(input.value); });
    section.append(camera, toggle, message, form); return section;
  }

  function summaryView(ride, pricing) {
    const article = node('article', 'surface ride-summary');
    const icon = node('i'); icon.dataset.lucide = 'circle-check-big';
    article.append(icon, node('p', 'user-kicker', t('summarySubtitle')), node('h1', '', t('summaryHeading')));
    const facts = node('div', 'ride-facts');
    const price = pricing?.includedInPlan || Number(ride.charged_amount_minor || 0) === 0
      ? t('summaryIncludedPlan')
      : new Intl.NumberFormat(document.documentElement.lang, { style: 'currency', currency: pricing?.currency || 'MAD' }).format(Number(ride.charged_amount_minor) / 100);
    facts.append(
      fact(t('rideBike'), ride.bike_code), fact(t('rideDeparture'), ride.start_station_name),
      fact(t('summaryArrival'), ride.end_station_name), fact(t('summaryDuration'), formatDuration(ride.duration_seconds, ride.started_at, ride.ended_at)),
      fact(t('summaryPrice'), price)
    );
    const history = node('a', 'button primary', t('rideBackHistory')); history.href = 'trajets.html';
    article.append(facts, history); return article;
  }

  function renderRide(ride, host, pricing) {
    host.replaceChildren();
    if (ride.status !== 'active') { host.append(summaryView(ride, pricing)); refreshIcons(); return; }
    const hero = node('section', 'surface active-ride-card');
    hero.append(node('p', 'user-kicker', t('activeRideSubtitle')), node('h1', '', t('activeRideHeading')));
    const timer = node('time', 'ride-live-timer', '00:00:00'); timer.dateTime = ride.started_at; hero.append(timer);
    const facts = node('div', 'ride-facts');
    facts.append(fact(t('rideBike'), ride.bike_code), fact(t('rideDeparture'), ride.start_station_name), fact(t('rideStartedAt'), formatDate(ride.started_at, { dateStyle: 'medium', timeStyle: 'short' })));
    const assistance = node('a', 'button secondary', t('rideAssistance')); assistance.href = `support.html?ride=${encodeURIComponent(ride.id)}`;
    hero.append(facts, assistance);
    host.append(hero, returnPanel(ride, host), incidentPanel(ride));
    liveDuration(ride.started_at, timer); refreshIcons();
  }

  async function loadRidePage() {
    if (!(await requireUser())) return;
    const host = document.querySelector('[data-ride-page]');
    const id = new URLSearchParams(location.search).get('id');
    try {
      const data = await api(id ? `/api/rides/${encodeURIComponent(id)}` : '/api/rides/active');
      if (!data.ride) {
        const empty = emptyState('rideNoActive', 'bike');
        const link = node('a', 'button primary', t('userFindBike')); link.href = 'stations.html'; empty.append(link); host.replaceChildren(empty); refreshIcons(); return;
      }
      renderRide(data.ride, host);
    } catch (error) { host.replaceChildren(errorState(error.message, loadRidePage)); refreshIcons(); }
  }

  window.addEventListener('pagehide', stopCamera);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopCamera(); });
  return { loadScanner, loadRidePage, stopCamera };
}
