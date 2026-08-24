import { getLocale, t } from './assets/js/i18n/index.js';
import { initLayout } from './assets/js/layouts.js';

const header = document.querySelector('[data-header]');
const menuButton = document.querySelector('[data-menu-button]');
const siteNav = document.querySelector('[data-site-nav]');
const stationList = document.querySelector('[data-station-list]');
const retryButton = document.querySelector('[data-retry-stations]');
const liveSummary = document.querySelector('[data-live-summary]');
const mapElement = document.querySelector('#public-map');
let stations = [];
let map;

function setHeaderState() { header?.classList.toggle('scrolled', window.scrollY > 12); }
function closeMenu() { siteNav?.classList.remove('open'); menuButton?.setAttribute('aria-expanded', 'false'); }

function updateDocumentMeta() {
  document.title = t('homeMetaTitle');
  document.querySelector('meta[name="description"]')?.setAttribute('content', t('homeMetaDescription'));
  document.querySelector('meta[property="og:title"]')?.setAttribute('content', t('homeMetaTitle'));
  document.querySelector('meta[property="og:description"]')?.setAttribute('content', t('homeMetaDescription'));
}

function stationAvailability(count) {
  return t(count === 1 ? 'bikesAvailableCount' : 'bikesAvailableCountPlural', { count });
}

function renderStations() {
  if (!stationList || !stations.length) return;
  stationList.replaceChildren(...stations.slice(0, 5).map((station) => {
    const row = document.createElement('article');
    row.className = 'station-row';
    const name = document.createElement('strong');
    const address = document.createElement('small');
    const count = document.createElement('span');
    name.textContent = String(station.name || t('homeUnnamedStation'));
    address.textContent = String(station.address || station.city || 'Rabat');
    count.className = 'station-count';
    count.textContent = String(Math.max(0, Number(station.bikes_available) || 0));
    count.setAttribute('aria-label', stationAvailability(Number(count.textContent)));
    row.append(name, address, count);
    return row;
  }));
  const totalBikes = stations.reduce((sum, station) => sum + Math.max(0, Number(station.bikes_available) || 0), 0);
  if (liveSummary) liveSummary.querySelector('p').textContent = t('homeLiveSummary', { stations: stations.length, bikes: totalBikes });
}

function showStationError(messageKey = 'homeStationsError') {
  stationList?.replaceChildren();
  const state = document.createElement('div');
  state.className = 'station-loading';
  state.textContent = t(messageKey);
  stationList?.append(state);
  if (retryButton) retryButton.hidden = false;
  liveSummary?.closest('.service-strip')?.setAttribute('data-state', 'error');
  if (liveSummary) liveSummary.querySelector('p').textContent = t('homeLiveUnavailable');
  if (mapElement) mapElement.innerHTML = `<div class="map-placeholder">${t('homeMapUnavailable')}</div>`;
}

function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  return new Promise((resolve, reject) => {
    if (!document.querySelector('[data-leaflet-css]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'assets/vendor/leaflet/leaflet.css';
      link.crossOrigin = '';
      link.dataset.leafletCss = '';
      document.head.append(link);
    }
    const existing = document.querySelector('[data-leaflet-script]');
    if (existing) { existing.addEventListener('load', () => resolve(window.L), { once: true }); existing.addEventListener('error', reject, { once: true }); return; }
    const script = document.createElement('script');
    script.src = 'assets/vendor/leaflet/leaflet.js';
    script.crossOrigin = '';
    script.dataset.leafletScript = '';
    script.addEventListener('load', () => resolve(window.L), { once: true });
    script.addEventListener('error', reject, { once: true });
    document.head.append(script);
  });
}

async function renderMap() {
  const located = stations.filter((station) => Number.isFinite(Number(station.latitude)) && Number.isFinite(Number(station.longitude)));
  if (!mapElement || !located.length) { if (mapElement) mapElement.innerHTML = `<div class="map-placeholder">${t('homeMapNoCoordinates')}</div>`; return; }
  try {
    const L = await loadLeaflet();
    mapElement.replaceChildren();
    map = L.map(mapElement, { scrollWheelZoom: false, zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false }).setView([34.0209, -6.8416], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap', maxZoom: 19 }).addTo(map);
    const bounds = [];
    located.forEach((station) => {
      const position = [Number(station.latitude), Number(station.longitude)];
      bounds.push(position);
      const amount = Math.max(0, Number(station.bikes_available) || 0);
      const icon = L.divIcon({ className: '', html: `<span class="map-bike-bubble" aria-hidden="true">${amount}</span>`, iconSize: [42, 42], iconAnchor: [21, 21] });
      L.marker(position, { icon, title: String(station.name || '') }).addTo(map).bindPopup(`<strong>${escapeHtml(String(station.name || 'Pikala'))}</strong><br>${escapeHtml(stationAvailability(amount))}`);
    });
    if (bounds.length > 1) map.fitBounds(bounds, { padding: [36, 36], maxZoom: 14 });
  } catch { if (mapElement) mapElement.innerHTML = `<div class="map-placeholder">${t('homeMapUnavailable')}</div>`; }
}

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

async function loadStations() {
  if (retryButton) retryButton.hidden = true;
  try {
    const response = await fetch('/api/stations', { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error('stations');
    const payload = await response.json();
    if (payload.degraded) return showStationError('homeStationsDegraded');
    stations = Array.isArray(payload.stations) ? payload.stations.filter((station) => station && Number(station.is_active ?? 1) === 1) : [];
    if (!stations.length) return showStationError('homeStationsEmpty');
    renderStations();
    renderMap();
  } catch { showStationError(); }
}

async function loadPlans() {
  const status = document.querySelector('[data-plan-status]');
  const summary = document.querySelector('[data-plan-summary]');
  try {
    const response = await fetch('/api/plans', { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error('plans');
    const payload = await response.json();
    const plan = Array.isArray(payload.plans) ? payload.plans[0] : null;
    if (!plan) throw new Error('empty');
    const amount = new Intl.NumberFormat(getLocale(), { style: 'currency', currency: 'MAD', maximumFractionDigits: 2 }).format(Number(plan.amount_mad));
    status.textContent = `${amount} / ${t(`homePeriod_${plan.billing_period}`)}`;
    summary.textContent = String(plan.summary || t('subscriptionDetails'));
  } catch {
    if (status) status.textContent = t('homePlanPending');
    if (summary) summary.textContent = t('homePlanFallback');
  }
}

setHeaderState();
window.addEventListener('scroll', setHeaderState, { passive: true });
menuButton?.addEventListener('click', () => { const open = siteNav?.classList.toggle('open'); menuButton.setAttribute('aria-expanded', String(Boolean(open))); });
siteNav?.addEventListener('click', (event) => { if (event.target instanceof HTMLAnchorElement) closeMenu(); });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeMenu(); });
retryButton?.addEventListener('click', loadStations);
document.querySelector('[data-current-year]').textContent = String(new Date().getFullYear());
document.addEventListener('pikala:localechange', () => { updateDocumentMeta(); renderStations(); loadPlans(); });
initLayout();
updateDocumentMeta();
loadStations();
loadPlans();
