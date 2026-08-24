import { getLocale, t } from './assets/js/i18n/index.js';
import { initLayout } from './assets/js/layouts.js';
import { mountUserShell, refreshUserIcons } from './assets/js/user-shell.js';
import { showToast } from './assets/js/ui/components.js';
import { createRealRideFlows } from './assets/js/real-rides.js';

mountUserShell();
initLayout();
refreshUserIcons();

let currentUser = null;
let dashboardData = null;
let stationsData = [];
let mapState = null;


function text(selector, value, root = document) {
  const element = root.querySelector(selector);
  if (element) element.textContent = value ?? '';
}

function fullName(user) { return [user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'Pikala'; }
function firstName(user) { return user?.first_name || fullName(user); }

function friendlyApiError(data) {
  const keys = {
    AUTH_REQUIRED: 'authInvalidCredentials', RATE_LIMITED: 'authRateLimited', PASSWORD_INVALID: 'authPasswordRule',
    CURRENT_PASSWORD_INVALID: 'authInvalidCredentials', PHONE_INVALID: 'authPhoneInvalid', NAME_INVALID: 'authNameInvalid',
    FORBIDDEN: 'authForbidden', DB_UNAVAILABLE: 'dbUnavailable', SERVER_ERROR: 'authServerError',
    BIKE_CODE_REQUIRED: 'scannerCodeRequired', QR_INVALID: 'scannerQrInvalid', QR_UNKNOWN: 'scannerQrUnknown',
    BIKE_MAINTENANCE: 'scannerBikeMaintenance', BIKE_UNAVAILABLE: 'scannerBikeUnavailable', BIKE_DOCK_INVALID: 'scannerDockInvalid',
    SUBSCRIPTION_REQUIRED: 'userNoPlan', RIDE_ALREADY_ACTIVE: 'userActiveRide', STATION_CLOSED: 'scannerStationClosed',
    DOCK_QR_INVALID: 'returnQrInvalid', DOCK_UNKNOWN: 'returnDockUnknown', DOCK_UNAVAILABLE: 'returnDockUnavailable',
    RIDE_ALREADY_ENDED: 'rideAlreadyEnded', RETURN_CONFLICT: 'returnConflict', BIKE_STATE_INVALID: 'rideStateInvalid', RIDE_NOT_FOUND: 'rideNotFound',
    INCIDENT_CATEGORY_INVALID: 'incidentInvalid', INCIDENT_DESCRIPTION_INVALID: 'incidentInvalid', STATION_NOT_FOUND: 'stationNotFound'
  };
  return t(keys[data?.code] || 'commonErrorV2');
}

async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(path, {
      ...options, credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-Pikala-Request': 'web', ...(options.headers || {}) }
    });
  } catch {
    const error = new Error(t('mapNetworkError')); error.code = 'NETWORK_ERROR'; throw error;
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(friendlyApiError(data));
    error.status = response.status; error.code = data?.code; throw error;
  }
  return data;
}

async function requireUser() {
  if (currentUser) return currentUser;
  try {
    const data = await api('/api/me'); currentUser = data.user;
    document.querySelectorAll('[data-admin-link]').forEach((link) => link.classList.toggle('is-hidden', currentUser?.role !== 'admin'));
    return currentUser;
  } catch (error) {
    if (error.status === 401) window.location.assign(`/connexion.html?next=${encodeURIComponent(location.pathname + location.search)}`);
    else showToast(error.message, { tone: 'error' });
    return null;
  }
}

function formatDate(value, options = { dateStyle: 'medium' }) {
  if (!value) return '';
  const date = new Date(value.endsWith?.('Z') ? value : `${value.replace(' ', 'T')}Z`);
  return Number.isNaN(date.valueOf()) ? '' : new Intl.DateTimeFormat(getLocale(), options).format(date);
}

function clientDistanceMeters(latitudeA, longitudeA, latitudeB, longitudeB) {
  const radians = (degrees) => degrees * Math.PI / 180; const radius = 6371000;
  const deltaLatitude = radians(latitudeB - latitudeA); const deltaLongitude = radians(longitudeB - longitudeA);
  const value = Math.sin(deltaLatitude / 2) ** 2 + Math.cos(radians(latitudeA)) * Math.cos(radians(latitudeB)) * Math.sin(deltaLongitude / 2) ** 2;
  return Math.round(radius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value)));
}

