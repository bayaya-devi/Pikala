-- Pikala Control Center. Additive only: no production row is removed.

CREATE TABLE employee_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  employee_code TEXT NOT NULL UNIQUE,
  job_role TEXT NOT NULL CHECK (job_role IN ('operator','technician','support','supervisor','finance','administrator')),
  team_name TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','suspended')),
  availability TEXT NOT NULL DEFAULT 'available' CHECK (availability IN ('available','busy','off_duty')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE TABLE inspections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_code TEXT NOT NULL UNIQUE,
  inspection_type TEXT NOT NULL CHECK (inspection_type IN ('bike','station','dock','safety')),
  bike_id INTEGER,
  station_id INTEGER,
  dock_id INTEGER,
  inspector_user_id INTEGER,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','in_progress','passed','failed','cancelled')),
  outcome TEXT,
  checklist_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(checklist_json)),
  notes TEXT,
  due_at TEXT,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bike_id) REFERENCES bikes(id) ON DELETE SET NULL,
  FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE SET NULL,
  FOREIGN KEY (dock_id) REFERENCES docks(id) ON DELETE SET NULL,
  FOREIGN KEY (inspector_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CHECK (bike_id IS NOT NULL OR station_id IS NOT NULL OR dock_id IS NOT NULL)
);

CREATE TABLE missions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_code TEXT NOT NULL UNIQUE,
  mission_type TEXT NOT NULL CHECK (mission_type IN ('inspection','maintenance','rebalancing','intervention','recovery')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created','assigned','accepted','in_progress','completed','cancelled','failed')),
  assigned_to_user_id INTEGER,
  source_station_id INTEGER,
  destination_station_id INTEGER,
  related_inspection_id INTEGER,
  related_maintenance_id INTEGER,
  title TEXT NOT NULL,
  description TEXT,
  due_at TEXT,
  accepted_at TEXT,
  started_at TEXT,
  completed_at TEXT,
  created_by_user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (assigned_to_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (source_station_id) REFERENCES stations(id) ON DELETE SET NULL,
  FOREIGN KEY (destination_station_id) REFERENCES stations(id) ON DELETE SET NULL,
  FOREIGN KEY (related_inspection_id) REFERENCES inspections(id) ON DELETE SET NULL,
  FOREIGN KEY (related_maintenance_id) REFERENCES maintenance_records(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE TABLE mission_bikes (
  mission_id INTEGER NOT NULL,
  bike_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (mission_id, bike_id),
  FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE CASCADE,
  FOREIGN KEY (bike_id) REFERENCES bikes(id) ON DELETE RESTRICT
);

CREATE TABLE rebalancing_recommendations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_station_id INTEGER NOT NULL,
  destination_station_id INTEGER NOT NULL,
  suggested_bikes INTEGER NOT NULL CHECK (suggested_bikes BETWEEN 1 AND 100),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','accepted','dismissed','completed','expired')),
  reason TEXT NOT NULL,
  mission_id INTEGER,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_station_id) REFERENCES stations(id) ON DELETE CASCADE,
  FOREIGN KEY (destination_station_id) REFERENCES stations(id) ON DELETE CASCADE,
  FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE SET NULL,
  CHECK (source_station_id <> destination_station_id)
);

CREATE TABLE automation_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('station_low','station_full','long_ride','maintenance_due','device_offline','incident_recurrence','ticket_urgent','mission_overdue')),
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0,1)),
  severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info','warning','critical')),
  config_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(config_json) AND json_type(config_json) = 'object'),
  last_run_at TEXT,
  created_by_user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE TABLE network_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info','warning','critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved','dismissed')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  dedupe_key TEXT,
  detected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  acknowledged_by_user_id INTEGER,
  acknowledged_at TEXT,
  resolved_at TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json)),
  FOREIGN KEY (acknowledged_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_code TEXT NOT NULL UNIQUE,
  device_type TEXT NOT NULL CHECK (device_type IN ('bike_lock','dock_controller','station_gateway','sensor')),
  bike_id INTEGER,
  dock_id INTEGER,
  station_id INTEGER,
  status TEXT NOT NULL DEFAULT 'provisioning' CHECK (status IN ('provisioning','online','offline','maintenance','disabled')),
  firmware_version TEXT,
  last_seen_at TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bike_id) REFERENCES bikes(id) ON DELETE SET NULL,
  FOREIGN KEY (dock_id) REFERENCES docks(id) ON DELETE SET NULL,
  FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE SET NULL,
  CHECK (bike_id IS NOT NULL OR dock_id IS NOT NULL OR station_id IS NOT NULL)
);

