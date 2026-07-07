const session = {
  get user() {
    try { return JSON.parse(localStorage.getItem('pikala-user') || 'null'); } catch { return null; }
  },
  set user(value) { localStorage.setItem('pikala-user', JSON.stringify(value)); },
  clear() { localStorage.removeItem('pikala-user'); }
};

function fullName(user) {
  return [user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'Utilisateur Pikala';
}

function requireUser() {
  const user = session.user;
  if (!user) {
    window.location.href = 'connexion.html';
    return null;
  }
  return user;
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

function wireLogout() {
  document.querySelectorAll('[data-logout]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      session.clear();
      window.location.href = 'index.html';
    });
  });
}

async function loadDashboard() {
  const user = requireUser();
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
    const profile = await api(`/api/profile?userId=${encodeURIComponent(user.id)}`);
    setText('[data-subscription-status]', profile.subscription ? profile.subscription.plan : 'Aucun');
  } catch {
    setText('[data-subscription-status]', 'Aucun');
  }
}

async function loadStations() {
  requireUser();
  const list = document.querySelector('[data-stations-list]');
  if (!list) return;
  list.innerHTML = '<div class="station-row"><strong>Chargement...</strong><span></span><span class="status">...</span></div>';
  try {
    const { stations } = await api('/api/stations');
    list.innerHTML = stations.map((station) => `<div class="station-row"><strong>${station.name}</strong><span>${station.bikes_available} vélos</span><span class="status">Ouverte</span></div>`).join('') || '<div class="station-row"><strong>Aucune station</strong><span>0 vélo</span><span class="status">Fermée</span></div>';
  } catch (error) {
    list.innerHTML = `<div class="station-row"><strong>${error.message}</strong><span></span><span class="status">Erreur</span></div>`;
  }
}

async function loadProfile() {
  const user = requireUser();
  if (!user) return;
  setText('[data-profile-name]', fullName(user));
  setText('[data-profile-email]', user.email || '');
  setText('[data-profile-phone]', user.phone || 'Non renseigné');
  try {
    const profile = await api(`/api/profile?userId=${encodeURIComponent(user.id)}`);
    if (profile.user) session.user = profile.user;
    setText('[data-profile-subscription]', profile.subscription ? `${profile.subscription.plan} actif` : 'Aucun abonnement actif');
  } catch (error) {
    setText('[data-profile-subscription]', error.message);
  }
}

function wireSubscription() {
  const user = requireUser();
  const button = document.querySelector('[data-activate-subscription]');
  if (!user || !button) return;
  button.addEventListener('click', async (event) => {
    event.preventDefault();
    button.textContent = 'Activation...';
    try {
      await api('/api/subscriptions', { method: 'POST', body: JSON.stringify({ userId: user.id, plan: 'Premium' }) });
      window.location.href = 'dashboard.html';
    } catch (error) {
      button.textContent = error.message;
    }
  });
}

function wireSupport() {
  const user = requireUser();
  const form = document.querySelector('[data-support-form]');
  if (!user || !form) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const subject = form.querySelector('[name="subject"]')?.value.trim() || 'Signalement Pikala';
    const message = form.querySelector('[name="message"]')?.value.trim() || '';
    const button = form.querySelector('button');
    if (button) button.textContent = 'Envoi...';
    try {
      await api('/api/support', { method: 'POST', body: JSON.stringify({ userId: user.id, name: fullName(user), email: user.email, subject, message }) });
      form.reset();
      if (button) button.textContent = 'Signalement envoyé';
    } catch (error) {
      if (button) button.textContent = error.message;
    }
  });
}

function wireScanner() {
  const user = requireUser();
  const button = document.querySelector('[data-start-ride]');
  if (!user || !button) return;
  button.addEventListener('click', async (event) => {
    event.preventDefault();
    button.textContent = 'Déblocage...';
    try {
      await api('/api/rides', { method: 'POST', body: JSON.stringify({ userId: user.id }) });
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