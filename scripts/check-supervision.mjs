import { readFile } from 'node:fs/promises';

const migration=await readFile('migrations/0017_supervision_engine.sql','utf8');
const service=await readFile('src/admin/supervision.js','utf8');
const rbac=await readFile('src/auth/rbac.js','utf8');
const worker=await readFile('src/worker.js','utf8');
const failures=[];
const check=(condition,message)=>{if(!condition)failures.push(message);};
for(const table of ['supervision_rules','supervision_alerts','supervision_alert_events'])check(migration.includes(`CREATE TABLE ${table}`),`Table absente: ${table}`);
for(const rule of ['station_low','station_full','long_ride','bike_incidents','maintenance_due','ticket_urgent','bike_dock_inconsistent','field_task_overdue','device_offline'])check(migration.includes(`'${rule}'`)&&service.includes(`'${rule}'`),`Règle absente: ${rule}`);
for(const status of ['new','acknowledged','in_progress','resolved','ignored'])check(migration.includes(`'${status}'`),`Statut absent: ${status}`);
check(migration.includes('idx_supervision_alert_active_dedupe'),'Déduplication active absente.');
check(migration.includes('guard_supervision_alert_transition'),'Transitions D1 non protégées.');
check(service.includes('cooldown_seconds')&&service.includes('automatic_action'),'Cooldown ou action automatique absent.');
check(service.includes('admin_audit_logs')&&service.includes('supervision_alert_events'),'Audit supervision absent.');
check(rbac.includes('/api/admin/supervision/alerts')&&rbac.includes('/api/admin/supervision/rules'),'RBAC supervision absent.');
check(worker.includes('runSupervision'),'Planification supervision absente.');
if(failures.length){console.error(failures.map(item=>`- ${item}`).join('\n'));process.exit(1);}
console.log('Supervision valide: 9 règles, 5 états, déduplication, cooldown, audit et RBAC.');
