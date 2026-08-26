import { CONTROL_ACTION_PERMISSIONS, hasPermission } from '../auth/rbac.js';
const TERMINAL_MISSION_STATUSES = new Set(['completed', 'cancelled', 'failed']);
const ACTIONS = new Set([
  'station.open', 'station.close', 'bike.block', 'bike.restore', 'bike.maintenance', 'bike.move',
  'dock.correct', 'user.suspend', 'user.reactivate', 'ride.force_end', 'maintenance.assign',
  'employee.upsert', 'inspection.create', 'mission.create', 'mission.assign', 'notification.send',
  'service.maintenance', 'service.restore', 'alert.acknowledge', 'alert.resolve', 'automation.toggle',
  'device.status', 'entitlement.grant', 'entitlement.revoke'
]);

function integer(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function text(value, min, max) {
  const result = String(value ?? '').trim();
  return result.length >= min && result.length <= max ? result : null;
}

function safeObject(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).slice(0, 16).flatMap(([key, item]) => {
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(key)) return [];
    if (typeof item === 'string') return [[key, item.slice(0, 240)]];
    if (typeof item === 'number' || typeof item === 'boolean' || item === null) return [[key, item]];
    return [];
  }));
}

function error(json, code, message, status = 400) {
  return json({ code, error: message }, status);
}

function pagination(url) {
  const page = Math.max(1, Math.min(100000, Number.parseInt(url.searchParams.get('page') || '1', 10) || 1));
  const limit = Math.max(10, Math.min(100, Number.parseInt(url.searchParams.get('limit') || '25', 10) || 25));
  return { page, limit, offset: (page - 1) * limit };
}

async function paged(DB, select, count, bindings, url) {
  const { page, limit, offset } = pagination(url);
  const [rows, total] = await DB.batch([
    DB.prepare(`${select} LIMIT ? OFFSET ?`).bind(...bindings, limit, offset),
    DB.prepare(count).bind(...bindings)
  ]);
  const countValue = Number(total.results?.[0]?.count || 0);
  return { items: rows.results || [], pagination: { page, limit, total: countValue, pages: Math.max(1, Math.ceil(countValue / limit)) } };
}

function settings(rows) {
  const raw = rows.find((row) => row.key === 'control_center')?.value_json;
  try {
    return { stationLowBikes: 2, stationFullDocks: 0, deviceOfflineMinutes: 15, maintenanceOverdueHours: 72, missionOverdueMinutes: 30, ...JSON.parse(raw || '{}') };
  } catch {
    return { stationLowBikes: 2, stationFullDocks: 0, deviceOfflineMinutes: 15, maintenanceOverdueHours: 72, missionOverdueMinutes: 30 };
  }
}

