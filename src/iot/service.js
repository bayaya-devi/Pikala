import { createDeviceProvider, decryptDeviceSecret, encryptDeviceSecret, generateDeviceSecret, iotMode } from './provider.js';
import { hasPermission } from '../auth/rbac.js';

const COMMANDS = new Set(['unlock', 'lock', 'ping', 'status', 'locate', 'reboot']);
const HARDWARE_TYPES = new Set(['bike_lock', 'bike_controller', 'dock', 'station_controller', 'tracker', 'other']);
const fail = (json, code, error, status = 400) => json({ code, error }, status);
const integer = (value) => { const parsed = Number(value); return Number.isInteger(parsed) && parsed > 0 ? parsed : null; };
const clean = (value, max) => { const text = String(value ?? '').trim(); return text && text.length <= max ? text : null; };
const commandId = () => `cmd_${crypto.randomUUID().replaceAll('-', '')}`;

function safeObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const safe = {};
  for (const [key, item] of Object.entries(value).slice(0, 20)) {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(key)) continue;
    if (typeof item === 'string') safe[key] = item.slice(0, 240);
    else if (typeof item === 'number' || typeof item === 'boolean' || item === null) safe[key] = item;
  }
  return safe;
}

async function audit(DB, actor, utilities, action, targetId, metadata = {}) {
  await DB.prepare(`INSERT INTO admin_audit_logs
    (actor_user_id,action,target_type,target_id,request_id,ip_hint,metadata_json)
    VALUES(? ,?,'device',?,?,?,?)`)
    .bind(actor.id, action, String(targetId), utilities.requestId, utilities.ipHint, JSON.stringify(metadata)).run();
}

async function queueCommand(DB, provider, input) {
  const { deviceId, type, payload = {}, userId = null, rideId = null, idempotencyKey, correlationId, ttlSeconds = 60 } = input;
  if (!COMMANDS.has(type) || !clean(idempotencyKey, 160) || !clean(correlationId, 160)) throw Object.assign(new Error('Invalid IoT command'), { code: 'IOT_COMMAND_INVALID' });
  const existing = await DB.prepare('SELECT * FROM device_commands WHERE idempotency_key=?').bind(idempotencyKey).first();
  if (existing) return { command: existing, idempotent: true };
  const device = await DB.prepare(`SELECT * FROM devices WHERE id=? AND status NOT IN ('disabled','maintenance')`).bind(deviceId).first();
  if (!device) throw Object.assign(new Error('Device unavailable'), { code: 'DEVICE_UNAVAILABLE' });
  if (device.connectivity_status === 'offline') throw Object.assign(new Error('Device offline'), { code: 'DEVICE_OFFLINE' });
  const publicId = commandId();
  const inserted = await DB.prepare(`INSERT INTO device_commands
    (command_id,device_id,command_type,payload_json,idempotency_key,correlation_id,requested_by_user_id,ride_id,expires_at)
    VALUES(?,?,?,?,?,?,?,?,datetime('now','+'||?||' seconds'))`)
    .bind(publicId, deviceId, type, JSON.stringify(payload), idempotencyKey, correlationId, userId, rideId, ttlSeconds).run();
  const command = await DB.prepare('SELECT * FROM device_commands WHERE id=?').bind(inserted.meta.last_row_id).first();
  let sent;
  try { sent = await provider.sendCommand(command); }
  catch (error) {
    await DB.prepare(`UPDATE device_commands SET status='failed',failed_at=CURRENT_TIMESTAMP,failure_reason=?,updated_at=CURRENT_TIMESTAMP
      WHERE id=? AND status='queued'`).bind(String(error?.code || 'PROVIDER_FAILURE').slice(0, 500), command.id).run();
    throw error;
  }
  await DB.prepare(`UPDATE device_commands SET status='sent',sent_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP
    WHERE id=? AND status='queued'`).bind(command.id).run();
  return { command: { ...command, status: 'sent', providerCommandId: sent.providerCommandId }, idempotent: false };
}

