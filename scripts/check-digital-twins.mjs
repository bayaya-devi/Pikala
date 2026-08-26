import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root=resolve('.');const read=(path)=>readFile(resolve(root,path),'utf8');
const [migration,backend,service,worker,frontend,columns,copy,css]=await Promise.all([read('migrations/0014_infrastructure_digital_twins.sql'),read('src/admin/digital-twins.js'),read('src/admin/service.js'),read('src/worker.js'),read('sitepikala/admin.js'),read('sitepikala/admin-control-center.js'),read('sitepikala/assets/js/i18n/admin/copy.js'),read('sitepikala/admin.css')]);
const failures=[];const assert=(condition,message)=>{if(!condition)failures.push(message);};
for(const field of ['lock_status','connectivity_status','last_seen_at','gps_latitude','gps_longitude','odometer_meters','total_usage_seconds','total_rides'])assert(migration.includes(field),`Champ jumeau absent : ${field}`);
for(const guard of ['guard_dock_twin_insert','guard_dock_twin_update','guard_bike_twin_insert','guard_bike_twin_update','guard_dock_capacity_insert','guard_infrastructure_events_no_update'])assert(migration.includes(guard),`Contrainte absente : ${guard}`);
assert(backend.includes("operation==='assign_station'")&&backend.includes('BULK.IMPORT')&&backend.includes('BULK.UPDATE'),'Les opérations bulk protégées sont incomplètes.');
assert(backend.includes("hasPermission(actor,`${entity}.manage`)")&&backend.includes("hasPermission(actor,'docks.read')"),'Les permissions des jumeaux doivent être vérifiées par ressource.');
assert(backend.includes("/^[=+\\-@]/"),'Les exports CSV doivent neutraliser les formules tableur.');
assert(service.includes("from './digital-twins.js'")&&service.includes('handleTwinApi'),'Le routeur admin doit charger le module jumeaux.');
assert(worker.includes("lock_status='unlocked'")&&worker.includes("lock_status='locked'")&&worker.includes('total_usage_seconds'),'Le trajet doit synchroniser serrure et compteurs du vélo.');
for(const feature of ['adminAssignStation','adminQrBatch','adminImportCsv','adminTelemetry'])assert(frontend.includes(feature)&&copy.includes(feature),`Interface ou traduction absente : ${feature}`);
assert(columns.includes("['lock_status','adminLock']")&&columns.includes("['connectivity_status','adminConnectivity']"),'La liste des docks doit afficher son état physique.');
assert(css.includes('.admin-network-tools')&&css.includes('.admin-twin-detail')&&css.includes('@media(max-width:820px)'),'Les vues jumeaux doivent être responsive.');
if(failures.length){console.error(failures.map((failure)=>`- ${failure}`).join('\n'));process.exit(1);}console.log('Jumeaux numériques valides : modèle, API, RBAC, bulk, i18n et interface vérifiés.');
