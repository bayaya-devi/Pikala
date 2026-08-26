-- Field operations, verified custody and rebalancing. Additive only.

CREATE TABLE field_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_code TEXT NOT NULL UNIQUE,
  task_type TEXT NOT NULL CHECK (task_type IN ('redistribution','bike_move','inspection','maintenance','retrieval','station_check','emergency','other')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created','assigned','accepted','in_progress','completed','cancelled')),
  description TEXT NOT NULL CHECK (length(trim(description)) BETWEEN 3 AND 1000),
  assigned_to_user_id INTEGER,
  source_station_id INTEGER,
  destination_station_id INTEGER,
  due_at TEXT,
  accepted_at TEXT,
  started_at TEXT,
  completed_at TEXT,
  cancelled_at TEXT,
  notes TEXT CHECK (notes IS NULL OR length(notes) <= 2000),
  rebalancing_recommendation_id INTEGER UNIQUE REFERENCES rebalancing_recommendations(id) ON DELETE SET NULL,
  created_by_user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (assigned_to_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (source_station_id) REFERENCES stations(id) ON DELETE RESTRICT,
  FOREIGN KEY (destination_station_id) REFERENCES stations(id) ON DELETE RESTRICT,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CHECK (source_station_id IS NULL OR destination_station_id IS NULL OR source_station_id <> destination_station_id),
  CHECK (status = 'created' OR assigned_to_user_id IS NOT NULL)
);

CREATE TABLE field_task_bikes (
  task_id INTEGER NOT NULL,
  bike_id INTEGER NOT NULL,
  sequence_number INTEGER NOT NULL DEFAULT 1 CHECK (sequence_number > 0),
  custody_status TEXT NOT NULL DEFAULT 'planned' CHECK (custody_status IN ('planned','picked_up','deposited','exception')),
  picked_up_at TEXT,
  picked_up_by_user_id INTEGER,
  deposited_at TEXT,
  deposited_by_user_id INTEGER,
  deposit_dock_id INTEGER,
  exception_note TEXT CHECK (exception_note IS NULL OR length(exception_note) <= 500),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (task_id,bike_id),
  FOREIGN KEY (task_id) REFERENCES field_tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (bike_id) REFERENCES bikes(id) ON DELETE RESTRICT,
  FOREIGN KEY (picked_up_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (deposited_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (deposit_dock_id) REFERENCES docks(id) ON DELETE SET NULL
);

CREATE TABLE field_task_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  actor_user_id INTEGER,
  event_type TEXT NOT NULL CHECK (length(trim(event_type)) BETWEEN 2 AND 80),
  station_id INTEGER,
  bike_id INTEGER,
  dock_id INTEGER,
  request_id TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(payload_json) AND json_type(payload_json)='object'),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES field_tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE SET NULL,
  FOREIGN KEY (bike_id) REFERENCES bikes(id) ON DELETE SET NULL,
  FOREIGN KEY (dock_id) REFERENCES docks(id) ON DELETE SET NULL
);

CREATE TABLE field_scan_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  actor_user_id INTEGER NOT NULL,
  scan_type TEXT NOT NULL CHECK (scan_type IN ('source_station','pickup_bike','destination_station','deposit_bike')),
  scanned_code TEXT NOT NULL CHECK (length(trim(scanned_code)) BETWEEN 2 AND 300),
  station_id INTEGER,
  bike_id INTEGER,
  dock_id INTEGER,
  request_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES field_tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE SET NULL,
  FOREIGN KEY (bike_id) REFERENCES bikes(id) ON DELETE SET NULL,
  FOREIGN KEY (dock_id) REFERENCES docks(id) ON DELETE SET NULL
);

ALTER TABLE bikes ADD COLUMN operational_custody_task_id INTEGER REFERENCES field_tasks(id) ON DELETE SET NULL;

ALTER TABLE rebalancing_recommendations ADD COLUMN reviewed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE rebalancing_recommendations ADD COLUMN reviewed_at TEXT;
ALTER TABLE rebalancing_recommendations ADD COLUMN ignored_reason TEXT;
ALTER TABLE rebalancing_recommendations ADD COLUMN calculation_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(calculation_json));
ALTER TABLE rebalancing_recommendations ADD COLUMN field_task_id INTEGER REFERENCES field_tasks(id) ON DELETE SET NULL;