export async function reserveIotRide(DB, env, { userId, bike, requestId, idempotencyKey }) {
  const mode = iotMode(env);
  if (mode === 'disabled') return null;
  const provider = createDeviceProvider(env);
  if (!provider.configured) throw Object.assign(new Error('Provider unavailable'), { code: 'DEVICE_PROVIDER_UNAVAILABLE' });
  if (!clean(idempotencyKey, 160)) throw Object.assign(new Error('Idempotency required'), { code: 'IOT_COMMAND_INVALID' });
  const prior = await DB.prepare(`SELECT c.*,r.id ride_id FROM device_commands c JOIN rides r ON r.id=c.ride_id
    WHERE c.idempotency_key=? AND c.requested_by_user_id=? AND c.command_type='unlock'`).bind(idempotencyKey, userId).first();
  if (prior) return { mode, rideId: prior.ride_id, command: prior };
  if (bike.status === 'maintenance' || Number(bike.maintenance_required) === 1) throw Object.assign(new Error('Bike maintenance'), { code: 'BIKE_MAINTENANCE' });
  if (bike.status !== 'available') throw Object.assign(new Error('Bike unavailable'), { code: 'BIKE_UNAVAILABLE' });
  if (!bike.station_id || Number(bike.station_active) !== 1) throw Object.assign(new Error('Station closed'), { code: 'STATION_CLOSED' });
  if (!bike.dock_id || bike.dock_status !== 'occupied') throw Object.assign(new Error('Dock invalid'), { code: 'BIKE_DOCK_INVALID' });
  const device = await DB.prepare(`SELECT * FROM devices WHERE bike_id=? AND hardware_type='bike_lock'
    AND status='online' ORDER BY id LIMIT 1`).bind(bike.id).first();
  if (!device) throw Object.assign(new Error('Lock unavailable'), { code: 'BIKE_LOCK_UNAVAILABLE' });
  const current = await DB.prepare(`SELECT id FROM rides WHERE user_id=? AND status IN ('reserved','active') LIMIT 1`).bind(userId).first();
  if (current) throw Object.assign(new Error('Ride already active'), { code: 'RIDE_ALREADY_ACTIVE' });
  const stamp = new Date().toISOString();
  const reserved = await DB.batch([
    DB.prepare(`UPDATE bikes SET status='reserved',updated_at=? WHERE id=? AND status='available' AND maintenance_required=0
      AND station_id=? AND EXISTS(SELECT 1 FROM docks WHERE id=? AND bike_id=? AND status='occupied')`).bind(stamp, bike.id, bike.station_id, bike.dock_id, bike.id),
    DB.prepare(`INSERT INTO rides(user_id,bike_id,start_station_id,start_dock_id,status,updated_at)
      SELECT ?,?,?,?,'reserved',? WHERE EXISTS(SELECT 1 FROM bikes WHERE id=? AND status='reserved' AND updated_at=?)`)
      .bind(userId, bike.id, bike.station_id, bike.dock_id, stamp, bike.id, stamp)
  ]);
  if (!reserved[0].meta.changes || !reserved[1].meta.changes) throw Object.assign(new Error('Bike unavailable'), { code: 'BIKE_UNAVAILABLE' });
  const rideId = reserved[1].meta.last_row_id;
  try {
    const queued = await queueCommand(DB, provider, { deviceId: device.id, type: 'unlock', payload: { bikeId: bike.id, dockId: bike.dock_id }, userId, rideId, idempotencyKey, correlationId: requestId });
    return { mode, rideId, command: queued.command };
  } catch (error) {
    await DB.batch([
      DB.prepare(`UPDATE rides SET status='cancelled',ended_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='reserved'`).bind(rideId),
      DB.prepare(`UPDATE bikes SET status='available',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='reserved'`).bind(bike.id)
    ]);
    throw error;
  }
}

