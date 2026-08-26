import { hasPermission } from '../auth/rbac.js';

const TYPES = new Set(['redistribution','bike_move','inspection','maintenance','retrieval','station_check','emergency','other']);
const PRIORITIES = new Set(['low','normal','high','urgent']);
const TRANSITIONS = Object.freeze({ assigned:'accepted', accepted:'in_progress', in_progress:'completed' });

function integer(value) { const number=Number(value); return Number.isInteger(number)&&number>0?number:null; }
function text(value,min,max) { const result=String(value??'').trim(); return result.length>=min&&result.length<=max?result:null; }
function error(json,code,message,status=400) { return json({code,error:message},status); }
function broad(actor) { return hasPermission(actor,'field_tasks.read')||hasPermission(actor,'field_tasks.manage'); }
function canManage(actor) { return hasPermission(actor,'field_tasks.manage'); }
function canExecute(actor) { return hasPermission(actor,'field_tasks.execute')||hasPermission(actor,'field_tasks.execute_assigned'); }
function page(url) { const limit=Math.max(10,Math.min(100,Number(url.searchParams.get('limit'))||25));const current=Math.max(1,Number(url.searchParams.get('page'))||1);return{limit,current,offset:(current-1)*limit}; }
function publicCode() { return `FIELD-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0,6).toUpperCase()}`; }
function normalizeScan(value,kind) {
  let code=String(value??'').trim();
  if(code.length<2||code.length>300)return null;
  const match=code.match(new RegExp(`^pikala:\\/\\/${kind}\\/([^/?#]+)`,'i'));
  if(match)code=decodeURIComponent(match[1]);
  return code.trim().toLowerCase();
}
async function audit(DB,actor,context,action,targetId,metadata={}) {
  await DB.prepare(`INSERT INTO admin_audit_logs(actor_user_id,action,target_type,target_id,request_id,ip_hint,metadata_json)
    VALUES(?,?,?,?,?,?,?)`).bind(actor.id,action,'field_task',String(targetId),context.requestId,context.ipHint,JSON.stringify(metadata)).run();
  context.logEvent?.('admin.action',{requestId:context.requestId,userId:actor.id,resourceType:'field_task',resourceId:targetId,action,outcome:'success'});
}
async function taskRow(DB,id) {
  return DB.prepare(`SELECT field_tasks.*,source.name source_station,source.public_code source_code,destination.name destination_station,destination.public_code destination_code,
    users.first_name assignee_first_name,users.last_name assignee_last_name,users.email assignee_email
    FROM field_tasks LEFT JOIN stations source ON source.id=field_tasks.source_station_id LEFT JOIN stations destination ON destination.id=field_tasks.destination_station_id
    LEFT JOIN users ON users.id=field_tasks.assigned_to_user_id WHERE field_tasks.id=?`).bind(id).first();
}
function visible(actor,task) { return broad(actor)||Number(task?.assigned_to_user_id)===Number(actor.id); }