function formatDistance(meters) {
  const value = Number(meters);
  if (!Number.isFinite(value)) return '';
  return value < 1000 ? `${Math.round(value)} m` : `${(value / 1000).toFixed(1)} km`;
}

function formatDuration(seconds, startedAt, endedAt) {
  let value = Number(seconds);
  if (!Number.isFinite(value) && startedAt && endedAt) value = (new Date(endedAt) - new Date(startedAt)) / 1000;
  return t('ridesDuration', { minutes: Math.max(1, Math.round((value || 0) / 60)) });
}

function statusLabel(status) {
  return t(status === 'active' ? 'ridesActive' : status === 'completed' ? 'ridesCompleted' : 'ridesCancelled');
}

function emptyState(key, icon = 'inbox') {
  const element = document.createElement('div'); element.className = 'empty-state';
  const iconElement = document.createElement('i'); iconElement.dataset.lucide = icon;
  const message = document.createElement('p'); message.textContent = t(key);
  element.append(iconElement, message); return element;
}

function errorState(message, retry) {
  const element = document.createElement('div'); element.className = 'error-state';
  const paragraph = document.createElement('p'); paragraph.textContent = message;
  element.append(paragraph);
  if (retry) { const button = document.createElement('button'); button.className = 'button secondary'; button.type = 'button'; button.textContent = t('commonRetryV2'); button.addEventListener('click', retry); element.append(button); }
  return element;
}

function rideRow(ride) {
  const row = document.createElement('a'); row.className = 'data-row'; row.href = `trajet.html?id=${encodeURIComponent(ride.id)}`;
  const title = document.createElement('strong');
  title.textContent = `${ride.start_station_name || t('userUnknownStation')} → ${ride.end_station_name || t('ridesUnknownDestination')}`;
  const meta = document.createElement('p');
  meta.textContent = ride.status === 'active' ? formatDate(ride.started_at, { timeStyle: 'short' }) : `${formatDate(ride.started_at)} · ${formatDuration(ride.duration_seconds, ride.started_at, ride.ended_at)}`;
  const badge = document.createElement('span'); badge.className = `status-badge${ride.status === 'cancelled' ? ' is-closed' : ''}`; badge.textContent = statusLabel(ride.status);
  row.append(title, meta, badge); return row;
}

function alertRow(notification) {
  const row = document.createElement('div'); row.className = 'data-row';
  const title = document.createElement('strong'); title.textContent = notification.title;
  const body = document.createElement('p'); body.textContent = notification.body;
  const date = document.createElement('time'); date.textContent = formatDate(notification.created_at); date.dateTime = notification.created_at;
  row.append(title, body, date); return row;
}

function renderDashboard() {
  if (!dashboardData) return;
  const data = dashboardData;
  text('[data-dashboard-greeting]', t('userDashboardHeading', { name: firstName(data.user) }));
  text('[data-total-bikes]', String(data.summary.bikesAvailable));
  text('[data-total-stations]', String(data.summary.stations));
  text('[data-plan]', data.subscription?.plan_name || data.subscription?.plan || t('userNoPlan'));
  const banner = document.querySelector('[data-active-ride]');
  if (banner) {
    banner.replaceChildren(); banner.classList.toggle('is-empty', !data.activeRide);
    const copy = document.createElement('div'); const kicker = document.createElement('p'); const heading = document.createElement('h2'); const meta = document.createElement('p');
    kicker.textContent = data.activeRide ? t('userActiveRide') : t('userDashboardSubtitle');
    heading.textContent = data.activeRide ? (data.activeRide.start_station_name || t('userActiveRide')) : t('userFindBike');
    meta.textContent = data.activeRide ? t('userRideStarted', { time: formatDate(data.activeRide.started_at, { timeStyle: 'short' }) }) : t('mapSubtitle');
    copy.append(kicker, heading, meta);
    const link = document.createElement('a'); link.className = 'button primary'; link.href = data.activeRide ? `trajet.html?id=${encodeURIComponent(data.activeRide.id)}` : 'stations.html'; link.textContent = data.activeRide ? t('userActiveRide') : t('userFindBike');
    banner.append(copy, link);
  }
  renderNearest(data.nearestStation);
  const rides = document.querySelector('[data-recent-rides]'); rides?.replaceChildren(...(data.recentRides.length ? data.recentRides.map(rideRow) : [emptyState('userNoRides', 'route')]));
  const alerts = document.querySelector('[data-alerts]'); alerts?.replaceChildren(...(data.notifications.length ? data.notifications.map(alertRow) : [emptyState('userNoAlerts', 'bell-off')]));
  refreshUserIcons();
}