export async function requestIotReturn(DB, env, { userId, ride, dock, requestId, idempotencyKey }) {
  const mode = iotMode(env);
  if (mode === 'disabled') return null;
  const provider = createDeviceProvider(env);
  if (!provider.configured) throw Object.assign(new Error('Provider unavailable'), { code: 'DEVICE_PROVIDER_UNAVAILABLE' });
  if (!clean(idempotencyKey, 160)) throw Object.assign(new Error('Idempotency required'), { code: 'IOT_COMMAND_INVALID' });
  const prior = await DB.prepare(`SELECT * FROM device_commands WHERE idempotency_key=? AND requested_by_user_id=?
    AND ride_id=? AND command_type='lock'`).bind(idempotencyKey, userId, ride.id).first();
  if (prior) return { mode, rideId: ride.id, command: prior };
  const device = await DB.prepare(`SELECT * FROM devices WHERE status='online' AND
    ((dock_id=? AND hardware_type='dock') OR (bike_id=? AND hardware_type='bike_lock'))
    ORDER BY CASE WHEN dock_id=? THEN 0 ELSE 1 END,id LIMIT 1`).bind(dock.id, ride.bike_id, dock.id).first();
  if (!device) throw Object.assign(new Error('Lock unavailable'), { code: 'DOCK_DEVICE_UNAVAILABLE' });
  const queued = await queueCommand(DB, provider, { deviceId: device.id, type: 'lock', payload: { bikeId: ride.bike_id, dockId: dock.id, stationId: dock.station_id }, userId, rideId: ride.id, idempotencyKey, correlationId: requestId, ttlSeconds: 90 });
  return { mode, rideId: ride.id, command: queued.command };
}

async function applyCommandResult(DB, command, status, result) {
  const existing = await DB.prepare(`SELECT id FROM device_command_results WHERE command_id=? AND provider_event_id=?`).bind(command.id, result.providerEventId).first();
  if (existing) return { duplicate: true };
  const now = new Date().toISOString();
  const statements = [DB.prepare(`INSERT INTO device_command_results(command_id,provider_event_id,result_status,result_json)
    VALUES(?,?,?,?)`).bind(command.id, result.providerEventId, status, JSON.stringify(safeObject(result.payload) || {}))];
  const required = [];
  if (status === 'acknowledged') {
    required.push(statements.length);
    statements.push(DB.prepare(`UPDATE device_commands SET status='acknowledged',acknowledged_at=?,updated_at=? WHERE id=? AND status='sent'`).bind(now, now, command.id));
  } else if (status === 'failed') {
    required.push(statements.length);
    statements.push(DB.prepare(`UPDATE device_commands SET status='failed',failed_at=?,failure_reason=?,updated_at=? WHERE id=? AND status IN ('sent','acknowledged')`).bind(now, result.reason || 'DEVICE_FAILED', now, command.id));
    statements.push(DB.prepare(`UPDATE rides SET status='cancelled',ended_at=?,updated_at=? WHERE id=? AND status='reserved'`).bind(now, now, command.ride_id));
    statements.push(DB.prepare(`UPDATE bikes SET status='available',updated_at=? WHERE id=(SELECT bike_id FROM rides WHERE id=?) AND status='reserved'`).bind(now, command.ride_id));
  } else if (command.command_type === 'unlock') {
    const ride = await DB.prepare(`SELECT * FROM rides WHERE id=? AND status='reserved'`).bind(command.ride_id).first();
    if (!ride) throw Object.assign(new Error('Reserved ride missing'), { code: 'IOT_RIDE_STATE_INVALID' });
    required.push(statements.length, statements.length + 1, statements.length + 2, statements.length + 3);
    statements.push(
      DB.prepare(`UPDATE docks SET status='available',bike_id=NULL,lock_status='unlocked',updated_at=? WHERE id=? AND bike_id=? AND status='occupied'`).bind(now, ride.start_dock_id, ride.bike_id),
      DB.prepare(`UPDATE bikes SET status='in_use',station_id=NULL,lock_status='unlocked',updated_at=? WHERE id=? AND status='reserved'`).bind(now, ride.bike_id),
      DB.prepare(`UPDATE rides SET status='active',started_at=?,updated_at=? WHERE id=? AND status='reserved'`).bind(now, now, ride.id),
      DB.prepare(`UPDATE device_commands SET status='completed',acknowledged_at=COALESCE(acknowledged_at,?),completed_at=?,updated_at=? WHERE id=? AND status IN ('sent','acknowledged')`).bind(now, now, now, command.id),
      DB.prepare(`INSERT INTO notifications(user_id,type,title,body,channel,status,sent_at,action_url,updated_at)
        VALUES(?,'ride_started','Trajet demarre','Votre velo Pikala est debloque.','in_app','sent',CURRENT_TIMESTAMP,'/trajet.html',CURRENT_TIMESTAMP)`).bind(ride.user_id)
    );
  } else if (command.command_type === 'lock') {
    const ride = await DB.prepare(`SELECT * FROM rides WHERE id=? AND status='active'`).bind(command.ride_id).first();
    if (!ride) throw Object.assign(new Error('Active ride missing'), { code: 'IOT_RIDE_STATE_INVALID' });
    const payload = safeObject(JSON.parse(command.payload_json || '{}')) || {};
    const dockId = integer(payload.dockId), stationId = integer(payload.stationId);
    if (!dockId || !stationId) throw Object.assign(new Error('Invalid return target'), { code: 'IOT_COMMAND_INVALID' });
    required.push(statements.length, statements.length + 1, statements.length + 2, statements.length + 3);
    statements.push(
      DB.prepare(`UPDATE rides SET status='completed',end_station_id=?,end_dock_id=?,ended_at=?,duration_seconds=MAX(0,CAST((julianday(?)-julianday(started_at))*86400 AS INTEGER)),updated_at=? WHERE id=? AND status='active'`).bind(stationId, dockId, now, now, now, ride.id),
      DB.prepare(`UPDATE bikes SET status=CASE WHEN maintenance_required=1 THEN 'maintenance' ELSE 'available' END,station_id=?,lock_status='locked',total_rides=total_rides+1,total_usage_seconds=total_usage_seconds+COALESCE((SELECT duration_seconds FROM rides WHERE id=?),0),updated_at=? WHERE id=? AND status='in_use'`).bind(stationId, ride.id, now, ride.bike_id),
      DB.prepare(`UPDATE docks SET status='occupied',bike_id=?,lock_status='locked',updated_at=? WHERE id=? AND station_id=? AND status='available' AND bike_id IS NULL`).bind(ride.bike_id, now, dockId, stationId),
      DB.prepare(`UPDATE device_commands SET status='completed',acknowledged_at=COALESCE(acknowledged_at,?),completed_at=?,updated_at=? WHERE id=? AND status IN ('sent','acknowledged')`).bind(now, now, now, command.id),
      DB.prepare(`INSERT INTO notifications(user_id,type,title,body,channel,status,sent_at,action_url,updated_at)
        VALUES(?,'ride_completed','Trajet termine','Votre velo a bien ete restitue.','in_app','sent',CURRENT_TIMESTAMP,?,CURRENT_TIMESTAMP)`).bind(ride.user_id, `/trajet.html?id=${ride.id}`)
    );
  } else {
    required.push(statements.length);
    statements.push(DB.prepare(`UPDATE device_commands SET status='completed',acknowledged_at=COALESCE(acknowledged_at,?),completed_at=?,updated_at=? WHERE id=? AND status IN ('sent','acknowledged')`).bind(now, now, now, command.id));
  }
  const results = await DB.batch(statements);
  if (!results[0].meta.changes || required.some((index) => !results[index]?.meta?.changes)) throw Object.assign(new Error('IoT state conflict'), { code: 'IOT_STATE_CONFLICT' });
  return { duplicate: false };
}