async function overview(DB,json,actor) {
  const scope=broad(actor)?'1=1':'assigned_to_user_id=?';const bindings=broad(actor)?[]:[actor.id];
  const [counts,due,custody]=await DB.batch([
    DB.prepare(`SELECT status,COUNT(*) count FROM field_tasks WHERE ${scope} GROUP BY status`).bind(...bindings),
    DB.prepare(`SELECT COUNT(*) count FROM field_tasks WHERE ${scope} AND status NOT IN ('completed','cancelled') AND due_at<CURRENT_TIMESTAMP`).bind(...bindings),
    DB.prepare(`SELECT COUNT(*) count FROM field_task_bikes JOIN field_tasks ON field_tasks.id=field_task_bikes.task_id WHERE ${broad(actor)?'1=1':'field_tasks.assigned_to_user_id=?'} AND custody_status='picked_up'`).bind(...bindings)
  ]);
  return json({counts:Object.fromEntries((counts.results||[]).map(row=>[row.status,Number(row.count)])),overdue:Number(due.results?.[0]?.count||0),inCustody:Number(custody.results?.[0]?.count||0)});
}
async function list(DB,json,url,actor) {
  const pagination=page(url);const status=String(url.searchParams.get('status')||'');const mine=!broad(actor)||url.searchParams.get('mine')==='1';
  const where=`WHERE (?='' OR field_tasks.status=?) AND (?=0 OR field_tasks.assigned_to_user_id=?)`;const bindings=[status,status,mine?1:0,actor.id];
  const [rows,count]=await DB.batch([
    DB.prepare(`SELECT field_tasks.*,source.name source_station,destination.name destination_station,users.first_name assignee_first_name,users.last_name assignee_last_name,
      (SELECT COUNT(*) FROM field_task_bikes WHERE task_id=field_tasks.id) bike_count,
      (SELECT COUNT(*) FROM field_task_bikes WHERE task_id=field_tasks.id AND custody_status='picked_up') custody_count
      FROM field_tasks LEFT JOIN stations source ON source.id=field_tasks.source_station_id LEFT JOIN stations destination ON destination.id=field_tasks.destination_station_id
      LEFT JOIN users ON users.id=field_tasks.assigned_to_user_id ${where} ORDER BY CASE field_tasks.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,COALESCE(field_tasks.due_at,'9999') LIMIT ? OFFSET ?`).bind(...bindings,pagination.limit,pagination.offset),
    DB.prepare(`SELECT COUNT(*) count FROM field_tasks ${where}`).bind(...bindings)
  ]);
  const total=Number(count.results?.[0]?.count||0);return json({items:rows.results||[],pagination:{page:pagination.current,limit:pagination.limit,total,pages:Math.max(1,Math.ceil(total/pagination.limit))}});
}
async function detail(DB,json,actor,id) {
  const task=await taskRow(DB,id);if(!task||!visible(actor,task))return error(json,'FIELD_TASK_NOT_FOUND','Mission introuvable.',404);
  const [bikes,events,scans]=await DB.batch([
    DB.prepare(`SELECT field_task_bikes.*,bikes.public_code,bikes.status,bikes.station_id,docks.public_code deposit_dock_code FROM field_task_bikes JOIN bikes ON bikes.id=field_task_bikes.bike_id LEFT JOIN docks ON docks.id=field_task_bikes.deposit_dock_id WHERE task_id=? ORDER BY sequence_number`).bind(id),
    DB.prepare(`SELECT field_task_events.*,users.first_name actor_first_name,users.last_name actor_last_name FROM field_task_events LEFT JOIN users ON users.id=field_task_events.actor_user_id WHERE task_id=? ORDER BY id DESC LIMIT 100`).bind(id),
    DB.prepare('SELECT id,scan_type,station_id,bike_id,dock_id,created_at FROM field_scan_records WHERE task_id=? ORDER BY id').bind(id)
  ]);
  return json({task,bikes:bikes.results||[],events:events.results||[],scans:scans.results||[]});
}
async function create(request,DB,json,actor,context,readJson) {
  if(!canManage(actor))return error(json,'FORBIDDEN','Permission insuffisante.',403);
  const body=await readJson(request);const type=String(body?.type||'');const priority=String(body?.priority||'normal');const description=text(body?.description,3,1000);
  const assignee=body?.agentId?integer(body.agentId):null;const source=body?.sourceStationId?integer(body.sourceStationId):null;const destination=body?.destinationStationId?integer(body.destinationStationId):null;
  const bikeIds=[...new Set((Array.isArray(body?.bikeIds)?body.bikeIds:[]).map(integer).filter(Boolean))].slice(0,100);
  if(!TYPES.has(type)||!PRIORITIES.has(priority)||!description||source===destination&&source!==null)return error(json,'FIELD_TASK_INPUT_INVALID','Vérifiez le type, les stations et la description.');
  if(['redistribution','bike_move'].includes(type)&&(!source||!destination||!bikeIds.length))return error(json,'FIELD_TASK_ROUTE_REQUIRED','Une mission de déplacement exige deux stations et au moins un vélo.');
  if(assignee&&!await DB.prepare("SELECT users.id FROM users JOIN staff_members ON staff_members.user_id=users.id WHERE users.id=? AND staff_members.status='active'").bind(assignee).first())return error(json,'FIELD_AGENT_INVALID','Agent actif introuvable.',404);
  const result=await DB.prepare(`INSERT INTO field_tasks(public_code,task_type,priority,status,description,assigned_to_user_id,source_station_id,destination_station_id,due_at,notes,created_by_user_id)
    VALUES(?,?,?,CASE WHEN ? IS NULL THEN 'created' ELSE 'assigned' END,?,?,?,?,?,?,?)`).bind(publicCode(),type,priority,assignee,description,assignee,source,destination,body?.deadline||null,text(body?.notes||'',0,2000)||null,actor.id).run();
  const id=result.meta.last_row_id;
  for(let index=0;index<bikeIds.length;index+=1)await DB.prepare('INSERT INTO field_task_bikes(task_id,bike_id,sequence_number) VALUES(?,?,?)').bind(id,bikeIds[index],index+1).run();
  await DB.prepare(`INSERT INTO field_task_events(task_id,actor_user_id,event_type,request_id,payload_json) VALUES(?,?,'task.created',?,?)`).bind(id,actor.id,context.requestId,JSON.stringify({type,priority,bikeCount:bikeIds.length})).run();
  await audit(DB,actor,context,'field_task.create',id,{type,priority,bikeCount:bikeIds.length});return json({success:true,id},201);
}
async function assign(request,DB,json,actor,context,id,readJson) {
  if(!canManage(actor))return error(json,'FORBIDDEN','Permission insuffisante.',403);const body=await readJson(request);const agent=integer(body?.agentId);if(!agent)return error(json,'FIELD_AGENT_INVALID','Agent invalide.');
  const valid=await DB.prepare("SELECT users.id FROM users JOIN staff_members ON staff_members.user_id=users.id WHERE users.id=? AND staff_members.status='active' AND staff_members.role IN ('field_agent','technician','station_manager','operations_manager','admin','super_admin')").bind(agent).first();if(!valid)return error(json,'FIELD_AGENT_INVALID','Agent actif introuvable.',404);
  const result=await DB.prepare("UPDATE field_tasks SET assigned_to_user_id=?,status='assigned' WHERE id=? AND status='created'").bind(agent,id).run();if(!result.meta.changes)return error(json,'FIELD_TASK_STATE_INVALID','Seule une mission créée peut être assignée.',409);
  await DB.prepare("INSERT INTO field_task_events(task_id,actor_user_id,event_type,request_id,payload_json) VALUES(?,?,'task.assigned',?,?)").bind(id,actor.id,context.requestId,JSON.stringify({agentId:agent})).run();await audit(DB,actor,context,'field_task.assign',id,{agentId:agent});return json({success:true});
}
async function transition(request,DB,json,actor,context,id,readJson) {
  if(!canExecute(actor))return error(json,'FORBIDDEN','Permission insuffisante.',403);const task=await taskRow(DB,id);if(!task||!visible(actor,task)||Number(task.assigned_to_user_id)!==Number(actor.id)&&!hasPermission(actor,'field_tasks.execute'))return error(json,'FIELD_TASK_NOT_FOUND','Mission introuvable.',404);
  const body=await readJson(request);const next=String(body?.status||'');const allowed=TRANSITIONS[task.status];if(next!==allowed&&next!=='cancelled')return error(json,'FIELD_TASK_TRANSITION_INVALID','Transition de mission invalide.',409);
  try { const result=await DB.prepare(`UPDATE field_tasks SET status=?,accepted_at=CASE WHEN ?='accepted' THEN CURRENT_TIMESTAMP ELSE accepted_at END,started_at=CASE WHEN ?='in_progress' THEN CURRENT_TIMESTAMP ELSE started_at END,completed_at=CASE WHEN ?='completed' THEN CURRENT_TIMESTAMP ELSE completed_at END,cancelled_at=CASE WHEN ?='cancelled' THEN CURRENT_TIMESTAMP ELSE cancelled_at END,notes=COALESCE(?,notes) WHERE id=? AND status=?`).bind(next,next,next,next,next,text(body?.notes||'',0,2000)||null,id,task.status).run();if(!result.meta.changes)return error(json,'FIELD_TASK_STATE_INVALID','La mission vient de changer. Rechargez-la.',409); }
  catch(errorValue){const message=String(errorValue.message);if(message.includes('physical steps incomplete'))return error(json,'FIELD_TASK_PHYSICAL_STEPS_INCOMPLETE','Scannez toutes les stations, vélos et quais requis avant de terminer.',409);if(message.includes('custody must be resolved'))return error(json,'FIELD_TASK_CUSTODY_UNRESOLVED','Un vélo est encore sous garde. Déposez-le avant d’annuler.',409);throw errorValue;}
  await DB.prepare(`INSERT INTO field_task_events(task_id,actor_user_id,event_type,request_id,payload_json) VALUES(?,?,?,?,'{}')`).bind(id,actor.id,`agent.${next}`,context.requestId).run();return json({success:true,status:next});
}
async function scan(request,DB,json,actor,context,id,readJson) {
  if(!canExecute(actor))return error(json,'FORBIDDEN','Permission insuffisante.',403);const task=await taskRow(DB,id);if(!task||Number(task.assigned_to_user_id)!==Number(actor.id)&&!hasPermission(actor,'field_tasks.execute'))return error(json,'FIELD_TASK_NOT_FOUND','Mission introuvable.',404);
  const body=await readJson(request);const type=String(body?.type||'');if(!['source_station','pickup_bike','destination_station','deposit_bike'].includes(type))return error(json,'FIELD_SCAN_TYPE_INVALID','Type de scan invalide.');
  const raw=String(body?.code||'').trim();const stationKind=type.includes('station');const bikeKind=type.includes('bike');const normalized=normalizeScan(raw,stationKind?'station':bikeKind?'bike':'dock');if(!normalized)return error(json,'FIELD_SCAN_INVALID','Code scanné invalide.');
  let stationId=null,bikeId=null,dockId=null;
  if(stationKind){const row=await DB.prepare('SELECT id FROM stations WHERE lower(public_code)=? OR lower(slug)=?').bind(normalized,normalized).first();stationId=row?.id||null;}
  if(type==='pickup_bike'){const row=await DB.prepare('SELECT id FROM bikes WHERE lower(public_code)=? OR lower(code)=?').bind(normalized,normalized).first();bikeId=row?.id||null;}
  if(type==='deposit_bike'){
    const bikeCode=normalizeScan(body?.bikeCode,'bike');const dockCode=normalizeScan(body?.dockCode||body?.code,'dock');
    const [bike,dock]=await Promise.all([DB.prepare('SELECT id FROM bikes WHERE lower(public_code)=? OR lower(code)=?').bind(bikeCode,bikeCode).first(),DB.prepare('SELECT id,station_id FROM docks WHERE lower(public_code)=?').bind(dockCode).first()]);
    bikeId=bike?.id||null;dockId=dock?.id||null;stationId=dock?.station_id||null;
  }
  try { const result=await DB.prepare(`INSERT INTO field_scan_records(task_id,actor_user_id,scan_type,scanned_code,station_id,bike_id,dock_id,request_id) VALUES(?,?,?,?,?,?,?,?)`).bind(id,actor.id,type,raw,stationId,bikeId,dockId,String(body?.idempotencyKey||context.requestId)).run();return json({success:true,scanId:result.meta.last_row_id,type},201); }
  catch(errorValue){const message=String(errorValue.message);if(message.includes('idx_field_scan_idempotency')||message.includes('UNIQUE constraint'))return json({success:true,idempotent:true,type});if(message.includes('actor or task'))return error(json,'FIELD_TASK_STATE_INVALID','La mission doit être démarrée par son agent.',409);if(message.includes('source station'))return error(json,'FIELD_SOURCE_SCAN_MISMATCH','Ce n’est pas la station de départ.',409);if(message.includes('destination station'))return error(json,'FIELD_DESTINATION_SCAN_MISMATCH','Ce n’est pas la station d’arrivée.',409);if(message.includes('pickup'))return error(json,'FIELD_PICKUP_REJECTED','Ce vélo ne peut pas être retiré pour cette mission.',409);if(message.includes('deposit'))return error(json,'FIELD_DEPOSIT_REJECTED','Le vélo ou le quai ne correspond pas à cette mission.',409);throw errorValue;}
}

