import { handleAdminOperationsApi } from './operations.js';

const USER_ROLES = new Set(['user', 'support', 'operator', 'admin']);
const USER_STATUSES = new Set(['active', 'suspended', 'disabled']);
const BIKE_STATUSES = new Set(['available', 'reserved', 'in_use', 'maintenance', 'disabled', 'lost', 'retired']);
const INCIDENT_STATUSES = new Set(['open', 'triaged', 'in_progress', 'resolved', 'closed']);
const SUPPORT_STATUSES = new Set(['open', 'in_progress', 'waiting_user', 'resolved', 'closed']);
const PRIORITIES = new Set(['low', 'normal', 'high', 'urgent']);
const MAINTENANCE_STATUSES = new Set(['open', 'in_progress', 'resolved', 'cancelled']);
const SETTINGS = new Set(['service_status', 'support_contact', 'ride_monitoring']);
const NOTIFICATION_TYPES = new Set(['ride_started','ride_completed','subscription','payment','support','incident','service','security','announcement']);

function pagination(url) {
  const page = Math.max(1, Math.min(100000, Number.parseInt(url.searchParams.get('page') || '1', 10) || 1));
  const limit = Math.max(10, Math.min(100, Number.parseInt(url.searchParams.get('limit') || '25', 10) || 25));
  return { page, limit, offset: (page - 1) * limit };
}

function query(url, key, max = 120) { return String(url.searchParams.get(key) || '').trim().slice(0, max); }
function integer(value) { const parsed = Number(value); return Number.isInteger(parsed) && parsed > 0 ? parsed : null; }
function finite(value, min, max) { const parsed = Number(value); return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null; }
function boolean(value, fallback = false) { return value === undefined ? fallback : value === true || value === 1 || value === '1'; }
function text(value, max, min = 0) { const result = String(value ?? '').trim(); return result.length >= min && result.length <= max ? result : null; }
function code(value, max = 80) { const result = String(value || '').trim().toLowerCase(); return /^[a-z0-9][a-z0-9-]{1,79}$/.test(result) && result.length <= max ? result : null; }
function jsonValue(value, fallback = {}) { try { return JSON.parse(value); } catch { return fallback; } }

function safeMetadata(value = {}) {
  const safe = {};
  Object.entries(value).slice(0, 12).forEach(([key, item]) => {
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(key)) return;
    if (typeof item === 'string') safe[key] = item.slice(0, 240);
    else if (typeof item === 'number' || typeof item === 'boolean' || item === null) safe[key] = item;
  });
  return safe;
}