CREATE TABLE admin_overrides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_user_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 10 AND 500),
  idempotency_key TEXT NOT NULL UNIQUE,
  outcome TEXT NOT NULL CHECK (outcome IN ('applied','rejected','failed')),
  request_id TEXT,
  details_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(details_json)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE TABLE manual_entitlements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  benefit_type TEXT NOT NULL CHECK (benefit_type IN ('ride_access','subscription_extension','service_credit')),
  plan_id INTEGER,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','revoked')),
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 10 AND 500),
  granted_by_user_id INTEGER NOT NULL,
  revoked_by_user_id INTEGER,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE SET NULL,
  FOREIGN KEY (granted_by_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (revoked_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CHECK (ends_at > starts_at)
);

CREATE INDEX idx_employee_status_role ON employee_profiles(status, job_role, availability);
CREATE INDEX idx_inspections_status_due ON inspections(status, due_at);
CREATE INDEX idx_missions_status_due ON missions(status, due_at, priority);
CREATE INDEX idx_missions_assignee_status ON missions(assigned_to_user_id, status);
CREATE INDEX idx_rebalancing_status_priority ON rebalancing_recommendations(status, priority, created_at);
CREATE INDEX idx_rules_enabled_type ON automation_rules(enabled, rule_type);
CREATE INDEX idx_alerts_status_severity ON network_alerts(status, severity, detected_at);
CREATE UNIQUE INDEX idx_alerts_open_dedupe ON network_alerts(dedupe_key) WHERE dedupe_key IS NOT NULL AND status IN ('open','acknowledged');
CREATE INDEX idx_devices_status_seen ON devices(status, last_seen_at);
CREATE INDEX idx_overrides_target ON admin_overrides(target_type, target_id, created_at);
CREATE INDEX idx_entitlements_user_status ON manual_entitlements(user_id, status, starts_at, ends_at);

CREATE TRIGGER guard_overrides_no_update BEFORE UPDATE ON admin_overrides
BEGIN SELECT RAISE(ABORT, 'admin overrides are append-only'); END;
CREATE TRIGGER guard_overrides_no_delete BEFORE DELETE ON admin_overrides
BEGIN SELECT RAISE(ABORT, 'admin overrides are append-only'); END;

CREATE TRIGGER touch_employee_profiles AFTER UPDATE ON employee_profiles
WHEN NEW.updated_at IS OLD.updated_at BEGIN UPDATE employee_profiles SET updated_at=CURRENT_TIMESTAMP WHERE id=NEW.id; END;
CREATE TRIGGER touch_inspections AFTER UPDATE ON inspections
WHEN NEW.updated_at IS OLD.updated_at BEGIN UPDATE inspections SET updated_at=CURRENT_TIMESTAMP WHERE id=NEW.id; END;
CREATE TRIGGER touch_missions AFTER UPDATE ON missions
WHEN NEW.updated_at IS OLD.updated_at BEGIN UPDATE missions SET updated_at=CURRENT_TIMESTAMP WHERE id=NEW.id; END;
CREATE TRIGGER touch_devices AFTER UPDATE ON devices
WHEN NEW.updated_at IS OLD.updated_at BEGIN UPDATE devices SET updated_at=CURRENT_TIMESTAMP WHERE id=NEW.id; END;
CREATE TRIGGER touch_entitlements AFTER UPDATE ON manual_entitlements
WHEN NEW.updated_at IS OLD.updated_at BEGIN UPDATE manual_entitlements SET updated_at=CURRENT_TIMESTAMP WHERE id=NEW.id; END;

INSERT OR IGNORE INTO app_settings (key, value_json, description)
VALUES ('control_center', json_object('stationLowBikes',2,'stationFullDocks',0,'deviceOfflineMinutes',15,'maintenanceOverdueHours',72,'missionOverdueMinutes',30), 'Seuils opérationnels du Pikala Control Center.');

PRAGMA optimize;