function renderNearest(station) {
  text('[data-nearest-name]', station?.name || t('userLocationUnavailable'));
  text('[data-nearest-meta]', station ? `${t('mapBikes', { count: station.bikes_available })} · ${t('mapDistance', { distance: formatDistance(station.distance_meters) })}` : t('userEnableLocation'));
}

function geolocate(options = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { const error = new Error(t('mapLocationUnavailable')); error.code = 2; reject(error); return; }
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000, ...options });
  });
}

async function fetchDashboard(position) {
  const query = position ? `?lat=${encodeURIComponent(position.coords.latitude)}&lng=${encodeURIComponent(position.coords.longitude)}` : '';
  dashboardData = await api(`/api/dashboard${query}`); renderDashboard();
}

async function loadDashboard() {
  if (!(await requireUser())) return;
  try { await fetchDashboard(); } catch (error) {
    const main = document.querySelector('.user-main'); main?.append(errorState(error.message, loadDashboard)); refreshUserIcons(); return;
  }
  document.querySelector('[data-dashboard-locate]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget; button.disabled = true;
    try { await fetchDashboard(await geolocate()); } catch (error) { renderNearest(null); showToast(error.code === 1 ? t('mapLocationDenied') : t('mapLocationUnavailable'), { tone: 'error' }); }
    finally { button.disabled = false; }
  });
  try { if ((await navigator.permissions?.query({ name: 'geolocation' }))?.state === 'granted') await fetchDashboard(await geolocate()); } catch {}
}

function stationClass(station) { return Number(station.bikes_available) <= 0 ? 'is-empty' : Number(station.bikes_available) <= 3 ? 'is-low' : ''; }

function stationResult(station) {
  const button = document.createElement('button'); button.type = 'button'; button.className = 'station-result'; button.dataset.stationId = station.id;
  const name = document.createElement('strong'); name.textContent = station.name;
  const address = document.createElement('small'); address.textContent = `${station.address || station.city || ''}${station.distance_meters != null ? ` · ${t('mapDistance', { distance: formatDistance(station.distance_meters) })}` : ''}`;
  const count = document.createElement('span'); count.className = `availability-count ${stationClass(station)}`; count.textContent = station.bikes_available;
  button.append(name, address, count); button.addEventListener('click', () => selectStation(station)); return button;
}

function stationPanel(station) {
  const wrapper = document.createElement('div');
  const status = document.createElement('span'); status.className = `status-badge${station.is_active ? '' : ' is-closed'}`; status.textContent = t(station.is_active ? 'mapOpen' : 'mapClosed');
  const heading = document.createElement('h2'); heading.textContent = station.name;
  const address = document.createElement('p'); address.className = 'detail-address'; address.textContent = station.address || station.city || '';
  const stats = document.createElement('div'); stats.className = 'detail-stats';
  [['bike', station.bikes_available, t('userBikesAvailable')], ['circle-parking', station.docks_available, t('mapDocks', { count: station.docks_available })]].forEach(([icon, value, label]) => {
    const item = document.createElement('div'); item.className = 'detail-stat'; item.innerHTML = `<i data-lucide="${icon}"></i>`;
    const strong = document.createElement('strong'); strong.textContent = value; if (value === '—') strong.dataset.stationDistance = ''; const span = document.createElement('span'); span.textContent = label; item.append(strong, span); stats.append(item);
  });
  const actions = document.createElement('div'); actions.className = 'detail-actions';
  const detail = document.createElement('a'); detail.className = 'button secondary'; detail.href = `station.html?id=${encodeURIComponent(station.public_code || station.id)}`; detail.textContent = t('mapStationDetails');
  const scan = document.createElement('a'); scan.className = 'button primary'; scan.href = 'scanner.html'; scan.textContent = t('mapScan');
  actions.append(detail, scan); wrapper.append(status, heading, address, stats, actions); return wrapper;
}

