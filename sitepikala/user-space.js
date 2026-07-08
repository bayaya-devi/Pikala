let currentUser = null;

function fullName(user) {
  return [user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'Utilisateur Pikala';
}

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Erreur serveur.');
  return data;
}

async function requireUser() {
  if (currentUser) return currentUser;
  try {
    const data = await api('/api/me');
    currentUser = data.user;
    return currentUser;
  } catch {
    window.location.href = 'connexion.html';
    return null;
  }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\'': '&#39;', '"': '&quot;' }[char]));
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

wireLogout();
const page = document.body.dataset.userPage;
if (page === 'dashboard') loadDashboard();
if (page === 'stations') loadStations();
if (page === 'profile') loadProfile();
if (page === 'subscription') wireSubscription();
if (page === 'support') wireSupport();
if (page === 'scanner') wireScanner();