async function controlOverview(DB, json, env) {
  const [configResult, serviceResult] = await DB.batch([
    DB.prepare("SELECT key,value_json FROM app_settings WHERE key='control_center'"),
    DB.prepare("SELECT value_json FROM app_settings WHERE key='service_status'")
  ]);
  const thresholds = settings(configResult.results || []);
  let service = { mode: 'operational', message: '' };
  try { service = { ...service, ...JSON.parse(serviceResult.results?.[0]?.value_json || '{}') }; } catch { /* surfaced as degraded below */ }

  const results = await DB.batch([
    DB.prepare("SELECT COUNT(*) count FROM users WHERE status='active'"),
    DB.prepare('SELECT COUNT(*) count FROM bikes'),
    DB.prepare("SELECT status,COUNT(*) count FROM bikes GROUP BY status"),
    DB.prepare(`WITH availability AS (
      SELECT stations.id,stations.is_active,
        (SELECT COUNT(*) FROM bikes WHERE bikes.station_id=stations.id AND bikes.status='available') bikes_available,
        (SELECT COUNT(*) FROM docks WHERE docks.station_id=stations.id AND docks.status='available') docks_available
      FROM stations)
      SELECT
        SUM(CASE WHEN is_active=1 AND bikes_available>? AND docks_available>? THEN 1 ELSE 0 END) normal,
        SUM(CASE WHEN is_active=1 AND bikes_available<=? THEN 1 ELSE 0 END) weak,
        SUM(CASE WHEN is_active=1 AND docks_available<=? THEN 1 ELSE 0 END) almost_full,
        SUM(CASE WHEN is_active=0 THEN 1 ELSE 0 END) closed
      FROM availability`).bind(thresholds.stationLowBikes, thresholds.stationFullDocks, thresholds.stationLowBikes, thresholds.stationFullDocks),
    DB.prepare("SELECT COUNT(*) count FROM rides WHERE status='active'"),
    DB.prepare("SELECT COUNT(*) count FROM bike_incidents WHERE status IN ('open','triaged','in_progress')"),
    DB.prepare("SELECT COUNT(*) count FROM maintenance_records WHERE status IN ('open','in_progress') AND opened_at<datetime('now','-'||?||' hours')").bind(thresholds.maintenanceOverdueHours),
    DB.prepare("SELECT COUNT(*) count FROM support_tickets WHERE priority='urgent' AND status NOT IN ('resolved','closed')"),
    DB.prepare("SELECT COUNT(*) count FROM missions WHERE status NOT IN ('completed','cancelled','failed') AND due_at IS NOT NULL AND due_at<datetime('now','-'||?||' minutes')").bind(thresholds.missionOverdueMinutes),
    DB.prepare("SELECT COUNT(*) count FROM network_alerts WHERE status IN ('open','acknowledged')"),
    DB.prepare("SELECT COUNT(*) count FROM devices WHERE status='offline' OR (status='online' AND last_seen_at<datetime('now','-'||?||' minutes'))").bind(thresholds.deviceOfflineMinutes),
    DB.prepare("SELECT COUNT(*) count FROM staff_members WHERE status='active'"),
    DB.prepare("SELECT COUNT(*) count FROM inspections WHERE status IN ('scheduled','in_progress') AND due_at<CURRENT_TIMESTAMP"),
    DB.prepare("SELECT COUNT(*) count FROM rebalancing_recommendations WHERE status='open'"),
    DB.prepare("SELECT COUNT(*) count FROM automation_rules WHERE enabled=1")
  ]);
  const bikes = Object.fromEntries((results[2].results || []).map((row) => [row.status, Number(row.count)]));
  const stations = results[3].results?.[0] || {};
  const metrics = {
    activeUsers: Number(results[0].results?.[0]?.count || 0),
    bikes: {
      total: Number(results[1].results?.[0]?.count || 0), available: bikes.available || 0,
      inUse: bikes.in_use || 0, maintenance: bikes.maintenance || 0,
      unavailable: (bikes.disabled || 0) + (bikes.lost || 0) + (bikes.retired || 0)
    },
    stations: { normal: Number(stations.normal || 0), weak: Number(stations.weak || 0), full: Number(stations.almost_full || 0), closed: Number(stations.closed || 0) },
    activeRides: Number(results[4].results?.[0]?.count || 0), openIncidents: Number(results[5].results?.[0]?.count || 0),
    overdueMaintenance: Number(results[6].results?.[0]?.count || 0), criticalTickets: Number(results[7].results?.[0]?.count || 0),
    overdueMissions: Number(results[8].results?.[0]?.count || 0), persistentAlerts: Number(results[9].results?.[0]?.count || 0),
    offlineDevices: Number(results[10].results?.[0]?.count || 0), activeEmployees: Number(results[11].results?.[0]?.count || 0),
    overdueInspections: Number(results[12].results?.[0]?.count || 0), openRebalancing: Number(results[13].results?.[0]?.count || 0),
    enabledAutomations: Number(results[14].results?.[0]?.count || 0)
  };

  const attentionResults = await DB.batch([
    DB.prepare(`SELECT 'station_weak' type,'warning' severity,stations.id resource_id,stations.name title,
      printf('%d vélo(s) disponible(s)',(SELECT COUNT(*) FROM bikes WHERE bikes.station_id=stations.id AND bikes.status='available')) message
      FROM stations WHERE is_active=1 AND (SELECT COUNT(*) FROM bikes WHERE bikes.station_id=stations.id AND bikes.status='available')<=? ORDER BY stations.name LIMIT 20`).bind(thresholds.stationLowBikes),
    DB.prepare(`SELECT 'station_full' type,'warning' severity,stations.id resource_id,stations.name title,'Aucun quai disponible' message
      FROM stations WHERE is_active=1 AND (SELECT COUNT(*) FROM docks WHERE docks.station_id=stations.id AND docks.status='available')<=? ORDER BY stations.name LIMIT 20`).bind(thresholds.stationFullDocks),
    DB.prepare(`SELECT 'long_ride' type,'critical' severity,rides.id resource_id,'Trajet actif anormalement long' title,
      users.email||' · depuis '||rides.started_at message FROM rides JOIN users ON users.id=rides.user_id
      WHERE rides.status='active' AND rides.started_at<datetime('now','-180 minutes') ORDER BY rides.started_at LIMIT 20`),
    DB.prepare(`SELECT 'maintenance_overdue' type,'warning' severity,maintenance_records.id resource_id,'Maintenance en retard' title,
      COALESCE(bikes.public_code,'Vélo')||' · '||maintenance_records.reason message FROM maintenance_records
      LEFT JOIN bikes ON bikes.id=maintenance_records.bike_id WHERE maintenance_records.status IN ('open','in_progress')
      AND maintenance_records.opened_at<datetime('now','-'||?||' hours') ORDER BY maintenance_records.opened_at LIMIT 20`).bind(thresholds.maintenanceOverdueHours),
    DB.prepare(`SELECT 'ticket_critical' type,'critical' severity,support_tickets.id resource_id,'Ticket critique' title,
      support_tickets.subject message FROM support_tickets WHERE priority='urgent' AND status NOT IN ('resolved','closed') ORDER BY created_at LIMIT 20`),
    DB.prepare(`SELECT 'mission_overdue' type,'critical' severity,missions.id resource_id,'Mission en retard' title,
      missions.public_code||' · '||missions.title message FROM missions WHERE status NOT IN ('completed','cancelled','failed')
      AND due_at IS NOT NULL AND due_at<datetime('now','-'||?||' minutes') ORDER BY due_at LIMIT 20`).bind(thresholds.missionOverdueMinutes),
    DB.prepare(`SELECT 'device_offline' type,'critical' severity,devices.id resource_id,'Device hors ligne' title,
      devices.public_code||' · dernière communication '||COALESCE(devices.last_seen_at,'jamais') message FROM devices
      WHERE status='offline' OR (status='online' AND last_seen_at<datetime('now','-'||?||' minutes')) ORDER BY last_seen_at LIMIT 20`).bind(thresholds.deviceOfflineMinutes),
    DB.prepare(`SELECT alert_type type,severity,id resource_id,title,message FROM network_alerts
      WHERE status IN ('open','acknowledged') ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,detected_at LIMIT 30`)
  ]);
  const attention = attentionResults.flatMap((result) => result.results || []).sort((a, b) => (a.severity === 'critical' ? -1 : 1) - (b.severity === 'critical' ? -1 : 1)).slice(0, 60);
  const configuration = {
    database: 'operational', email: env?.RESEND_API_KEY && env?.FROM_EMAIL ? 'operational' : 'missing', payment: env?.PAYMENT_PROVIDER ? 'operational' : 'missing', devices: metrics.offlineDevices ? 'degraded' : (env?.DEVICE_PROVIDER ? 'operational' : 'unconfigured')
  };
  const computedMode = service.mode !== 'operational' || attention.some((item) => item.severity === 'critical') ? 'degraded' : 'operational';
  return json({ service: { ...service, computedMode }, metrics, attention, thresholds, configuration, generatedAt: new Date().toISOString() });
}