function selectStation(station) {
  if (!station) return;
  mapState.selected = station;
  document.querySelectorAll('[data-station-id]').forEach((item) => item.classList.toggle('is-active', String(station.id) === item.dataset.stationId));
  const panel = document.querySelector('[data-station-panel]'); const content = document.querySelector('[data-station-panel-content]');
  content?.replaceChildren(stationPanel(station)); panel?.classList.add('is-open'); refreshUserIcons();
  const marker = mapState.markers.get(String(station.id)); marker?.openPopup();
  if (mapState.map && station.latitude !== null) mapState.map.flyTo([Number(station.latitude), Number(station.longitude)], Math.max(mapState.map.getZoom(), 15), { duration: .6 });
}

function filteredStations() {
  const query = (document.querySelector('[data-map-search]')?.value || '').trim().toLocaleLowerCase(getLocale());
  const filter = document.querySelector('[data-map-filter]')?.value || 'all';
  return stationsData.filter((station) => {
    const matchesText = !query || [station.name, station.address, station.city].some((value) => String(value || '').toLocaleLowerCase(getLocale()).includes(query));
    const matchesFilter = filter === 'all' || (filter === 'available' && station.is_active && Number(station.bikes_available) > 0) || (filter === 'open' && station.is_active);
    return matchesText && matchesFilter;
  });
}

function renderStationResults() {
  const stations = filteredStations(); const list = document.querySelector('[data-stations-list]');
  list?.replaceChildren(...(stations.length ? stations.map(stationResult) : [emptyState('mapNoResults', 'search-x')]));
  text('[data-map-count]', t('mapResults', { count: stations.length }));
  mapState?.markers.forEach((marker, id) => { const visible = stations.some((station) => String(station.id) === id); if (visible) marker.addTo(mapState.map); else marker.remove(); });
  refreshUserIcons();
}

function initializeMap() {
  const element = document.querySelector('[data-stations-map]');
  if (!element || !window.L) throw new Error(t('mapLoadError'));
  const map = window.L.map(element, { zoomControl: true, scrollWheelZoom: true }).setView([34.0209, -6.8416], 13);
  window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
  const markers = new Map(); const bounds = [];
  stationsData.filter((station) => Number.isFinite(Number(station.latitude)) && Number.isFinite(Number(station.longitude))).forEach((station) => {
    const location = [Number(station.latitude), Number(station.longitude)]; bounds.push(location);
    const icon = window.L.divIcon({ className: `bike-bubble ${stationClass(station)}`, html: `<div>${Number(station.bikes_available)}</div>`, iconSize: [44, 44], iconAnchor: [22, 22] });
    const marker = window.L.marker(location, { icon, title: station.name }).addTo(map).bindTooltip(station.name, { direction: 'top' });
    marker.on('click', () => selectStation(station)); markers.set(String(station.id), marker);
  });
  if (bounds.length) map.fitBounds(bounds, { padding: [35, 35], maxZoom: 14 });
  mapState = { map, markers, initialBounds: bounds.length ? window.L.latLngBounds(bounds) : null, selected: null, userMarker: null };
  window.setTimeout(() => map.invalidateSize(), 100); renderStationResults();
}

async function locateOnMap() {
  try {
    const position = await geolocate(); const location = [position.coords.latitude, position.coords.longitude];
    const icon = window.L.divIcon({ className: '', html: '<div class="user-location-marker"></div>', iconSize: [20, 20], iconAnchor: [10, 10] });
    mapState.userMarker?.remove(); mapState.userMarker = window.L.marker(location, { icon, title: t('mapLocate') }).addTo(mapState.map); mapState.map.flyTo(location, 15, { duration: .7 });
    stationsData.forEach((station) => { if (station.latitude !== null && station.longitude !== null) station.distance_meters = clientDistanceMeters(location[0], location[1], Number(station.latitude), Number(station.longitude)); });
    renderStationResults(); if (mapState.selected) selectStation(mapState.selected);
    text('[data-map-feedback]', t('mapLocate'));
  } catch (error) { const message = error.code === 1 ? t('mapLocationDenied') : t('mapLocationUnavailable'); text('[data-map-feedback]', message); document.querySelector('[data-map-feedback]')?.classList.add('is-error'); }
}

