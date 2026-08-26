-- Hardware-neutral IoT core. Additive: legacy devices remain valid.
ALTER TABLE devices ADD COLUMN hardware_id TEXT;
ALTER TABLE devices ADD COLUMN hardware_type TEXT NOT NULL DEFAULT 'other'
  CHECK (hardware_type IN ('bike_lock','bike_controller','dock','station_controller','tracker','other'));
ALTER TABLE devices ADD COLUMN provider TEXT NOT NULL DEFAULT 'unconfigured';
ALTER TABLE devices ADD COLUMN connectivity_status TEXT NOT NULL DEFAULT 'unknown'
  CHECK (connectivity_status IN ('unknown','online','offline','degraded'));
ALTER TABLE devices ADD COLUMN battery_level INTEGER CHECK (battery_level IS NULL OR battery_level BETWEEN 0 AND 100);
ALTER TABLE devices ADD COLUMN commissioned_at TEXT;
ALTER TABLE devices ADD COLUMN retired_at TEXT;
ALTER TABLE devices ADD COLUMN credential_version INTEGER NOT NULL DEFAULT 0 CHECK (credential_version >= 0);

UPDATE devices SET
  hardware_type=CASE device_type
    WHEN 'bike_lock' THEN 'bike_lock'
    WHEN 'dock_controller' THEN 'dock'
    WHEN 'station_gateway' THEN 'station_controller'
    ELSE 'other'
  END,
  provider=CASE WHEN provider='unconfigured' THEN 'legacy' ELSE provider END,
  connectivity_status=CASE status WHEN 'online' THEN 'online' WHEN 'offline' THEN 'offline' ELSE connectivity_status END;

CREATE UNIQUE INDEX idx_devices_hardware_provider ON devices(provider,hardware_id) WHERE hardware_id IS NOT NULL;
CREATE INDEX idx_devices_connectivity_seen ON devices(connectivity_status,last_seen_at);

CREATE TABLE device_credentials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id INTEGER NOT NULL,
  key_id TEXT NOT NULL UNIQUE,
  secret_hash TEXT NOT NULL CHECK (length(secret_hash) >= 43),
  secret_ciphertext TEXT NOT NULL,
  secret_iv TEXT NOT NULL,
  algorithm TEXT NOT NULL DEFAULT 'HMAC-SHA256' CHECK (algorithm IN ('HMAC-SHA256')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','rotated','revoked')),
  valid_from TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT,
  rotated_at TEXT,
  revoked_at TEXT,
  created_by_user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CHECK (expires_at IS NULL OR expires_at > valid_from)
);

CREATE TABLE device_commands (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  command_id TEXT NOT NULL UNIQUE,
  device_id INTEGER NOT NULL,
  command_type TEXT NOT NULL CHECK (command_type IN ('unlock','lock','ping','status','locate','reboot','firmware')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','acknowledged','completed','failed','expired','cancelled')),
  payload_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(payload_json) AND json_type(payload_json)='object'),
  idempotency_key TEXT NOT NULL UNIQUE,
  correlation_id TEXT NOT NULL,
  requested_by_user_id INTEGER,
  ride_id INTEGER,
  expires_at TEXT NOT NULL,
  sent_at TEXT,
  acknowledged_at TEXT,
  completed_at TEXT,
  failed_at TEXT,
  failure_reason TEXT CHECK (failure_reason IS NULL OR length(failure_reason) <= 500),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE RESTRICT,
  FOREIGN KEY (requested_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (ride_id) REFERENCES rides(id) ON DELETE SET NULL,
  CHECK (expires_at > created_at)
);

CREATE TABLE device_command_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  command_id INTEGER NOT NULL,
  provider_event_id TEXT NOT NULL,
  result_status TEXT NOT NULL CHECK (result_status IN ('acknowledged','completed','failed')),
  result_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(result_json) AND json_type(result_json)='object'),
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (command_id,provider_event_id),
  FOREIGN KEY (command_id) REFERENCES device_commands(id) ON DELETE CASCADE
);

