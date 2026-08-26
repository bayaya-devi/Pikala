const base = process.argv[2] || 'http://127.0.0.1:8890';
const origin = new URL(base).origin;
const riderPassword = 'Pikala IoT secure test password!';
const checks = [];

class Client {
  constructor() { this.cookies = new Map(); }
  absorb(response) {
    const values = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [response.headers.get('set-cookie')].filter(Boolean);
    for (const header of values) { const pair = header.split(';')[0], index = pair.indexOf('='); if (index > 0) this.cookies.set(pair.slice(0, index), pair.slice(index + 1)); }
  }
  async request(path, { method = 'GET', body, headers: extraHeaders = {} } = {}) {
    const headers = { accept: 'application/json', ...extraHeaders };
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (!['GET', 'HEAD'].includes(method)) { headers['x-pikala-request'] = 'web'; headers.origin = origin; }
    if (this.cookies.size) headers.cookie = [...this.cookies].map(([key, value]) => `${key}=${value}`).join('; ');
    const response = await fetch(new URL(path, base), { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
    this.absorb(response);
    const data = (response.headers.get('content-type') || '').includes('json') ? await response.json() : null;
    return { response, data };
  }
}
function check(name, condition, detail = '') { if (!condition) throw new Error(`${name}: ${detail || 'echec'}`); checks.push(name); }
async function sign(secret, raw) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(raw)));
  return Buffer.from(bytes).toString('base64url');
}
async function sendDeviceEvent(credential, event) {
  const raw = JSON.stringify(event);
  return fetch(new URL('/api/iot/events', base), { method: 'POST', headers: { 'content-type': 'application/json', 'x-pikala-key-id': credential.keyId, 'x-pikala-signature': await sign(credential.secret, raw) }, body: raw });
}
function command(action,targetId,reason,data={}){return{action,targetId,reason,data,idempotencyKey:crypto.randomUUID(),confirmation:`PIKALA ${action.toUpperCase()}`};}

const rider = new Client();
const email = `iot-${Date.now()}@example.test`;
let value = await rider.request('/api/signup', { method: 'POST', body: { firstName: 'Test', lastName: 'IoT', email, password: riderPassword, locale: 'fr' } });
check('inscription test', value.response.status === 202 && value.data.verificationUrl, `${value.response.status}`);
check('verification email', (await fetch(value.data.verificationUrl, { redirect: 'manual' })).status === 303);
value = await rider.request('/api/login', { method: 'POST', body: { email, password: riderPassword } });
check('connexion test', value.response.status === 200, `${value.response.status}`);
value = await rider.request('/api/subscriptions/checkout', { method: 'POST', headers: { 'idempotency-key': crypto.randomUUID() }, body: { plan: 'dev-monthly' } });
check('abonnement local', value.response.status === 201, `${value.response.status} ${value.data?.code || ''}`);

const admin = new Client();
value = await admin.request('/api/login', { method: 'POST', body: { email: 'rbac-super@example.test', password: 'Pikala admin phase nine password!' } });
check('connexion super admin', value.response.status === 200, `${value.response.status}`);
value = await admin.request('/api/admin/control-center/devices');
const lockDevice = value.data.items.find((item) => item.public_code === 'iot-lock-bike-005');
check('device visible par admin', value.response.status === 200 && lockDevice?.id, JSON.stringify(value.data));
value = await admin.request(`/api/admin/iot/devices/${lockDevice.id}/credentials`, { method: 'POST', body: { reason: 'Rotation reservee au crash-test IoT local' } });
check('credential genere une seule fois', value.response.status === 201 && value.data.keyId && value.data.secret, JSON.stringify(value.data));
const credential = value.data;
value = await admin.request('/api/admin/control-center/devices');
const dockDevice = value.data.items.find((item) => item.public_code === 'iot-dock-oudayas-04');
value = await admin.request(`/api/admin/iot/devices/${dockDevice.id}/credentials`, { method: 'POST', body: { reason: 'Rotation du dock pour crash-test IoT local' } });
check('credential dock distinct', value.response.status === 201 && value.data.keyId !== credential.keyId, JSON.stringify(value.data));
const dockCredential = value.data;

