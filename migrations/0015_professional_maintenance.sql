-- Professional workshop, inspections and preventive maintenance.
-- Additive only: legacy maintenance data remains readable and unchanged.

ALTER TABLE maintenance_records ADD COLUMN process_version INTEGER NOT NULL DEFAULT 1 CHECK (process_version IN (1,2));
ALTER TABLE maintenance_records ADD COLUMN workshop_stage TEXT NOT NULL DEFAULT 'inspection_required'
  CHECK (workshop_stage IN ('reported','inspection_required','diagnosed','maintenance','testing','repaired','available'));
ALTER TABLE maintenance_records ADD COLUMN priority TEXT NOT NULL DEFAULT 'normal'
  CHECK (priority IN ('low','normal','high','urgent'));
ALTER TABLE maintenance_records ADD COLUMN problem_text TEXT;
ALTER TABLE maintenance_records ADD COLUMN diagnosis_text TEXT;
ALTER TABLE maintenance_records ADD COLUMN work_notes TEXT;
ALTER TABLE maintenance_records ADD COLUMN test_result TEXT CHECK (test_result IS NULL OR test_result IN ('passed','failed'));
ALTER TABLE maintenance_records ADD COLUMN test_notes TEXT;
ALTER TABLE maintenance_records ADD COLUMN labor_minutes INTEGER NOT NULL DEFAULT 0 CHECK (labor_minutes >= 0);
ALTER TABLE maintenance_records ADD COLUMN labor_cost_minor INTEGER NOT NULL DEFAULT 0 CHECK (labor_cost_minor >= 0);
ALTER TABLE maintenance_records ADD COLUMN parts_cost_minor INTEGER NOT NULL DEFAULT 0 CHECK (parts_cost_minor >= 0);
ALTER TABLE maintenance_records ADD COLUMN total_cost_minor INTEGER NOT NULL DEFAULT 0 CHECK (total_cost_minor >= 0);
ALTER TABLE maintenance_records ADD COLUMN return_to_service_validated_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE maintenance_records ADD COLUMN return_to_service_validated_at TEXT;
ALTER TABLE maintenance_records ADD COLUMN mileage_at_open INTEGER CHECK (mileage_at_open IS NULL OR mileage_at_open >= 0);
ALTER TABLE maintenance_records ADD COLUMN rides_at_open INTEGER CHECK (rides_at_open IS NULL OR rides_at_open >= 0);

UPDATE maintenance_records SET workshop_stage=CASE workflow_stage
  WHEN 'reported' THEN 'reported' WHEN 'to_inspect' THEN 'inspection_required'
  WHEN 'maintenance' THEN 'maintenance' WHEN 'repaired' THEN 'repaired'
  WHEN 'available' THEN 'available' ELSE 'inspection_required' END;

ALTER TABLE inspections ADD COLUMN health_score INTEGER CHECK (health_score IS NULL OR health_score BETWEEN 0 AND 100);
ALTER TABLE inspections ADD COLUMN odometer_meters INTEGER CHECK (odometer_meters IS NULL OR odometer_meters >= 0);
ALTER TABLE inspections ADD COLUMN ride_count INTEGER CHECK (ride_count IS NULL OR ride_count >= 0);
ALTER TABLE inspections ADD COLUMN maintenance_id INTEGER REFERENCES maintenance_records(id) ON DELETE SET NULL;

