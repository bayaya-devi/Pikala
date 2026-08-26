import { hasPermission } from '../auth/rbac.js';

const STAGES=['reported','inspection_required','diagnosed','maintenance','testing','repaired','available'];
const NEXT=Object.freeze({reported:'inspection_required',inspection_required:'diagnosed',diagnosed:'maintenance',maintenance:'testing',testing:'repaired',repaired:'available'});
const PRIORITIES=new Set(['low','normal','high','urgent']);
const CHECKS=['brakes','tires','wheels','chain','saddle','lighting','frame','qr','lock','electronics'];
const RESULTS=new Set(['pass','watch','fail','not_applicable']);
const broad=(actor)=>['super_admin','admin','operations_manager'].includes(actor.role);
const integer=(value)=>{const number=Number(value);return Number.isInteger(number)&&number>0?number:null;};
const clean=(value,max=2000,min=0)=>{const result=String(value??'').trim();return result.length>=min&&result.length<=max?result:null;};
const fail=(json,code,error,status=400)=>json({code,error},status);
const metadata=(value)=>JSON.stringify(value,(key,item)=>/password|secret|token/i.test(key)?undefined:item);

async function audit(DB,actor,context,action,type,id,data={}){
  await DB.prepare(`INSERT INTO admin_audit_logs(actor_user_id,action,target_type,target_id,request_id,ip_hint,metadata_json)
    VALUES (?,?,?,?,?,?,?)`).bind(actor.id,action,type,String(id),context.requestId,context.ipHint,metadata(data)).run();
  context.logEvent?.('admin.action',{requestId:context.requestId,userId:actor.id,resourceType:type,resourceId:id,action,outcome:'success'});
}

function scope(actor,alias='maintenance_records'){
  return broad(actor)?{sql:'1=1',args:[]}:{sql:`${alias}.assigned_to_user_id=?`,args:[actor.id]};
}

async function overview(DB,json,actor){
  const scoped=scope(actor);
  const [counts,missions,reminders]=await DB.batch([
    DB.prepare(`SELECT workshop_stage,COUNT(*) count FROM maintenance_records WHERE process_version=2 AND ${scoped.sql} GROUP BY workshop_stage`).bind(...scoped.args),
    DB.prepare(`SELECT missions.id,missions.public_code,missions.priority,missions.status,missions.title,missions.due_at,bikes.public_code bike_code
      FROM missions LEFT JOIN mission_bikes ON mission_bikes.mission_id=missions.id LEFT JOIN bikes ON bikes.id=mission_bikes.bike_id
      WHERE missions.mission_type IN ('maintenance','inspection') AND (?=1 OR missions.assigned_to_user_id=?) AND missions.status NOT IN ('completed','cancelled','failed') ORDER BY CASE missions.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 ELSE 2 END,missions.due_at LIMIT 20`).bind(broad(actor)?1:0,actor.id),
    DB.prepare(`SELECT maintenance_reminders.*,bikes.public_code bike_code FROM maintenance_reminders JOIN bikes ON bikes.id=maintenance_reminders.bike_id WHERE maintenance_reminders.status='due' ORDER BY detected_at DESC LIMIT 20`)
  ]);
  return json({stages:STAGES,counts:Object.fromEntries((counts.results||[]).map(row=>[row.workshop_stage,Number(row.count)])),missions:missions.results||[],reminders:reminders.results||[]});
}

