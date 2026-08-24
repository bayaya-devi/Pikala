const SUPPORT_TOPICS = new Set(['bike','station','ride','subscription','payment','account','security','other']);
const INCIDENT_TYPES = new Set(['brake','wheel','tire','chain','saddle','qr','light','damage','other']);
const NOTIFICATION_TYPES = new Set(['ride_started','ride_completed','subscription','payment','support','incident','service','security','announcement']);

function integer(value) { const parsed = Number(value); return Number.isInteger(parsed) && parsed > 0 ? parsed : null; }
function text(value, min, max) { const result = String(value ?? '').trim(); return result.length >= min && result.length <= max ? result : null; }
function page(url) { const current = Math.max(1, Number.parseInt(url.searchParams.get('page') || '1',10) || 1); const limit = Math.max(10,Math.min(50,Number.parseInt(url.searchParams.get('limit') || '20',10) || 20)); return {current,limit,offset:(current-1)*limit}; }
function missing(json, label) { return json({code:'RESOURCE_NOT_FOUND',error:`${label} introuvable.`},404); }
function invalid(json, code, message) { return json({code,error:message},400); }
function conflict(json, code, message) { return json({code,error:message},409); }
function publicCode(prefix) { return `${prefix}-${crypto.randomUUID().replaceAll('-','').slice(0,12).toUpperCase()}`; }

const COPY = {
  fr:{ticketTitle:'Ticket créé',ticketBody:'Votre demande a bien été transmise au support.',incidentTitle:'Incident signalé',incidentBody:'Votre signalement a bien été enregistré.'},
  en:{ticketTitle:'Ticket created',ticketBody:'Your request has been sent to support.',incidentTitle:'Incident reported',incidentBody:'Your report has been recorded.'},
  es:{ticketTitle:'Ticket creado',ticketBody:'Tu solicitud se ha enviado al soporte.',incidentTitle:'Incidente reportado',incidentBody:'Tu reporte ha sido registrado.'},
  pt:{ticketTitle:'Ticket criado',ticketBody:'O seu pedido foi enviado ao suporte.',incidentTitle:'Incidente comunicado',incidentBody:'O seu relato foi registado.'},
  ar:{ticketTitle:'تم إنشاء الطلب',ticketBody:'تم إرسال طلبك إلى فريق الدعم.',incidentTitle:'تم الإبلاغ عن العطل',incidentBody:'تم تسجيل بلاغك بنجاح.'}
};
function copy(user,key){return (COPY[user.locale]||COPY.fr)[key];}
function legacyTopic(topic){return ({bike:'bike',station:'station',ride:'ride',payment:'payment',subscription:'payment',account:'account',security:'safety',other:'general'})[topic];}
function legacyIncident(type){if(type==='damage')return'damage';if(type==='qr')return'lock';if(['brake','wheel','tire','chain','saddle','light'].includes(type))return'mechanical';return'other';}

async function supportContext(DB,json,user){const [rides,stations,bikes]=await DB.batch([
  DB.prepare(`SELECT rides.id,rides.status,rides.started_at,rides.bike_id,rides.start_station_id,rides.end_station_id,bikes.public_code bike_code,start.name start_station,end.name end_station FROM rides LEFT JOIN bikes ON bikes.id=rides.bike_id LEFT JOIN stations start ON start.id=rides.start_station_id LEFT JOIN stations end ON end.id=rides.end_station_id WHERE rides.user_id=? ORDER BY rides.id DESC LIMIT 30`).bind(user.id),
  DB.prepare('SELECT id,name,public_code FROM stations WHERE is_active=1 ORDER BY name LIMIT 100'),
  DB.prepare(`SELECT DISTINCT bikes.id,bikes.public_code,bikes.status,bikes.station_id,stations.name station_name FROM bikes LEFT JOIN stations ON stations.id=bikes.station_id LEFT JOIN rides ON rides.bike_id=bikes.id WHERE bikes.status<>'retired' AND (rides.user_id=? OR bikes.status IN ('available','maintenance')) ORDER BY bikes.public_code LIMIT 100`).bind(user.id)
]);return json({rides:rides.results||[],stations:stations.results||[],bikes:bikes.results||[]});}