async function audit(DB, actor, context, action, targetType, targetId, metadata = {}) {
  await DB.prepare(`INSERT INTO admin_audit_logs
    (actor_user_id, action, target_type, target_id, request_id, ip_hint, metadata_json)
    VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(actor.id, action, targetType, targetId == null ? null : String(targetId), context.requestId, context.ipHint,
      JSON.stringify(safeMetadata(metadata))).run();
}

async function paged(DB, selectSql, countSql, bindings, url) {
  const { page, limit, offset } = pagination(url);
  const [rows, count] = await DB.batch([
    DB.prepare(`${selectSql} LIMIT ? OFFSET ?`).bind(...bindings, limit, offset),
    DB.prepare(countSql).bind(...bindings)
  ]);
  const total = Number(count.results?.[0]?.count || 0);
  return { items: rows.results || [], pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } };
}

function invalid(json, codeName = 'ADMIN_INPUT_INVALID', message = 'Donnees invalides.') { return json({ code: codeName, error: message }, 400); }
function missing(json, resource = 'Ressource') { return json({ code: 'ADMIN_NOT_FOUND', error: `${resource} introuvable.` }, 404); }
function conflict(json, message) { return json({ code: 'ADMIN_CONFLICT', error: message }, 409); }

async function overview(DB, json) {
  const results = await DB.batch([
    DB.prepare('SELECT COUNT(*) count FROM users'),
    DB.prepare("SELECT COUNT(*) count FROM users WHERE created_at >= datetime('now','-7 days')"),
    DB.prepare("SELECT COUNT(*) count FROM rides WHERE date(started_at) = date('now')"),
    DB.prepare("SELECT COUNT(*) count FROM rides WHERE status = 'active'"),
    DB.prepare("SELECT status, COUNT(*) count FROM bikes GROUP BY status"),
    DB.prepare('SELECT COUNT(*) count FROM stations WHERE is_active = 1'),
    DB.prepare("SELECT COUNT(*) count FROM subscriptions WHERE status = 'active' AND (current_period_end IS NULL OR current_period_end > CURRENT_TIMESTAMP)"),
    DB.prepare("SELECT COUNT(*) count FROM support_tickets WHERE status IN ('open','in_progress','waiting_user')"),
    DB.prepare("SELECT COUNT(*) count FROM bike_incidents WHERE status IN ('open','triaged','in_progress')"),
    DB.prepare("SELECT date(started_at) day, COUNT(*) count FROM rides WHERE started_at >= datetime('now','-6 days') GROUP BY date(started_at) ORDER BY day")
  ]);
  const bikes = Object.fromEntries((results[4].results || []).map((row) => [row.status, Number(row.count)]));
  return json({ metrics: {
    users: Number(results[0].results?.[0]?.count || 0), newUsers: Number(results[1].results?.[0]?.count || 0),
    ridesToday: Number(results[2].results?.[0]?.count || 0), activeRides: Number(results[3].results?.[0]?.count || 0),
    bikes: { available: bikes.available || 0, in_use: bikes.in_use || 0, maintenance: bikes.maintenance || 0, unavailable: (bikes.disabled || 0) + (bikes.lost || 0) + (bikes.retired || 0) },
    activeStations: Number(results[5].results?.[0]?.count || 0), activeSubscriptions: Number(results[6].results?.[0]?.count || 0),
    openTickets: Number(results[7].results?.[0]?.count || 0), openIncidents: Number(results[8].results?.[0]?.count || 0)
  }, ridesByDay: results[9].results || [] });
}

async function usersList(DB, json, url) {
  const search = query(url, 'search'); const role = query(url, 'role', 20); const status = query(url, 'status', 20);
  const conditions = ['(? = \'\' OR lower(users.first_name || \' \' || users.last_name || \' \' || users.email || \' \' || COALESCE(users.phone,\'\')) LIKE \'%\' || lower(?) || \'%\')', '(? = \'\' OR users.role = ?)', '(? = \'\' OR users.status = ?)'];
  const bindings = [search, search, role, role, status, status]; const where = `WHERE ${conditions.join(' AND ')}`;
  return json(await paged(DB, `SELECT users.id, users.first_name, users.last_name, users.email, users.phone, users.role, users.status, users.locale,
    users.email_verified, users.created_at, users.last_login_at, plans.name AS plan_name, subscriptions.status AS subscription_status
    FROM users LEFT JOIN subscriptions ON subscriptions.user_id = users.id AND subscriptions.status = 'active'
    LEFT JOIN plans ON plans.id = subscriptions.plan_id ${where} ORDER BY users.id DESC`, `SELECT COUNT(*) count FROM users ${where}`, bindings, url));
}

async function userDetail(DB, json, id) {
  const user = await DB.prepare(`SELECT users.id, users.first_name, users.last_name, users.email, users.phone, users.role, users.status,
    users.status_reason, users.locale, users.email_verified, users.created_at, users.last_login_at,
    subscriptions.id subscription_id, subscriptions.status subscription_status, subscriptions.current_period_end, plans.name plan_name
    FROM users LEFT JOIN subscriptions ON subscriptions.user_id = users.id AND subscriptions.status = 'active'
    LEFT JOIN plans ON plans.id = subscriptions.plan_id WHERE users.id = ? LIMIT 1`).bind(id).first();
  if (!user) return missing(json, 'Utilisateur');
  const [rides, tickets, incidents] = await DB.batch([
    DB.prepare(`SELECT rides.id, rides.status, rides.started_at, rides.ended_at, bikes.public_code bike_code
      FROM rides LEFT JOIN bikes ON bikes.id = rides.bike_id WHERE rides.user_id = ? ORDER BY rides.id DESC LIMIT 10`).bind(id),
    DB.prepare('SELECT id, subject, status, priority, created_at FROM support_tickets WHERE user_id = ? ORDER BY id DESC LIMIT 10').bind(id),
    DB.prepare(`SELECT bike_incidents.id, bike_incidents.category, bike_incidents.severity, bike_incidents.status, bike_incidents.created_at
      FROM bike_incidents LEFT JOIN rides ON rides.id = bike_incidents.ride_id
      WHERE bike_incidents.reported_by_user_id = ? OR rides.user_id = ? ORDER BY bike_incidents.id DESC LIMIT 10`).bind(id, id)
  ]);
  return json({ user, rides: rides.results || [], tickets: tickets.results || [], incidents: incidents.results || [] });
}

async function userUpdate(request, DB, json, actor, context, id, readJson) {
  const body = await readJson(request); if (!body) return invalid(json);
  const existing = await DB.prepare('SELECT id, role, status FROM users WHERE id = ?').bind(id).first(); if (!existing) return missing(json, 'Utilisateur');
  const role = String(body.role ?? existing.role); const status = String(body.status ?? existing.status); const reason = text(body.statusReason ?? '', 300);
  if (!USER_ROLES.has(role) || !USER_STATUSES.has(status) || reason === null) return invalid(json);
  if (id === actor.id && (role !== 'admin' || status !== 'active')) return conflict(json, 'Vous ne pouvez pas retirer votre propre acces administrateur.');
  const preservingActiveAdmin = role === 'admin' && status === 'active';
  const result = await DB.prepare(`UPDATE users SET role = ?, status = ?, status_reason = ?,
    auth_version = CASE WHEN role <> ? OR status <> ? THEN auth_version + 1 ELSE auth_version END,
    updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND (role <> 'admin' OR status <> 'active' OR ? = 1 OR
      (SELECT COUNT(*) FROM users WHERE role = 'admin' AND status = 'active') > 1)`)
    .bind(role, status, reason || null, role, status, id, preservingActiveAdmin ? 1 : 0).run();
  if (!result.meta.changes) return conflict(json, 'Le dernier administrateur actif doit etre conserve.');
  if (existing.role !== role || existing.status !== status) {
    await DB.prepare('UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ?').bind(id).run();
  }
  await audit(DB, actor, context, 'user.access.update', 'user', id, { fromRole: existing.role, role, fromStatus: existing.status, status });
  return json({ success: true });
}

const STATION_SELECT = `SELECT stations.id, stations.public_code, stations.slug, stations.name, stations.city, stations.address,
  stations.latitude, stations.longitude, stations.capacity, stations.is_active, stations.opening_hours_json, stations.created_at, stations.updated_at,
  COUNT(DISTINCT CASE WHEN docks.status <> 'disabled' THEN docks.id END) dock_count,
  COUNT(DISTINCT CASE WHEN docks.status = 'available' THEN docks.id END) docks_available,
  COUNT(DISTINCT CASE WHEN bikes.status = 'available' THEN bikes.id END) bikes_available,
  COUNT(DISTINCT bikes.id) bikes_total FROM stations
  LEFT JOIN docks ON docks.station_id = stations.id LEFT JOIN bikes ON bikes.station_id = stations.id`;

async function stationsList(DB, json, url) {
  const search = query(url, 'search'); const status = query(url, 'status', 20);
  const where = `WHERE (? = '' OR lower(stations.name || ' ' || stations.public_code || ' ' || COALESCE(stations.address,'')) LIKE '%' || lower(?) || '%')
    AND (? = '' OR stations.is_active = ?)`; const statusValue = status === 'active' ? 1 : status === 'inactive' ? 0 : -1;
  const bindings = [search, search, status, statusValue];
  return json(await paged(DB, `${STATION_SELECT} ${where} GROUP BY stations.id ORDER BY stations.name`, `SELECT COUNT(*) count FROM stations ${where}`, bindings, url));
}

function stationInput(body, existing = {}) {
  const name = text(body?.name ?? existing.name, 120, 2); const publicCode = code(body?.publicCode ?? existing.public_code);
  const slug = code(body?.slug ?? existing.slug ?? publicCode); const address = text(body?.address ?? existing.address ?? '', 240);
  const city = text(body?.city ?? existing.city ?? 'Rabat', 80, 2); const latitude = finite(body?.latitude ?? existing.latitude, -90, 90);
  const longitude = finite(body?.longitude ?? existing.longitude, -180, 180); const capacity = Number(body?.capacity ?? existing.capacity ?? 0);
  const dockCount = Number(body?.dockCount ?? existing.dock_count ?? capacity); const isActive = boolean(body?.isActive, Boolean(existing.is_active ?? true));
  const openingHours = body?.openingHours ?? jsonValue(existing.opening_hours_json, {});
  if (!name || !publicCode || !slug || address === null || !city || latitude === null || longitude === null || !Number.isInteger(capacity) || capacity < 0 || capacity > 100
    || !Number.isInteger(dockCount) || dockCount < 0 || dockCount > capacity || !openingHours || typeof openingHours !== 'object' || Array.isArray(openingHours) || JSON.stringify(openingHours).length > 4000) return null;
  return { name, publicCode, slug, address, city, latitude, longitude, capacity, dockCount, isActive, openingHours };
}

async function syncDocks(DB, stationId, publicCode, target) {
  const rows = (await DB.prepare('SELECT id, position, status, bike_id FROM docks WHERE station_id = ? ORDER BY position').bind(stationId).all()).results || [];
  const active = rows.filter((row) => row.status !== 'disabled');
  if (target > active.length) {
    const disabled = rows.filter((row) => row.status === 'disabled' && !row.bike_id).slice(0, target - active.length);
    for (const dock of disabled) await DB.prepare("UPDATE docks SET status = 'available', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(dock.id).run();
    let remaining = target - active.length - disabled.length; let position = rows.reduce((max, row) => Math.max(max, Number(row.position)), 0) + 1;
    while (remaining > 0) { await DB.prepare("INSERT INTO docks (station_id, position, public_code, status) VALUES (?, ?, ?, 'available')").bind(stationId, position, `${publicCode}-dock-${String(position).padStart(3,'0')}`).run(); position += 1; remaining -= 1; }
  } else if (target < active.length) {
    const removable = active.filter((row) => !row.bike_id).sort((a,b) => b.position - a.position).slice(0, active.length - target);
    if (removable.length !== active.length - target) throw Object.assign(new Error('occupied docks'), { code: 'DOCKS_OCCUPIED' });
    for (const dock of removable) await DB.prepare("UPDATE docks SET status = 'disabled', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(dock.id).run();
  }
}

async function stationCreate(request, DB, json, actor, context, readJson) {
  const input = stationInput(await readJson(request)); if (!input) return invalid(json);
  try {
    const result = await DB.prepare(`INSERT INTO stations
      (public_code, slug, name, city, address, latitude, longitude, capacity, bikes_available, is_active, opening_hours_json, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, CURRENT_TIMESTAMP)`)
      .bind(input.publicCode, input.slug, input.name, input.city, input.address || null, input.latitude, input.longitude, input.capacity, input.isActive ? 1 : 0, JSON.stringify(input.openingHours)).run();
    await syncDocks(DB, result.meta.last_row_id, input.publicCode, input.dockCount);
    await audit(DB, actor, context, 'station.create', 'station', result.meta.last_row_id, { publicCode: input.publicCode, dockCount: input.dockCount });
    return json({ success: true, id: result.meta.last_row_id }, 201);
  } catch (error) { if (String(error.message).includes('UNIQUE')) return conflict(json, 'Le code ou le slug de station existe deja.'); throw error; }
}

async function stationDetail(DB, json, id) {
  const station = await DB.prepare(`${STATION_SELECT} WHERE stations.id = ? GROUP BY stations.id`).bind(id).first(); if (!station) return missing(json, 'Station');
  const [bikes, docks] = await DB.batch([
    DB.prepare('SELECT id, public_code, status, model, battery_level FROM bikes WHERE station_id = ? ORDER BY public_code').bind(id),
    DB.prepare('SELECT id, position, public_code, status, bike_id FROM docks WHERE station_id = ? ORDER BY position').bind(id)
  ]);
  return json({ station: { ...station, openingHours: jsonValue(station.opening_hours_json, {}) }, bikes: bikes.results || [], docks: docks.results || [] });
}

async function stationUpdate(request, DB, json, actor, context, id, readJson) {
  const existing = await DB.prepare(`${STATION_SELECT} WHERE stations.id = ? GROUP BY stations.id`).bind(id).first(); if (!existing) return missing(json, 'Station');
  const input = stationInput(await readJson(request), existing); if (!input) return invalid(json);
  try {
    await DB.prepare(`UPDATE stations SET public_code=?, slug=?, name=?, city=?, address=?, latitude=?, longitude=?, capacity=?, is_active=?, opening_hours_json=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .bind(input.publicCode,input.slug,input.name,input.city,input.address||null,input.latitude,input.longitude,input.capacity,input.isActive?1:0,JSON.stringify(input.openingHours),id).run();
    await syncDocks(DB, id, input.publicCode, input.dockCount);
    await audit(DB, actor, context, 'station.update', 'station', id, { publicCode: input.publicCode, dockCount: input.dockCount, active: input.isActive });
    return json({ success: true });
  } catch (error) { if (error.code === 'DOCKS_OCCUPIED') return conflict(json, 'Des quais occupes empechent cette reduction.'); if (String(error.message).includes('UNIQUE')) return conflict(json, 'Le code ou le slug existe deja.'); throw error; }
}

