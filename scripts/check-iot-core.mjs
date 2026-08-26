import { readFile } from 'node:fs/promises';

const files = {
  migration: await readFile('migrations/0018_iot_core.sql', 'utf8'),
  service: await readFile('src/iot/service.js', 'utf8'),
  provider: await readFile('src/iot/provider.js', 'utf8'),
  worker: await readFile('src/worker.js', 'utf8'),
  rbac: await readFile('src/auth/rbac.js', 'utf8')
};
const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };
for (const table of ['device_credentials','device_commands','device_command_results','device_events','device_telemetry','device_rate_limits']) {
  assert(new RegExp(`CREATE TABLE ${table}\\b`).test(files.migration), `Table IoT absente: ${table}`);
}
for (const status of ['queued','sent','acknowledged','completed','failed','expired']) assert(files.migration.includes(`'${status}'`), `Etat commande absent: ${status}`);
assert(/UNIQUE \(device_id,nonce\)/.test(files.migration), 'Anti-replay D1 absent.');
assert(/guard_device_command_transition/.test(files.migration), 'Transitions de commande non protegees.');
assert(/HMAC-SHA256/.test(files.migration) && /AES-GCM/.test(files.provider), 'Signature ou chiffrement IoT absent.');
assert(/timingSafeEqual/.test(files.provider), 'Comparaison de signature non constante.');
assert(/IOT_MODE/.test(files.provider) && /mode==='disabled'/.test(files.provider), 'Mode IoT explicite absent.');
assert(/IOT_SIMULATOR_DISABLED/.test(files.service) && /ENVIRONMENT/.test(files.service), 'Simulateur non isole de la production.');
assert(/idempotency_key TEXT NOT NULL UNIQUE/.test(files.migration), 'Idempotence des commandes absente.');
assert(/reserveIotRide/.test(files.worker) && /requestIotReturn/.test(files.worker) && /handleDeviceEvent/.test(files.worker), 'Cycle utilisateur IoT non branche.');
assert(/devices\.manage/.test(files.service) && /devices\.manage/.test(files.rbac), 'RBAC device incomplet.');
assert(/admin_audit_logs/.test(files.service), 'Audit IoT absent.');
assert(!/secret[^\n]{0,30}(console|logEvent)/i.test(files.service + files.provider), 'Un secret semble journalise.');
if (failures.length) { console.error(failures.map((item) => `- ${item}`).join('\n')); process.exit(1); }
console.log('Socle IoT valide: provider neutre, commandes, signatures, anti-replay, idempotence, RBAC et simulateur interne.');