CREATE INDEX idx_field_tasks_assignee_status ON field_tasks(assigned_to_user_id,status,due_at);
CREATE INDEX idx_field_tasks_status_priority ON field_tasks(status,priority,due_at);
CREATE INDEX idx_field_task_bikes_custody ON field_task_bikes(custody_status,bike_id);
CREATE UNIQUE INDEX idx_field_active_bike_custody ON field_task_bikes(bike_id) WHERE custody_status='picked_up';
CREATE INDEX idx_field_events_task_date ON field_task_events(task_id,created_at,id);
CREATE INDEX idx_field_scans_task_type ON field_scan_records(task_id,scan_type,created_at);
CREATE UNIQUE INDEX idx_field_scan_idempotency ON field_scan_records(task_id,request_id);
CREATE INDEX idx_rebalancing_open_pair ON rebalancing_recommendations(source_station_id,destination_station_id,status);

CREATE TRIGGER guard_field_events_no_update BEFORE UPDATE ON field_task_events
BEGIN SELECT RAISE(ABORT,'field events are append-only'); END;
CREATE TRIGGER guard_field_events_no_delete BEFORE DELETE ON field_task_events
BEGIN SELECT RAISE(ABORT,'field events are append-only'); END;
CREATE TRIGGER guard_field_scans_no_update BEFORE UPDATE ON field_scan_records
BEGIN SELECT RAISE(ABORT,'field scans are append-only'); END;
CREATE TRIGGER guard_field_scans_no_delete BEFORE DELETE ON field_scan_records
BEGIN SELECT RAISE(ABORT,'field scans are append-only'); END;

CREATE TRIGGER guard_field_task_transition BEFORE UPDATE OF status ON field_tasks
WHEN OLD.status <> NEW.status AND NOT (
  (OLD.status='created' AND NEW.status IN ('assigned','cancelled')) OR
  (OLD.status='assigned' AND NEW.status IN ('accepted','cancelled')) OR
  (OLD.status='accepted' AND NEW.status IN ('in_progress','cancelled')) OR
  (OLD.status='in_progress' AND NEW.status IN ('completed','cancelled'))
)
BEGIN SELECT RAISE(ABORT,'invalid field task transition'); END;

CREATE TRIGGER guard_field_task_completion BEFORE UPDATE OF status ON field_tasks
WHEN NEW.status='completed' AND (
  EXISTS (SELECT 1 FROM field_task_bikes WHERE task_id=NEW.id AND custody_status<>'deposited') OR
  (NEW.task_type IN ('redistribution','bike_move','retrieval') AND NOT EXISTS (SELECT 1 FROM field_scan_records WHERE task_id=NEW.id AND scan_type='source_station')) OR
  (NEW.task_type IN ('redistribution','bike_move') AND NOT EXISTS (SELECT 1 FROM field_scan_records WHERE task_id=NEW.id AND scan_type='destination_station'))
)
BEGIN SELECT RAISE(ABORT,'field task physical steps incomplete'); END;

CREATE TRIGGER guard_field_task_cancel_with_custody BEFORE UPDATE OF status ON field_tasks
WHEN NEW.status='cancelled' AND EXISTS (SELECT 1 FROM field_task_bikes WHERE task_id=NEW.id AND custody_status='picked_up')
BEGIN SELECT RAISE(ABORT,'field task custody must be resolved before cancellation'); END;

CREATE TRIGGER guard_field_task_bike_duplicate BEFORE INSERT ON field_task_bikes
WHEN EXISTS (
  SELECT 1 FROM field_task_bikes existing_bikes JOIN field_tasks existing_tasks ON existing_tasks.id=existing_bikes.task_id
  WHERE existing_bikes.bike_id=NEW.bike_id AND existing_tasks.status NOT IN ('completed','cancelled')
)
BEGIN SELECT RAISE(ABORT,'bike is already planned in an active field task'); END;

