import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import adminCopy from '../sitepikala/assets/js/i18n/admin/copy.js';

const root = resolve(import.meta.dirname, '..');
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const [migration, service, control, worker, html, frontend, controlFrontend, css] = await Promise.all([
  'migrations/0012_control_center.sql', 'src/admin/service.js', 'src/admin/control-center.js', 'src/worker.js',
  'sitepikala/admin.html', 'sitepikala/admin.js', 'sitepikala/admin-control-center.js', 'sitepikala/admin.css'
].map((file) => readFile(resolve(root, file), 'utf8')));

const domains = ['employees','docks','inspections','missions','rebalancing','automations','devices','alerts','entitlements','overrides','system'];
for (const domain of domains) check(frontend.includes(`'${domain}'`) || controlFrontend.includes(`'${domain}'`), `Vue Control Center absente: ${domain}`);
for (const table of ['employee_profiles','inspections','missions','mission_bikes','rebalancing_recommendations','automation_rules','network_alerts','devices','admin_overrides','manual_entitlements']) {
  check(new RegExp(`CREATE TABLE ${table}\\b`).test(migration), `Table Control Center absente: ${table}`);
}
check(!/^[ \t]*(?:DROP|DELETE|TRUNCATE)\b/im.test(migration), 'La migration Control Center est destructive.');
check(migration.includes('guard_overrides_no_update') && migration.includes('guard_overrides_no_delete'), 'Les overrides ne sont pas append-only.');
check(service.includes('handleControlCenterApi') && worker.includes("url.pathname.startsWith('/api/admin/')"), 'La barrière admin centrale ne protège pas le Control Center.');
check(control.includes("confirmation !== `PIKALA ${action.toUpperCase()}`") && migration.includes('length(trim(reason))'), 'Confirmation forte ou motif obligatoire absent.');
check(control.includes('idempotency_key') && control.includes('admin_overrides') && control.includes('admin_audit_logs'), 'Idempotence ou double audit absent.');
check(control.includes("'entitlement.grant'") && worker.includes('manual_entitlements'), 'Avantage manuel non relié au droit de trajet.');
check(!/UPDATE payments SET|INSERT INTO payments|DELETE FROM payments/.test(control), 'Le Control Center peut falsifier un paiement.');
for (const metric of ['activeUsers','bikes','stations','activeRides','openIncidents','overdueMaintenance','criticalTickets','overdueMissions','offlineDevices']) {
  check(control.includes(metric), `Métrique réseau absente: ${metric}`);
}
for (const action of ['station.open','station.close','bike.block','bike.restore','bike.maintenance','bike.move','dock.correct','user.suspend','user.reactivate','ride.force_end','maintenance.assign','mission.create','notification.send','service.maintenance','entitlement.grant']) {
  check(control.includes(`'${action}'`) && frontend.includes(`'${action}'`), `Commande manuelle incomplète: ${action}`);
}
check(frontend.includes('adminAttention') && css.includes('.admin-attention') && css.includes('.admin-command-bar'), 'Dashboard attention ou barre de commandes absente.');
check(html.includes('noindex,nofollow') && css.includes('@media(max-width:820px)'), 'Protection SEO ou responsive tablette absent.');
const keys = Object.keys(adminCopy.fr);
for (const locale of ['fr','en','es','pt','ar']) check(keys.every((key) => Object.hasOwn(adminCopy[locale], key)), `${locale}: dictionnaire Control Center incomplet.`);

if (failures.length) {
  console.error(failures.map((item) => `- ${item}`).join('\n'));
  process.exit(1);
}
console.log(`Control Center valide: ${domains.length} nouveaux domaines, ${keys.length} clés x 5 langues, commandes sensibles auditées.`);
