-- Keep every accepted bike identifier unique across code and public_code.
-- This is additive and does not rewrite existing data.

CREATE TRIGGER guard_bike_qr_namespace_insert BEFORE INSERT ON bikes
WHEN EXISTS (
  SELECT 1 FROM bikes existing_bike
  WHERE existing_bike.code IN (NEW.code, NEW.public_code)
     OR existing_bike.public_code IN (NEW.code, NEW.public_code)
)
AND NOT EXISTS (
  SELECT 1 FROM bikes same_bike
  WHERE same_bike.code = NEW.code AND same_bike.public_code = NEW.public_code
)
BEGIN SELECT RAISE(ABORT, 'bike QR identifier already exists'); END;

CREATE TRIGGER guard_bike_qr_namespace_update BEFORE UPDATE OF code, public_code ON bikes
WHEN EXISTS (
  SELECT 1 FROM bikes existing_bike
  WHERE existing_bike.id <> NEW.id
    AND (
      existing_bike.code IN (NEW.code, NEW.public_code)
      OR existing_bike.public_code IN (NEW.code, NEW.public_code)
    )
)
AND NOT EXISTS (
  SELECT 1 FROM bikes same_bike
  WHERE same_bike.code = NEW.code AND same_bike.public_code = NEW.public_code
)
BEGIN SELECT RAISE(ABORT, 'bike QR identifier already exists'); END;

PRAGMA optimize;
