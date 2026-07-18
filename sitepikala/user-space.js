let currentUser = null;

function fullName(user) {
  return [user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'Utilisateur Pikala';
}

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
}

function friendlyApiError(data) {
  const raw = String(data?.error || data?.message || 'Erreur serveur.');
  if (data?.code === 'DB_UNAVAILABLE' || raw.includes('D1 DB') || raw.includes('base de donnees')) {
    return 'Service temporairement indisponible : la base Cloudflare D1 doit etre reconnectee.';
  }
  return raw;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(friendlyApiError(data));
    error.status = response.status;
    error.code = data?.code;
    throw error;
  }
  return data;
}

function wait(ms) { return new Promise((resolve) => window.setTimeout(resolve, ms)); }

async function requireUser() {
  if (currentUser) return currentUser;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const data = await api('/api/me');
      currentUser = data.user;
      return currentUser;
    } catch (error) {
      if (error.status === 401) {
        window.location.href = 'connexion.html';
        return null;
      }
      if (attempt === 0) {
        await wait(600);
        continue;
      }
      setText('[data-user-greeting]', error.message || 'Connexion temporairement indisponible.');
      return null;
    }
  }
  return null;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\'': '&#39;', '"': '&quot;' }[char]));
}

function setAdminLinks(user) {
  document.querySelectorAll('[data-admin-link]').forEach((link) => {
    link.classList.toggle('is-hidden', user?.role !== 'admin');
  });
}

function wireLogout() {
  document.querySelectorAll('[data-logout]').forEach((link) => {
    link.addEventListener('click', async (event) => {
      event.preventDefault();
      try { await api('/api/logout', { method: 'POST', body: '{}' }); } catch {}
      window.location.href = 'index.html';
    });
  });
}

async function loadDashboard() {
  const user = await requireUser();
  if (!user) return;
  setText('[data-user-greeting]', `Bonjour ${user.first_name || fullName(user)}`);
  try {
    const { stations } = await api('/api/stations');
    const totalBikes = stations.reduce((sum, station) => sum + Number(station.bikes_available || 0), 0);
    const nearest = stations[0];
    setText('[data-nearest-station]', nearest ? `${nearest.name} : ${nearest.bikes_available} velos disponibles.` : 'Aucune station disponible.');
    setText('[data-total-bikes]', String(totalBikes));
    setText('[data-total-stations]', String(stations.length));
  } catch (error) {
    setText('[data-nearest-station]', error.message);
  }
  try {
    const profile = await api('/api/profile');
    setText('[data-subscription-status]', profile.subscription ? profile.subscription.plan : 'Aucun');
  } catch {
    setText('[data-subscription-status]', 'Aucun');
  }
}



function stationAvailabilityLabel(bikes) {
  if (bikes <= 0) return 'Indisponible';
  if (bikes <= 3) return 'Peu de velos';
  return 'Disponible';
}

function stationCard(station, index) {
  const bikes = Number(station.bikes_available || 0);
  return '<button class="station-card" type="button" data-station-index="' + index + '">' +
    '<span class="station-card-main"><strong>' + escapeHtml(station.name) + '</strong><small>' + escapeHtml(station.address || station.city || 'Rabat') + '</small></span>' +
    '<span class="station-card-bubble">' + bikes + '</span>' +
    '<span class="status">' + stationAvailabilityLabel(bikes) + '</span>' +
  '</button>';
}

function stationMeta(station) {
  const bikes = Number(station.bikes_available || 0);
  return bikes + ' velo' + (bikes > 1 ? 's' : '') + ' disponible' + (bikes > 1 ? 's' : '') + ' - ' + (station.address || station.city || 'Rabat');
}

let stationMapState = null;

function selectStation(usableStations, index, marker) {
  const station = usableStations[index];
  if (!station) return;
  setText('[data-selected-station]', station.name);
  setText('[data-selected-station-meta]', stationMeta(station));
  document.querySelectorAll('[data-station-index]').forEach((item) => {
    item.classList.toggle('active', Number(item.dataset.stationIndex || -1) === index);
  });
  if (marker) marker.openPopup();
}