async function suggestions(DB,json) {
  const rows=(await DB.prepare(`SELECT stations.id,stations.name,stations.capacity,
    (SELECT COUNT(*) FROM bikes WHERE bikes.station_id=stations.id AND bikes.status='available') bikes_available,
    (SELECT COUNT(*) FROM docks WHERE docks.station_id=stations.id AND docks.status='available' AND docks.bike_id IS NULL) docks_available
    FROM stations WHERE is_active=1 AND capacity>0 ORDER BY stations.id`).all()).results||[];
  const sources=rows.filter(row=>Number(row.docks_available)<=1&&Number(row.bikes_available)>=2).sort((a,b)=>Number(a.docks_available)-Number(b.docks_available)||Number(b.bikes_available)-Number(a.bikes_available));const destinations=rows.filter(row=>Number(row.bikes_available)<=2&&Number(row.docks_available)>=1).sort((a,b)=>Number(a.bikes_available)-Number(b.bikes_available)||Number(b.docks_available)-Number(a.docks_available));let created=0;
  for(const source of sources)for(const destination of destinations){if(source.id===destination.id)continue;const amount=Math.min(Math.max(1,Number(source.bikes_available)-Math.ceil(Number(source.capacity)/2)),Math.max(1,Math.ceil(Number(destination.capacity)/2)-Number(destination.bikes_available)),Number(destination.docks_available));if(amount<1)continue;
    const exists=await DB.prepare("SELECT id FROM rebalancing_recommendations WHERE source_station_id=? AND destination_station_id=? AND status='open'").bind(source.id,destination.id).first();if(exists)continue;
    await DB.prepare(`INSERT INTO rebalancing_recommendations(source_station_id,destination_station_id,suggested_bikes,priority,status,reason,calculation_json,expires_at) VALUES(?,?,?,'high','open',?,?,datetime('now','+6 hours'))`).bind(source.id,destination.id,amount,`Déplacer ${amount} vélo(s) de ${source.name} vers ${destination.name}.`,JSON.stringify({sourceBikes:Number(source.bikes_available),sourceFreeDocks:Number(source.docks_available),destinationBikes:Number(destination.bikes_available),destinationFreeDocks:Number(destination.docks_available)})).run();created+=1;break;
  }
  return json({success:true,created,suggestions:(await DB.prepare(`SELECT rebalancing_recommendations.*,source.name source_station,destination.name destination_station FROM rebalancing_recommendations JOIN stations source ON source.id=source_station_id JOIN stations destination ON destination.id=destination_station_id WHERE rebalancing_recommendations.status='open' ORDER BY priority DESC,created_at DESC`).all()).results||[]});
}
async function listSuggestions(DB,json) { return json({items:(await DB.prepare(`SELECT rebalancing_recommendations.*,source.name source_station,destination.name destination_station FROM rebalancing_recommendations JOIN stations source ON source.id=source_station_id JOIN stations destination ON destination.id=destination_station_id WHERE rebalancing_recommendations.status='open' ORDER BY CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 ELSE 2 END,created_at DESC`).all()).results||[]}); }
async function reviewSuggestion(request,DB,json,actor,context,id,readJson) {
  if(!canManage(actor)||!hasPermission(actor,'rebalancing.manage'))return error(json,'FORBIDDEN','Permission insuffisante.',403);const body=await readJson(request);const action=String(body?.action||'');const suggestion=await DB.prepare("SELECT * FROM rebalancing_recommendations WHERE id=?").bind(id).first();if(!suggestion)return error(json,'REBALANCING_NOT_FOUND','Suggestion introuvable.',404);if(suggestion.status!=='open')return error(json,'REBALANCING_ALREADY_ACCEPTED','Cette suggestion a déjà été traitée.',409);
  if(action==='ignore'){const reason=text(body?.reason,5,500);if(!reason)return error(json,'REBALANCING_REASON_REQUIRED','Expliquez pourquoi la suggestion est ignorée.');await DB.prepare("UPDATE rebalancing_recommendations SET status='dismissed',ignored_reason=?,reviewed_by_user_id=?,reviewed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='open'").bind(reason,actor.id,id).run();return json({success:true,status:'dismissed'});}
  if(action!=='accept')return error(json,'REBALANCING_ACTION_INVALID','Action invalide.');const agent=body?.agentId?integer(body.agentId):null;if(agent&&!await DB.prepare("SELECT users.id FROM users JOIN staff_members ON staff_members.user_id=users.id WHERE users.id=? AND staff_members.status='active' AND staff_members.role IN ('field_agent','technician','station_manager','operations_manager','admin','super_admin')").bind(agent).first())return error(json,'FIELD_AGENT_INVALID','Agent actif introuvable.',404);const count=Math.max(1,Math.min(100,integer(body?.bikeCount)||Number(suggestion.suggested_bikes)));const bikeRows=(await DB.prepare("SELECT id FROM bikes WHERE station_id=? AND status='available' AND maintenance_required=0 ORDER BY id LIMIT ?").bind(suggestion.source_station_id,count).all()).results||[];if(bikeRows.length<count)return error(json,'REBALANCING_BIKES_UNAVAILABLE','Pas assez de vélos réellement disponibles.',409);
  let result;try{result=await DB.prepare(`INSERT INTO field_tasks(public_code,task_type,priority,status,description,assigned_to_user_id,source_station_id,destination_station_id,due_at,rebalancing_recommendation_id,created_by_user_id) VALUES(?, 'redistribution', ?, CASE WHEN ? IS NULL THEN 'created' ELSE 'assigned' END,?,?,?,?,datetime('now','+4 hours'),?,?)`).bind(publicCode(),suggestion.priority,agent,suggestion.reason,agent,suggestion.source_station_id,suggestion.destination_station_id,id,actor.id).run();}catch(errorValue){if(String(errorValue.message).includes('UNIQUE constraint'))return error(json,'REBALANCING_ALREADY_ACCEPTED','Cette suggestion a déjà été convertie en mission.',409);throw errorValue;}
  for(let index=0;index<bikeRows.length;index+=1)await DB.prepare('INSERT INTO field_task_bikes(task_id,bike_id,sequence_number) VALUES(?,?,?)').bind(result.meta.last_row_id,bikeRows[index].id,index+1).run();
  const accepted=await DB.prepare("UPDATE rebalancing_recommendations SET status='accepted',field_task_id=?,reviewed_by_user_id=?,reviewed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='open'").bind(result.meta.last_row_id,actor.id,id).run();if(!accepted.meta.changes)return error(json,'REBALANCING_ALREADY_ACCEPTED','Cette suggestion a déjà été traitée.',409);await audit(DB,actor,context,'rebalancing.accept',result.meta.last_row_id,{suggestionId:id,bikeCount:bikeRows.length});return json({success:true,taskId:result.meta.last_row_id,status:'accepted'},201);
}