async function stationDisable(DB, json, actor, context, id) {
  const station = await DB.prepare('SELECT id FROM stations WHERE id = ?').bind(id).first(); if (!station) return missing(json, 'Station');
  const [inUse, bikes] = await DB.batch([
    DB.prepare("SELECT COUNT(*) count FROM rides WHERE status = 'active' AND start_station_id = ?").bind(id),
    DB.prepare('SELECT COUNT(*) count FROM bikes WHERE station_id = ?').bind(id)
  ]);
  if (Number(inUse.results?.[0]?.count || 0) > 0) return conflict(json, 'Cette station est liee a un trajet actif.');
  if (Number(bikes.results?.[0]?.count || 0) > 0) return conflict(json, 'Deplacez les velos avant de desactiver cette station.');
  await DB.batch([
    DB.prepare('UPDATE stations SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(id),
    DB.prepare("UPDATE docks SET status = 'disabled', updated_at = CURRENT_TIMESTAMP WHERE station_id = ? AND bike_id IS NULL").bind(id)
  ]);
  await audit(DB, actor, context, 'station.disable', 'station', id);
  return json({ success: true });
}

const BIKE_SELECT = `SELECT bikes.id, bikes.code, bikes.public_code, bikes.station_id, stations.name station_name, bikes.status, bikes.battery_level,
  bikes.model, bikes.serial_number, bikes.maintenance_required, bikes.last_service_at, bikes.retired_at, bikes.created_at, bikes.updated_at,
  (SELECT MAX(started_at) FROM rides WHERE bike_id = bikes.id) last_ride_at,
  (SELECT COUNT(*) FROM maintenance_records WHERE bike_id = bikes.id AND status IN ('open','in_progress')) open_maintenance
  FROM bikes LEFT JOIN stations ON stations.id = bikes.station_id`;

async function bikesList(DB, json, url) {
  const search=query(url,'search');const status=query(url,'status',20);const stationId=integer(query(url,'stationId',20))||0;
  const where=`WHERE (?='' OR lower(bikes.public_code || ' ' || bikes.code || ' ' || COALESCE(bikes.serial_number,'')) LIKE '%' || lower(?) || '%') AND (?='' OR bikes.status=?) AND (?=0 OR bikes.station_id=?)`;
  const bindings=[search,search,status,status,stationId,stationId];
  return json(await paged(DB,`${BIKE_SELECT} ${where} ORDER BY bikes.id DESC`,`SELECT COUNT(*) count FROM bikes ${where}`,bindings,url));
}

function bikeInput(body, existing={}) {
  const publicCode=code(body?.publicCode??existing.public_code);const internalCode=text(body?.code??existing.code??String(publicCode||'').toUpperCase(),80,2);
  const stationId=body?.stationId===null?null:integer(body?.stationId??existing.station_id);const status=String(body?.status??existing.status??'available');
  const model=text(body?.model??existing.model??'',120);const serial=text(body?.serialNumber??existing.serial_number??'',120);const battery=body?.batteryLevel===null?null:finite(body?.batteryLevel??existing.battery_level??100,0,100);
  if(!publicCode||!internalCode||!BIKE_STATUSES.has(status)||model===null||serial===null||battery===null)return null;
  return{publicCode,internalCode,stationId,status,model,serial,battery};
}

async function freeDock(DB, stationId) {
  return DB.prepare("SELECT id FROM docks WHERE station_id = ? AND status = 'available' AND bike_id IS NULL ORDER BY position LIMIT 1").bind(stationId).first();
}

async function bikeCreate(request,DB,json,actor,context,readJson){const input=bikeInput(await readJson(request));if(!input)return invalid(json);
  if(['in_use','reserved'].includes(input.status))return invalid(json,'BIKE_STATUS_INVALID','Un velo ne peut pas etre cree avec un trajet ou une reservation active.');
  if(input.stationId&&!await DB.prepare('SELECT id FROM stations WHERE id=? AND is_active=1').bind(input.stationId).first())return invalid(json,'STATION_INVALID','Station inactive ou introuvable.');
  if(input.stationId&&!await freeDock(DB,input.stationId))return conflict(json,'Aucun quai libre dans cette station.');
  try{const statements=[DB.prepare("INSERT INTO bikes (code,public_code,station_id,status,battery_level,model,serial_number,updated_at) VALUES (?,?,NULL,?,?,?,?,CURRENT_TIMESTAMP)").bind(input.internalCode,input.publicCode,input.status,input.battery,input.model||null,input.serial||null)];
    if(input.stationId){statements.push(DB.prepare("UPDATE docks SET bike_id=(SELECT id FROM bikes WHERE public_code=?),status='occupied',updated_at=CURRENT_TIMESTAMP WHERE id=(SELECT id FROM docks WHERE station_id=? AND status='available' AND bike_id IS NULL ORDER BY position LIMIT 1)").bind(input.publicCode,input.stationId),DB.prepare('UPDATE bikes SET station_id=?,updated_at=CURRENT_TIMESTAMP WHERE public_code=?').bind(input.stationId,input.publicCode),DB.prepare("UPDATE stations SET bikes_available=(SELECT COUNT(*) FROM bikes WHERE station_id=? AND status='available'),updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(input.stationId,input.stationId));}
    const results=await DB.batch(statements);const id=results[0].meta.last_row_id;await audit(DB,actor,context,'bike.create','bike',id,{publicCode:input.publicCode,status:input.status,stationId:input.stationId});return json({success:true,id},201);
  }catch(error){const message=String(error.message);if(message.includes('bike station requires occupied dock'))return conflict(json,'Le quai vient d etre reserve. Reessayez.');if(message.includes('UNIQUE'))return conflict(json,'Le code ou le numero de serie existe deja.');throw error;}}

async function bikeDetail(DB,json,id){const bike=await DB.prepare(`${BIKE_SELECT} WHERE bikes.id=?`).bind(id).first();if(!bike)return missing(json,'Velo');
  const [rides,maintenance,incidents]=await DB.batch([DB.prepare('SELECT id,status,started_at,ended_at FROM rides WHERE bike_id=? ORDER BY id DESC LIMIT 10').bind(id),DB.prepare('SELECT * FROM maintenance_records WHERE bike_id=? ORDER BY id DESC LIMIT 20').bind(id),DB.prepare('SELECT id,category,severity,status,description,created_at FROM bike_incidents WHERE bike_id=? ORDER BY id DESC LIMIT 20').bind(id)]);
  return json({bike,rides:rides.results||[],maintenance:maintenance.results||[],incidents:incidents.results||[]});}

async function bikeUpdate(request,DB,json,actor,context,id,readJson){const existing=await DB.prepare('SELECT * FROM bikes WHERE id=?').bind(id).first();if(!existing)return missing(json,'Velo');const input=bikeInput(await readJson(request),existing);if(!input)return invalid(json);
  const moving=(input.stationId??null)!==(existing.station_id??null);if(existing.status==='in_use'&&(input.status!=='in_use'||moving))return conflict(json,'Un velo en trajet ne peut pas etre deplace ou desactive.');
  if(input.stationId&&!await DB.prepare('SELECT id FROM stations WHERE id=? AND is_active=1').bind(input.stationId).first())return invalid(json,'STATION_INVALID','Station inactive ou introuvable.');
  if(moving&&input.stationId&&!await freeDock(DB,input.stationId))return conflict(json,'Aucun quai libre dans cette station.');
  try{const statements=[];if(moving){statements.push(DB.prepare("UPDATE docks SET bike_id=NULL,status=CASE WHEN status='disabled' THEN status ELSE 'available' END,updated_at=CURRENT_TIMESTAMP WHERE bike_id=?").bind(id));if(input.stationId)statements.push(DB.prepare("UPDATE docks SET bike_id=?,status='occupied',updated_at=CURRENT_TIMESTAMP WHERE id=(SELECT id FROM docks WHERE station_id=? AND status='available' AND bike_id IS NULL ORDER BY position LIMIT 1)").bind(id,input.stationId));}
    statements.push(DB.prepare("UPDATE bikes SET code=?,public_code=?,station_id=?,status=?,battery_level=?,model=?,serial_number=?,retired_at=CASE WHEN ?='retired' THEN COALESCE(retired_at,CURRENT_TIMESTAMP) ELSE retired_at END,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(input.internalCode,input.publicCode,input.stationId,input.status,input.battery,input.model||null,input.serial||null,input.status,id));
    for(const stationId of new Set([existing.station_id,input.stationId].filter(Boolean)))statements.push(DB.prepare("UPDATE stations SET bikes_available=(SELECT COUNT(*) FROM bikes WHERE station_id=? AND status='available'),updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(stationId,stationId));
    await DB.batch(statements);await audit(DB,actor,context,'bike.update','bike',id,{status:input.status,stationId:input.stationId});return json({success:true});}
  catch(error){const message=String(error.message);if(message.includes('bike station requires occupied dock'))return conflict(json,'Le quai vient d etre reserve. Reessayez.');if(message.includes('UNIQUE'))return conflict(json,'Le code ou le numero de serie existe deja.');throw error;}}

async function bikeQr(DB,json,id){const bike=await DB.prepare('SELECT id,public_code,status FROM bikes WHERE id=?').bind(id).first();if(!bike)return missing(json,'Velo');return json({bikeId:bike.id,publicCode:bike.public_code,payload:`pikala://bike/${bike.public_code}`,printUrl:`/admin.html?view=bikes&qr=${encodeURIComponent(bike.public_code)}`});}

async function maintenanceStart(request,DB,json,actor,context,bikeId,readJson){const body=await readJson(request);const reason=text(body?.reason,500,5);const incidentId=body?.incidentId?integer(body.incidentId):null;const assignee=body?.assignedToUserId?integer(body.assignedToUserId):null;if(!reason)return invalid(json);
  const bike=await DB.prepare('SELECT id,status FROM bikes WHERE id=?').bind(bikeId).first();if(!bike)return missing(json,'Velo');if(bike.status==='in_use')return conflict(json,'Le velo est actuellement utilise.');
  const existing=await DB.prepare("SELECT id FROM maintenance_records WHERE bike_id=? AND status IN ('open','in_progress')").bind(bikeId).first();if(existing)return conflict(json,'Une maintenance est deja ouverte pour ce velo.');
  const result=await DB.batch([DB.prepare(`INSERT INTO maintenance_records (bike_id,incident_id,opened_by_user_id,assigned_to_user_id,status,reason,started_at,workflow_stage) VALUES (?,?,?,?, 'in_progress',?,CURRENT_TIMESTAMP,'maintenance')`).bind(bikeId,incidentId,actor.id,assignee,reason),DB.prepare("UPDATE bikes SET status='maintenance',maintenance_required=1,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(bikeId),DB.prepare("UPDATE bike_incidents SET status='in_progress',assigned_to_user_id=COALESCE(?,assigned_to_user_id),updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(assignee,incidentId||0)]);
  const recordId=result[0].meta.last_row_id;await DB.prepare("INSERT INTO workflow_events (resource_type,resource_id,actor_user_id,to_status,note) VALUES ('maintenance',?,?, 'maintenance',?)").bind(recordId,actor.id,reason).run();await audit(DB,actor,context,'maintenance.open','maintenance',recordId,{bikeId,incidentId});return json({success:true,id:recordId},201);}

async function maintenanceUpdate(request,DB,json,actor,context,id,readJson){const body=await readJson(request);const status=String(body?.status||'');const notes=text(body?.resolutionNotes??'',1000);const assignee=body?.assignedToUserId?integer(body.assignedToUserId):null;if(!MAINTENANCE_STATUSES.has(status)||notes===null)return invalid(json);
  const record=await DB.prepare('SELECT * FROM maintenance_records WHERE id=?').bind(id).first();if(!record)return missing(json,'Maintenance');if(['resolved','cancelled'].includes(record.status))return conflict(json,'Cette maintenance est deja terminee.');
  const restore=boolean(body?.returnToService,status==='resolved');await DB.batch([DB.prepare(`UPDATE maintenance_records SET status=?,assigned_to_user_id=COALESCE(?,assigned_to_user_id),resolution_notes=?,resolved_by_user_id=CASE WHEN ? IN ('resolved','cancelled') THEN ? ELSE resolved_by_user_id END,resolved_at=CASE WHEN ? IN ('resolved','cancelled') THEN CURRENT_TIMESTAMP ELSE resolved_at END,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(status,assignee,notes||null,status,actor.id,status,id),DB.prepare("UPDATE bikes SET status=CASE WHEN ?=1 THEN 'available' ELSE status END,last_service_at=CASE WHEN ?='resolved' THEN CURRENT_TIMESTAMP ELSE last_service_at END,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(restore?1:0,status,record.bike_id),DB.prepare("UPDATE bike_incidents SET status=CASE WHEN ?='resolved' THEN 'resolved' ELSE status END,resolution_notes=CASE WHEN ?='resolved' THEN ? ELSE resolution_notes END,resolved_at=CASE WHEN ?='resolved' THEN CURRENT_TIMESTAMP ELSE resolved_at END,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(status,status,notes||null,status,record.incident_id||0)]);
  await audit(DB,actor,context,'maintenance.update','maintenance',id,{status,restore,bikeId:record.bike_id});return json({success:true});}

async function ridesList(DB,json,url){const search=query(url,'search');const status=query(url,'status',20);const longOnly=query(url,'long',5)==='1';const threshold=Math.max(30,Math.min(1440,Number(query(url,'threshold',8))||180));
  const where=`WHERE (?='' OR lower(users.email || ' ' || users.first_name || ' ' || users.last_name || ' ' || COALESCE(bikes.public_code,'')) LIKE '%' || lower(?) || '%') AND (?='' OR rides.status=?) AND (?=0 OR (rides.status='active' AND rides.started_at < datetime('now','-' || ? || ' minutes')))`;const bindings=[search,search,status,status,longOnly?1:0,threshold];
  return json(await paged(DB,`SELECT rides.id,rides.status,rides.started_at,rides.ended_at,rides.duration_seconds,rides.charged_amount_minor,users.id user_id,users.email,users.first_name,bikes.public_code bike_code,start_station.name start_station,end_station.name end_station,CASE WHEN rides.status='active' AND rides.started_at < datetime('now','-${threshold} minutes') THEN 1 ELSE 0 END is_long FROM rides JOIN users ON users.id=rides.user_id LEFT JOIN bikes ON bikes.id=rides.bike_id LEFT JOIN stations start_station ON start_station.id=rides.start_station_id LEFT JOIN stations end_station ON end_station.id=rides.end_station_id ${where} ORDER BY rides.id DESC`,`SELECT COUNT(*) count FROM rides JOIN users ON users.id=rides.user_id LEFT JOIN bikes ON bikes.id=rides.bike_id ${where}`,bindings,url));}

async function rideAdminDetail(DB,json,id){const ride=await DB.prepare(`SELECT rides.*,users.first_name,users.last_name,users.email,bikes.public_code bike_code,start_station.name start_station,end_station.name end_station FROM rides JOIN users ON users.id=rides.user_id LEFT JOIN bikes ON bikes.id=rides.bike_id LEFT JOIN stations start_station ON start_station.id=rides.start_station_id LEFT JOIN stations end_station ON end_station.id=rides.end_station_id WHERE rides.id=?`).bind(id).first();return ride?json({ride}):missing(json,'Trajet');}

async function simpleList(DB,json,url,type){const configs={
  subscriptions:{select:`SELECT subscriptions.id,subscriptions.status,subscriptions.current_period_start,subscriptions.current_period_end,subscriptions.cancel_at_period_end,users.id user_id,users.email,users.first_name,users.last_name,plans.name plan_name FROM subscriptions JOIN users ON users.id=subscriptions.user_id LEFT JOIN plans ON plans.id=subscriptions.plan_id`,search:`lower(users.email || ' ' || users.first_name || ' ' || users.last_name || ' ' || COALESCE(plans.name,''))`,order:'subscriptions.id'},
  payments:{select:`SELECT payments.id,payments.public_reference,payments.lifecycle_status status,payments.amount_minor,payments.currency,payments.provider,payments.created_at,payments.paid_at,payments.refunded_at,users.id user_id,users.email,plans.name plan_name FROM payments JOIN users ON users.id=payments.user_id LEFT JOIN plans ON plans.id=payments.plan_id`,search:`lower(users.email || ' ' || COALESCE(payments.public_reference,'') || ' ' || COALESCE(plans.name,''))`,order:'payments.id'},
  incidents:{select:`SELECT bike_incidents.id,bike_incidents.public_code,bike_incidents.incident_type,bike_incidents.category,bike_incidents.severity,bike_incidents.status,bike_incidents.description,bike_incidents.created_at,bikes.public_code bike_code,users.email reporter_email,assignee.email assignee_email FROM bike_incidents JOIN bikes ON bikes.id=bike_incidents.bike_id LEFT JOIN users ON users.id=bike_incidents.reported_by_user_id LEFT JOIN users assignee ON assignee.id=bike_incidents.assigned_to_user_id`,search:`lower(COALESCE(bikes.public_code,'') || ' ' || COALESCE(users.email,'') || ' ' || bike_incidents.description)`,order:'bike_incidents.id'},
  maintenance:{select:`SELECT maintenance_records.id,maintenance_records.workflow_stage,maintenance_records.status legacy_status,maintenance_records.reason,maintenance_records.opened_at,maintenance_records.updated_at,maintenance_records.resolved_at,bikes.public_code bike_code,assignee.email assignee_email FROM maintenance_records JOIN bikes ON bikes.id=maintenance_records.bike_id LEFT JOIN users assignee ON assignee.id=maintenance_records.assigned_to_user_id`,search:`lower(bikes.public_code || ' ' || maintenance_records.reason || ' ' || COALESCE(assignee.email,''))`,order:'maintenance_records.id'},
  support:{select:`SELECT support_tickets.id,support_tickets.public_code,support_tickets.subject,support_tickets.topic,support_tickets.category,support_tickets.priority,support_tickets.status,support_tickets.created_at,support_tickets.updated_at,users.email,assignee.email assignee_email FROM support_tickets LEFT JOIN users ON users.id=support_tickets.user_id LEFT JOIN users assignee ON assignee.id=support_tickets.assigned_to_user_id`,search:`lower(COALESCE(users.email,support_tickets.email,'') || ' ' || support_tickets.subject || ' ' || support_tickets.message)`,order:'support_tickets.id'},
  notifications:{select:`SELECT notifications.id,notifications.type,notifications.title,notifications.body,notifications.channel,notifications.status,notifications.created_at,users.email FROM notifications JOIN users ON users.id=notifications.user_id`,search:`lower(users.email || ' ' || notifications.title || ' ' || notifications.body)`,order:'notifications.id'}
  };const config=configs[type];const search=query(url,'search');const status=query(url,'status',30);const statusColumn=type==='payments'?'payments.lifecycle_status':`${type==='maintenance'?'maintenance_records':type==='support'?'support_tickets':type==='notifications'?'notifications':type==='incidents'?'bike_incidents':'subscriptions'}.status`;const where=`WHERE (?='' OR ${config.search} LIKE '%' || lower(?) || '%') AND (?='' OR ${statusColumn}=?)`;const bindings=[search,search,status,status];return json(await paged(DB,`${config.select} ${where} ORDER BY ${config.order} DESC`,`SELECT COUNT(*) count FROM (${config.select} ${where})`,bindings,url));}

async function incidentUpdate(request,DB,json,actor,context,id,readJson){const body=await readJson(request);const status=String(body?.status||'');const assignee=body?.assignedToUserId?integer(body.assignedToUserId):null;const notes=text(body?.resolutionNotes??'',1000);if(!INCIDENT_STATUSES.has(status)||notes===null)return invalid(json);const result=await DB.prepare(`UPDATE bike_incidents SET status=?,assigned_to_user_id=?,resolution_notes=?,resolved_at=CASE WHEN ? IN ('resolved','closed') THEN CURRENT_TIMESTAMP ELSE NULL END,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(status,assignee,notes||null,status,id).run();if(!result.meta.changes)return missing(json,'Incident');await audit(DB,actor,context,'incident.update','incident',id,{status,assignee});return json({success:true});}

async function supportUpdate(request,DB,json,actor,context,id,readJson){const body=await readJson(request);const status=String(body?.status||'');const priority=String(body?.priority||'normal');const assignee=body?.assignedToUserId?integer(body.assignedToUserId):null;const notes=text(body?.resolutionNotes??'',2000);if(!SUPPORT_STATUSES.has(status)||!PRIORITIES.has(priority)||notes===null)return invalid(json);const result=await DB.prepare(`UPDATE support_tickets SET status=?,priority=?,assigned_to_user_id=?,resolution_notes=?,closed_at=CASE WHEN ? IN ('resolved','closed') THEN CURRENT_TIMESTAMP ELSE NULL END,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(status,priority,assignee,notes||null,status,id).run();if(!result.meta.changes)return missing(json,'Ticket');await audit(DB,actor,context,'support.update','support_ticket',id,{status,priority,assignee});return json({success:true});}

async function notificationsCreate(request,DB,json,actor,context,readJson){const body=await readJson(request);const title=text(body?.title,120,2);const message=text(body?.body,1000,2);const type=code(body?.type||'service',40);const locale=String(body?.locale||'all');const target=String(body?.target||'active');const ids=Array.isArray(body?.userIds)?[...new Set(body.userIds.map(integer).filter(Boolean))].slice(0,100):[];if(!title||!message||!type||!NOTIFICATION_TYPES.has(type)||!['all','fr','en','es','pt','ar'].includes(locale)||!['active','all','users'].includes(target)||(target==='users'&&!ids.length))return invalid(json);
  let statement;if(target==='users'){const placeholders=ids.map(()=>'?').join(',');statement=DB.prepare(`INSERT INTO notifications (user_id,type,title,body,channel,status,sent_at) SELECT id,?,?,?,'in_app','sent',CURRENT_TIMESTAMP FROM users WHERE id IN (${placeholders}) AND status='active'`).bind(type,title,message,...ids);}else{statement=DB.prepare(`INSERT INTO notifications (user_id,type,title,body,channel,status,sent_at) SELECT id,?,?,?,'in_app','sent',CURRENT_TIMESTAMP FROM users WHERE (?='all' OR status='active') AND (?='all' OR locale=?)`).bind(type,title,message,target,locale,locale);}const result=await statement.run();await audit(DB,actor,context,'notification.broadcast','notification',null,{target,locale,count:result.meta.changes});return json({success:true,count:result.meta.changes},201);}

async function settingsGet(DB,json){const rows=(await DB.prepare('SELECT key,value_json,description,updated_at FROM app_settings ORDER BY key').all()).results||[];return json({settings:rows.map((row)=>({...row,value:jsonValue(row.value_json,null)}))});}
function validSetting(key,value){if(!SETTINGS.has(key)||!value||typeof value!=='object'||Array.isArray(value)||JSON.stringify(value).length>2000)return false;if(key==='ride_monitoring')return Number.isInteger(Number(value.longRideMinutes))&&Number(value.longRideMinutes)>=30&&Number(value.longRideMinutes)<=1440;if(key==='service_status')return ['operational','degraded','paused'].includes(value.mode)&&String(value.message||'').length<=300;if(key==='support_contact')return String(value.email||'').length<=254&&String(value.phone||'').length<=30;return false;}
async function settingsUpdate(request,DB,json,actor,context,readJson){const body=await readJson(request);const key=String(body?.key||'');const value=body?.value;if(!validSetting(key,value))return invalid(json);await DB.prepare('UPDATE app_settings SET value_json=?,updated_by_user_id=?,updated_at=CURRENT_TIMESTAMP WHERE key=?').bind(JSON.stringify(value),actor.id,key).run();await audit(DB,actor,context,'setting.update','setting',key,{key});return json({success:true});}

async function auditList(DB,json,url){const search=query(url,'search');const action=query(url,'action',80);const where=`WHERE (?='' OR lower(admin_audit_logs.action || ' ' || admin_audit_logs.target_type || ' ' || COALESCE(admin_audit_logs.target_id,'') || ' ' || COALESCE(users.email,'')) LIKE '%' || lower(?) || '%') AND (?='' OR admin_audit_logs.action=?)`;const bindings=[search,search,action,action];return json(await paged(DB,`SELECT admin_audit_logs.id,admin_audit_logs.action,admin_audit_logs.target_type,admin_audit_logs.target_id,admin_audit_logs.metadata_json,admin_audit_logs.created_at,users.email admin_email FROM admin_audit_logs LEFT JOIN users ON users.id=admin_audit_logs.actor_user_id ${where} ORDER BY admin_audit_logs.id DESC`,`SELECT COUNT(*) count FROM admin_audit_logs LEFT JOIN users ON users.id=admin_audit_logs.actor_user_id ${where}`,bindings,url));}

export async function handleAdminApi(request, env, actor, utilities) {
  const { json, readJson, requestId, ipHint } = utilities; const DB = env.DB; const url = new URL(request.url); const path = url.pathname; const method = request.method; const context = { requestId, ipHint };
  if (!DB) return json({ code:'DB_UNAVAILABLE', error:'Service temporairement indisponible.' },503);
  try {
    const operationsResponse=await handleAdminOperationsApi(request,DB,actor,{json,readJson,requestId,ipHint});if(operationsResponse)return operationsResponse;
    if(method==='GET'&&path==='/api/admin/overview')return overview(DB,json);
    if(method==='GET'&&path==='/api/admin/users')return usersList(DB,json,url);
    let match=path.match(/^\/api\/admin\/users\/([1-9][0-9]*)$/);if(match&&method==='GET')return userDetail(DB,json,Number(match[1]));if(match&&method==='PATCH')return userUpdate(request,DB,json,actor,context,Number(match[1]),readJson);
    if(path==='/api/admin/stations'&&method==='GET')return stationsList(DB,json,url);if(path==='/api/admin/stations'&&method==='POST')return stationCreate(request,DB,json,actor,context,readJson);
    match=path.match(/^\/api\/admin\/stations\/([1-9][0-9]*)$/);if(match&&method==='GET')return stationDetail(DB,json,Number(match[1]));if(match&&method==='PATCH')return stationUpdate(request,DB,json,actor,context,Number(match[1]),readJson);if(match&&method==='DELETE')return stationDisable(DB,json,actor,context,Number(match[1]));
    if(path==='/api/admin/bikes'&&method==='GET')return bikesList(DB,json,url);if(path==='/api/admin/bikes'&&method==='POST')return bikeCreate(request,DB,json,actor,context,readJson);
    match=path.match(/^\/api\/admin\/bikes\/([1-9][0-9]*)$/);if(match&&method==='GET')return bikeDetail(DB,json,Number(match[1]));if(match&&method==='PATCH')return bikeUpdate(request,DB,json,actor,context,Number(match[1]),readJson);
    match=path.match(/^\/api\/admin\/bikes\/([1-9][0-9]*)\/qr$/);if(match&&method==='GET')return bikeQr(DB,json,Number(match[1]));
    match=path.match(/^\/api\/admin\/bikes\/([1-9][0-9]*)\/maintenance$/);if(match&&method==='POST')return maintenanceStart(request,DB,json,actor,context,Number(match[1]),readJson);
    if(path==='/api/admin/rides'&&method==='GET')return ridesList(DB,json,url);match=path.match(/^\/api\/admin\/rides\/([1-9][0-9]*)$/);if(match&&method==='GET')return rideAdminDetail(DB,json,Number(match[1]));
    for(const type of ['subscriptions','payments','incidents','maintenance','support','notifications'])if(path===`/api/admin/${type}`&&method==='GET')return simpleList(DB,json,url,type);
    match=path.match(/^\/api\/admin\/incidents\/([1-9][0-9]*)$/);if(match&&method==='PATCH')return incidentUpdate(request,DB,json,actor,context,Number(match[1]),readJson);
    match=path.match(/^\/api\/admin\/maintenance\/([1-9][0-9]*)$/);if(match&&method==='PATCH')return maintenanceUpdate(request,DB,json,actor,context,Number(match[1]),readJson);
    match=path.match(/^\/api\/admin\/support\/([1-9][0-9]*)$/);if(match&&method==='PATCH')return supportUpdate(request,DB,json,actor,context,Number(match[1]),readJson);
    if(path==='/api/admin/notifications'&&method==='POST')return notificationsCreate(request,DB,json,actor,context,readJson);
    if(path==='/api/admin/settings'&&method==='GET')return settingsGet(DB,json);if(path==='/api/admin/settings'&&method==='PATCH')return settingsUpdate(request,DB,json,actor,context,readJson);
    if(path==='/api/admin/audit-logs'&&method==='GET')return auditList(DB,json,url);
    return json({code:'ADMIN_ROUTE_NOT_FOUND',error:'Route administration introuvable.'},404);
  } catch(error) {
    if(String(error?.message||'').includes('UNIQUE constraint'))return conflict(json,'Cette valeur existe deja.');
    if(String(error?.message||'').includes('CHECK constraint'))return invalid(json);
    throw error;
  }
}