async function supportList(DB,json,user,url){const {current,limit,offset}=page(url);const [rows,count]=await DB.batch([
  DB.prepare(`SELECT support_tickets.id,support_tickets.public_code,support_tickets.topic,support_tickets.subject,support_tickets.status,support_tickets.priority,support_tickets.created_at,support_tickets.updated_at,bikes.public_code bike_code,stations.name station_name,(SELECT COUNT(*) FROM support_ticket_messages WHERE ticket_id=support_tickets.id) message_count FROM support_tickets LEFT JOIN bikes ON bikes.id=support_tickets.bike_id LEFT JOIN stations ON stations.id=support_tickets.station_id WHERE support_tickets.user_id=? ORDER BY support_tickets.updated_at DESC,support_tickets.id DESC LIMIT ? OFFSET ?`).bind(user.id,limit,offset),
  DB.prepare('SELECT COUNT(*) count FROM support_tickets WHERE user_id=?').bind(user.id)
]);const total=Number(count.results?.[0]?.count||0);return json({tickets:rows.results||[],pagination:{page:current,limit,total,pages:Math.max(1,Math.ceil(total/limit))}});}

async function relations(DB,user,body){let ride=null;const rideId=integer(body.rideId);let bikeId=integer(body.bikeId);let stationId=integer(body.stationId);
  if(body.rideId&&!rideId)return{error:'REFERENCE_INVALID'};if(body.bikeId&&!bikeId)return{error:'REFERENCE_INVALID'};if(body.stationId&&!stationId)return{error:'REFERENCE_INVALID'};
  if(rideId){ride=await DB.prepare('SELECT id,bike_id,start_station_id,end_station_id FROM rides WHERE id=? AND user_id=?').bind(rideId,user.id).first();if(!ride)return{error:'RIDE_NOT_FOUND'};if(bikeId&&bikeId!==ride.bike_id)return{error:'REFERENCE_MISMATCH'};bikeId=bikeId||ride.bike_id;stationId=stationId||ride.end_station_id||ride.start_station_id;}
  if(bikeId&&!await DB.prepare('SELECT id FROM bikes WHERE id=?').bind(bikeId).first())return{error:'BIKE_NOT_FOUND'};
  if(stationId&&!await DB.prepare('SELECT id FROM stations WHERE id=?').bind(stationId).first())return{error:'STATION_NOT_FOUND'};
  return{rideId,bikeId,stationId};}

async function supportCreate(request,DB,json,user,readJson){const body=await readJson(request);const topic=String(body?.category||body?.topic||'other');const subject=text(body?.subject,3,140);const description=text(body?.description??body?.message,10,4000);if(!SUPPORT_TOPICS.has(topic))return invalid(json,'SUPPORT_CATEGORY_INVALID','Catégorie invalide.');if(!subject)return invalid(json,'SUPPORT_SUBJECT_INVALID','Le sujet doit contenir entre 3 et 140 caractères.');if(!description)return invalid(json,'SUPPORT_DESCRIPTION_INVALID','La description doit contenir entre 10 et 4000 caractères.');const refs=await relations(DB,user,body);if(refs.error)return invalid(json,refs.error,'Référence associée invalide.');const code=publicCode('TKT');const results=await DB.batch([
  DB.prepare(`INSERT INTO support_tickets (public_code,user_id,name,email,subject,message,category,topic,priority,status,bike_id,station_id,ride_id,updated_at) VALUES (?,?,?,?,?,?,?,?,?,'open',?,?,?,CURRENT_TIMESTAMP)`).bind(code,user.id,`${user.first_name} ${user.last_name}`.trim(),user.email,subject,description,legacyTopic(topic),topic,topic==='security'?'urgent':'normal',refs.bikeId,refs.stationId,refs.rideId),
  DB.prepare(`INSERT INTO support_ticket_messages (ticket_id,author_user_id,author_kind,body) SELECT id,?,'user',? FROM support_tickets WHERE public_code=?`).bind(user.id,description,code),
  DB.prepare(`INSERT INTO workflow_events (resource_type,resource_id,actor_user_id,to_status) SELECT 'support_ticket',id,?,'open' FROM support_tickets WHERE public_code=?`).bind(user.id,code),
  DB.prepare(`INSERT INTO notifications (user_id,type,title,body,channel,status,sent_at,action_url,updated_at) VALUES (?,'support',?,?,'in_app','sent',CURRENT_TIMESTAMP,?,CURRENT_TIMESTAMP)`).bind(user.id,copy(user,'ticketTitle'),copy(user,'ticketBody'),`/ticket.html?id=${encodeURIComponent(code)}`)
]);return json({ticket:{id:results[0].meta.last_row_id,publicCode:code,status:'open'}},201);}