export async function handleFieldOperationsApi(request,DB,actor,utilities) {
  const {json,readJson,requestId,ipHint,logEvent}=utilities;const url=new URL(request.url);const path=url.pathname;const method=request.method;const context={requestId,ipHint,logEvent};
  if(!path.startsWith('/api/admin/field/'))return null;
  if(!broad(actor)&&!hasPermission(actor,'field_tasks.read_assigned'))return error(json,'FORBIDDEN','Permission insuffisante.',403);
  if(path==='/api/admin/field/overview'&&method==='GET')return overview(DB,json,actor);
  if(path==='/api/admin/field/tasks'&&method==='GET')return list(DB,json,url,actor);
  if(path==='/api/admin/field/tasks'&&method==='POST')return create(request,DB,json,actor,context,readJson);
  let match=path.match(/^\/api\/admin\/field\/tasks\/([1-9][0-9]*)$/);if(match&&method==='GET')return detail(DB,json,actor,Number(match[1]));
  match=path.match(/^\/api\/admin\/field\/tasks\/([1-9][0-9]*)\/assign$/);if(match&&method==='POST')return assign(request,DB,json,actor,context,Number(match[1]),readJson);
  match=path.match(/^\/api\/admin\/field\/tasks\/([1-9][0-9]*)\/transition$/);if(match&&method==='POST')return transition(request,DB,json,actor,context,Number(match[1]),readJson);
  match=path.match(/^\/api\/admin\/field\/tasks\/([1-9][0-9]*)\/scan$/);if(match&&method==='POST')return scan(request,DB,json,actor,context,Number(match[1]),readJson);
  if(path==='/api/admin/field/rebalancing/generate'&&method==='POST'){if(!canManage(actor)||!hasPermission(actor,'rebalancing.manage'))return error(json,'FORBIDDEN','Permission insuffisante.',403);return suggestions(DB,json);}
  if(path==='/api/admin/field/rebalancing'&&method==='GET'){if(!hasPermission(actor,'rebalancing.read'))return error(json,'FORBIDDEN','Permission insuffisante.',403);return listSuggestions(DB,json);}
  match=path.match(/^\/api\/admin\/field\/rebalancing\/([1-9][0-9]*)$/);if(match&&method==='POST')return reviewSuggestion(request,DB,json,actor,context,Number(match[1]),readJson);
  return error(json,'FIELD_ROUTE_NOT_FOUND','Route terrain introuvable.',404);
}