async function rateLimitDevice(DB, deviceId) {
  const window = Math.floor(Date.now() / 60000);
  await DB.prepare(`INSERT INTO device_rate_limits(device_id,window_start,request_count) VALUES(?,?,1)
    ON CONFLICT(device_id,window_start) DO UPDATE SET request_count=request_count+1`).bind(deviceId, window).run();
  const row = await DB.prepare(`SELECT request_count FROM device_rate_limits WHERE device_id=? AND window_start=?`).bind(deviceId, window).first();
  return Number(row?.request_count || 0) <= 120;
}

export async function handleDeviceEvent(request, env, { json }) {
  const provider = createDeviceProvider(env);
  if (iotMode(env) === 'disabled') return fail(json, 'IOT_DISABLED', 'Reception IoT desactivee.', 404);
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > 32768) return fail(json, 'IOT_EVENT_TOO_LARGE', 'Evenement trop volumineux.', 413);
  const raw = await request.text();
  if (!raw || new TextEncoder().encode(raw).length > 32768) return fail(json, 'IOT_EVENT_INVALID', 'Evenement invalide.');
  let body;
  try { body = JSON.parse(raw); } catch { return fail(json, 'IOT_EVENT_INVALID', 'Evenement invalide.'); }
  const keyId = clean(request.headers.get('x-pikala-key-id'), 160), signature = clean(request.headers.get('x-pikala-signature'), 256);
  const nonce = clean(body?.nonce, 160), providerEventId = clean(body?.eventId, 160), timestamp = Date.parse(body?.timestamp);
  if (!keyId || !signature || !nonce || !providerEventId || !Number.isFinite(timestamp) || Math.abs(Date.now() - timestamp) > 300000) return fail(json, 'IOT_EVENT_INVALID', 'Evenement invalide.', 401);
  const credential = await env.DB.prepare(`SELECT c.*,d.status device_status FROM device_credentials c JOIN devices d ON d.id=c.device_id
    WHERE c.key_id=? AND c.status='active' AND (c.expires_at IS NULL OR c.expires_at>CURRENT_TIMESTAMP)`).bind(keyId).first();
  if (!credential || credential.device_status === 'disabled') return fail(json, 'IOT_AUTH_FAILED', 'Authentification device refusee.', 401);
  let secret;
  try { secret = await decryptDeviceSecret(credential, env.IOT_CREDENTIAL_KEK); }
  catch { return fail(json, 'IOT_AUTH_UNAVAILABLE', 'Authentification device indisponible.', 503); }
  if (!await provider.verifyIncomingEvent({ raw, signature, secret })) return fail(json, 'IOT_SIGNATURE_INVALID', 'Signature invalide.', 401);
  if (!await rateLimitDevice(env.DB, credential.device_id)) return fail(json, 'IOT_RATE_LIMITED', "Trop d'evenements.", 429);
  let event = await env.DB.prepare(`SELECT id,processing_status FROM device_events WHERE device_id=? AND (provider_event_id=? OR nonce=?)`).bind(credential.device_id, providerEventId, nonce).first();
  if (event?.processing_status === 'processed') return json({ received: true, duplicate: true });
  if (!event) {
    const inserted = await env.DB.prepare(`INSERT INTO device_events(device_id,provider_event_id,event_type,event_timestamp,nonce,payload_json,signature_valid)
      VALUES(?,?,?,?,?,?,1)`).bind(credential.device_id, providerEventId, clean(body.type, 80) || 'unknown', new Date(timestamp).toISOString(), nonce, JSON.stringify(safeObject(body.payload) || {})).run();
    event = { id: inserted.meta.last_row_id, processing_status: 'received' };
  }
  try {
    const normalized = provider.handleAcknowledgement(body.payload);
    if (normalized && body.payload?.commandId) {
      const command = await env.DB.prepare(`SELECT * FROM device_commands WHERE command_id=? AND device_id=?`).bind(String(body.payload.commandId), credential.device_id).first();
      if (!command) {
        await env.DB.prepare(`UPDATE device_events SET processing_status='rejected',processed_at=CURRENT_TIMESTAMP,error_code='IOT_COMMAND_DEVICE_MISMATCH' WHERE id=?`).bind(event.id).run();
        return fail(json, 'IOT_COMMAND_DEVICE_MISMATCH', 'La commande ne correspond pas a ce device.', 409);
      }
      await applyCommandResult(env.DB, command, normalized.status, { providerEventId, payload: body.payload, reason: normalized.reason });
    }
    const telemetry = provider.normalizeTelemetry(body.payload);
    if (Object.keys(telemetry).length) await env.DB.batch([
      env.DB.prepare(`INSERT INTO device_telemetry(device_id,event_id,recorded_at,connectivity_status,battery_level,latitude,longitude,lock_status)
        VALUES(?,?,?,?,?,?,?,?)`).bind(credential.device_id, event.id, new Date(timestamp).toISOString(), telemetry.connectivityStatus || null, telemetry.batteryLevel ?? null, telemetry.latitude ?? null, telemetry.longitude ?? null, telemetry.lockStatus || null),
      env.DB.prepare(`UPDATE devices SET connectivity_status=COALESCE(?,connectivity_status),battery_level=COALESCE(?,battery_level),last_seen_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(telemetry.connectivityStatus || null, telemetry.batteryLevel ?? null, new Date(timestamp).toISOString(), credential.device_id)
    ]);
    await env.DB.prepare(`UPDATE device_events SET processing_status='processed',processed_at=CURRENT_TIMESTAMP,error_code=NULL WHERE id=?`).bind(event.id).run();
    return json({ received: true }, 202);
  } catch (error) {
    await env.DB.prepare(`UPDATE device_events SET processing_status='rejected',processed_at=CURRENT_TIMESTAMP,error_code=? WHERE id=?`).bind(String(error?.code || 'PROCESSING_FAILURE').slice(0, 120), event.id).run();
    throw error;
  }
}

function deviceInput(body) {
  const hardwareType = String(body?.hardwareType || '');
  const assignments = [integer(body?.bikeId), integer(body?.dockId), integer(body?.stationId)];
  if (!clean(body?.publicCode, 80) || !clean(body?.hardwareId, 160) || !HARDWARE_TYPES.has(hardwareType) || assignments.filter(Boolean).length !== 1) return null;
  const legacyType = ({ bike_lock: 'bike_lock', bike_controller: 'sensor', dock: 'dock_controller', station_controller: 'station_gateway', tracker: 'sensor', other: 'sensor' })[hardwareType];
  return { publicCode: clean(body.publicCode, 80), hardwareId: clean(body.hardwareId, 160), hardwareType, legacyType, provider: clean(body.provider, 80) || 'unconfigured', bikeId: assignments[0], dockId: assignments[1], stationId: assignments[2] };
}

async function createDevice(request, env, actor, utilities) {
  const input = deviceInput(await utilities.readJson(request));
  if (!input) return fail(utilities.json, 'IOT_INPUT_INVALID', 'Donnees device invalides.');
  const inserted = await env.DB.prepare(`INSERT INTO devices
    (public_code,device_type,bike_id,dock_id,station_id,status,hardware_id,hardware_type,provider,connectivity_status)
    VALUES(?,?,?,?,?,'provisioning',?,?,?,'unknown')`).bind(input.publicCode, input.legacyType, input.bikeId, input.dockId, input.stationId, input.hardwareId, input.hardwareType, input.provider).run();
  await audit(env.DB, actor, utilities, 'device.create', inserted.meta.last_row_id, { hardwareType: input.hardwareType, provider: input.provider });
  return utilities.json({ id: inserted.meta.last_row_id, ...input, status: 'provisioning' }, 201);
}

async function provisionCredential(request, env, actor, utilities, deviceId) {
  if (!env.IOT_CREDENTIAL_KEK) return fail(utilities.json, 'IOT_KEY_UNAVAILABLE', 'Cle de chiffrement IoT non configuree.', 503);
  const reason = clean((await utilities.readJson(request))?.reason, 500);
  if (!reason || reason.length < 10) return fail(utilities.json, 'IOT_INPUT_INVALID', 'Motif requis.');
  const device = await env.DB.prepare(`SELECT id FROM devices WHERE id=? AND status<>'disabled'`).bind(deviceId).first();
  if (!device) return fail(utilities.json, 'DEVICE_NOT_FOUND', 'Device introuvable.', 404);
  const secret = generateDeviceSecret(), encrypted = await encryptDeviceSecret(secret, env.IOT_CREDENTIAL_KEK), keyId = `key_${crypto.randomUUID().replaceAll('-', '')}`;
  await env.DB.batch([
    env.DB.prepare(`UPDATE device_credentials SET status='rotated',rotated_at=CURRENT_TIMESTAMP WHERE device_id=? AND status='active'`).bind(deviceId),
    env.DB.prepare(`INSERT INTO device_credentials(device_id,key_id,secret_hash,secret_ciphertext,secret_iv,created_by_user_id) VALUES(?,?,?,?,?,?)`).bind(deviceId, keyId, encrypted.hash, encrypted.ciphertext, encrypted.iv, actor.id),
    env.DB.prepare(`UPDATE devices SET credential_version=credential_version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(deviceId),
    env.DB.prepare(`INSERT INTO admin_audit_logs(actor_user_id,action,target_type,target_id,request_id,ip_hint,metadata_json)
      VALUES(?,'device.credential.rotate','device',?,?,?,?)`).bind(actor.id, String(deviceId), utilities.requestId, utilities.ipHint, JSON.stringify({ reason, keyId }))
  ]);
  return utilities.json({ keyId, secret, warning: 'Ce secret ne sera plus affiche.' }, 201);
}

async function simulate(request, env, actor, utilities) {
  if (iotMode(env) !== 'test' || String(env.ENVIRONMENT || '') !== 'development') return fail(utilities.json, 'IOT_SIMULATOR_DISABLED', 'Simulateur indisponible.', 404);
  if (!hasPermission(actor, 'devices.manage')) return fail(utilities.json, 'FORBIDDEN', 'Permission insuffisante.', 403);
  const body = await utilities.readJson(request), commandIdValue = clean(body?.commandId, 160), outcome = String(body?.outcome || '');
  if (!commandIdValue || !['acknowledged', 'completed', 'failed', 'timeout', 'offline', 'low_battery', 'duplicate'].includes(outcome)) return fail(utilities.json, 'IOT_INPUT_INVALID', 'Simulation invalide.');
  const command = await env.DB.prepare(`SELECT * FROM device_commands WHERE command_id=?`).bind(commandIdValue).first();
  if (!command) return fail(utilities.json, 'IOT_COMMAND_NOT_FOUND', 'Commande introuvable.', 404);
  let status = outcome;
  if (outcome === 'timeout') {
    await env.DB.batch([
      env.DB.prepare(`UPDATE device_commands SET status='expired',failed_at=CURRENT_TIMESTAMP,failure_reason='TIMEOUT',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status IN ('sent','acknowledged')`).bind(command.id),
      env.DB.prepare(`UPDATE rides SET status='cancelled',ended_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='reserved'`).bind(command.ride_id),
      env.DB.prepare(`UPDATE bikes SET status='available',updated_at=CURRENT_TIMESTAMP WHERE id=(SELECT bike_id FROM rides WHERE id=?) AND status='reserved'`).bind(command.ride_id)
    ]);
    status = 'expired';
  } else if (outcome === 'offline' || outcome === 'low_battery') {
    await env.DB.prepare(`UPDATE devices SET connectivity_status=?,battery_level=CASE WHEN ?='low_battery' THEN 5 ELSE battery_level END,last_seen_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(outcome === 'offline' ? 'offline' : 'online', outcome, command.device_id).run();
  } else {
    const previous = outcome === 'duplicate' ? await env.DB.prepare(`SELECT provider_event_id,result_status FROM device_command_results WHERE command_id=? ORDER BY id DESC LIMIT 1`).bind(command.id).first() : null;
    if (outcome === 'duplicate' && !previous) return fail(utilities.json, 'IOT_RESULT_NOT_FOUND', 'Aucun accuse a rejouer.', 409);
    const resultStatus = previous?.result_status || outcome, eventId = previous?.provider_event_id || `sim_${crypto.randomUUID().replaceAll('-', '')}`;
    await applyCommandResult(env.DB, command, resultStatus, { providerEventId: eventId, payload: { simulated: true }, reason: resultStatus === 'failed' ? 'SIMULATED_FAILURE' : null });
    status = resultStatus;
  }
  await audit(env.DB, actor, utilities, 'device.simulate', command.device_id, { commandId: command.command_id, outcome });
  return utilities.json({ success: true, status });
}

export async function handleIotAdminApi(request, env, actor, utilities) {
  const url = new URL(request.url), path = url.pathname;
  if (path === '/api/admin/iot/devices' && request.method === 'POST') return createDevice(request, env, actor, utilities);
  const match = path.match(/^\/api\/admin\/iot\/devices\/([1-9][0-9]*)\/credentials$/);
  if (match && request.method === 'POST') return provisionCredential(request, env, actor, utilities, Number(match[1]));
  if (path === '/api/admin/iot/simulate' && request.method === 'POST') return simulate(request, env, actor, utilities);
  if (path === '/api/admin/iot/commands' && request.method === 'GET') {
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1), limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 25));
    const status = String(url.searchParams.get('status') || ''), offset = (page - 1) * limit;
    const [rows, count] = await env.DB.batch([
      env.DB.prepare(`SELECT c.*,d.public_code device_code FROM device_commands c JOIN devices d ON d.id=c.device_id WHERE (?='' OR c.status=?) ORDER BY c.id DESC LIMIT ? OFFSET ?`).bind(status, status, limit, offset),
      env.DB.prepare(`SELECT COUNT(*) count FROM device_commands WHERE (?='' OR status=?)`).bind(status, status)
    ]);
    const total = Number(count.results?.[0]?.count || 0);
    return utilities.json({ items: rows.results || [], pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } });
  }
  return null;
}