const LISTS = {
  employees: {
    select: `SELECT staff_members.id,staff_members.employee_code,staff_members.role,staff_members.status,staff_members.hire_date,staff_members.last_activity_at,staff_members.updated_at,users.id user_id,users.first_name,users.last_name,users.email,COALESCE((SELECT group_concat(staff_zones.name,', ') FROM staff_member_zones JOIN staff_zones ON staff_zones.id=staff_member_zones.zone_id WHERE staff_member_zones.staff_member_id=staff_members.id),'') zones FROM staff_members JOIN users ON users.id=staff_members.user_id`,
    search: "lower(staff_members.employee_code||' '||users.email||' '||users.first_name||' '||users.last_name)", status: 'staff_members.status', order: 'staff_members.id'
  },
  docks: {
    select: `SELECT docks.id,docks.public_code,docks.position,docks.status,docks.updated_at,stations.id station_id,stations.name station_name,bikes.public_code bike_code FROM docks JOIN stations ON stations.id=docks.station_id LEFT JOIN bikes ON bikes.id=docks.bike_id`,
    search: "lower(docks.public_code||' '||stations.name||' '||COALESCE(bikes.public_code,''))", status: 'docks.status', order: 'docks.id'
  },
  inspections: {
    select: `SELECT inspections.id,inspections.public_code,inspections.inspection_type,inspections.status,inspections.outcome,inspections.due_at,inspections.completed_at,users.email inspector_email,bikes.public_code bike_code,stations.name station_name,docks.public_code dock_code FROM inspections LEFT JOIN users ON users.id=inspections.inspector_user_id LEFT JOIN bikes ON bikes.id=inspections.bike_id LEFT JOIN stations ON stations.id=inspections.station_id LEFT JOIN docks ON docks.id=inspections.dock_id`,
    search: "lower(inspections.public_code||' '||COALESCE(users.email,'')||' '||COALESCE(bikes.public_code,'')||' '||COALESCE(stations.name,''))", status: 'inspections.status', order: 'inspections.id'
  },
  missions: {
    select: `SELECT missions.id,missions.public_code,missions.mission_type,missions.title,missions.priority,missions.status,missions.due_at,missions.updated_at,users.email assignee_email,source.name source_station,destination.name destination_station FROM missions LEFT JOIN users ON users.id=missions.assigned_to_user_id LEFT JOIN stations source ON source.id=missions.source_station_id LEFT JOIN stations destination ON destination.id=missions.destination_station_id`,
    search: "lower(missions.public_code||' '||missions.title||' '||COALESCE(users.email,''))", status: 'missions.status', order: 'missions.id'
  },
  rebalancing: {
    select: `SELECT rebalancing_recommendations.id,rebalancing_recommendations.source_station_id,rebalancing_recommendations.destination_station_id,rebalancing_recommendations.suggested_bikes,rebalancing_recommendations.priority,rebalancing_recommendations.status,rebalancing_recommendations.reason,rebalancing_recommendations.expires_at,source.name source_station,destination.name destination_station,missions.public_code mission_code FROM rebalancing_recommendations JOIN stations source ON source.id=rebalancing_recommendations.source_station_id JOIN stations destination ON destination.id=rebalancing_recommendations.destination_station_id LEFT JOIN missions ON missions.id=rebalancing_recommendations.mission_id`,
    search: "lower(source.name||' '||destination.name||' '||rebalancing_recommendations.reason)", status: 'rebalancing_recommendations.status', order: 'rebalancing_recommendations.id'
  },
  automations: {
    select: 'SELECT id,public_code,name,rule_type,enabled,status,severity,last_run_at,updated_at FROM (SELECT automation_rules.*,CASE WHEN enabled=1 THEN \'active\' ELSE \'disabled\' END status FROM automation_rules)',
    search: "lower(public_code||' '||name||' '||rule_type)", status: 'status', order: 'id'
  },
  devices: {
    select: `SELECT devices.id,devices.public_code,devices.device_type,devices.status,devices.firmware_version,devices.last_seen_at,devices.updated_at,bikes.public_code bike_code,docks.public_code dock_code,stations.name station_name FROM devices LEFT JOIN bikes ON bikes.id=devices.bike_id LEFT JOIN docks ON docks.id=devices.dock_id LEFT JOIN stations ON stations.id=devices.station_id`,
    search: "lower(devices.public_code||' '||COALESCE(bikes.public_code,'')||' '||COALESCE(docks.public_code,'')||' '||COALESCE(stations.name,''))", status: 'devices.status', order: 'devices.id'
  },
  alerts: {
    select: 'SELECT id,alert_type,severity,status,title,message,resource_type,resource_id,detected_at,acknowledged_at,resolved_at FROM network_alerts',
    search: "lower(alert_type||' '||title||' '||message)", status: 'status', order: 'id'
  },
  overrides: {
    select: `SELECT admin_overrides.id,admin_overrides.action,admin_overrides.target_type,admin_overrides.target_id,admin_overrides.reason,admin_overrides.outcome,admin_overrides.request_id,admin_overrides.created_at,users.email actor_email FROM admin_overrides JOIN users ON users.id=admin_overrides.actor_user_id`,
    search: "lower(admin_overrides.action||' '||admin_overrides.target_type||' '||admin_overrides.target_id||' '||users.email)", status: 'admin_overrides.outcome', order: 'admin_overrides.id'
  },
  entitlements: {
    select: `SELECT manual_entitlements.id,manual_entitlements.benefit_type,manual_entitlements.status,manual_entitlements.starts_at,manual_entitlements.ends_at,manual_entitlements.reason,manual_entitlements.created_at,users.email,plans.name plan_name,admins.email granted_by FROM manual_entitlements JOIN users ON users.id=manual_entitlements.user_id LEFT JOIN plans ON plans.id=manual_entitlements.plan_id JOIN users admins ON admins.id=manual_entitlements.granted_by_user_id`,
    search: "lower(users.email||' '||manual_entitlements.benefit_type||' '||COALESCE(plans.name,''))", status: 'manual_entitlements.status', order: 'manual_entitlements.id'
  }
};