const startKey = crypto.randomUUID();
value = await rider.request('/api/rides', { method: 'POST', body: { bikeCode: 'DEV-BIKE-005', idempotencyKey: startKey } });
check('deverrouillage en attente materiel', value.response.status === 202 && value.data.pendingHardware && value.data.ride.status === 'reserved', JSON.stringify(value.data));
const rideId = value.data.ride.id, unlockCommand = value.data.command.id;
value = await rider.request('/api/rides', { method: 'POST', body: { bikeCode: 'DEV-BIKE-005', idempotencyKey: startKey } });
check('start idempotent', value.response.status === 202 && value.data.ride.id === rideId, `${value.response.status}`);
let delayed = { eventId: `evt-${crypto.randomUUID()}`, nonce: crypto.randomUUID(), timestamp: new Date(Date.now()-3600000).toISOString(), type: 'command.result', payload: { commandId: unlockCommand, status: 'completed' } };
let eventResponse = await sendDeviceEvent(credential, delayed);
check('evenement retarde refuse', eventResponse.status === 401, `${eventResponse.status}`);
const wrongEvent = { eventId: `evt-${crypto.randomUUID()}`, nonce: crypto.randomUUID(), timestamp: new Date().toISOString(), type: 'command.result', payload: { commandId: unlockCommand, status: 'completed' } };
eventResponse = await sendDeviceEvent(dockCredential, wrongEvent);
check('accuse du mauvais device refuse', eventResponse.status === 409, `${eventResponse.status} ${await eventResponse.text()}`);
const eventBody = { eventId: `evt-${crypto.randomUUID()}`, nonce: crypto.randomUUID(), timestamp: new Date().toISOString(), type: 'command.result', payload: { commandId: unlockCommand, status: 'completed', connectivityStatus: 'online', batteryLevel: 90, lockStatus: 'unlocked' } };
const rawEvent = JSON.stringify(eventBody), eventHeaders = { 'content-type': 'application/json', 'x-pikala-key-id': credential.keyId };
eventResponse = await fetch(new URL('/api/iot/events', base), { method: 'POST', headers: { ...eventHeaders, 'x-pikala-signature': 'signature-invalide' }, body: rawEvent });
check('mauvaise signature refusee', eventResponse.status === 401, `${eventResponse.status}`);
eventHeaders['x-pikala-signature'] = await sign(credential.secret, rawEvent);
eventResponse = await fetch(new URL('/api/iot/events', base), { method: 'POST', headers: eventHeaders, body: rawEvent });
check('confirmation unlock signee', eventResponse.status === 202, `${eventResponse.status} ${await eventResponse.text()}`);
eventResponse = await fetch(new URL('/api/iot/events', base), { method: 'POST', headers: eventHeaders, body: rawEvent });
const replay = await eventResponse.json();
check('rejeu signe deduplique', eventResponse.status === 200 && replay.duplicate === true, `${eventResponse.status} ${JSON.stringify(replay)}`);
value = await rider.request('/api/rides/active');
check('trajet actif seulement apres confirmation', value.response.status === 200 && value.data.ride.id === rideId && value.data.ride.status === 'active', JSON.stringify(value.data));