CREATE TABLE device_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id INTEGER NOT NULL,
  provider_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (length(trim(event_type)) BETWEEN 2 AND 80),
  event_timestamp TEXT NOT NULL,
  nonce TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(payload_json) AND json_type(payload_json)='object'),
  signature_valid INTEGER NOT NULL CHECK (signature_valid IN (0,1)),
  processing_status TEXT NOT NULL DEFAULT 'received' CHECK (processing_status IN ('received','processed','ignored','rejected')),
  error_code TEXT,
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TEXT,
  UNIQUE (device_id,provider_event_id),
  UNIQUE (device_id,nonce),
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

CREATE TABLE device_telemetry (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id INTEGER NOT NULL,
  event_id INTEGER,
  recorded_at TEXT NOT NULL,
  connectivity_status TEXT CHECK (connectivity_status IN ('unknown','online','offline','degraded')),
  battery_level INTEGER CHECK (battery_level IS NULL OR battery_level BETWEEN 0 AND 100),
  latitude REAL CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  longitude REAL CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  lock_status TEXT CHECK (lock_status IS NULL OR lock_status IN ('unknown','locked','unlocked','jammed','offline')),
  metrics_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metrics_json) AND json_type(metrics_json)='object'),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES device_events(id) ON DELETE SET NULL
);

CREATE TABLE device_rate_limits (
  device_id INTEGER NOT NULL,
  window_start INTEGER NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  PRIMARY KEY (device_id,window_start),
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

CREATE INDEX idx_device_credentials_device_status ON device_credentials(device_id,status,expires_at);
CREATE INDEX idx_device_commands_device_status ON device_commands(device_id,status,created_at);
CREATE INDEX idx_device_commands_expiry ON device_commands(status,expires_at);
CREATE INDEX idx_device_events_device_time ON device_events(device_id,event_timestamp);
CREATE INDEX idx_device_telemetry_device_time ON device_telemetry(device_id,recorded_at DESC);

CREATE TRIGGER guard_device_assignment_insert BEFORE INSERT ON devices
WHEN (NEW.bike_id IS NOT NULL) + (NEW.dock_id IS NOT NULL) + (NEW.station_id IS NOT NULL) <> 1
BEGIN SELECT RAISE(ABORT,'device must have exactly one assignment'); END;

CREATE TRIGGER guard_device_assignment_update BEFORE UPDATE OF bike_id,dock_id,station_id ON devices
WHEN (NEW.bike_id IS NOT NULL) + (NEW.dock_id IS NOT NULL) + (NEW.station_id IS NOT NULL) <> 1
BEGIN SELECT RAISE(ABORT,'device must have exactly one assignment'); END;

CREATE TRIGGER guard_device_command_transition BEFORE UPDATE OF status ON device_commands
WHEN NOT (
  OLD.status='queued' AND NEW.status IN ('sent','cancelled','expired','failed') OR
  OLD.status='sent' AND NEW.status IN ('acknowledged','completed','failed','expired') OR
  OLD.status='acknowledged' AND NEW.status IN ('completed','failed','expired') OR
  OLD.status=NEW.status
)
BEGIN SELECT RAISE(ABORT,'invalid device command transition'); END;

CREATE TRIGGER guard_device_events_payload_immutable BEFORE UPDATE ON device_events
WHEN NEW.device_id<>OLD.device_id OR NEW.provider_event_id<>OLD.provider_event_id OR NEW.event_type<>OLD.event_type
  OR NEW.event_timestamp<>OLD.event_timestamp OR NEW.nonce<>OLD.nonce OR NEW.payload_json<>OLD.payload_json
  OR NEW.signature_valid<>OLD.signature_valid OR NEW.received_at<>OLD.received_at
BEGIN SELECT RAISE(ABORT,'device event payload is immutable'); END;
CREATE TRIGGER guard_device_events_immutable_delete BEFORE DELETE ON device_events BEGIN SELECT RAISE(ABORT,'device events are immutable'); END;
CREATE TRIGGER guard_device_results_immutable_update BEFORE UPDATE ON device_command_results BEGIN SELECT RAISE(ABORT,'device command results are immutable'); END;
CREATE TRIGGER guard_device_results_immutable_delete BEFORE DELETE ON device_command_results BEGIN SELECT RAISE(ABORT,'device command results are immutable'); END;