async function listInterventions(DB,json,actor,url){
  const scoped=scope(actor);const stage=clean(url.searchParams.get('stage'),30)||'';const search=clean(url.searchParams.get('search'),100)||'';
  const rows=await DB.prepare(`SELECT maintenance_records.id,maintenance_records.workshop_stage,maintenance_records.priority,maintenance_records.problem_text,
    maintenance_records.diagnosis_text,maintenance_records.started_at,maintenance_records.opened_at,maintenance_records.updated_at,
    maintenance_records.labor_minutes,maintenance_records.total_cost_minor,bikes.public_code bike_code,bikes.maintenance_required,
    users.first_name technician_first_name,users.last_name technician_last_name
    FROM maintenance_records JOIN bikes ON bikes.id=maintenance_records.bike_id LEFT JOIN users ON users.id=maintenance_records.assigned_to_user_id
    WHERE process_version=2 AND ${scoped.sql} AND (?='' OR maintenance_records.workshop_stage=?)
      AND (?='' OR lower(bikes.public_code||' '||COALESCE(maintenance_records.problem_text,'')) LIKE '%'||lower(?)||'%')
    ORDER BY CASE maintenance_records.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,maintenance_records.updated_at DESC LIMIT 100`)
    .bind(...scoped.args,stage,stage,search,search).all();
  return json({items:rows.results||[],stages:STAGES});
}

