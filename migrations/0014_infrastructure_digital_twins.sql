-- Complete digital twins for Pikala physical infrastructure.
-- Additive only: existing assets and operational history are preserved.

ALTER TABLE bikes ADD COLUMN lock_status TEXT NOT NULL DEFAULT 'unknown'
  CHECK (lock_status IN ('unknown','locked','unlocked','jammed','offline'));
ALTER TABLE bikes ADD COLUMN connectivity_status TEXT NOT NULL DEFAULT 'unknown'
  CHECK (connectivity_status IN ('unknown','online','offline','degraded'));
ALTER TABLE bikes ADD COLUMN last_seen_at TEXT;
ALTER TABLE bikes ADD COLUMN gps_latitude REAL CHECK (gps_latitude IS NULL OR gps_latitude BETWEEN -90 AND 90);
ALTER TABLE bikes ADD COLUMN gps_longitude REAL CHECK (gps_longitude IS NULL OR gps_longitude BETWEEN -180 AND 180);
ALTER TABLE bikes ADD COLUMN odometer_meters INTEGER NOT NULL DEFAULT 0 CHECK (odometer_meters >= 0);
ALTER TABLE bikes ADD COLUMN total_usage_seconds INTEGER NOT NULL DEFAULT 0 CHECK (total_usage_seconds >= 0);
ALTER TABLE bikes ADD COLUMN total_rides INTEGER NOT NULL DEFAULT 0 CHECK (total_rides >= 0);

ALTER TABLE stations ADD COLUMN connectivity_status TEXT NOT NULL DEFAULT 'unknown'
  CHECK (connectivity_status IN ('unknown','online','offline','degraded'));
ALTER TABLE stations ADD COLUMN last_seen_at TEXT;

ALTER TABLE docks ADD COLUMN lock_status TEXT NOT NULL DEFAULT 'unknown'
  CHECK (lock_status IN ('unknown','locked','unlocked','jammed','offline'));
ALTER TABLE docks ADD COLUMN connectivity_status TEXT NOT NULL DEFAULT 'unknown'
  CHECK (connectivity_status IN ('unknown','online','offline','degraded'));
ALTER TABLE docks ADD COLUMN last_seen_at TEXT;

CREATE TABLE infrastructure_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('bike','station','dock')),
  asset_id INTEGER NOT NULL,
  event_type TEXT NOT NULL CHECK (length(trim(event_type)) BETWEEN 2 AND 80),
  from_status TEXT,
  to_status TEXT,
  from_station_id INTEGER,
  to_station_id INTEGER,
  actor_user_id INTEGER,
  ride_id INTEGER,
  request_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json) AND json_type(metadata_json)='object'),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (from_station_id) REFERENCES stations(id) ON DELETE SET NULL,
  FOREIGN KEY (to_station_id) REFERENCES stations(id) ON DELETE SET NULL,
  FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (ride_id) REFERENCES rides(id) ON DELETE SET NULL
);

CREATE INDEX idx_infrastructure_events_asset_date ON infrastructure_events(asset_type,asset_id,created_at,id);
CREATE INDEX idx_infrastructure_events_station_date ON infrastructure_events(to_station_id,created_at,id);
CREATE INDEX idx_bikes_connectivity_seen ON bikes(connectivity_status,last_seen_at);
CREATE INDEX idx_stations_connectivity_seen ON stations(connectivity_status,last_seen_at);
CREATE INDEX idx_docks_connectivity_seen ON docks(connectivity_status,last_seen_at);

UPDATE bikes SET
  total_rides=(SELECT COUNT(*) FROM rides WHERE rides.bike_id=bikes.id AND rides.status='completed'),
  total_usage_seconds=COALESCE((SELECT SUM(duration_seconds) FROM rides WHERE rides.bike_id=bikes.id AND rides.status='completed'),0),
  odometer_meters=COALESCE((SELECT SUM(distance_meters) FROM rides WHERE rides.bike_id=bikes.id AND rides.status='completed'),0);

CREATE TRIGGER guard_infrastructure_events_no_update BEFORE UPDATE ON infrastructure_events
BEGIN SELECT RAISE(ABORT,'infrastructure events are append-only'); END;
CREATE TRIGGER guard_infrastructure_events_no_delete BEFORE DELETE ON infrastructure_events
BEGIN SELECT RAISE(ABORT,'infrastructure events are append-only'); END;

CREATE TRIGGER guard_dock_twin_insert BEFORE INSERT ON docks
WHEN (NEW.bike_id IS NULL AND NEW.status='occupied')
  OR (NEW.bike_id IS NOT NULL AND NEW.status<>'occupied')
  OR (NEW.bike_id IS NOT NULL AND EXISTS (SELECT 1 FROM bikes WHERE id=NEW.bike_id AND status='in_use'))
BEGIN SELECT RAISE(ABORT,'invalid dock bike assignment'); END;