CREATE TABLE maintenance_parts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reference TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 120),
  category TEXT NOT NULL CHECK (length(trim(category)) BETWEEN 2 AND 80),
  unit_cost_minor INTEGER NOT NULL DEFAULT 0 CHECK (unit_cost_minor >= 0),
  stock_quantity INTEGER CHECK (stock_quantity IS NULL OR stock_quantity >= 0),
  supplier TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE maintenance_part_usages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  maintenance_id INTEGER NOT NULL,
  part_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 1000),
  unit_cost_minor_snapshot INTEGER NOT NULL CHECK (unit_cost_minor_snapshot >= 0),
  consumed_by_user_id INTEGER,
  consumed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (maintenance_id) REFERENCES maintenance_records(id) ON DELETE RESTRICT,
  FOREIGN KEY (part_id) REFERENCES maintenance_parts(id) ON DELETE RESTRICT,
  FOREIGN KEY (consumed_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE inspection_check_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inspection_id INTEGER NOT NULL,
  item_code TEXT NOT NULL CHECK (item_code IN ('brakes','tires','wheels','chain','saddle','lighting','frame','qr','lock','electronics')),
  result TEXT NOT NULL CHECK (result IN ('pass','watch','fail','not_applicable')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (inspection_id,item_code),
  FOREIGN KEY (inspection_id) REFERENCES inspections(id) ON DELETE CASCADE
);

CREATE TABLE maintenance_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  maintenance_id INTEGER NOT NULL,
  author_user_id INTEGER,
  body TEXT NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 2000),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (maintenance_id) REFERENCES maintenance_records(id) ON DELETE CASCADE,
  FOREIGN KEY (author_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE maintenance_schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bike_id INTEGER NOT NULL UNIQUE,
  interval_days INTEGER CHECK (interval_days IS NULL OR interval_days BETWEEN 1 AND 730),
  interval_meters INTEGER CHECK (interval_meters IS NULL OR interval_meters BETWEEN 1000 AND 1000000),
  interval_rides INTEGER CHECK (interval_rides IS NULL OR interval_rides BETWEEN 1 AND 10000),
  incident_threshold INTEGER CHECK (incident_threshold IS NULL OR incident_threshold BETWEEN 1 AND 100),
  last_inspected_at TEXT,
  last_inspected_odometer INTEGER NOT NULL DEFAULT 0 CHECK (last_inspected_odometer >= 0),
  last_inspected_rides INTEGER NOT NULL DEFAULT 0 CHECK (last_inspected_rides >= 0),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bike_id) REFERENCES bikes(id) ON DELETE CASCADE,
  CHECK (interval_days IS NOT NULL OR interval_meters IS NOT NULL OR interval_rides IS NOT NULL OR incident_threshold IS NOT NULL)
);

