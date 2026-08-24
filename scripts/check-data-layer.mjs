import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve('.');
const migrationDir = resolve(root, 'migrations');
const expectedMigrations = [
  '0001_v1_compatibility_baseline.sql',
  '0002_v2_additive_model.sql',
  '0003_v2_indexes_and_guards.sql',
  '0004_authentication_security.sql',
  '0005_real_ride_invariants.sql',
  '0006_unique_bike_qr_namespace.sql',
  '0007_subscription_payment_lifecycle.sql'
];
const expectedTables = [
  'users', 'sessions', 'email_verifications', 'password_reset_tokens',
  'stations', 'bikes', 'docks', 'plans', 'subscriptions', 'payments',
  'rides', 'support_tickets', 'bike_incidents', 'notifications', 'admin_audit_logs', 'auth_rate_limits', 'security_events', 'payment_events'
];
const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };

const migrations = (await readdir(migrationDir)).filter((name) => name.endsWith('.sql')).sort();
assert(JSON.stringify(migrations) === JSON.stringify(expectedMigrations), 'La sequence des migrations D1 est inattendue.');

const sql = (await Promise.all(migrations.map((name) => readFile(resolve(migrationDir, name), 'utf8')))).join('\n');
for (const table of expectedTables) {
  assert(new RegExp(`CREATE TABLE(?: IF NOT EXISTS)? ${table}\\b`, 'i').test(sql), `Table absente des migrations : ${table}`);
}
assert(!/^[ \t]*(?:DROP|DELETE|TRUNCATE)\b/im.test(sql), 'Une instruction destructive est interdite dans les migrations V2.');
assert(/guard_one_active_ride_per_user_insert/i.test(sql), 'La concurrence des trajets actifs doit être protégée par D1.');
assert(/guard_bike_qr_namespace_insert/i.test(sql), 'Les identifiants QR vélo doivent partager un espace unique.');
assert(/guard_paid_subscription_insert/i.test(sql), 'D1 doit refuser un abonnement actif sans paiement payé.');
assert(/guard_payment_lifecycle_insert/i.test(sql), 'Les statuts de paiement doivent être contraints.');
assert(/guard_active_ride_insert/i.test(sql), 'Un trajet actif incomplet doit être refusé par D1.');
assert((sql.match(/FOREIGN KEY/gi) || []).length >= 20, 'Le modele doit definir ses relations par cles etrangeres.');
assert((sql.match(/CREATE (?:UNIQUE )?INDEX/gi) || []).length >= 20, 'Le modele doit definir ses index de requete.');
assert(/PRAGMA defer_foreign_keys = ON/i.test(sql), 'La migration additive doit differer les controles de cles pendant le backfill.');
assert(/INSERT OR IGNORE INTO plans[\s\S]*FROM subscriptions/i.test(sql), 'Les libelles de plans V1 doivent etre repris sans perte.');

const worker = await readFile(resolve(root, 'src/worker.js'), 'utf8');
assert(!/CREATE TABLE|ALTER TABLE|ensureSchema|debugSchema|FALLBACK_STATIONS/.test(worker), 'Le Worker ne doit plus modifier le schema au runtime.');
assert(worker.includes("url.pathname === '/api/plans'"), 'La route publique des plans doit etre branchee sur D1.');

const wrangler = await readFile(resolve(root, 'wrangler.toml'), 'utf8');
assert(/migrations_dir\s*=\s*"migrations"/.test(wrangler), 'Wrangler doit pointer vers le dossier migrations.');
assert(/migrations_table\s*=\s*"d1_migrations"/.test(wrangler), 'La table de suivi des migrations doit etre explicite.');

const seed = await readFile(resolve(root, 'seeds/development.sql'), 'utf8');
assert(/DEVELOPMENT ONLY/.test(seed) && !/^[ \t]*(?:DROP|DELETE|TRUNCATE)\b/im.test(seed), 'Le seed doit etre local, explicite et non destructif.');

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}
console.log(`Couche D1 valide : ${migrations.length} migrations, ${expectedTables.length} tables, aucune instruction destructive.`);
