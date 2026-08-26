import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const root=resolve(import.meta.dirname,'..');const failures=[];const check=(value,message)=>{if(!value)failures.push(message);};
const [migration,rbac,worker,service,staff,control,frontend,copy]=await Promise.all(['migrations/0013_staff_rbac.sql','src/auth/rbac.js','src/worker.js','src/admin/service.js','src/admin/staff.js','src/admin/control-center.js','sitepikala/admin.js','sitepikala/assets/js/i18n/admin/copy.js'].map((file)=>readFile(resolve(root,file),'utf8')));
const roles=['super_admin','admin','operations_manager','station_manager','technician','field_agent','support_agent','finance','analyst'];
const tables=['staff_members','staff_zones','staff_member_zones','staff_role_permissions','staff_permission_overrides','staff_activity_logs'];
for(const role of roles){check(migration.includes(`'${role}'`),`Rôle absent: ${role}`);check(rbac.includes(`'${role}'`),`Moteur RBAC incomplet: ${role}`);}
for(const table of tables)check(new RegExp(`CREATE TABLE ${table}\\b`).test(migration),`Table absente: ${table}`);
check(!/^[ \t]*(?:DROP|TRUNCATE)\b/im.test(migration),'Migration RBAC destructive.');
check(migration.includes('guard_staff_activity_no_update')&&migration.includes('guard_staff_activity_no_delete'),'Historique activité non append-only.');
for(const permission of ['bikes.move','maintenance.manage','missions.read_assigned','support.manage','payments.refund','analytics.read','employees.manage_roles'])check(migration.includes(`'${permission}'`)||rbac.includes(`'${permission}'`),`Permission absente: ${permission}`);
check(worker.includes('requireStaff')&&worker.includes('loadStaffActor'),'Barrière staff absente du Worker.');
check(service.includes('adminRoutePermission')&&control.includes('CONTROL_ACTION_PERMISSIONS'),'Contrôle route/action incomplet.');
check(staff.includes('STAFF_SELF_LOCKOUT')&&staff.includes('STAFF_LAST_SUPER_ADMIN'),'Protections anti-verrouillage absentes.');
check(staff.includes('UPDATE sessions SET revoked_at=CURRENT_TIMESTAMP'),'Révocation des sessions employé absente.');
check(frontend.includes('canView')&&frontend.includes("'/api/admin/session'")&&frontend.includes("'/api/admin/staff'"),'Interface employé non filtrée.');
for(const key of ['adminZones','adminLastActivity','adminHireDate','adminActivity'])check(copy.includes(key),`Traduction absente: ${key}`);
if(failures.length){console.error(failures.map((item)=>`- ${item}`).join('\n'));process.exit(1);}console.log(`RBAC valide : ${roles.length} rôles, ${tables.length} tables, contrôles route/action et interface filtrée.`);
