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
  if (data?.code === 'DB_UNAVAILABLE' || raw.includes('D1 DB') || raw.includes('base de données')) {
    return 'Service temporairement indisponible : la base Cloudflare D1 doit être reconnectée.';
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
    setText('[data-nearest-station]', nearest ? `${nearest.name} : ${nearest.bikes_available} vélos disponibles.` : 'Aucune station disponible.');
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

async function loadStations() {
  await requireUser();
  const list = document.querySelector('[data-stations-list]');
  if (!list) return;
  list.innerHTML = '<div class="station-row"><strong>Chargement...</strong><span></span><span class="status">...</span></div>';
  try {
    const { stations } = await api('/api/stations');
    list.innerHTML = stations.map((station) => `<div class="station-row"><strong>${escapeHtml(station.name)}</strong><span>${Number(station.bikes_available || 0)} vélos</span><span class="status">Ouverte</span></div>`).join('') || '<div class="station-row"><strong>Aucune station</strong><span>0 vélo</span><span class="status">Fermée</span></div>';
  } catch (error) {
    list.innerHTML = `<div class="station-row"><strong>${escapeHtml(error.message)}</strong><span></span><span class="status">Erreur</span></div>`;
  }
}

async function loadProfile() {
  const user = await requireUser();
  if (!user) return;
  setText('[data-profile-name]', fullName(user));
  setText('[data-profile-email]', user.email || '');
  setText('[data-profile-phone]', user.phone || 'Non renseigné');
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
    const subject = form.querySelector('[name="subject"]')?.value.trim() || 'Signalement Pikala';
    const message = form.querySelector('[name="message"]')?.value.trim() || '';
    const button = form.querySelector('button');
    if (button) button.textContent = 'Envoi...';
    try {
      await api('/api/support', { method: 'POST', body: JSON.stringify({ subject, message }) });
      form.reset();
      if (button) button.textContent = 'Signalement envoyé';
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
    button.textContent = 'Déblocage...';
    try {
      await api('/api/rides', { method: 'POST', body: '{}' });
      button.textContent = 'Vélo débloqué';
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
      list.innerHTML = stations.map((station) => `<div class="station-row"><strong>${escapeHtml(station.name)}</strong><span>${Number(station.bikes_available || 0)} vélos</span><span class="status">${station.latitude && station.longitude ? 'Carte prête' : 'À compléter'}</span></div>`).join('');
    }
  } catch (error) {
    setText('[data-admin-error]', error.message);
  }
}