async function createIntervention(request,DB,json,actor,context,readJson){
  const body=await readJson(request);const bikeId=integer(body?.bikeId);const incidentId=integer(body?.incidentId);const assignee=integer(body?.assignedToUserId)||actor.id;
  const priority=String(body?.priority||'normal');const problem=clean(body?.problem,2000,5);
  if(!bikeId||!PRIORITIES.has(priority)||!problem)return fail(json,'WORKSHOP_INPUT_INVALID','Vélo, priorité et problème valides requis.');
  if(!broad(actor)&&assignee!==actor.id)return fail(json,'FORBIDDEN','Vous ne pouvez vous assigner que vos propres interventions.',403);
  const bike=await DB.prepare('SELECT id,status,odometer_meters,total_rides FROM bikes WHERE id=?').bind(bikeId).first();if(!bike)return fail(json,'BIKE_NOT_FOUND','Vélo introuvable.',404);if(bike.status==='in_use')return fail(json,'BIKE_IN_USE','Le vélo doit être restitué avant l’intervention.',409);if(['lost','retired'].includes(bike.status))return fail(json,'BIKE_WORKSHOP_FORBIDDEN','Un vélo perdu ou retiré ne peut pas entrer en atelier.',409);
  try{
    const result=await DB.prepare(`INSERT INTO maintenance_records(bike_id,incident_id,opened_by_user_id,assigned_to_user_id,status,reason,workflow_stage,
      process_version,workshop_stage,priority,problem_text,mileage_at_open,rides_at_open)
      VALUES (?,?,?,?,'open',?,'reported',2,'reported',?,?,?,?)`).bind(bikeId,incidentId,actor.id,assignee,problem,priority,problem,bike.odometer_meters,bike.total_rides).run();
    await DB.batch([DB.prepare("UPDATE bikes SET maintenance_required=1,status='maintenance',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(bikeId),DB.prepare("INSERT INTO workflow_events(resource_type,resource_id,actor_user_id,to_status,note) VALUES('maintenance',?,?,'reported',?)").bind(result.meta.last_row_id,actor.id,problem)]);
    await audit(DB,actor,context,'workshop.intervention.create','maintenance',result.meta.last_row_id,{bikeId,priority,assignee});return json({id:result.meta.last_row_id,stage:'reported'},201);
  }catch(error){if(String(error.message).includes('idx_maintenance_one_open_per_bike')||String(error.message).includes('UNIQUE'))return fail(json,'MAINTENANCE_ALREADY_OPEN','Une intervention est déjà ouverte pour ce vélo.',409);throw error;}
}

async function detail(DB,json,actor,id){
  const scoped=scope(actor,'m');const record=await DB.prepare(`SELECT m.*,b.public_code bike_code,b.status bike_status,b.maintenance_required,u.first_name technician_first_name,u.last_name technician_last_name
    FROM maintenance_records m JOIN bikes b ON b.id=m.bike_id LEFT JOIN users u ON u.id=m.assigned_to_user_id WHERE m.id=? AND m.process_version=2 AND ${scoped.sql}`).bind(id,...scoped.args).first();
  if(!record)return fail(json,'WORKSHOP_NOT_FOUND','Intervention introuvable.',404);
  const [parts,comments,inspections,events]=await DB.batch([
    DB.prepare(`SELECT u.id,u.quantity,u.unit_cost_minor_snapshot,u.consumed_at,p.reference,p.name FROM maintenance_part_usages u JOIN maintenance_parts p ON p.id=u.part_id WHERE u.maintenance_id=? ORDER BY u.id`).bind(id),
    DB.prepare(`SELECT maintenance_comments.id,maintenance_comments.body,maintenance_comments.created_at,users.first_name,users.last_name FROM maintenance_comments LEFT JOIN users ON users.id=maintenance_comments.author_user_id WHERE maintenance_id=? ORDER BY maintenance_comments.id`).bind(id),
    DB.prepare(`SELECT inspections.id,inspections.public_code,inspections.status,inspections.health_score,inspections.notes,inspections.completed_at FROM inspections WHERE maintenance_id=? ORDER BY inspections.id DESC`).bind(id),
    DB.prepare("SELECT from_status,to_status,note,created_at FROM workflow_events WHERE resource_type='maintenance' AND resource_id=? ORDER BY id").bind(id)
  ]);return json({intervention:record,parts:parts.results||[],comments:comments.results||[],inspections:inspections.results||[],events:events.results||[],nextStage:NEXT[record.workshop_stage]||null});
}

async function transition(request,DB,json,actor,context,id,readJson){
  const scoped=scope(actor,'m');const record=await DB.prepare(`SELECT m.*,b.status bike_status FROM maintenance_records m JOIN bikes b ON b.id=m.bike_id WHERE m.id=? AND m.process_version=2 AND ${scoped.sql}`).bind(id,...scoped.args).first();if(!record)return fail(json,'WORKSHOP_NOT_FOUND','Intervention introuvable.',404);
  const body=await readJson(request);const target=String(body?.stage||'');if(NEXT[record.workshop_stage]!==target)return fail(json,'WORKSHOP_TRANSITION_INVALID',`Étape attendue : ${NEXT[record.workshop_stage]||'aucune'}.`,409);
  const diagnosis=clean(body?.diagnosis,2000,5);const notes=clean(body?.notes,2000,0);const testResult=body?.testResult==null?null:String(body.testResult);const testNotes=clean(body?.testNotes,2000,0);const labor=Number(body?.laborMinutes??record.labor_minutes);
  if(target==='diagnosed'){
    const inspection=await DB.prepare(`SELECT inspections.id,inspections.status,(SELECT COUNT(*) FROM inspection_check_items WHERE inspection_id=inspections.id) item_count FROM inspections WHERE maintenance_id=? ORDER BY id DESC LIMIT 1`).bind(id).first();
    if(!inspection||!['passed','failed'].includes(inspection.status)||Number(inspection.item_count)!==CHECKS.length)return fail(json,'INSPECTION_REQUIRED','Une inspection complète des 10 points est requise.',409);if(!diagnosis)return fail(json,'DIAGNOSIS_REQUIRED','Un diagnostic détaillé est requis.',400);
  }
  if(target==='maintenance'&&!record.diagnosis_text&&!diagnosis)return fail(json,'DIAGNOSIS_REQUIRED','Le diagnostic est requis.',409);
  if(target==='testing'&&!(notes||record.work_notes))return fail(json,'WORK_NOTES_REQUIRED','Décrivez les travaux effectués avant le test.',400);
  if(target==='repaired'&&testResult!=='passed')return fail(json,'TEST_NOT_PASSED','Le test doit être réussi avant de déclarer le vélo réparé.',409);
  if(target==='available'&&(!hasPermission(actor,'maintenance.release')||body?.confirmReturnToService!==true))return fail(json,'RETURN_VALIDATION_REQUIRED','Permission et validation de retour au service requises.',403);
  const legacy=target==='maintenance'||target==='testing'?'in_progress':['repaired','available'].includes(target)?'resolved':'open';const legacyStage=target==='inspection_required'?'to_inspect':target==='diagnosed'?'to_inspect':target==='testing'?'maintenance':target;
  const release=target==='available';
  await DB.batch([
    DB.prepare(`UPDATE maintenance_records SET workshop_stage=?,workflow_stage=?,status=?,diagnosis_text=COALESCE(?,diagnosis_text),work_notes=COALESCE(?,work_notes),test_result=COALESCE(?,test_result),test_notes=COALESCE(?,test_notes),labor_minutes=?,labor_cost_minor=CASE WHEN ?>=0 THEN labor_cost_minor ELSE labor_cost_minor END,total_cost_minor=labor_cost_minor+parts_cost_minor,started_at=CASE WHEN ?='maintenance' THEN COALESCE(started_at,CURRENT_TIMESTAMP) ELSE started_at END,resolved_at=CASE WHEN ?='available' THEN CURRENT_TIMESTAMP ELSE resolved_at END,resolved_by_user_id=CASE WHEN ?='available' THEN ? ELSE resolved_by_user_id END,return_to_service_validated_at=CASE WHEN ?='available' THEN CURRENT_TIMESTAMP ELSE return_to_service_validated_at END,return_to_service_validated_by_user_id=CASE WHEN ?='available' THEN ? ELSE return_to_service_validated_by_user_id END,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(target,legacyStage,legacy,diagnosis,notes||null,testResult,testNotes||null,Number.isInteger(labor)&&labor>=0?labor:record.labor_minutes,0,target,target,target,actor.id,target,target,actor.id,id),
    DB.prepare(`UPDATE bikes SET maintenance_required=?,status=?,last_service_at=CASE WHEN ?=1 THEN CURRENT_TIMESTAMP ELSE last_service_at END,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(release?0:1,release?'available':'maintenance',release?1:0,record.bike_id),
    DB.prepare("INSERT INTO workflow_events(resource_type,resource_id,actor_user_id,from_status,to_status,note) VALUES('maintenance',?,?,?,?,?)").bind(id,actor.id,record.workshop_stage,target,notes||diagnosis||null),
    DB.prepare(`UPDATE bike_incidents SET status=CASE WHEN ?=1 THEN 'resolved' ELSE 'in_progress' END,resolved_at=CASE WHEN ?=1 THEN CURRENT_TIMESTAMP ELSE resolved_at END,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(release?1:0,release?1:0,record.incident_id||0)
  ]);await audit(DB,actor,context,'workshop.transition','maintenance',id,{from:record.workshop_stage,to:target,bikeId:record.bike_id});return json({success:true,stage:target});
}

async function addComment(request,DB,json,actor,context,id,readJson){const body=await readJson(request);const message=clean(body?.message,2000,1);if(!message)return fail(json,'COMMENT_INVALID','Commentaire requis.');const scoped=scope(actor);const found=await DB.prepare(`SELECT id FROM maintenance_records WHERE id=? AND process_version=2 AND ${scoped.sql}`).bind(id,...scoped.args).first();if(!found)return fail(json,'WORKSHOP_NOT_FOUND','Intervention introuvable.',404);const result=await DB.prepare('INSERT INTO maintenance_comments(maintenance_id,author_user_id,body) VALUES (?,?,?)').bind(id,actor.id,message).run();await audit(DB,actor,context,'workshop.comment.create','maintenance',id,{commentId:result.meta.last_row_id});return json({id:result.meta.last_row_id},201);}

async function partsList(DB,json){const rows=await DB.prepare('SELECT * FROM maintenance_parts WHERE is_active=1 ORDER BY category,name').all();return json({items:rows.results||[]});}
async function partCreate(request,DB,json,actor,context,readJson){if(!broad(actor))return fail(json,'FORBIDDEN','Gestion du catalogue réservée aux responsables.',403);const body=await readJson(request);const reference=clean(body?.reference,60,2)?.toUpperCase();const name=clean(body?.name,120,2);const category=clean(body?.category,80,2);const cost=Number(body?.unitCostMinor);const stock=body?.stockQuantity==null?null:Number(body.stockQuantity);const supplier=clean(body?.supplier,120,0);if(!reference||!name||!category||!Number.isInteger(cost)||cost<0||(stock!==null&&(!Number.isInteger(stock)||stock<0)))return fail(json,'PART_INPUT_INVALID','Données de pièce invalides.');const result=await DB.prepare('INSERT INTO maintenance_parts(reference,name,category,unit_cost_minor,stock_quantity,supplier) VALUES (?,?,?,?,?,?)').bind(reference,name,category,cost,stock,supplier||null).run();await audit(DB,actor,context,'workshop.part.create','maintenance_part',result.meta.last_row_id,{reference});return json({id:result.meta.last_row_id},201);}
async function usePart(request,DB,json,actor,context,id,readJson){const body=await readJson(request);const partId=integer(body?.partId);const quantity=Number(body?.quantity);if(!partId||!Number.isInteger(quantity)||quantity<1||quantity>1000)return fail(json,'PART_USAGE_INVALID','Pièce et quantité valides requises.');const scoped=scope(actor);const record=await DB.prepare(`SELECT id,workshop_stage FROM maintenance_records WHERE id=? AND process_version=2 AND ${scoped.sql}`).bind(id,...scoped.args).first();if(!record)return fail(json,'WORKSHOP_NOT_FOUND','Intervention introuvable.',404);if(!['diagnosed','maintenance'].includes(record.workshop_stage))return fail(json,'PART_STAGE_INVALID','Les pièces sont ajoutées pendant le diagnostic ou la maintenance.',409);const part=await DB.prepare('SELECT id,unit_cost_minor FROM maintenance_parts WHERE id=? AND is_active=1').bind(partId).first();if(!part)return fail(json,'PART_NOT_FOUND','Pièce introuvable.',404);try{const result=await DB.prepare('INSERT INTO maintenance_part_usages(maintenance_id,part_id,quantity,unit_cost_minor_snapshot,consumed_by_user_id) VALUES (?,?,?,?,?)').bind(id,partId,quantity,part.unit_cost_minor,actor.id).run();await audit(DB,actor,context,'workshop.part.consume','maintenance',id,{partId,quantity});return json({id:result.meta.last_row_id},201);}catch(error){if(String(error.message).includes('insufficient maintenance part stock'))return fail(json,'PART_STOCK_INSUFFICIENT','Stock insuffisant.',409);throw error;}}

async function createInspection(request,DB,json,actor,context,readJson){const body=await readJson(request);const maintenanceId=integer(body?.maintenanceId);const scoped=scope(actor,'m');const record=await DB.prepare(`SELECT m.id,m.bike_id,m.workshop_stage,b.odometer_meters,b.total_rides FROM maintenance_records m JOIN bikes b ON b.id=m.bike_id WHERE m.id=? AND m.process_version=2 AND ${scoped.sql}`).bind(maintenanceId,...scoped.args).first();if(!record)return fail(json,'WORKSHOP_NOT_FOUND','Intervention introuvable.',404);if(record.workshop_stage!=='inspection_required')return fail(json,'INSPECTION_STAGE_INVALID','L’intervention doit attendre une inspection.',409);const items=Array.isArray(body?.items)?body.items:[];const normalized=new Map();for(const item of items){if(CHECKS.includes(item?.code)&&RESULTS.has(item?.result)&&!normalized.has(item.code))normalized.set(item.code,{result:item.result,notes:clean(item.notes,500,0)||null});}if(normalized.size!==CHECKS.length)return fail(json,'INSPECTION_INCOMPLETE','Les 10 points de contrôle sont obligatoires.');const score=Math.round([...normalized.values()].reduce((sum,item)=>sum+(item.result==='pass'?100:item.result==='watch'?60:item.result==='not_applicable'?100:0),0)/CHECKS.length);const status=[...normalized.values()].some(item=>item.result==='fail')?'failed':'passed';const code=`INS-${crypto.randomUUID().slice(0,8).toUpperCase()}`;const result=await DB.prepare(`INSERT INTO inspections(public_code,inspection_type,bike_id,inspector_user_id,status,outcome,checklist_json,notes,started_at,completed_at,health_score,odometer_meters,ride_count,maintenance_id) VALUES (?,'bike',?,?,?, ?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,?,?,?,?)`).bind(code,record.bike_id,actor.id,status,status,JSON.stringify(Object.fromEntries(normalized)),clean(body?.notes,2000,0)||null,score,record.odometer_meters,record.total_rides,maintenanceId).run();await DB.batch([...normalized.entries()].map(([itemCode,item])=>DB.prepare('INSERT INTO inspection_check_items(inspection_id,item_code,result,notes) VALUES (?,?,?,?)').bind(result.meta.last_row_id,itemCode,item.result,item.notes)));await audit(DB,actor,context,'workshop.inspection.complete','inspection',result.meta.last_row_id,{maintenanceId,status,score});return json({id:result.meta.last_row_id,status,healthScore:score},201);}

export async function refreshMaintenanceReminders(DB){return DB.prepare(`INSERT OR IGNORE INTO maintenance_reminders(bike_id,trigger_type,dedupe_key,reason,due_at)
    SELECT s.bike_id,'time','time-'||s.bike_id||'-'||date('now'),'Inspection périodique arrivée à échéance',datetime(COALESCE(s.last_inspected_at,'1970-01-01'),'+'||s.interval_days||' days') FROM maintenance_schedules s WHERE s.is_active=1 AND s.interval_days IS NOT NULL AND datetime(COALESCE(s.last_inspected_at,'1970-01-01'),'+'||s.interval_days||' days')<=CURRENT_TIMESTAMP
    UNION ALL SELECT s.bike_id,'mileage','mileage-'||s.bike_id||'-'||b.odometer_meters,'Seuil kilométrique atteint',NULL FROM maintenance_schedules s JOIN bikes b ON b.id=s.bike_id WHERE s.is_active=1 AND s.interval_meters IS NOT NULL AND b.odometer_meters-s.last_inspected_odometer>=s.interval_meters
    UNION ALL SELECT s.bike_id,'rides','rides-'||s.bike_id||'-'||b.total_rides,'Seuil de trajets atteint',NULL FROM maintenance_schedules s JOIN bikes b ON b.id=s.bike_id WHERE s.is_active=1 AND s.interval_rides IS NOT NULL AND b.total_rides-s.last_inspected_rides>=s.interval_rides
    UNION ALL SELECT s.bike_id,'incidents','incidents-'||s.bike_id||'-'||COUNT(i.id),'Seuil d incidents atteint',NULL FROM maintenance_schedules s JOIN bike_incidents i ON i.bike_id=s.bike_id AND i.created_at>=COALESCE(s.last_inspected_at,'1970-01-01') WHERE s.is_active=1 AND s.incident_threshold IS NOT NULL GROUP BY s.id HAVING COUNT(i.id)>=s.incident_threshold`).run();}
async function generateReminders(DB,json,actor,context){if(!broad(actor))return fail(json,'FORBIDDEN','Génération réservée aux responsables.',403);const result=await refreshMaintenanceReminders(DB);await audit(DB,actor,context,'workshop.reminders.generate','maintenance_reminder','batch',{count:result.meta.changes});return json({created:Number(result.meta.changes||0)});}

async function upsertSchedule(request,DB,json,actor,context,readJson){if(!broad(actor))return fail(json,'FORBIDDEN','Planification réservée aux responsables.',403);const body=await readJson(request);const bikeId=integer(body?.bikeId);const optional=(value,min,max)=>value==null||value===''?null:(Number.isInteger(Number(value))&&Number(value)>=min&&Number(value)<=max?Number(value):NaN);const days=optional(body?.intervalDays,1,730),meters=optional(body?.intervalMeters,1000,1000000),rides=optional(body?.intervalRides,1,10000),incidents=optional(body?.incidentThreshold,1,100);if(!bikeId||[days,meters,rides,incidents].some(Number.isNaN)||[days,meters,rides,incidents].every(value=>value===null))return fail(json,'SCHEDULE_INPUT_INVALID','Définissez au moins un seuil de maintenance valide.');const bike=await DB.prepare('SELECT id,last_service_at,odometer_meters,total_rides FROM bikes WHERE id=?').bind(bikeId).first();if(!bike)return fail(json,'BIKE_NOT_FOUND','Vélo introuvable.',404);await DB.prepare(`INSERT INTO maintenance_schedules(bike_id,interval_days,interval_meters,interval_rides,incident_threshold,last_inspected_at,last_inspected_odometer,last_inspected_rides) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(bike_id) DO UPDATE SET interval_days=excluded.interval_days,interval_meters=excluded.interval_meters,interval_rides=excluded.interval_rides,incident_threshold=excluded.incident_threshold,is_active=1,updated_at=CURRENT_TIMESTAMP`).bind(bikeId,days,meters,rides,incidents,bike.last_service_at,bike.odometer_meters,bike.total_rides).run();await audit(DB,actor,context,'workshop.schedule.upsert','bike',bikeId,{days,meters,rides,incidents});return json({success:true});}

export async function handleWorkshopApi(request,DB,actor,{json,readJson,requestId,ipHint,logEvent}){
  const url=new URL(request.url);const path=url.pathname;const method=request.method;const context={requestId,ipHint,logEvent};
  const legacy=path.match(/^\/api\/admin\/maintenance\/([1-9][0-9]*)$/);if(legacy&&method==='PATCH'){const record=await DB.prepare('SELECT process_version FROM maintenance_records WHERE id=?').bind(Number(legacy[1])).first();if(Number(record?.process_version)===2)return fail(json,'WORKSHOP_REQUIRED','Cette intervention doit être traitée dans l atelier professionnel.',409);}
  if(path==='/api/admin/workshop/overview'&&method==='GET')return overview(DB,json,actor);
  if(path==='/api/admin/workshop/interventions'&&method==='GET')return listInterventions(DB,json,actor,url);
  if(path==='/api/admin/workshop/interventions'&&method==='POST')return createIntervention(request,DB,json,actor,context,readJson);
  let match=path.match(/^\/api\/admin\/workshop\/interventions\/([1-9][0-9]*)$/);if(match&&method==='GET')return detail(DB,json,actor,Number(match[1]));
  match=path.match(/^\/api\/admin\/workshop\/interventions\/([1-9][0-9]*)\/transition$/);if(match&&method==='POST')return transition(request,DB,json,actor,context,Number(match[1]),readJson);
  match=path.match(/^\/api\/admin\/workshop\/interventions\/([1-9][0-9]*)\/comments$/);if(match&&method==='POST')return addComment(request,DB,json,actor,context,Number(match[1]),readJson);
  match=path.match(/^\/api\/admin\/workshop\/interventions\/([1-9][0-9]*)\/parts$/);if(match&&method==='POST')return usePart(request,DB,json,actor,context,Number(match[1]),readJson);
  if(path==='/api/admin/workshop/parts'&&method==='GET')return partsList(DB,json);if(path==='/api/admin/workshop/parts'&&method==='POST')return partCreate(request,DB,json,actor,context,readJson);
  if(path==='/api/admin/workshop/inspections'&&method==='POST')return createInspection(request,DB,json,actor,context,readJson);
  if(path==='/api/admin/workshop/schedules'&&method==='POST')return upsertSchedule(request,DB,json,actor,context,readJson);
  if(path==='/api/admin/workshop/reminders/generate'&&method==='POST')return generateReminders(DB,json,actor,context);
  return null;
}