CREATE TRIGGER guard_dock_twin_update BEFORE UPDATE OF bike_id,status ON docks
WHEN (NEW.bike_id IS NULL AND NEW.status='occupied')
  OR (NEW.bike_id IS NOT NULL AND NEW.status<>'occupied')
  OR (NEW.bike_id IS NOT NULL AND EXISTS (SELECT 1 FROM bikes WHERE id=NEW.bike_id AND status='in_use'))
BEGIN SELECT RAISE(ABORT,'invalid dock bike assignment'); END;

CREATE TRIGGER guard_dock_capacity_insert BEFORE INSERT ON docks
WHEN NEW.status<>'disabled' AND
  (SELECT COUNT(*) FROM docks WHERE station_id=NEW.station_id AND status<>'disabled') >=
  COALESCE((SELECT capacity FROM stations WHERE id=NEW.station_id),0)
BEGIN SELECT RAISE(ABORT,'station dock capacity exceeded'); END;

CREATE TRIGGER guard_dock_capacity_update BEFORE UPDATE OF station_id,status ON docks
WHEN NEW.status<>'disabled' AND
  (SELECT COUNT(*) FROM docks WHERE station_id=NEW.station_id AND id<>OLD.id AND status<>'disabled') >=
  COALESCE((SELECT capacity FROM stations WHERE id=NEW.station_id),0)
BEGIN SELECT RAISE(ABORT,'station dock capacity exceeded'); END;

CREATE TRIGGER guard_bike_twin_insert BEFORE INSERT ON bikes
WHEN (NEW.status='in_use' AND NEW.station_id IS NOT NULL)
  OR (NEW.status='available' AND NEW.maintenance_required=1)
  OR (NEW.status='maintenance' AND NEW.maintenance_required<>1)
BEGIN SELECT RAISE(ABORT,'invalid bike operational state'); END;

CREATE TRIGGER guard_bike_twin_update BEFORE UPDATE OF status,station_id,maintenance_required ON bikes
WHEN (NEW.status='in_use' AND (NEW.station_id IS NOT NULL OR EXISTS (SELECT 1 FROM docks WHERE bike_id=NEW.id)))
  OR (NEW.status='available' AND NEW.maintenance_required=1)
  OR (NEW.status='maintenance' AND NEW.maintenance_required<>1)
BEGIN SELECT RAISE(ABORT,'invalid bike operational state'); END;

CREATE TRIGGER log_bike_twin_update AFTER UPDATE OF status,station_id,lock_status,connectivity_status ON bikes
WHEN OLD.status<>NEW.status OR OLD.station_id IS NOT NEW.station_id OR OLD.lock_status<>NEW.lock_status OR OLD.connectivity_status<>NEW.connectivity_status
BEGIN
  INSERT INTO infrastructure_events(asset_type,asset_id,event_type,from_status,to_status,from_station_id,to_station_id,metadata_json)
  VALUES('bike',NEW.id,'state_changed',OLD.status,NEW.status,OLD.station_id,NEW.station_id,
    json_object('fromLock',OLD.lock_status,'toLock',NEW.lock_status,'fromConnectivity',OLD.connectivity_status,'toConnectivity',NEW.connectivity_status));
END;

CREATE TRIGGER log_station_twin_update AFTER UPDATE OF is_active,connectivity_status ON stations
WHEN OLD.is_active<>NEW.is_active OR OLD.connectivity_status<>NEW.connectivity_status
BEGIN
  INSERT INTO infrastructure_events(asset_type,asset_id,event_type,from_status,to_status,to_station_id,metadata_json)
  VALUES('station',NEW.id,'state_changed',CASE OLD.is_active WHEN 1 THEN 'active' ELSE 'inactive' END,
    CASE NEW.is_active WHEN 1 THEN 'active' ELSE 'inactive' END,NEW.id,
    json_object('fromConnectivity',OLD.connectivity_status,'toConnectivity',NEW.connectivity_status));
END;

CREATE TRIGGER log_dock_twin_update AFTER UPDATE OF status,bike_id,lock_status,connectivity_status ON docks
WHEN OLD.status<>NEW.status OR OLD.bike_id IS NOT NEW.bike_id OR OLD.lock_status<>NEW.lock_status OR OLD.connectivity_status<>NEW.connectivity_status
BEGIN
  INSERT INTO infrastructure_events(asset_type,asset_id,event_type,from_status,to_status,from_station_id,to_station_id,metadata_json)
  VALUES('dock',NEW.id,'state_changed',OLD.status,NEW.status,OLD.station_id,NEW.station_id,
    json_object('fromBikeId',OLD.bike_id,'toBikeId',NEW.bike_id,'fromLock',OLD.lock_status,'toLock',NEW.lock_status,
      'fromConnectivity',OLD.connectivity_status,'toConnectivity',NEW.connectivity_status));
END;

PRAGMA optimize;