async function loadMap() {
  if (!(await requireUser())) return;
  try { stationsData = (await api('/api/user/stations')).stations; initializeMap(); text('[data-map-feedback]', t('mapSubtitle')); }
  catch (error) { text('[data-map-feedback]', error.message); document.querySelector('[data-map-feedback]')?.classList.add('is-error'); document.querySelector('[data-stations-list]')?.replaceChildren(errorState(error.message, loadMap)); refreshUserIcons(); return; }
  document.querySelector('[data-map-search]')?.addEventListener('input', renderStationResults);
  document.querySelector('[data-map-filter]')?.addEventListener('change', renderStationResults);
  document.querySelector('[data-map-locate]')?.addEventListener('click', locateOnMap);
  document.querySelector('[data-map-recenter]')?.addEventListener('click', () => mapState.initialBounds && mapState.map.fitBounds(mapState.initialBounds, { padding: [35, 35], maxZoom: 14 }));
  document.querySelector('[data-close-station]')?.addEventListener('click', () => document.querySelector('[data-station-panel]')?.classList.remove('is-open'));
}

async function loadStationPage() {
  if (!(await requireUser())) return;
  const host = document.querySelector('[data-station-page]'); const id = new URLSearchParams(location.search).get('id');
  if (!id) { host?.replaceChildren(errorState(t('stationNotFound'))); return; }
  try {
    const { station } = await api(`/api/stations/${encodeURIComponent(id)}`);
    const section = document.createElement('section'); section.className = 'station-page-grid';
    const hero = document.createElement('article'); hero.className = 'surface station-page-hero';
    const status = document.createElement('span'); status.className = `status-badge${station.is_active ? '' : ' is-closed'}`; status.textContent = t(station.is_active ? 'mapOpen' : 'mapClosed');
    const heading = document.createElement('h1'); heading.textContent = station.name; const address = document.createElement('p'); address.className = 'muted'; address.textContent = station.address || station.city || '';
    const facts = document.createElement('div'); facts.className = 'station-facts';
    [[station.bikes_available, t('userBikesAvailable')], [station.docks_available, t('mapDocks', { count: station.docks_available })], ['—', t('stationDistance')]].forEach(([value, label]) => { const item = document.createElement('div'); item.className = 'station-fact'; const strong = document.createElement('strong'); strong.textContent = value; if (value === '—') strong.dataset.stationDistance = ''; const span = document.createElement('span'); span.textContent = label; item.append(strong, span); facts.append(item); });
    const actions = document.createElement('div'); actions.className = 'detail-actions';
    const directions = document.createElement('a'); directions.className = 'button secondary'; const destination = Number.isFinite(Number(station.latitude)) && Number.isFinite(Number(station.longitude)) ? `${station.latitude},${station.longitude}` : (station.address || station.city || station.name); directions.href = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`; directions.target = '_blank'; directions.rel = 'noopener'; directions.textContent = t('mapDirections');
    const scan = document.createElement('a'); scan.className = 'button primary'; scan.href = 'scanner.html'; scan.textContent = t('mapScan'); const locate = document.createElement('button'); locate.className = 'button secondary'; locate.type = 'button'; locate.textContent = t('mapLocate'); locate.addEventListener('click', async () => { try { const position = await geolocate(); text('[data-station-distance]', formatDistance(clientDistanceMeters(position.coords.latitude, position.coords.longitude, Number(station.latitude), Number(station.longitude))), hero); } catch (error) { showToast(error.code === 1 ? t('mapLocationDenied') : t('mapLocationUnavailable'), { tone: 'error' }); } }); actions.append(directions, scan, locate); hero.append(status, heading, address, facts, actions);
    const info = document.createElement('article'); info.className = 'surface'; const title = document.createElement('h2'); title.textContent = t('stationAvailability'); const paragraph = document.createElement('p'); paragraph.className = 'muted'; paragraph.textContent = `${t('mapBikes', { count: station.bikes_available })} · ${t('mapDocks', { count: station.docks_available })}`; info.append(title, paragraph); section.append(hero, info); host.replaceChildren(section);
  } catch (error) { host?.replaceChildren(errorState(error.message, loadStationPage)); }
  refreshUserIcons();
}

async function loadRides() {
  if (!(await requireUser())) return;
  const host = document.querySelector('[data-rides-list]');
  try { const data = await api('/api/rides'); host?.replaceChildren(...(data.rides.length ? data.rides.map(rideRow) : [emptyState('userNoRides', 'route')])); }
  catch (error) { host?.replaceChildren(errorState(error.message, loadRides)); }
  refreshUserIcons();
}

async function loadProfile() {
  const user = await requireUser(); if (!user) return;
  text('[data-profile-name]', fullName(user)); text('[data-profile-email]', user.email || ''); text('[data-profile-phone]', user.phone || '');
  text('[data-profile-initials]', `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase() || 'PK');
  const form = document.querySelector('[data-profile-form]'); if (form) { form.elements.firstName.value = user.first_name || ''; form.elements.lastName.value = user.last_name || ''; form.elements.phone.value = user.phone || ''; }
  try { const profile = await api('/api/profile'); text('[data-profile-subscription]', profile.subscription?.plan || t('userNoPlan')); } catch (error) { text('[data-profile-subscription]', error.message); }
  wireProfileForms();
}