async function controlList(DB, json, url, domain, actor) {
  const config = LISTS[domain];
  if (!config) return error(json, 'CONTROL_DOMAIN_NOT_FOUND', 'Domaine Control Center introuvable.', 404);
  const search = String(url.searchParams.get('search') || '').trim().slice(0, 120);
  const status = String(url.searchParams.get('status') || '').trim().slice(0, 40);
  const assignedOnly = domain === 'missions' && !hasPermission(actor, 'missions.read') && hasPermission(actor, 'missions.read_assigned');
  const where = `WHERE (?='' OR ${config.search} LIKE '%'||lower(?)||'%') AND (?='' OR ${config.status}=?)${assignedOnly ? ' AND missions.assigned_to_user_id=?' : ''}`;
  const bindings = [search, search, status, status, ...(assignedOnly ? [actor.id] : [])];
  return json(await paged(DB, `${config.select} ${where} ORDER BY ${config.order} DESC`, `SELECT COUNT(*) count FROM (${config.select} ${where})`, bindings, url));
}

async function overrideLog(DB, actor, context, action, targetType, targetId, reason, idempotencyKey, details = {}) {
  const metadata = JSON.stringify(safeObject({ reason, ...details }));
  await DB.batch([
    DB.prepare(`INSERT INTO admin_overrides (actor_user_id,action,target_type,target_id,reason,idempotency_key,outcome,request_id,details_json)
      VALUES (?,?,?,?,?,?,'applied',?,?)`).bind(actor.id, action, targetType, String(targetId), reason, idempotencyKey, context.requestId, metadata),
    DB.prepare(`INSERT INTO admin_audit_logs (actor_user_id,action,target_type,target_id,request_id,ip_hint,metadata_json)
      VALUES (?,?,?,?,?,?,?)`).bind(actor.id, `override.${action}`, targetType, String(targetId), context.requestId, context.ipHint, metadata)
  ]);
  context.logEvent?.('admin.action', { requestId: context.requestId, userId: actor.id, resourceType: targetType, resourceId: targetId, action: `override.${action}`, outcome: 'success' });
}

