-- Pikala V2 real ride invariants.
-- This migration is non-destructive and does not rewrite existing rides.

CREATE INDEX idx_rides_user_active_lookup
ON rides(user_id, status, id);

CREATE TRIGGER guard_one_active_ride_per_user_insert BEFORE INSERT ON rides
WHEN NEW.status = 'active' AND EXISTS (
  SELECT 1 FROM rides existing_ride
  WHERE existing_ride.user_id = NEW.user_id AND existing_ride.status = 'active'
)
BEGIN SELECT RAISE(ABORT, 'user already has an active ride'); END;

CREATE TRIGGER guard_one_active_ride_per_user_update BEFORE UPDATE OF status, user_id ON rides
WHEN NEW.status = 'active' AND EXISTS (
  SELECT 1 FROM rides existing_ride
  WHERE existing_ride.user_id = NEW.user_id
    AND existing_ride.status = 'active'
    AND existing_ride.id <> NEW.id
)
BEGIN SELECT RAISE(ABORT, 'user already has an active ride'); END;

CREATE TRIGGER guard_active_ride_insert BEFORE INSERT ON rides
WHEN NEW.status = 'active'
  AND (NEW.bike_id IS NULL OR NEW.start_station_id IS NULL OR NEW.start_dock_id IS NULL)
BEGIN SELECT RAISE(ABORT, 'active ride requires bike, station and dock'); END;

CREATE TRIGGER guard_active_ride_update BEFORE UPDATE OF status, bike_id, start_station_id, start_dock_id ON rides
WHEN NEW.status = 'active'
  AND (NEW.bike_id IS NULL OR NEW.start_station_id IS NULL OR NEW.start_dock_id IS NULL)
BEGIN SELECT RAISE(ABORT, 'active ride requires bike, station and dock'); END;

CREATE TRIGGER guard_bike_qr_insert BEFORE INSERT ON bikes
WHEN trim(NEW.code) = '' OR NEW.public_code IS NULL OR trim(NEW.public_code) = ''
BEGIN SELECT RAISE(ABORT, 'bike QR code is required'); END;

CREATE TRIGGER guard_bike_qr_update BEFORE UPDATE OF code, public_code ON bikes
WHEN trim(NEW.code) = '' OR NEW.public_code IS NULL OR trim(NEW.public_code) = ''
BEGIN SELECT RAISE(ABORT, 'bike QR code is required'); END;

PRAGMA optimize;