const lockKey = crypto.randomUUID();
value = await rider.request(`/api/rides/${rideId}/return`, { method: 'POST', body: { dockCode: 'dev-dock-oudayas-04', idempotencyKey: lockKey } });
check('verrouillage en attente materiel', value.response.status === 202 && value.data.pendingHardware, JSON.stringify(value.data));
const lockCommand = value.data.command.id;
value = await rider.request(`/api/rides/${rideId}/return`, { method: 'POST', body: { dockCode: 'dev-dock-oudayas-04', idempotencyKey: lockKey } });
check('restitution idempotente', value.response.status === 202 && value.data.command.id === lockCommand, `${value.response.status}`);
value = await admin.request('/api/admin/iot/simulate', { method: 'POST', body: { commandId: lockCommand, outcome: 'completed' } });
check('confirmation lock device', value.response.status === 200 && value.data.status === 'completed', JSON.stringify(value.data));
value = await rider.request(`/api/rides/${rideId}`);
check('trajet termine seulement apres verrouillage', value.response.status === 200 && value.data.ride.status === 'completed' && value.data.ride.end_dock_code === 'dev-dock-oudayas-04', JSON.stringify(value.data));
value = await admin.request('/api/admin/iot/simulate', { method: 'POST', body: { commandId: lockCommand, outcome: 'duplicate' } });
check('double accuse sans double restitution', value.response.status === 200, `${value.response.status}`);

const timeoutKey = crypto.randomUUID();
value = await rider.request('/api/rides', { method: 'POST', body: { bikeCode: 'DEV-BIKE-005', idempotencyKey: timeoutKey } });
check('nouvelle reservation', value.response.status === 202, `${value.response.status} ${value.data?.code || ''}`);
value = await admin.request('/api/admin/iot/simulate', { method: 'POST', body: { commandId: value.data.command.id, outcome: 'timeout' } });
check('timeout commande', value.response.status === 200 && value.data.status === 'expired', JSON.stringify(value.data));
value = await rider.request('/api/rides/active');
check('reservation liberee apres timeout', value.response.status === 200 && value.data.ride === null, `${value.response.status} ${JSON.stringify(value.data)}`);

const offlineEvent={eventId:`evt-${crypto.randomUUID()}`,nonce:crypto.randomUUID(),timestamp:new Date().toISOString(),type:'telemetry',payload:{connectivityStatus:'offline'}};
eventResponse=await sendDeviceEvent(credential,offlineEvent);check('telemetrie offline acceptee',eventResponse.status===202,`${eventResponse.status}`);
value=await rider.request('/api/rides',{method:'POST',body:{bikeCode:'DEV-BIKE-005',idempotencyKey:crypto.randomUUID()}});check('serrure hors ligne bloque location',value.response.status===409&&value.data.code==='DEVICE_OFFLINE',JSON.stringify(value.data));
const onlineEvent={eventId:`evt-${crypto.randomUUID()}`,nonce:crypto.randomUUID(),timestamp:new Date().toISOString(),type:'telemetry',payload:{connectivityStatus:'online'}};await sendDeviceEvent(credential,onlineEvent);
value=await admin.request('/api/admin/stations?limit=100');const sourceStation=value.data.items.find(item=>item.public_code==='dev-station-oudayas');
value=await admin.request('/api/admin/control-center/actions',{method:'POST',body:command('station.close',sourceStation.id,'Fermeture temporaire pour crash-test IoT')});check('station fermee par commande forte',value.response.status===201,JSON.stringify(value.data));
value=await rider.request('/api/rides',{method:'POST',body:{bikeCode:'DEV-BIKE-005',idempotencyKey:crypto.randomUUID()}});check('station fermee bloque location',value.response.status===409&&value.data.code==='STATION_CLOSED',JSON.stringify(value.data));
await admin.request('/api/admin/control-center/actions',{method:'POST',body:command('station.open',sourceStation.id,'Reouverture apres crash-test IoT')});
value=await rider.request('/api/rides',{method:'POST',body:{bikeCode:'DEV-BIKE-004',idempotencyKey:crypto.randomUUID()}});check('velo maintenance bloque en mode IoT',value.response.status===409&&value.data.code==='BIKE_MAINTENANCE',JSON.stringify(value.data));

console.log(`Crash-test IoT valide : ${checks.length} controles.`);
for (const item of checks) console.log(`- ${item}`);