function renderStationFallback(mapElement, usableStations) {
  mapElement.innerHTML = '<div class="map-fallback">' + usableStations.map((station, index) => {
    const bikes = Number(station.bikes_available || 0);
    const left = 18 + ((index * 29) % 62);
    const top = 20 + ((index * 37) % 56);
    const state = bikes <= 0 ? ' is-empty' : bikes <= 3 ? ' is-low' : '';
    return '<button class="map-dot' + state + '" style="left:' + left + '%;top:' + top + '%" type="button" data-station-index="' + index + '"><span>' + bikes + '</span><small>' + escapeHtml(station.name) + '</small></button>';
  }).join('') + '</div>';
  mapElement.querySelectorAll('[data-station-index]').forEach((button) => {
    button.addEventListener('click', () => selectStation(usableStations, Number(button.dataset.stationIndex || 0)));
  });
}

function renderStationMap(stations) {
  const mapElement = document.querySelector('[data-stations-map]');
  const status = document.querySelector('[data-map-status]');
  if (!mapElement) return [];
  const usableStations = stations.filter((station) => Number.isFinite(Number(station.latitude)) && Number.isFinite(Number(station.longitude)));
  if (!usableStations.length) {
    mapElement.innerHTML = '<div class="map-empty"><strong>Carte indisponible</strong><span>Coordonnees manquantes pour les stations.</span></div>';
    if (status) status.textContent = 'Indisponible';
    return [];
  }
  if (!window.L) {
    renderStationFallback(mapElement, usableStations);
    if (status) status.textContent = 'Carte simplifiee';
    selectStation(usableStations, 0);
    stationMapState = { usableStations, markers: [] };
    return usableStations;
  }
  if (stationMapState?.map) stationMapState.map.remove();
  mapElement.dataset.ready = 'true';
  const map = window.L.map(mapElement, { scrollWheelZoom: false, zoomControl: true });
  window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);
  const bounds = [];
  const markers = [];
  usableStations.forEach((station, index) => {
    const bikes = Number(station.bikes_available || 0);
    const className = bikes <= 0 ? 'bike-bubble is-empty' : bikes <= 3 ? 'bike-bubble is-low' : 'bike-bubble';
    const icon = window.L.divIcon({ className, html: '<span>' + bikes + '</span>', iconSize: [48, 48] });
    const latLng = [Number(station.latitude), Number(station.longitude)];
    bounds.push(latLng);
    const marker = window.L.marker(latLng, { icon }).addTo(map).bindPopup('<strong>' + escapeHtml(station.name) + '</strong><br>' + stationMeta(station));
    marker.on('click', () => selectStation(usableStations, index, marker));
    markers[index] = marker;
  });
  map.fitBounds(bounds, { padding: [42, 42], maxZoom: 14 });
  map.whenReady(() => window.setTimeout(() => map.invalidateSize(), 120));
  if (status) status.textContent = usableStations.length + ' stations';
  stationMapState = { map, usableStations, markers };
  selectStation(usableStations, 0, markers[0]);
  return usableStations;
}

async function loadStations() {
  await requireUser();
  const list = document.querySelector('[data-stations-list]');
  if (!list) return;
  list.innerHTML = '<div class="station-row"><strong>Chargement...</strong><span></span><span class="status">...</span></div>';
  try {
    const { stations } = await api('/api/stations');
    const usableStations = renderStationMap(stations);
    list.innerHTML = usableStations.map(stationCard).join('') || '<div class="station-row"><strong>Aucune station</strong><span>0 velo</span><span class="status">Fermee</span></div>';
    list.querySelectorAll('[data-station-index]').forEach((button) => {
      button.addEventListener('click', () => {
        const index = Number(button.dataset.stationIndex || 0);
        const marker = stationMapState?.markers?.[index];
        if (stationMapState?.map && stationMapState.usableStations[index]) {
          stationMapState.map.flyTo([Number(stationMapState.usableStations[index].latitude), Number(stationMapState.usableStations[index].longitude)], Math.max(stationMapState.map.getZoom(), 14), { duration: 0.8 });
        }
        selectStation(usableStations, index, marker);
      });
    });
  } catch (error) {
    list.innerHTML = '<div class="station-row"><strong>' + escapeHtml(error.message) + '</strong><span></span><span class="status">Erreur</span></div>';
  }
}
async function loadProfile() {
  const user = await requireUser();
  if (!user) return;
  setText('[data-profile-name]', fullName(user));
  setText('[data-profile-email]', user.email || '');
  setText('[data-profile-phone]', user.phone || 'Non renseigne');
  try {
    const profile = await api('/api/profile');
    setText('[data-profile-subscription]', profile.subscription ? `${profile.subscription.plan} actif` : 'Aucun abonnement actif');
  } catch (error) {
    setText('[data-profile-subscription]', error.message);
  }
}

