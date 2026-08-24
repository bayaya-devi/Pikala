-- Keep admin bike moves and dock assignments atomic without changing ride returns.

CREATE TRIGGER guard_admin_bike_station_dock_update
BEFORE UPDATE OF station_id ON bikes
WHEN OLD.status <> 'in_use'
  AND NEW.station_id IS NOT NULL
  AND (OLD.station_id IS NULL OR NEW.station_id <> OLD.station_id)
  AND NOT EXISTS (
    SELECT 1 FROM docks
    WHERE bike_id = OLD.id
      AND station_id = NEW.station_id
      AND status = 'occupied'
  )
BEGIN
  SELECT RAISE(ABORT, 'bike station requires occupied dock');
END;

PRAGMA optimize;
