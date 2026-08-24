-- Pikala V2 administration operations. Additive: no existing row is deleted.

ALTER TABLE users ADD COLUMN status_reason TEXT;
ALTER TABLE stations ADD COLUMN opening_hours_json TEXT NOT NULL DEFAULT '{}'
  CHECK (json_valid(opening_hours_json) AND json_type(opening_hours_json) = 'object');
ALTER TABLE support_tickets ADD COLUMN resolution_notes TEXT;

CREATE TABLE maintenance_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bike_id INTEGER NOT NULL,
  incident_id INTEGER,
  opened_by_user_id INTEGER,
  assigned_to_user_id INTEGER,
  resolved_by_user_id INTEGER,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'resolved', 'cancelled')),
  reason TEXT NOT NULL,
  resolution_notes TEXT,
  opened_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at TEXT,
  resolved_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bike_id) REFERENCES bikes(id) ON DELETE RESTRICT,
  FOREIGN KEY (incident_id) REFERENCES bike_incidents(id) ON DELETE SET NULL,
  FOREIGN KEY (opened_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_to_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (resolved_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL CHECK (json_valid(value_json)),
  description TEXT,
  updated_by_user_id INTEGER,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_maintenance_status_updated ON maintenance_records(status, updated_at);
CREATE INDEX idx_maintenance_bike_updated ON maintenance_records(bike_id, updated_at);
CREATE INDEX idx_users_created ON users(created_at);
CREATE INDEX idx_users_last_login ON users(last_login_at);
CREATE INDEX idx_stations_updated ON stations(updated_at);
CREATE INDEX idx_bikes_updated ON bikes(updated_at);
CREATE INDEX idx_support_updated ON support_tickets(updated_at);
CREATE INDEX idx_audit_created ON admin_audit_logs(created_at);

CREATE TRIGGER guard_maintenance_bike_insert BEFORE INSERT ON maintenance_records
WHEN EXISTS (SELECT 1 FROM bikes WHERE id = NEW.bike_id AND status = 'in_use')
BEGIN SELECT RAISE(ABORT, 'bike in use cannot enter maintenance'); END;

INSERT OR IGNORE INTO app_settings (key, value_json, description)
VALUES
  ('service_status', json_object('mode', 'operational', 'message', ''), 'Etat public du service Pikala.'),
  ('support_contact', json_object('email', '', 'phone', ''), 'Coordonnees de support affichees aux utilisateurs.'),
  ('ride_monitoring', json_object('longRideMinutes', 180), 'Seuil de detection des trajets actifs anormalement longs.');

PRAGMA optimize;