CREATE TABLE maintenance_reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bike_id INTEGER NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('time','mileage','rides','incidents')),
  status TEXT NOT NULL DEFAULT 'due' CHECK (status IN ('due','acknowledged','completed','dismissed')),
  dedupe_key TEXT NOT NULL UNIQUE,
  reason TEXT NOT NULL,
  due_at TEXT,
  detected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  acknowledged_by_user_id INTEGER,
  completed_at TEXT,
  FOREIGN KEY (bike_id) REFERENCES bikes(id) ON DELETE CASCADE,
  FOREIGN KEY (acknowledged_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_workshop_stage_priority ON maintenance_records(workshop_stage,priority,updated_at);
CREATE INDEX idx_workshop_assignee_stage ON maintenance_records(assigned_to_user_id,workshop_stage,updated_at);
CREATE INDEX idx_parts_category_active ON maintenance_parts(category,is_active,name);
CREATE INDEX idx_part_usage_maintenance ON maintenance_part_usages(maintenance_id,consumed_at);
CREATE INDEX idx_inspection_items_inspection ON inspection_check_items(inspection_id,item_code);
CREATE INDEX idx_maintenance_comments_record ON maintenance_comments(maintenance_id,created_at);
CREATE INDEX idx_reminders_status_date ON maintenance_reminders(status,detected_at);

CREATE TRIGGER guard_professional_workflow_update BEFORE UPDATE OF workshop_stage ON maintenance_records
WHEN OLD.process_version=2 AND NEW.workshop_stage<>OLD.workshop_stage AND NOT (
  (OLD.workshop_stage='reported' AND NEW.workshop_stage='inspection_required') OR
  (OLD.workshop_stage='inspection_required' AND NEW.workshop_stage='diagnosed') OR
  (OLD.workshop_stage='diagnosed' AND NEW.workshop_stage='maintenance') OR
  (OLD.workshop_stage='maintenance' AND NEW.workshop_stage='testing') OR
  (OLD.workshop_stage='testing' AND NEW.workshop_stage='repaired') OR
  (OLD.workshop_stage='repaired' AND NEW.workshop_stage='available'))
BEGIN SELECT RAISE(ABORT,'invalid professional maintenance transition'); END;

CREATE TRIGGER guard_professional_workflow_insert BEFORE INSERT ON maintenance_records
WHEN NEW.process_version=2 AND NEW.workshop_stage NOT IN ('reported','inspection_required')
BEGIN SELECT RAISE(ABORT,'invalid professional maintenance initial stage'); END;

CREATE TRIGGER guard_professional_return_to_service BEFORE UPDATE OF workshop_stage ON maintenance_records
WHEN OLD.process_version=2 AND NEW.workshop_stage='available' AND (
  NEW.test_result<>'passed' OR NEW.return_to_service_validated_at IS NULL OR NEW.return_to_service_validated_by_user_id IS NULL)
BEGIN SELECT RAISE(ABORT,'return to service validation required'); END;

CREATE TRIGGER guard_part_stock BEFORE INSERT ON maintenance_part_usages
WHEN EXISTS (SELECT 1 FROM maintenance_parts WHERE id=NEW.part_id AND stock_quantity IS NOT NULL AND stock_quantity<NEW.quantity)
BEGIN SELECT RAISE(ABORT,'insufficient maintenance part stock'); END;

CREATE TRIGGER consume_part_stock AFTER INSERT ON maintenance_part_usages
BEGIN
  UPDATE maintenance_parts SET stock_quantity=CASE WHEN stock_quantity IS NULL THEN NULL ELSE stock_quantity-NEW.quantity END,updated_at=CURRENT_TIMESTAMP WHERE id=NEW.part_id;
  UPDATE maintenance_records SET parts_cost_minor=(SELECT COALESCE(SUM(quantity*unit_cost_minor_snapshot),0) FROM maintenance_part_usages WHERE maintenance_id=NEW.maintenance_id),
    total_cost_minor=labor_cost_minor+(SELECT COALESCE(SUM(quantity*unit_cost_minor_snapshot),0) FROM maintenance_part_usages WHERE maintenance_id=NEW.maintenance_id),updated_at=CURRENT_TIMESTAMP WHERE id=NEW.maintenance_id;
END;

CREATE TRIGGER guard_professional_bike_available BEFORE UPDATE OF status,maintenance_required ON bikes
WHEN NEW.status='available' AND EXISTS (
  SELECT 1 FROM maintenance_records WHERE bike_id=NEW.id AND process_version=2 AND workshop_stage<>'available' AND return_to_service_validated_at IS NULL)
BEGIN SELECT RAISE(ABORT,'professional maintenance not validated'); END;

CREATE TRIGGER guard_maintenance_required_ride BEFORE INSERT ON rides
WHEN NEW.status='active' AND EXISTS (SELECT 1 FROM bikes WHERE id=NEW.bike_id AND maintenance_required=1)
BEGIN SELECT RAISE(ABORT,'bike maintenance required'); END;

CREATE TRIGGER touch_maintenance_parts AFTER UPDATE ON maintenance_parts
WHEN NEW.updated_at IS OLD.updated_at BEGIN UPDATE maintenance_parts SET updated_at=CURRENT_TIMESTAMP WHERE id=NEW.id; END;
CREATE TRIGGER touch_maintenance_schedules AFTER UPDATE ON maintenance_schedules
WHEN NEW.updated_at IS OLD.updated_at BEGIN UPDATE maintenance_schedules SET updated_at=CURRENT_TIMESTAMP WHERE id=NEW.id; END;

INSERT OR IGNORE INTO staff_role_permissions(role,permission) VALUES
  ('admin','maintenance.release'),
  ('operations_manager','maintenance.release'),
  ('technician','maintenance.release');

PRAGMA optimize;