async function ownedTicket(DB,user,key){return DB.prepare(`SELECT support_tickets.*,bikes.public_code bike_code,stations.name station_name,rides.status ride_status FROM support_tickets LEFT JOIN bikes ON bikes.id=support_tickets.bike_id LEFT JOIN stations ON stations.id=support_tickets.station_id LEFT JOIN rides ON rides.id=support_tickets.ride_id WHERE support_tickets.user_id=? AND (support_tickets.public_code=? OR CAST(support_tickets.id AS TEXT)=?) LIMIT 1`).bind(user.id,key,key).first();}
async function supportDetail(DB,json,user,key){const ticket=await ownedTicket(DB,user,key);if(!ticket)return missing(json,'Ticket');const [messages,events]=await DB.batch([
  DB.prepare(`SELECT support_ticket_messages.id,support_ticket_messages.author_kind,support_ticket_messages.body,support_ticket_messages.created_at,users.first_name,users.last_name FROM support_ticket_messages LEFT JOIN users ON users.id=support_ticket_messages.author_user_id WHERE ticket_id=? ORDER BY support_ticket_messages.id`).bind(ticket.id),
  DB.prepare("SELECT from_status,to_status,note,created_at FROM workflow_events WHERE resource_type='support_ticket' AND resource_id=? ORDER BY id").bind(ticket.id)
]);return json({ticket,messages:messages.results||[],events:events.results||[]});}
async function supportReply(request,DB,json,user,key,readJson){const ticket=await ownedTicket(DB,user,key);if(!ticket)return missing(json,'Ticket');if(['resolved','closed'].includes(ticket.status))return conflict(json,'TICKET_CLOSED','Ce ticket est fermé.');const body=await readJson(request);const message=text(body?.message,2,4000);if(!message)return invalid(json,'SUPPORT_MESSAGE_INVALID','Le message doit contenir entre 2 et 4000 caractères.');const next=ticket.status==='waiting_user'?'in_progress':ticket.status;const statements=[DB.prepare("INSERT INTO support_ticket_messages (ticket_id,author_user_id,author_kind,body) VALUES (?,?,'user',?)").bind(ticket.id,user.id,message),DB.prepare('UPDATE support_tickets SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(next,ticket.id)];if(next!==ticket.status)statements.push(DB.prepare("INSERT INTO workflow_events (resource_type,resource_id,actor_user_id,from_status,to_status) VALUES ('support_ticket',?,?,?,?)").bind(ticket.id,user.id,ticket.status,next));await DB.batch(statements);return json({success:true,status:next});}

async function incidentList(DB,json,user,url){const {current,limit,offset}=page(url);const [rows,count]=await DB.batch([
  DB.prepare(`SELECT bike_incidents.id,bike_incidents.public_code,bike_incidents.incident_type,bike_incidents.severity,bike_incidents.status,bike_incidents.description,bike_incidents.created_at,bikes.public_code bike_code,stations.name station_name FROM bike_incidents JOIN bikes ON bikes.id=bike_incidents.bike_id LEFT JOIN stations ON stations.id=bike_incidents.station_id WHERE bike_incidents.reported_by_user_id=? ORDER BY bike_incidents.id DESC LIMIT ? OFFSET ?`).bind(user.id,limit,offset),
  DB.prepare('SELECT COUNT(*) count FROM bike_incidents WHERE reported_by_user_id=?').bind(user.id)
]);const total=Number(count.results?.[0]?.count||0);return json({incidents:rows.results||[],pagination:{page:current,limit,total,pages:Math.max(1,Math.ceil(total/limit))}});}
async function incidentCreate(request,DB,json,user,readJson){const body=await readJson(request);const type=String(body?.type||body?.incidentType||'');const description=text(body?.description,10,1000);if(!INCIDENT_TYPES.has(type))return invalid(json,'INCIDENT_TYPE_INVALID','Type d’incident invalide.');if(!description)return invalid(json,'INCIDENT_DESCRIPTION_INVALID','La description doit contenir entre 10 et 1000 caractères.');const refs=await relations(DB,user,body);if(refs.error||!refs.bikeId)return invalid(json,refs.error||'BIKE_REQUIRED','Vélo invalide ou manquant.');const critical=body?.critical===true;const code=publicCode('INC');const results=await DB.batch([
  DB.prepare(`INSERT INTO bike_incidents (public_code,bike_id,ride_id,station_id,reported_by_user_id,category,incident_type,severity,status,description) VALUES (?,?,?,?,?,?,?,?, 'open',?)`).bind(code,refs.bikeId,refs.rideId,refs.stationId,user.id,legacyIncident(type),type,critical?'critical':'medium',description),
  DB.prepare(`INSERT INTO workflow_events (resource_type,resource_id,actor_user_id,to_status,note) SELECT 'incident',id,?,'open',? FROM bike_incidents WHERE public_code=?`).bind(user.id,critical?'critical':null,code),
  DB.prepare(`UPDATE bikes SET maintenance_required=CASE WHEN ?=1 THEN 1 ELSE maintenance_required END,status=CASE WHEN ?=1 AND status NOT IN ('in_use','retired') THEN 'maintenance' ELSE status END,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(critical?1:0,critical?1:0,refs.bikeId),
  DB.prepare(`INSERT INTO maintenance_records (bike_id,incident_id,opened_by_user_id,status,reason,workflow_stage) SELECT ?,id,?,'open',?,'reported' FROM bike_incidents WHERE public_code=? AND ?=1 AND EXISTS (SELECT 1 FROM bikes WHERE id=? AND status='maintenance') AND NOT EXISTS (SELECT 1 FROM maintenance_records WHERE bike_id=? AND status IN ('open','in_progress'))`).bind(refs.bikeId,user.id,description,code,critical?1:0,refs.bikeId,refs.bikeId),
  DB.prepare(`INSERT INTO notifications (user_id,type,title,body,channel,status,sent_at,action_url,updated_at) VALUES (?,'incident',?,?,'in_app','sent',CURRENT_TIMESTAMP,?,CURRENT_TIMESTAMP)`).bind(user.id,copy(user,'incidentTitle'),copy(user,'incidentBody'),`/incidents.html?id=${encodeURIComponent(code)}`)
]);if(results[3]?.meta?.changes){const record=await DB.prepare('SELECT id FROM maintenance_records WHERE incident_id=? ORDER BY id DESC LIMIT 1').bind(results[0].meta.last_row_id).first();if(record)await DB.prepare("INSERT INTO workflow_events (resource_type,resource_id,actor_user_id,to_status,note) VALUES ('maintenance',?,?,'reported','Incident critique')").bind(record.id,user.id).run();}return json({incident:{id:results[0].meta.last_row_id,publicCode:code,status:'open',critical}},201);}
async function incidentDetail(DB,json,user,key){const incident=await DB.prepare(`SELECT bike_incidents.*,bikes.public_code bike_code,stations.name station_name FROM bike_incidents JOIN bikes ON bikes.id=bike_incidents.bike_id LEFT JOIN stations ON stations.id=bike_incidents.station_id WHERE bike_incidents.reported_by_user_id=? AND (bike_incidents.public_code=? OR CAST(bike_incidents.id AS TEXT)=?) LIMIT 1`).bind(user.id,key,key).first();if(!incident)return missing(json,'Incident');const events=await DB.prepare("SELECT from_status,to_status,note,created_at FROM workflow_events WHERE resource_type='incident' AND resource_id=? ORDER BY id").bind(incident.id).all();return json({incident,events:events.results||[]});}

async function notificationsList(DB,json,user,url){const {current,limit,offset}=page(url);const [rows,count,unread]=await DB.batch([
  DB.prepare("SELECT id,type,title,body,status,action_url,created_at,read_at FROM notifications WHERE user_id=? AND status<>'dismissed' ORDER BY id DESC LIMIT ? OFFSET ?").bind(user.id,limit,offset),
  DB.prepare("SELECT COUNT(*) count FROM notifications WHERE user_id=? AND status<>'dismissed'").bind(user.id),
  DB.prepare("SELECT COUNT(*) count FROM notifications WHERE user_id=? AND status<>'dismissed' AND read_at IS NULL").bind(user.id)
]);const total=Number(count.results?.[0]?.count||0);return json({notifications:rows.results||[],unreadCount:Number(unread.results?.[0]?.count||0),pagination:{page:current,limit,total,pages:Math.max(1,Math.ceil(total/limit))}});}
async function notificationUpdate(request,DB,json,user,id,readJson){const body=await readJson(request);if(typeof body?.read!=='boolean')return invalid(json,'NOTIFICATION_STATE_INVALID','État invalide.');const result=await DB.prepare("UPDATE notifications SET status=CASE WHEN ?=1 THEN 'read' ELSE 'sent' END,read_at=CASE WHEN ?=1 THEN CURRENT_TIMESTAMP ELSE NULL END,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=? AND status<>'dismissed'").bind(body.read?1:0,body.read?1:0,id,user.id).run();return result.meta.changes?json({success:true,read:body.read}):missing(json,'Notification');}
async function notificationsReadAll(DB,json,user){const result=await DB.prepare("UPDATE notifications SET status='read',read_at=COALESCE(read_at,CURRENT_TIMESTAMP),updated_at=CURRENT_TIMESTAMP WHERE user_id=? AND status<>'dismissed' AND read_at IS NULL").bind(user.id).run();return json({success:true,count:result.meta.changes});}

export async function handleOperationsApi(request,env,user,{json,readJson}){const DB=env.DB;if(!DB)return json({code:'DB_UNAVAILABLE',error:'Service temporairement indisponible.'},503);const url=new URL(request.url);const path=url.pathname;const method=request.method;
  if(path==='/api/support/context'&&method==='GET')return supportContext(DB,json,user);
  if(path==='/api/support'&&method==='GET')return supportList(DB,json,user,url);if(path==='/api/support'&&method==='POST')return supportCreate(request,DB,json,user,readJson);
  let match=path.match(/^\/api\/support\/([A-Za-z0-9-]+)$/);if(match&&method==='GET')return supportDetail(DB,json,user,match[1]);
  match=path.match(/^\/api\/support\/([A-Za-z0-9-]+)\/messages$/);if(match&&method==='POST')return supportReply(request,DB,json,user,match[1],readJson);
  if(path==='/api/incidents'&&method==='GET')return incidentList(DB,json,user,url);if(path==='/api/incidents'&&method==='POST')return incidentCreate(request,DB,json,user,readJson);
  match=path.match(/^\/api\/incidents\/([A-Za-z0-9-]+)$/);if(match&&method==='GET')return incidentDetail(DB,json,user,match[1]);
  if(path==='/api/notifications'&&method==='GET')return notificationsList(DB,json,user,url);if(path==='/api/notifications/read-all'&&method==='POST')return notificationsReadAll(DB,json,user);
  match=path.match(/^\/api\/notifications\/([1-9][0-9]*)$/);if(match&&method==='PATCH')return notificationUpdate(request,DB,json,user,Number(match[1]),readJson);
  return json({code:'OPERATIONS_ROUTE_NOT_FOUND',error:'Route introuvable.'},404);
}

export { NOTIFICATION_TYPES };
