const base = process.argv[2] || 'http://127.0.0.1:8840';
const origin = new URL(base).origin;
const checks = [];
const password = 'Pikala admin phase nine password!';

class Client {
  constructor() { this.cookies = new Map(); }
  absorb(response) {
    const values = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [response.headers.get('set-cookie')].filter(Boolean);
    for (const header of values) {
      const pair = header.split(';')[0]; const index = pair.indexOf('=');
      if (index > 0) this.cookies.set(pair.slice(0, index), pair.slice(index + 1));
    }
  }
  async request(path, { method = 'GET', body, redirect = 'manual' } = {}) {
    const headers = { accept:'application/json' };
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (!['GET','HEAD'].includes(method)) { headers['x-pikala-request'] = 'web'; headers.origin = origin; }
    if (this.cookies.size) headers.cookie = [...this.cookies].map(([key, value]) => `${key}=${value}`).join('; ');
    const response = await fetch(new URL(path, base), { method, headers, body:body === undefined ? undefined : JSON.stringify(body), redirect });
    this.absorb(response);
    const data = (response.headers.get('content-type') || '').includes('json') ? await response.json() : null;
    return { response, data };
  }
}

function check(name, condition, detail = '') {
  if (!condition) throw new Error(`${name}: ${detail || 'échec'}`);
  checks.push(name);
}

function command(action, targetId, reason, data = {}, key = crypto.randomUUID()) {
  return { action, targetId, reason, data, idempotencyKey:`control-${key}`, confirmation:`PIKALA ${action.toUpperCase()}` };
}

async function createNormalUser() {
  const client = new Client(); const email = `control-user-${Date.now()}@example.test`; const userPassword = 'Pikala control user password!';
  let value = await client.request('/api/signup', { method:'POST', body:{ firstName:'Utilisateur', lastName:'Control', email, password:userPassword, locale:'fr' } });
  check('inscription utilisateur', value.response.status === 202 && value.data.verificationUrl, String(value.response.status));
  const verified = await fetch(value.data.verificationUrl, { redirect:'manual' });
  check('vérification utilisateur', verified.status === 303, String(verified.status));
  value = await client.request('/api/login', { method:'POST', body:{ email, password:userPassword } });
  check('connexion utilisateur', value.response.status === 200 && value.data.user?.id, String(value.response.status));
  return { client, userId:value.data.user.id, email, password:userPassword };
}

const admin = new Client();
let value = await admin.request('/api/login', { method:'POST', body:{ email:'admin-phase9@example.test', password } });
check('connexion administrateur', value.response.status === 200 && value.data.user?.role === 'admin', `${value.response.status} ${value.data?.user?.role}`);
const normal = await createNormalUser();

value = await normal.client.request('/api/admin/control-center');
check('RBAC lecture utilisateur refusée', value.response.status === 403 && value.data.code === 'FORBIDDEN', String(value.response.status));
value = await normal.client.request('/api/admin/control-center/actions', { method:'POST', body:command('service.maintenance', null, 'Tentative utilisateur interdite') });
check('RBAC action utilisateur refusée', value.response.status === 403, String(value.response.status));

value = await admin.request('/api/admin/control-center');
check('dashboard réseau', value.response.status === 200 && value.data.metrics?.bikes && Array.isArray(value.data.attention) && value.data.configuration?.database === 'operational', JSON.stringify(value.data));
for (const domain of ['employees','docks','inspections','missions','rebalancing','automations','devices','alerts','entitlements','overrides']) {
  value = await admin.request(`/api/admin/control-center/${domain}`);
  check(`liste ${domain}`, value.response.status === 200 && Array.isArray(value.data.items), String(value.response.status));
}

value = await admin.request('/api/admin/control-center/actions', { method:'POST', body:{ ...command('service.maintenance', null, 'Maintenance globale planifiée'), confirmation:'CONFIRMER' } });
check('confirmation forte obligatoire', value.response.status === 400 && value.data.code === 'CONTROL_CONFIRMATION_REQUIRED', String(value.response.status));
value = await admin.request('/api/admin/control-center/actions', { method:'POST', body:command('service.maintenance', null, 'court') });
check('motif long obligatoire', value.response.status === 400, String(value.response.status));

const employeeKey = `staff-${crypto.randomUUID()}`;
const staffBody = { email:normal.email, employeeCode:`EMP-${normal.userId}`, role:'field_agent', hireDate:new Date().toISOString().slice(0,10), zoneIds:[1], reason:'Création du profil agent pour les opérations', idempotencyKey:employeeKey, confirmation:'PIKALA STAFF.CREATE' };
value = await admin.request('/api/admin/staff', { method:'POST', body:staffBody });
check('création employé RBAC', value.response.status === 201 && value.data.success, JSON.stringify(value.data));
value = await admin.request('/api/admin/staff', { method:'POST', body:staffBody });
check('idempotence employé RBAC', value.response.status === 200 && value.data.idempotent, JSON.stringify(value.data));
value = await admin.request('/api/admin/control-center/actions', { method:'POST', body:command('employee.upsert', null, 'Tentative sur le flux employé historique', { userId:normal.userId, employeeCode:`OLD-${normal.userId}`, jobRole:'operator' }) });
check('ancien flux employé neutralisé', value.response.status === 410 && value.data.code === 'STAFF_LEGACY_ROUTE_REMOVED', JSON.stringify(value.data));
value = await normal.client.request('/api/login', { method:'POST', body:{ email:normal.email, password:normal.password } });
check('reconnexion obligatoire après attribution du rôle', value.response.status === 200, JSON.stringify(value.data));
const stations = await admin.request('/api/admin/stations?limit=100');
const bikes = await admin.request('/api/admin/bikes?limit=100&status=available');
const bike = bikes.data.items[0]; const station = stations.data.items.find((item) => item.id === bike?.station_id);
check('fixtures réseau disponibles', Boolean(station?.id && bike?.id), JSON.stringify({ station, bike }));

