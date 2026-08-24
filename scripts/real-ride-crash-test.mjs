const base = process.argv[2] || 'http://127.0.0.1:8799';
const origin = new URL(base).origin;
const password = 'Pikala phase seven secure password!';
const checks = [];

class Client {
  constructor() { this.cookies = new Map(); }
  absorb(response) {
    const values = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [response.headers.get('set-cookie')].filter(Boolean);
    for (const header of values) { const pair = header.split(';')[0]; const index = pair.indexOf('='); if (index > 0) this.cookies.set(pair.slice(0, index), pair.slice(index + 1)); }
  }
  async request(path, { method = 'GET', body } = {}) {
    const headers = { accept: 'application/json' };
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (!['GET', 'HEAD'].includes(method)) { headers['x-pikala-request'] = 'web'; headers.origin = origin; }
    if (this.cookies.size) headers.cookie = [...this.cookies].map(([key, value]) => `${key}=${value}`).join('; ');
    const response = await fetch(new URL(path, base), { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
    this.absorb(response);
    const data = (response.headers.get('content-type') || '').includes('json') ? await response.json() : null;
    return { response, data };
  }
}

function check(name, condition, detail = '') {
  if (!condition) throw new Error(`${name}: ${detail || 'échec'}`);
  checks.push(name);
}

async function createRider(index) {
  const client = new Client();
  const labels = ['Un', 'Deux', 'Trois', 'Quatre', 'Cinq', 'Six'];
  const email = `ride-${Date.now()}-${index}-${Math.random().toString(16).slice(2)}@example.test`;
  let value = await client.request('/api/signup', { method: 'POST', body: { firstName: 'Test', lastName: `Trajet ${labels[index - 1]}`, email, password, locale: index % 2 ? 'ar' : 'fr' } });
  check(`inscription utilisateur ${index}`, value.response.status === 202 && value.data.verificationUrl, `${value.response.status}`);
  const verification = await fetch(value.data.verificationUrl, { redirect: 'manual' });
  check(`vérification utilisateur ${index}`, verification.status === 303, `${verification.status}`);
  value = await client.request('/api/login', { method: 'POST', body: { email, password } });
  check(`connexion utilisateur ${index}`, value.response.status === 200, `${value.response.status}`);
  value = await client.request('/api/subscriptions', { method: 'POST', body: { plan: 'dev-monthly' } });
  check(`abonnement utilisateur ${index}`, value.response.status === 201, `${value.response.status}`);
  return client;
}

const anonymous = new Client();
let value = await anonymous.request('/api/rides/active');
check('trajet actif protégé', value.response.status === 401, `${value.response.status}`);
const riders = [];
for (const index of [1, 2, 3, 4]) riders.push(await createRider(index));
const [a, b, c, d] = riders;

value = await a.request('/api/rides', { method: 'POST', body: { qrPayload: 'not a valid qr payload' } });
check('QR invalide refusé', value.response.status === 400 && value.data.code === 'QR_INVALID', `${value.response.status} ${value.data?.code}`);
value = await a.request('/api/rides', { method: 'POST', body: { qrPayload: 'bike-unknown' } });
check('QR inconnu refusé', value.response.status === 404 && value.data.code === 'QR_UNKNOWN', `${value.response.status} ${value.data?.code}`);
value = await a.request('/api/rides', { method: 'POST', body: { qrPayload: 'dev-bike-004' } });
check('vélo en maintenance refusé', value.response.status === 409 && value.data.code === 'BIKE_MAINTENANCE', `${value.response.status} ${value.data?.code}`);

const collision = await Promise.all([
  a.request('/api/rides', { method: 'POST', body: { qrPayload: 'pikala://bike/dev-bike-005' } }),
  b.request('/api/rides', { method: 'POST', body: { qrPayload: 'dev-bike-005' } })
]);
const winners = collision.filter((item) => item.response.status === 201);
const losers = collision.filter((item) => item.response.status === 409 && item.data.code === 'BIKE_UNAVAILABLE');
check('deux utilisateurs simultanés : un seul gagne', winners.length === 1 && losers.length === 1, JSON.stringify(collision.map((item) => [item.response.status, item.data?.code])));
const owner = collision[0].response.status === 201 ? a : b;
const outsider = owner === a ? b : a;
const sharedRide = winners[0].data.ride;

value = await outsider.request('/api/rides', { method: 'POST', body: { qrPayload: 'dev-bike-005' } });
check('vélo déjà utilisé refusé', value.response.status === 409 && value.data.code === 'BIKE_UNAVAILABLE', `${value.response.status} ${value.data?.code}`);
value = await outsider.request(`/api/rides/${sharedRide.id}`);
check('détail trajet tiers masqué', value.response.status === 404 && value.data.code === 'RIDE_NOT_FOUND', `${value.response.status}`);
value = await outsider.request(`/api/rides/${sharedRide.id}/return`, { method: 'POST', body: { dockCode: 'dev-dock-oudayas-04' } });
check('restitution trajet tiers refusée', value.response.status === 404 && value.data.code === 'RIDE_NOT_FOUND', `${value.response.status}`);
value = await outsider.request(`/api/rides/${sharedRide.id}/incidents`, { method: 'POST', body: { category: 'lock', description: 'Test interdit' } });
check('incident trajet tiers refusé', value.response.status === 404 && value.data.code === 'RIDE_NOT_FOUND', `${value.response.status}`);

value = await owner.request(`/api/rides/${sharedRide.id}/incidents`, { method: 'POST', body: { category: 'mechanical', description: 'La pédale droite fait un bruit inhabituel.' } });
check('incident propriétaire enregistré', value.response.status === 201, `${value.response.status} ${value.data?.code}`);
value = await owner.request(`/api/rides/${sharedRide.id}/return`, { method: 'POST', body: { dockCode: 'dock-unknown' } });
check('quai inconnu refusé', value.response.status === 404 && value.data.code === 'DOCK_UNKNOWN', `${value.response.status} ${value.data?.code}`);
value = await owner.request(`/api/rides/${sharedRide.id}/return`, { method: 'POST', body: { dockCode: 'dev-dock-oudayas-01' } });
check('quai occupé refusé', value.response.status === 409 && value.data.code === 'DOCK_UNAVAILABLE', `${value.response.status} ${value.data?.code}`);
value = await owner.request(`/api/rides/${sharedRide.id}/return`, { method: 'POST', body: { qrPayload: 'pikala://dock/dev-dock-oudayas-04' } });
check('restitution valide', value.response.status === 200 && value.data.ride.status === 'completed' && value.data.ride.end_dock_code === 'dev-dock-oudayas-04', `${value.response.status} ${value.data?.code}`);
value = await owner.request(`/api/rides/${sharedRide.id}/return`, { method: 'POST', body: { dockCode: 'dev-dock-hassan-04' } });
check('double restitution refusée', value.response.status === 409 && value.data.code === 'RIDE_ALREADY_ENDED', `${value.response.status} ${value.data?.code}`);

const doubleStart = await Promise.all([
  c.request('/api/rides', { method: 'POST', body: { bikeCode: 'DEV-BIKE-006' } }),
  c.request('/api/rides', { method: 'POST', body: { bikeCode: 'DEV-BIKE-006' } })
]);
check('double clic Start idempotent', doubleStart.filter((item) => item.response.status === 201).length === 1 && doubleStart.filter((item) => item.response.status === 409).length === 1, JSON.stringify(doubleStart.map((item) => [item.response.status, item.data?.code])));
const cRide = doubleStart.find((item) => item.response.status === 201).data.ride;
value = await c.request('/api/rides', { method: 'POST', body: { bikeCode: 'DEV-BIKE-002' } });
check('utilisateur avec trajet actif refusé', value.response.status === 409 && value.data.code === 'RIDE_ALREADY_ACTIVE', `${value.response.status} ${value.data?.code}`);
value = await c.request('/api/rides/active');
check('trajet actif récupéré', value.response.status === 200 && value.data.ride.id === cRide.id, `${value.response.status}`);
value = await c.request(`/api/rides/${cRide.id}/return`, { method: 'POST', body: { dockCode: 'dev-dock-hassan-04' } });
check('second trajet restitué', value.response.status === 200 && value.data.ride.duration_seconds >= 0, `${value.response.status}`);
value = await c.request('/api/rides');
check('historique et détail réels', value.response.status === 200 && value.data.rides.some((ride) => ride.id === cRide.id && ride.status === 'completed'), `${value.response.status}`);

console.log(`Crash-test trajets réels valide : ${checks.length} contrôles.\n${checks.map((item) => `- ${item}`).join('\n')}`);