async function wireSubscription() {
  const user = await requireUser();
  const button = document.querySelector('[data-activate-subscription]');
  if (!user || !button) return;
  button.addEventListener('click', async (event) => {
    event.preventDefault();
    button.textContent = 'Activation...';
    try {
      await api('/api/subscriptions', { method: 'POST', body: JSON.stringify({ plan: 'Premium' }) });
      window.location.href = 'dashboard.html';
    } catch (error) {
      button.textContent = error.message;
    }
  });
}

async function wireSupport() {
  const user = await requireUser();
  const form = document.querySelector('[data-support-form]');
  if (!user || !form) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
      if (button) button.textContent = 'Signalement envoye';
    const message = form.querySelector('[name="message"]')?.value.trim() || '';
    const button = form.querySelector('button');
    if (button) button.textContent = 'Envoi...';
    try {
      await api('/api/support', { method: 'POST', body: JSON.stringify({ subject, message }) });
      form.reset();
      if (button) button.textContent = 'Signalement envoye';
    } catch (error) {
      if (button) button.textContent = error.message;
    }
  });
}

async function wireScanner() {
  const user = await requireUser();
  const button = document.querySelector('[data-start-ride]');
  if (!user || !button) return;
  button.addEventListener('click', async (event) => {
    event.preventDefault();
    button.textContent = 'Deblocage...';
    try {
      await api('/api/rides', { method: 'POST', body: '{}' });
      button.textContent = 'Velo debloque';
      window.setTimeout(() => { window.location.href = 'dashboard.html'; }, 800);
    } catch (error) {
      button.textContent = error.message;
    }
  });
}

function setupBottomNav() {
  const nav = document.querySelector('.bottom-nav');
  if (!nav) return;
  const page = document.body.dataset.userPage || 'dashboard';
  document.querySelectorAll('[data-bottom-nav]').forEach((link) => {
    link.classList.toggle('active', link.dataset.bottomNav === page);
  });
  let lastY = window.scrollY;
  let ticking = false;
  const update = () => {
    const currentY = window.scrollY;
    const goingDown = currentY > lastY + 8;
    const goingUp = currentY < lastY - 8;
    if (currentY < 90 || goingUp) nav.classList.remove('is-hidden-on-scroll');
    if (goingDown && currentY > 120) nav.classList.add('is-hidden-on-scroll');
    lastY = Math.max(currentY, 0);
    ticking = false;
  };
  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(update);
      ticking = true;
    }
  }, { passive: true });
}

function setupScrollReveals() {
  const selectors = ['.topbar', '.panel', '.tile', '.station-row', '.quick-actions a', '.profile-list div', '.support-list a', '.scan-frame'];
  const items = document.querySelectorAll(selectors.join(','));
  if (!items.length) return;
  items.forEach((item, index) => {
    item.classList.add('user-reveal');
    item.style.setProperty('--delay', String(Math.min(index % 4, 3) * 70) + 'ms');
  });
  if (!('IntersectionObserver' in window)) {
    items.forEach((item) => item.classList.add('is-visible'));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.14, rootMargin: '0px 0px -30px 0px' });
  items.forEach((item) => observer.observe(item));
}

wireLogout();
setupBottomNav();
setupScrollReveals();
const page = document.body.dataset.userPage;
if (page === 'dashboard') loadDashboard();
if (page === 'stations') loadStations();
if (page === 'profile') loadProfile();
if (page === 'subscription') wireSubscription();
if (page === 'support') wireSupport();
if (page === 'scanner') wireScanner();
if (page === 'admin') loadAdmin();
async function loadAdmin() {
  const user = await requireUser();
  if (!user) return;
  if (user.role !== 'admin') {
    window.location.href = 'dashboard.html';
    return;
  }
  setText('[data-admin-name]', fullName(user));
  try {
    const { stations } = await api('/api/stations');
    const totalBikes = stations.reduce((sum, station) => sum + Number(station.bikes_available || 0), 0);
    setText('[data-admin-stations]', String(stations.length));
    setText('[data-admin-bikes]', String(totalBikes));
    const list = document.querySelector('[data-admin-station-list]');
    if (list) {
      list.innerHTML = stations.map((station) => `<div class="station-row"><strong>${escapeHtml(station.name)}</strong><span>${Number(station.bikes_available || 0)} velos</span><span class="status">${station.latitude && station.longitude ? 'Carte prete' : 'A completer'}</span></div>`).join('');
    }
  } catch (error) {
    setText('[data-admin-error]', error.message);
  }
}