value = await admin.request('/api/admin/control-center/actions', { method:'POST', body:command('inspection.create', null, 'Inspection préventive programmée par le Control Center', { inspectionType:'bike', bikeId:bike.id, userId:normal.userId, dueAt:new Date(Date.now() + 3600000).toISOString() }) });
check('création inspection', value.response.status === 201 && value.data.targetType === 'inspection', JSON.stringify(value.data));
value = await admin.request('/api/admin/control-center/actions', { method:'POST', body:command('mission.create', null, 'Mission opérationnelle assignée avec justification', { missionType:'inspection', title:'Contrôle de sécurité', priority:'high', userId:normal.userId, sourceStationId:station.id, dueAt:new Date(Date.now() + 7200000).toISOString() }) });
check('création mission', value.response.status === 201 && value.data.targetType === 'mission', JSON.stringify(value.data));

value = await admin.request('/api/admin/control-center/actions', { method:'POST', body:command('entitlement.grant', null, 'Geste commercial manuel sans modification de paiement', { userId:normal.userId, benefitType:'ride_access', days:30 }) });
check('avantage manuel accordé', value.response.status === 201 && value.data.targetType === 'entitlement', JSON.stringify(value.data));
const paymentsBefore = await admin.request('/api/admin/payments?limit=100');
value = await admin.request('/api/admin/payments', { method:'PATCH', body:{ status:'paid' } });
check('falsification paiement impossible', value.response.status === 404 && value.data.code === 'ADMIN_ROUTE_NOT_FOUND', `${value.response.status} ${value.data?.code}`);
const paymentsAfter = await admin.request('/api/admin/payments?limit=100');
check('paiements inchangés', paymentsBefore.data.pagination.total === paymentsAfter.data.pagination.total, JSON.stringify({ before:paymentsBefore.data.pagination, after:paymentsAfter.data.pagination }));

await admin.request('/api/admin/control-center/actions', { method:'POST', body:command('station.open', station.id, 'Normalisation initiale de la station avant le test') });
value = await admin.request('/api/admin/control-center/actions', { method:'POST', body:command('station.close', station.id, 'Fermeture temporaire pour contrôle du site') });
check('fermeture station', value.response.status === 201, JSON.stringify(value.data));
value = await admin.request('/api/admin/control-center/actions', { method:'POST', body:command('station.open', station.id, 'Réouverture après contrôle opérationnel terminé') });
check('réouverture station', value.response.status === 201, JSON.stringify(value.data));
await admin.request('/api/admin/control-center/actions', { method:'POST', body:command('bike.restore', bike.id, 'Normalisation initiale du vélo avant le test') });
value = await admin.request('/api/admin/control-center/actions', { method:'POST', body:command('bike.block', bike.id, 'Blocage préventif demandé par le responsable réseau') });
check('blocage vélo', value.response.status === 201, JSON.stringify(value.data));
value = await admin.request('/api/admin/control-center/actions', { method:'POST', body:command('bike.restore', bike.id, 'Remise disponible après vérification visuelle complète') });
check('restauration vélo', value.response.status === 201, JSON.stringify(value.data));

value = await normal.client.request('/api/rides', { method:'POST', body:{ qrPayload:bike.public_code } });
check('trajet autorisé par avantage manuel', value.response.status === 201 && value.data.ride?.id, JSON.stringify(value.data));
const rideId = value.data.ride.id;
value = await admin.request('/api/admin/control-center/actions', { method:'POST', body:command('ride.force_end', rideId, 'Fin exceptionnelle après appel confirmé de l’utilisateur') });
check('fin exceptionnelle trajet', value.response.status === 201, JSON.stringify(value.data));

value = await admin.request('/api/admin/control-center/actions', { method:'POST', body:command('notification.send', null, 'Message opérationnel envoyé individuellement', { userId:normal.userId, title:'Information Pikala', message:'Votre trajet a été clôturé par notre équipe.' }) });
check('notification individuelle', value.response.status === 201, JSON.stringify(value.data));
value = await admin.request('/api/admin/control-center/actions', { method:'POST', body:command('service.maintenance', null, 'Maintenance générale planifiée du réseau numérique') });
check('service en maintenance', value.response.status === 201, JSON.stringify(value.data));
value = await admin.request('/api/admin/control-center/actions', { method:'POST', body:command('service.restore', null, 'Service rétabli après validation de tous les contrôles') });
check('service rétabli', value.response.status === 201, JSON.stringify(value.data));

value = await admin.request('/api/admin/audit-logs?search=override&limit=100');
check('audit logs overrides', value.response.status === 200 && value.data.items.some((item) => item.action === 'override.ride.force_end') && value.data.items.some((item) => item.action === 'override.entitlement.grant'), JSON.stringify(value.data.items));
value = await admin.request('/api/admin/control-center/overrides?limit=100');
check('registre overrides', value.response.status === 200 && value.data.items.length >= 10 && value.data.items.every((item) => item.reason?.length >= 10), JSON.stringify(value.data.items));

console.log(`Crash-test Control Center valide : ${checks.length} contrôles.\n${checks.map((item) => `- ${item}`).join('\n')}`);
