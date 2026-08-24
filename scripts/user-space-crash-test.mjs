const base = process.argv[2] || 'http://127.0.0.1:8796';
const origin = new URL(base).origin;
const stamp = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const email = `user-space-${stamp}@example.test`;
const password = 'Pikala user space secure password!';
const checks = [];

class Client {
  constructor() { this.cookies = new Map(); }
  absorb(response) {
    const headers = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [response.headers.get('set-cookie')].filter(Boolean);
    for (const header of headers) { const pair = header.split(';')[0]; const index = pair.indexOf('='); if (index > 0) this.cookies.set(pair.slice(0, index), pair.slice(index + 1)); }
  }
  async request(path, { method = 'GET', body } = {}) {
    const headers = { accept: 'application/json' }; if (body !== undefined) headers['content-type'] = 'application/json';
    if (!['GET', 'HEAD'].includes(method)) { headers['x-pikala-request'] = 'web'; headers.origin = origin; }
    if (this.cookies.size) headers.cookie = [...this.cookies].map(([key, value]) => `${key}=${value}`).join('; ');
    const response = await fetch(new URL(path, base), { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' }); this.absorb(response);
    const data = (response.headers.get('content-type') || '').includes('json') ? await response.json() : null; return { response, data };
  }
}

function check(name, condition, detail = '') { if (!condition) throw new Error(`${name}: ${detail || 'échec'}`); checks.push(name); }

const anonymous = new Client();
let value = await anonymous.request('/api/user/stations'); check('stations privées protégées', value.response.status === 401, `${value.response.status}`);
value = await anonymous.request('/api/dashboard'); check('dashboard API protégé', value.response.status === 401, `${value.response.status}`);
value = await anonymous.request('/api/signup', { method: 'POST', body: { firstName: 'Parcours', lastName: 'Utilisateur', email, password, locale: 'fr' } });
check('inscription', value.response.status === 202 && value.data.verificationUrl, `${value.response.status}`);
let response = await fetch(value.data.verificationUrl, { redirect: 'manual' }); check('vérification email', response.status === 303, `${response.status}`);
const user = new Client(); value = await user.request('/api/login', { method: 'POST', body: { email, password } }); check('connexion', value.response.status === 200, `${value.response.status}`);

value = await user.request('/api/dashboard'); check('dashboard sans position', value.response.status === 200 && value.data.nearestStation === null && Array.isArray(value.data.recentRides), `${value.response.status}`);
value = await user.request('/api/dashboard?lat=34.02&lng=-6.84'); check('station la plus proche calculée', value.response.status === 200 && value.data.nearestStation?.distance_meters >= 0, JSON.stringify(value.data.nearestStation));
value = await user.request('/api/user/stations'); check('liste stations réelle', value.response.status === 200 && value.data.stations.length > 0, `${value.response.status}`);
const station = value.data.stations[0];
value = await user.request(`/api/stations/${encodeURIComponent(station.public_code || station.id)}`); check('fiche station', value.response.status === 200 && value.data.station.id === station.id, `${value.response.status}`);
value = await user.request('/api/stations/introuvable'); check('station absente', value.response.status === 404 && value.data.code === 'STATION_NOT_FOUND', `${value.response.status}`);
value = await user.request('/api/rides'); check('historique vide réel', value.response.status === 200 && Array.isArray(value.data.rides), `${value.response.status}`);
value = await user.request('/api/rides', { method: 'POST', body: {} }); check('code vélo obligatoire', value.response.status === 400 && value.data.code === 'BIKE_CODE_REQUIRED', `${value.response.status}`);
value = await user.request('/api/rides', { method: 'POST', body: { bikeCode: 'DEV-BIKE-001' } }); check('abonnement obligatoire', value.response.status === 409 && value.data.code === 'SUBSCRIPTION_REQUIRED', `${value.response.status} ${value.data?.code}`);
value = await user.request('/api/plans'); const plan = value.data.plans[0]; check('plan disponible', Boolean(plan));
value = await user.request('/api/subscriptions', { method: 'POST', body: { plan: plan.slug } }); check('abonnement activé', value.response.status === 201, `${value.response.status}`);
value = await user.request('/api/rides', { method: 'POST', body: { bikeCode: 'CODE-INCONNU' } }); check('vélo inconnu refusé', value.response.status === 409 && value.data.code === 'BIKE_UNAVAILABLE', `${value.response.status}`);
value = await user.request('/api/rides', { method: 'POST', body: { bikeCode: 'DEV-BIKE-001' } }); check('trajet réel démarré', value.response.status === 201 && value.data.ride.bike_code, `${value.response.status} ${value.data?.code}`);
value = await user.request('/api/rides', { method: 'POST', body: { bikeCode: 'DEV-BIKE-002' } }); check('second trajet actif refusé', value.response.status === 409 && value.data.code === 'RIDE_ALREADY_ACTIVE', `${value.response.status} ${value.data?.code}`);
value = await user.request('/api/dashboard?lat=34.02&lng=-6.84'); check('trajet actif visible dashboard', value.response.status === 200 && value.data.activeRide?.bike_code, `${value.response.status}`);
value = await user.request('/api/rides'); check('trajet présent dans historique', value.response.status === 200 && value.data.rides.some((ride) => ride.status === 'active'), `${value.response.status}`);

console.log(`Crash-test espace utilisateur valide : ${checks.length} scénarios.\n${checks.map((item) => `- ${item}`).join('\n')}`);