async function requireEmployee(DB, userId, roles = []) {
  if (!userId) return null;
  const employee = await DB.prepare(`SELECT staff_members.*,users.email FROM staff_members JOIN users ON users.id=staff_members.user_id
    WHERE staff_members.user_id=? AND staff_members.status='active' AND users.status='active'`).bind(userId).first();
  return employee && (!roles.length || roles.includes(employee.role)) ? employee : null;
}

async function applyAction(request, DB, json, actor, context, readJson) {
  const body = await readJson(request);
  const action = String(body?.action || '');
  const targetId = integer(body?.targetId);
  const reason = text(body?.reason, 10, 500);
  const idempotencyKey = text(body?.idempotencyKey, 16, 120);
  const confirmation = String(body?.confirmation || '');
  const data = body?.data && typeof body.data === 'object' && !Array.isArray(body.data) ? body.data : {};
  if (!ACTIONS.has(action) || !reason || !idempotencyKey || confirmation !== `PIKALA ${action.toUpperCase()}`) {
    return error(json, 'CONTROL_CONFIRMATION_REQUIRED', 'Action, motif ou confirmation forte invalide.');
  }
  const requiredPermission = CONTROL_ACTION_PERMISSIONS[action];
  if (!requiredPermission || !hasPermission(actor, requiredPermission)) return error(json, 'FORBIDDEN', 'Permission insuffisante pour cette commande.', 403);
  const duplicate = await DB.prepare('SELECT id,outcome,created_at FROM admin_overrides WHERE idempotency_key=?').bind(idempotencyKey).first();
  if (duplicate) return json({ success: duplicate.outcome === 'applied', idempotent: true, override: duplicate });

  let targetType = action.split('.')[0];
  let resolvedTarget = targetId;
  let result;
  if (action === 'station.open' || action === 'station.close') {
    if (!targetId) return error(json, 'TARGET_REQUIRED', 'Station requise.');
    const active = action.endsWith('.open') ? 1 : 0;
    result = await DB.prepare('UPDATE stations SET is_active=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND is_active<>?').bind(active, targetId, active).run();
    if (!result.meta.changes) return error(json, 'CONTROL_CONFLICT', 'Station introuvable ou déjà dans cet état.', 409);
  } else if (action === 'bike.block') {
    result = await DB.prepare("UPDATE bikes SET status='disabled',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status NOT IN ('in_use','retired')").bind(targetId).run();
    if (!result.meta.changes) return error(json, 'CONTROL_CONFLICT', 'Vélo introuvable, en trajet ou retiré.', 409);
  } else if (action === 'bike.restore') {
    result = await DB.prepare(`UPDATE bikes SET status='available',maintenance_required=0,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status IN ('disabled','maintenance')
      AND NOT EXISTS (SELECT 1 FROM maintenance_records WHERE bike_id=? AND status IN ('open','in_progress'))
      AND (station_id IS NULL OR EXISTS (SELECT 1 FROM docks WHERE bike_id=bikes.id AND status='occupied'))`).bind(targetId, targetId).run();
    if (!result.meta.changes) return error(json, 'CONTROL_CONFLICT', 'Maintenance ouverte ou incohérence de quai.', 409);
  } else if (action === 'bike.maintenance') {
    const bike = await DB.prepare("SELECT id FROM bikes WHERE id=? AND status NOT IN ('in_use','retired')").bind(targetId).first();
    if (!bike) return error(json, 'CONTROL_CONFLICT', 'Vélo introuvable, en trajet ou retiré.', 409);
    const maintenance = await DB.prepare("SELECT id FROM maintenance_records WHERE bike_id=? AND status IN ('open','in_progress')").bind(targetId).first();
    if (maintenance) return error(json, 'CONTROL_CONFLICT', 'Une maintenance est déjà ouverte.', 409);
    const rows = await DB.batch([
      DB.prepare("INSERT INTO maintenance_records (bike_id,opened_by_user_id,status,reason,workflow_stage,started_at) VALUES (?,?,'in_progress',?,'maintenance',CURRENT_TIMESTAMP)").bind(targetId, actor.id, reason),
      DB.prepare("UPDATE bikes SET status='maintenance',maintenance_required=1,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(targetId)
    ]);
    resolvedTarget = rows[0].meta.last_row_id;
    targetType = 'maintenance';
  } else if (action === 'bike.move') {
    const stationId = integer(data.stationId); const dockId = integer(data.dockId);
    if (!targetId || !stationId || !dockId) return error(json, 'TARGET_REQUIRED', 'Vélo, station et quai requis.');
    const bike = await DB.prepare("SELECT id,station_id FROM bikes WHERE id=? AND status NOT IN ('in_use','retired')").bind(targetId).first();
    const dock = await DB.prepare("SELECT id FROM docks WHERE id=? AND station_id=? AND status='available' AND bike_id IS NULL").bind(dockId, stationId).first();
    if (!bike || !dock) return error(json, 'CONTROL_CONFLICT', 'Vélo ou quai indisponible.', 409);
    await DB.batch([
      DB.prepare("UPDATE docks SET bike_id=NULL,status=CASE WHEN status='disabled' THEN status ELSE 'available' END,updated_at=CURRENT_TIMESTAMP WHERE bike_id=?").bind(targetId),
      DB.prepare("UPDATE docks SET bike_id=?,status='occupied',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='available' AND bike_id IS NULL").bind(targetId, dockId),
      DB.prepare('UPDATE bikes SET station_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(stationId, targetId)
    ]);
  } else if (action === 'dock.correct') {
    const status = String(data.status || '');
    if (!['available', 'disabled', 'maintenance'].includes(status)) return error(json, 'CONTROL_INPUT_INVALID', 'Statut de quai invalide.');
    result = await DB.prepare('UPDATE docks SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND bike_id IS NULL').bind(status, targetId).run();
    if (!result.meta.changes) return error(json, 'CONTROL_CONFLICT', 'Quai introuvable ou occupé.', 409);
  } else if (action === 'user.suspend' || action === 'user.reactivate') {
    if (targetId === actor.id) return error(json, 'CONTROL_CONFLICT', 'Votre propre compte ne peut pas être modifié ici.', 409);
    const status = action.endsWith('reactivate') ? 'active' : 'suspended';
    const rows = await DB.batch([
      DB.prepare('UPDATE users SET status=?,status_reason=?,auth_version=auth_version+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status<>?').bind(status, reason, targetId, status),
      DB.prepare('UPDATE sessions SET revoked_at=CURRENT_TIMESTAMP WHERE user_id=? AND revoked_at IS NULL').bind(targetId)
    ]);
    if (!rows[0].meta.changes) return error(json, 'CONTROL_CONFLICT', 'Utilisateur introuvable ou déjà dans cet état.', 409);
  } else if (action === 'ride.force_end') {
    const ride = await DB.prepare("SELECT id,bike_id,started_at FROM rides WHERE id=? AND status='active'").bind(targetId).first();
    if (!ride) return error(json, 'CONTROL_CONFLICT', 'Trajet actif introuvable.', 409);
    await DB.batch([
      DB.prepare("UPDATE rides SET status='cancelled',ended_at=CURRENT_TIMESTAMP,duration_seconds=MAX(0,CAST((julianday(CURRENT_TIMESTAMP)-julianday(started_at))*86400 AS INTEGER)),updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='active'").bind(targetId),
      DB.prepare("UPDATE bikes SET status='disabled',station_id=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='in_use'").bind(ride.bike_id),
      DB.prepare("INSERT INTO network_alerts (alert_type,severity,title,message,resource_type,resource_id,dedupe_key) VALUES ('forced_ride_end','critical','Vélo à récupérer',?,'bike',?,?)").bind(reason, String(ride.bike_id), `forced-ride-${targetId}`)
    ]);
  } else if (action === 'maintenance.assign') {
    const employeeId = integer(data.userId);
    if (!await requireEmployee(DB, employeeId, ['technician','operations_manager','admin','super_admin'])) return error(json, 'EMPLOYEE_INVALID', 'Technicien actif requis.');
    result = await DB.prepare("UPDATE maintenance_records SET assigned_to_user_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status IN ('open','in_progress')").bind(employeeId, targetId).run();
    if (!result.meta.changes) return error(json, 'CONTROL_CONFLICT', 'Maintenance ouverte introuvable.', 409);
  } else if (action === 'employee.upsert') {
    return error(json, 'STAFF_LEGACY_ROUTE_REMOVED', 'Utilisez la section Employés et la route /api/admin/staff.', 410);
  } else if (action === 'inspection.create') {
    const type = String(data.inspectionType || ''); const publicCode = `INSP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const bikeId = integer(data.bikeId); const stationId = integer(data.stationId); const dockId = integer(data.dockId); const inspector = integer(data.userId);
    if (!['bike','station','dock','safety'].includes(type) || (!bikeId && !stationId && !dockId)) return error(json, 'CONTROL_INPUT_INVALID', 'Inspection invalide.');
    if (inspector && !await requireEmployee(DB, inspector, ['technician','field_agent','station_manager','operations_manager','admin','super_admin'])) return error(json, 'EMPLOYEE_INVALID', 'Inspecteur actif requis.');
    const inserted = await DB.prepare(`INSERT INTO inspections (public_code,inspection_type,bike_id,station_id,dock_id,inspector_user_id,due_at,notes)
      VALUES (?,?,?,?,?,?,?,?)`).bind(publicCode, type, bikeId, stationId, dockId, inspector, data.dueAt || null, reason).run();
    resolvedTarget = inserted.meta.last_row_id; targetType = 'inspection';
  } else if (action === 'mission.create') {
    const type = String(data.missionType || ''); const title = text(data.title, 2, 120); const priority = String(data.priority || 'normal');
    if (!['inspection','maintenance','rebalancing','intervention','recovery'].includes(type) || !title || !['low','normal','high','urgent'].includes(priority)) return error(json, 'CONTROL_INPUT_INVALID', 'Mission invalide.');
    const assignee = integer(data.userId);
    if (assignee && !await requireEmployee(DB, assignee)) return error(json, 'EMPLOYEE_INVALID', 'Employé actif requis.');
    const code = `MIS-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const inserted = await DB.prepare(`INSERT INTO missions (public_code,mission_type,priority,status,assigned_to_user_id,source_station_id,destination_station_id,title,description,due_at,created_by_user_id)
      VALUES (?,?,?,CASE WHEN ? IS NULL THEN 'created' ELSE 'assigned' END,?,?,?,?,?,?,?)`)
      .bind(code, type, priority, assignee, assignee, integer(data.sourceStationId), integer(data.destinationStationId), title, reason, data.dueAt || null, actor.id).run();
    resolvedTarget = inserted.meta.last_row_id; targetType = 'mission';
  } else if (action === 'mission.assign') {
    const employeeId = integer(data.userId);
    if (!await requireEmployee(DB, employeeId)) return error(json, 'EMPLOYEE_INVALID', 'Employé actif requis.');
    result = await DB.prepare("UPDATE missions SET assigned_to_user_id=?,status=CASE WHEN status='created' THEN 'assigned' ELSE status END,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status NOT IN ('completed','cancelled','failed')").bind(employeeId, targetId).run();
    if (!result.meta.changes) return error(json, 'CONTROL_CONFLICT', 'Mission assignable introuvable.', 409);
  } else if (action === 'notification.send') {
    const userId = integer(data.userId); const title = text(data.title, 2, 120); const message = text(data.message, 2, 1000);
    if (!userId || !title || !message) return error(json, 'CONTROL_INPUT_INVALID', 'Notification invalide.');
    const inserted = await DB.prepare("INSERT INTO notifications (user_id,type,title,body,channel,status,sent_at,updated_at) SELECT id,'service',?,?,'in_app','sent',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP FROM users WHERE id=? AND status='active'").bind(title, message, userId).run();
    if (!inserted.meta.changes) return error(json, 'CONTROL_CONFLICT', 'Utilisateur actif introuvable.', 409);
    resolvedTarget = userId; targetType = 'notification';
  } else if (action === 'service.maintenance' || action === 'service.restore') {
    const mode = action.endsWith('restore') ? 'operational' : 'paused';
    await DB.prepare("UPDATE app_settings SET value_json=json_object('mode',?,'message',?),updated_by_user_id=?,updated_at=CURRENT_TIMESTAMP WHERE key='service_status'").bind(mode, action.endsWith('restore') ? '' : reason, actor.id).run();
    resolvedTarget = 'service_status'; targetType = 'setting';
  } else if (action === 'alert.acknowledge' || action === 'alert.resolve') {
    const status = action.endsWith('resolve') ? 'resolved' : 'acknowledged';
    result = await DB.prepare(`UPDATE network_alerts SET status=?,acknowledged_by_user_id=?,acknowledged_at=COALESCE(acknowledged_at,CURRENT_TIMESTAMP),resolved_at=CASE WHEN ?='resolved' THEN CURRENT_TIMESTAMP ELSE resolved_at END WHERE id=? AND status IN ('open','acknowledged')`).bind(status, actor.id, status, targetId).run();
    if (!result.meta.changes) return error(json, 'CONTROL_CONFLICT', 'Alerte active introuvable.', 409);
  } else if (action === 'automation.toggle') {
    const enabled = data.enabled === true || data.enabled === 1;
    result = await DB.prepare('UPDATE automation_rules SET enabled=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(enabled ? 1 : 0, targetId).run();
    if (!result.meta.changes) return error(json, 'CONTROL_CONFLICT', 'Règle introuvable.', 409);
  } else if (action === 'device.status') {
    const status = String(data.status || '');
    if (!['online','offline','maintenance','disabled'].includes(status)) return error(json, 'CONTROL_INPUT_INVALID', 'Statut device invalide.');
    result = await DB.prepare('UPDATE devices SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(status, targetId).run();
    if (!result.meta.changes) return error(json, 'CONTROL_CONFLICT', 'Device introuvable.', 409);
  } else if (action === 'entitlement.grant') {
    const userId = integer(data.userId); const planId = integer(data.planId); const days = Number(data.days); const benefit = String(data.benefitType || 'ride_access');
    if (!userId || !Number.isInteger(days) || days < 1 || days > 366 || !['ride_access','subscription_extension','service_credit'].includes(benefit)) return error(json, 'CONTROL_INPUT_INVALID', 'Avantage manuel invalide.');
    const inserted = await DB.prepare(`INSERT INTO manual_entitlements (user_id,benefit_type,plan_id,starts_at,ends_at,reason,granted_by_user_id)
      SELECT id,?,?,CURRENT_TIMESTAMP,datetime('now','+'||?||' days'),?,? FROM users WHERE id=? AND status='active'`)
      .bind(benefit, planId, days, reason, actor.id, userId).run();
    if (!inserted.meta.changes) return error(json, 'CONTROL_CONFLICT', 'Utilisateur actif introuvable.', 409);
    resolvedTarget = inserted.meta.last_row_id; targetType = 'entitlement';
  } else if (action === 'entitlement.revoke') {
    result = await DB.prepare("UPDATE manual_entitlements SET status='revoked',revoked_by_user_id=?,revoked_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='active'").bind(actor.id, targetId).run();
    if (!result.meta.changes) return error(json, 'CONTROL_CONFLICT', 'Avantage actif introuvable.', 409);
    targetType = 'entitlement';
  }

  await overrideLog(DB, actor, context, action, targetType, resolvedTarget, reason, idempotencyKey, safeObject(data));
  return json({ success: true, action, targetType, targetId: resolvedTarget }, 201);
}

export async function handleControlCenterApi(request, env, actor, utilities) {
  const DB = env.DB; const url = new URL(request.url); const { json, readJson, requestId, ipHint, logEvent } = utilities;
  const context = { requestId, ipHint, logEvent };
  if (request.method === 'GET' && url.pathname === '/api/admin/control-center') return controlOverview(DB, json, env);
  const listMatch = url.pathname.match(/^\/api\/admin\/control-center\/([a-z-]+)$/);
  if (request.method === 'GET' && listMatch) return controlList(DB, json, url, listMatch[1], actor);
  if (request.method === 'POST' && url.pathname === '/api/admin/control-center/actions') return applyAction(request, DB, json, actor, context, readJson);
  return null;
}

export { ACTIONS, TERMINAL_MISSION_STATUSES };