function wireProfileForms() {
  const profileForm = document.querySelector('[data-profile-form]');
  profileForm?.addEventListener('submit', async (event) => { event.preventDefault(); const button = profileForm.querySelector('[type=submit]'); button.disabled = true; try { const data = await api('/api/profile', { method: 'PATCH', body: JSON.stringify({ firstName: profileForm.elements.firstName.value.trim(), lastName: profileForm.elements.lastName.value.trim(), phone: profileForm.elements.phone.value.trim(), locale: getLocale() }) }); currentUser = data.user; showToast(t('profileUpdated')); await loadProfile(); } catch (error) { showToast(error.message, { tone: 'error' }); } finally { button.disabled = false; } }, { once: true });
  const passwordForm = document.querySelector('[data-password-form]');
  passwordForm?.addEventListener('submit', async (event) => { event.preventDefault(); const button = passwordForm.querySelector('[type=submit]'); button.disabled = true; try { await api('/api/password/change', { method: 'POST', body: JSON.stringify({ currentPassword: passwordForm.elements.currentPassword.value, newPassword: passwordForm.elements.newPassword.value }) }); passwordForm.reset(); showToast(t('authPasswordChanged')); } catch (error) { showToast(error.message, { tone: 'error' }); } finally { button.disabled = false; } }, { once: true });
}

function wireLogout() { document.querySelectorAll('[data-logout]').forEach((button) => button.addEventListener('click', async () => { try { await api('/api/logout', { method: 'POST', body: '{}' }); } finally { location.assign('index.html'); } })); }
function wireBottomNavigation() { let previous = scrollY; const nav = document.querySelector('.user-bottom-nav'); addEventListener('scroll', () => { const current = scrollY; nav?.classList.toggle('is-hidden-by-scroll', current > previous && current > 120); previous = current; }, { passive: true }); }

async function loadLegacyPage(page) {
  if (!(await requireUser())) return;
  if (page === 'support') document.querySelector('[data-support-form]')?.addEventListener('submit', async (event) => { event.preventDefault(); const form = event.currentTarget; try { await api('/api/support', { method: 'POST', body: JSON.stringify({ subject: form.elements.subject.value, message: form.elements.message.value }) }); form.reset(); showToast(t('supportSent')); } catch (error) { showToast(error.message, { tone: 'error' }); } });
  if (page === 'subscription') document.querySelector('[data-activate-subscription]')?.addEventListener('click', async (event) => { event.preventDefault(); try { const plans = (await api('/api/plans')).plans; if (!plans.length) throw new Error(t('commonUnavailableV2')); await api('/api/subscriptions', { method: 'POST', body: JSON.stringify({ plan: plans[0].slug }) }); location.assign('dashboard.html'); } catch (error) { showToast(error.message, { tone: 'error' }); } });
}

const realRideFlows = createRealRideFlows({ api, requireUser, t, showToast, refreshIcons: refreshUserIcons, formatDate, formatDuration, errorState, emptyState });
const loaders = { dashboard: loadDashboard, stations: loadMap, rides: loadRides, scanner: realRideFlows.loadScanner, ride: realRideFlows.loadRidePage, profile: loadProfile, support: () => loadLegacyPage('support'), subscription: () => loadLegacyPage('subscription') };
if (location.pathname.endsWith('/station.html') || location.pathname === '/station') loadStationPage(); else loaders[document.body.dataset.userPage]?.();
wireLogout(); wireBottomNavigation();
document.addEventListener('pikala:localechange', () => { if (dashboardData) renderDashboard(); if (stationsData.length) renderStationResults(); refreshUserIcons(); });