CREATE TRIGGER guard_field_scan_actor BEFORE INSERT ON field_scan_records
WHEN NOT EXISTS (SELECT 1 FROM field_tasks WHERE id=NEW.task_id AND assigned_to_user_id=NEW.actor_user_id AND status IN ('accepted','in_progress'))
BEGIN SELECT RAISE(ABORT,'field scan actor or task invalid'); END;

CREATE TRIGGER guard_field_source_scan BEFORE INSERT ON field_scan_records
WHEN NEW.scan_type='source_station' AND (
  NEW.station_id IS NULL OR NOT EXISTS (SELECT 1 FROM field_tasks WHERE id=NEW.task_id AND source_station_id=NEW.station_id AND status='in_progress')
)
BEGIN SELECT RAISE(ABORT,'invalid source station scan'); END;

CREATE TRIGGER guard_field_destination_scan BEFORE INSERT ON field_scan_records
WHEN NEW.scan_type='destination_station' AND (
  NEW.station_id IS NULL OR NOT EXISTS (SELECT 1 FROM field_tasks WHERE id=NEW.task_id AND destination_station_id=NEW.station_id AND status='in_progress')
)
BEGIN SELECT RAISE(ABORT,'invalid destination station scan'); END;

CREATE TRIGGER guard_field_pickup_scan BEFORE INSERT ON field_scan_records
WHEN NEW.scan_type='pickup_bike' AND (
  NEW.bike_id IS NULL OR
  NOT EXISTS (SELECT 1 FROM field_tasks WHERE id=NEW.task_id AND status='in_progress' AND source_station_id IS NOT NULL) OR
  NOT EXISTS (SELECT 1 FROM field_scan_records WHERE task_id=NEW.task_id AND scan_type='source_station') OR
  NOT EXISTS (SELECT 1 FROM field_task_bikes WHERE task_id=NEW.task_id AND bike_id=NEW.bike_id AND custody_status='planned') OR
  NOT EXISTS (SELECT 1 FROM bikes JOIN field_tasks ON field_tasks.id=NEW.task_id WHERE bikes.id=NEW.bike_id AND bikes.status='available' AND bikes.maintenance_required=0 AND bikes.station_id=field_tasks.source_station_id AND bikes.operational_custody_task_id IS NULL AND EXISTS (SELECT 1 FROM docks WHERE docks.bike_id=bikes.id AND docks.station_id=field_tasks.source_station_id AND docks.status='occupied'))
)
BEGIN SELECT RAISE(ABORT,'invalid bike pickup scan'); END;

CREATE TRIGGER apply_field_pickup_scan AFTER INSERT ON field_scan_records
WHEN NEW.scan_type='pickup_bike'
BEGIN
  UPDATE docks SET bike_id=NULL,status='available',lock_status='unlocked',updated_at=CURRENT_TIMESTAMP WHERE bike_id=NEW.bike_id;
  UPDATE bikes SET status='reserved',station_id=NULL,lock_status='unlocked',operational_custody_task_id=NEW.task_id,updated_at=CURRENT_TIMESTAMP WHERE id=NEW.bike_id;
  UPDATE field_task_bikes SET custody_status='picked_up',picked_up_at=CURRENT_TIMESTAMP,picked_up_by_user_id=NEW.actor_user_id,updated_at=CURRENT_TIMESTAMP WHERE task_id=NEW.task_id AND bike_id=NEW.bike_id;
  UPDATE stations SET bikes_available=(SELECT COUNT(*) FROM bikes WHERE station_id=stations.id AND status='available'),updated_at=CURRENT_TIMESTAMP WHERE id=(SELECT source_station_id FROM field_tasks WHERE id=NEW.task_id);
END;

