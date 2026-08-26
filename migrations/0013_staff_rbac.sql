-- Pikala staff RBAC. Additive only: no existing row is removed.

CREATE TABLE staff_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  employee_code TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('super_admin','admin','operations_manager','station_manager','technician','field_agent','support_agent','finance','analyst')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','inactive')),
  hire_date TEXT,
  last_activity_at TEXT,
  created_by_user_id INTEGER,
  updated_by_user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE staff_zones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT 'Rabat',
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE staff_member_zones (
  staff_member_id INTEGER NOT NULL,
  zone_id INTEGER NOT NULL,
  assigned_by_user_id INTEGER,
  assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (staff_member_id, zone_id),
  FOREIGN KEY (staff_member_id) REFERENCES staff_members(id) ON DELETE CASCADE,
  FOREIGN KEY (zone_id) REFERENCES staff_zones(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE staff_role_permissions (
  role TEXT NOT NULL,
  permission TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (role, permission),
  CHECK (role IN ('super_admin','admin','operations_manager','station_manager','technician','field_agent','support_agent','finance','analyst')),
  CHECK (permission='*' OR length(permission) BETWEEN 3 AND 80)
);

CREATE TABLE staff_permission_overrides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  staff_member_id INTEGER NOT NULL,
  permission TEXT NOT NULL,
  effect TEXT NOT NULL CHECK (effect IN ('grant','deny')),
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 10 AND 500),
  granted_by_user_id INTEGER NOT NULL,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TEXT,
  revoked_by_user_id INTEGER,
  UNIQUE (staff_member_id, permission, effect, revoked_at),
  FOREIGN KEY (staff_member_id) REFERENCES staff_members(id) ON DELETE CASCADE,
  FOREIGN KEY (granted_by_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (revoked_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE staff_activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  staff_member_id INTEGER NOT NULL,
  actor_user_id INTEGER,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  outcome TEXT NOT NULL DEFAULT 'success' CHECK (outcome IN ('success','denied','failure')),
  request_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (staff_member_id) REFERENCES staff_members(id) ON DELETE RESTRICT,
  FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_staff_role_status ON staff_members(role, status, last_activity_at);
CREATE INDEX idx_staff_zones_member ON staff_member_zones(staff_member_id, zone_id);
CREATE INDEX idx_staff_overrides_active ON staff_permission_overrides(staff_member_id, permission, revoked_at, expires_at);
CREATE UNIQUE INDEX idx_staff_override_one_active ON staff_permission_overrides(staff_member_id, permission, effect) WHERE revoked_at IS NULL;
CREATE INDEX idx_staff_activity_member_date ON staff_activity_logs(staff_member_id, created_at);

CREATE TRIGGER touch_staff_members AFTER UPDATE ON staff_members
WHEN NEW.updated_at IS OLD.updated_at BEGIN UPDATE staff_members SET updated_at=CURRENT_TIMESTAMP WHERE id=NEW.id; END;
CREATE TRIGGER touch_staff_zones AFTER UPDATE ON staff_zones
WHEN NEW.updated_at IS OLD.updated_at BEGIN UPDATE staff_zones SET updated_at=CURRENT_TIMESTAMP WHERE id=NEW.id; END;
CREATE TRIGGER guard_staff_activity_no_update BEFORE UPDATE ON staff_activity_logs
BEGIN SELECT RAISE(ABORT, 'staff activity logs are append-only'); END;
CREATE TRIGGER guard_staff_activity_no_delete BEFORE DELETE ON staff_activity_logs
BEGIN SELECT RAISE(ABORT, 'staff activity logs are append-only'); END;

INSERT OR IGNORE INTO staff_zones (code,name,city) VALUES ('RABAT','Rabat','Rabat');

INSERT OR IGNORE INTO staff_members (user_id,employee_code,role,status,hire_date)
SELECT users.id,'LEGACY-'||printf('%05d',users.id),
  CASE users.role WHEN 'super_admin' THEN 'super_admin' ELSE 'admin' END,
  CASE users.status WHEN 'active' THEN 'active' ELSE 'suspended' END,
  substr(users.created_at,1,10)
FROM users WHERE users.role IN ('admin','super_admin');

INSERT OR IGNORE INTO staff_members (user_id,employee_code,role,status,hire_date)
SELECT employee_profiles.user_id,employee_profiles.employee_code,
  CASE employee_profiles.job_role
    WHEN 'administrator' THEN 'admin' WHEN 'finance' THEN 'finance'
    WHEN 'technician' THEN 'technician' WHEN 'support' THEN 'support_agent'
    WHEN 'supervisor' THEN 'operations_manager' ELSE 'field_agent' END,
  CASE employee_profiles.status WHEN 'active' THEN 'active' ELSE 'suspended' END,
  substr(employee_profiles.created_at,1,10)
FROM employee_profiles;

INSERT OR IGNORE INTO staff_member_zones (staff_member_id,zone_id)
SELECT staff_members.id,staff_zones.id FROM staff_members CROSS JOIN staff_zones WHERE staff_zones.code='RABAT';

INSERT INTO staff_role_permissions (role,permission) VALUES
('super_admin','*'),('super_admin','employees.manage_roles'),
('admin','staff.access'),('admin','dashboard.view'),('admin','users.read_full'),('admin','users.manage'),('admin','employees.read'),('admin','employees.manage'),('admin','employees.assign_roles'),
('admin','stations.read'),('admin','stations.manage'),('admin','docks.read'),('admin','docks.manage'),('admin','bikes.read'),('admin','bikes.manage'),('admin','bikes.move'),
('admin','rides.read'),('admin','rides.force_end'),('admin','incidents.read'),('admin','incidents.manage'),('admin','maintenance.read'),('admin','maintenance.manage'),
('admin','inspections.read'),('admin','inspections.manage'),('admin','missions.read'),('admin','missions.manage'),('admin','rebalancing.read'),('admin','rebalancing.manage'),
('admin','plans.read'),('admin','plans.manage'),('admin','subscriptions.read'),('admin','subscriptions.manage'),('admin','payments.read'),('admin','support.read'),('admin','support.manage'),
('admin','notifications.read'),('admin','notifications.send'),('admin','automations.read'),('admin','automations.manage'),('admin','devices.read'),('admin','devices.manage'),
('admin','alerts.read'),('admin','alerts.manage'),('admin','audit.read'),('admin','settings.read'),('admin','settings.manage'),('admin','analytics.read'),('admin','service.override'),('admin','entitlements.manage'),
('operations_manager','staff.access'),('operations_manager','dashboard.view'),('operations_manager','users.read_limited'),('operations_manager','employees.read'),
('operations_manager','stations.read'),('operations_manager','stations.manage'),('operations_manager','docks.read'),('operations_manager','docks.manage'),
('operations_manager','bikes.read'),('operations_manager','bikes.manage'),('operations_manager','bikes.move'),('operations_manager','rides.read'),('operations_manager','rides.force_end'),
('operations_manager','incidents.read'),('operations_manager','incidents.manage'),('operations_manager','maintenance.read'),('operations_manager','maintenance.manage'),
('operations_manager','inspections.read'),('operations_manager','inspections.manage'),('operations_manager','missions.read'),('operations_manager','missions.manage'),
('operations_manager','rebalancing.read'),('operations_manager','rebalancing.manage'),('operations_manager','support.read'),('operations_manager','notifications.read'),
('operations_manager','notifications.send'),('operations_manager','devices.read'),('operations_manager','alerts.read'),('operations_manager','alerts.manage'),('operations_manager','analytics.read'),
('station_manager','staff.access'),('station_manager','dashboard.view'),('station_manager','stations.read'),('station_manager','stations.manage'),('station_manager','docks.read'),('station_manager','docks.manage'),
('station_manager','bikes.read'),('station_manager','bikes.move'),('station_manager','incidents.read'),('station_manager','inspections.read'),('station_manager','inspections.manage'),
('station_manager','missions.read'),('station_manager','missions.manage_assigned'),('station_manager','rebalancing.read'),('station_manager','rebalancing.manage'),('station_manager','analytics.read'),
('technician','staff.access'),('technician','dashboard.view'),('technician','bikes.read'),('technician','incidents.read'),('technician','incidents.manage'),
('technician','maintenance.read'),('technician','maintenance.manage'),('technician','inspections.read'),('technician','inspections.manage'),('technician','missions.read_assigned'),('technician','missions.manage_assigned'),
('field_agent','staff.access'),('field_agent','dashboard.view'),('field_agent','stations.read'),('field_agent','docks.read'),('field_agent','bikes.read'),('field_agent','bikes.move'),
('field_agent','missions.read_assigned'),('field_agent','missions.manage_assigned'),('field_agent','rebalancing.read'),
('support_agent','staff.access'),('support_agent','dashboard.view'),('support_agent','users.read_limited'),('support_agent','rides.read'),('support_agent','support.read'),('support_agent','support.manage'),
('finance','staff.access'),('finance','dashboard.view'),('finance','users.read_limited'),('finance','plans.read'),('finance','subscriptions.read'),('finance','subscriptions.manage'),
('finance','payments.read'),('finance','payments.refund'),('finance','invoices.read'),('finance','analytics.read'),
('analyst','staff.access'),('analyst','dashboard.view'),('analyst','analytics.read'),('analyst','stations.read'),('analyst','bikes.read'),('analyst','rides.read'),
('analyst','incidents.read'),('analyst','maintenance.read'),('analyst','subscriptions.read'),('analyst','payments.read');
