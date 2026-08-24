-- Pikala V2 admin concurrency guard. Additive and safe for existing data.

CREATE UNIQUE INDEX idx_maintenance_one_open_per_bike
ON maintenance_records(bike_id)
WHERE status IN ('open', 'in_progress');

PRAGMA optimize;