CREATE TRIGGER guard_field_deposit_scan BEFORE INSERT ON field_scan_records
WHEN NEW.scan_type='deposit_bike' AND (
  NEW.bike_id IS NULL OR NEW.dock_id IS NULL OR
  NOT EXISTS (SELECT 1 FROM field_tasks WHERE id=NEW.task_id AND status='in_progress' AND destination_station_id IS NOT NULL) OR
  NOT EXISTS (SELECT 1 FROM field_scan_records WHERE task_id=NEW.task_id AND scan_type='destination_station') OR
  NOT EXISTS (SELECT 1 FROM field_task_bikes WHERE task_id=NEW.task_id AND bike_id=NEW.bike_id AND custody_status='picked_up') OR
  NOT EXISTS (SELECT 1 FROM bikes WHERE id=NEW.bike_id AND status='reserved' AND station_id IS NULL AND operational_custody_task_id=NEW.task_id) OR
  NOT EXISTS (SELECT 1 FROM docks JOIN field_tasks ON field_tasks.id=NEW.task_id WHERE docks.id=NEW.dock_id AND docks.station_id=field_tasks.destination_station_id AND docks.status='available' AND docks.bike_id IS NULL)
)
BEGIN SELECT RAISE(ABORT,'invalid bike deposit scan'); END;

CREATE TRIGGER apply_field_deposit_scan AFTER INSERT ON field_scan_records
WHEN NEW.scan_type='deposit_bike'
BEGIN
  UPDATE docks SET bike_id=NEW.bike_id,status='occupied',lock_status='locked',updated_at=CURRENT_TIMESTAMP WHERE id=NEW.dock_id;
  UPDATE bikes SET status=CASE WHEN maintenance_required=1 THEN 'maintenance' ELSE 'available' END,station_id=(SELECT station_id FROM docks WHERE id=NEW.dock_id),lock_status='locked',operational_custody_task_id=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=NEW.bike_id;
  UPDATE field_task_bikes SET custody_status='deposited',deposited_at=CURRENT_TIMESTAMP,deposited_by_user_id=NEW.actor_user_id,deposit_dock_id=NEW.dock_id,updated_at=CURRENT_TIMESTAMP WHERE task_id=NEW.task_id AND bike_id=NEW.bike_id;
  UPDATE stations SET bikes_available=(SELECT COUNT(*) FROM bikes WHERE station_id=stations.id AND status='available'),updated_at=CURRENT_TIMESTAMP WHERE id=(SELECT destination_station_id FROM field_tasks WHERE id=NEW.task_id);
END;

CREATE TRIGGER log_field_scan AFTER INSERT ON field_scan_records
BEGIN
  INSERT INTO field_task_events(task_id,actor_user_id,event_type,station_id,bike_id,dock_id,request_id,payload_json)
  VALUES(NEW.task_id,NEW.actor_user_id,'scan.'||NEW.scan_type,NEW.station_id,NEW.bike_id,NEW.dock_id,NEW.request_id,json_object('code',NEW.scanned_code));
END;

CREATE TRIGGER log_field_task_status AFTER UPDATE OF status ON field_tasks
WHEN OLD.status<>NEW.status
BEGIN
  INSERT INTO field_task_events(task_id,actor_user_id,event_type,payload_json)
  VALUES(NEW.id,NEW.assigned_to_user_id,'status.'||NEW.status,json_object('from',OLD.status,'to',NEW.status));
END;

CREATE TRIGGER touch_field_tasks AFTER UPDATE ON field_tasks
WHEN NEW.updated_at IS OLD.updated_at BEGIN UPDATE field_tasks SET updated_at=CURRENT_TIMESTAMP WHERE id=NEW.id; END;
CREATE TRIGGER touch_field_task_bikes AFTER UPDATE ON field_task_bikes
WHEN NEW.updated_at IS OLD.updated_at BEGIN UPDATE field_task_bikes SET updated_at=CURRENT_TIMESTAMP WHERE task_id=NEW.task_id AND bike_id=NEW.bike_id; END;

INSERT OR IGNORE INTO staff_role_permissions(role,permission) VALUES
  ('admin','field_tasks.read'),('admin','field_tasks.manage'),('admin','field_tasks.execute'),
  ('operations_manager','field_tasks.read'),('operations_manager','field_tasks.manage'),('operations_manager','field_tasks.execute'),
  ('station_manager','field_tasks.read'),('station_manager','field_tasks.manage'),
  ('technician','field_tasks.read_assigned'),('technician','field_tasks.execute_assigned'),
  ('field_agent','field_tasks.read_assigned'),('field_agent','field_tasks.execute_assigned');

PRAGMA optimize;
