-- LOCAL CRASH-TEST ONLY. Never execute this file with --remote.
PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO plans
  (slug, name, description, amount_minor, currency, billing_period, status, display_order)
VALUES ('dev-monthly', 'Pikala Dev Mensuel', 'Offre de test locale.', 9900, 'MAD', 'month', 'active', 10);

INSERT OR IGNORE INTO stations
  (public_code, slug, name, city, address, latitude, longitude, capacity, bikes_available, is_active, updated_at)
VALUES
  ('dev-station-oudayas', 'dev-oudayas', 'Station Dev Oudayas', 'Rabat', 'Kasbah des Oudayas', 34.0318, -6.8361, 12, 0, 1, CURRENT_TIMESTAMP),
  ('dev-station-hassan', 'dev-hassan', 'Station Dev Hassan', 'Rabat', 'Tour Hassan', 34.0224, -6.8225, 12, 0, 1, CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO bikes (code, public_code, station_id, status, battery_level, model, updated_at)
VALUES
  ('DEV-BIKE-001', 'dev-bike-001', (SELECT id FROM stations WHERE public_code='dev-station-oudayas'), 'available', 100, 'Test', CURRENT_TIMESTAMP),
  ('DEV-BIKE-002', 'dev-bike-002', (SELECT id FROM stations WHERE public_code='dev-station-oudayas'), 'available', 90, 'Test', CURRENT_TIMESTAMP),
  ('DEV-BIKE-003', 'dev-bike-003', (SELECT id FROM stations WHERE public_code='dev-station-hassan'), 'available', 90, 'Test', CURRENT_TIMESTAMP),
  ('DEV-BIKE-004', 'dev-bike-004', (SELECT id FROM stations WHERE public_code='dev-station-hassan'), 'maintenance', 40, 'Test', CURRENT_TIMESTAMP),
  ('DEV-BIKE-005', 'dev-bike-005', (SELECT id FROM stations WHERE public_code='dev-station-oudayas'), 'available', 85, 'Test', CURRENT_TIMESTAMP),
  ('DEV-BIKE-006', 'dev-bike-006', (SELECT id FROM stations WHERE public_code='dev-station-hassan'), 'available', 75, 'Test', CURRENT_TIMESTAMP);

UPDATE rides SET status='cancelled', ended_at=COALESCE(ended_at,CURRENT_TIMESTAMP), updated_at=CURRENT_TIMESTAMP
WHERE status='active' AND bike_id IN (SELECT id FROM bikes WHERE code LIKE 'DEV-BIKE-%');
UPDATE docks SET bike_id=NULL, status='available', updated_at=CURRENT_TIMESTAMP
WHERE station_id IN (SELECT id FROM stations WHERE public_code IN ('dev-station-oudayas','dev-station-hassan'));
UPDATE bikes SET station_id=CASE WHEN code IN ('DEV-BIKE-001','DEV-BIKE-002','DEV-BIKE-005')
  THEN (SELECT id FROM stations WHERE public_code='dev-station-oudayas')
  ELSE (SELECT id FROM stations WHERE public_code='dev-station-hassan') END,
  status=CASE WHEN code='DEV-BIKE-004' THEN 'maintenance' ELSE 'available' END, updated_at=CURRENT_TIMESTAMP
WHERE code IN ('DEV-BIKE-001','DEV-BIKE-002','DEV-BIKE-003','DEV-BIKE-004','DEV-BIKE-005','DEV-BIKE-006');

INSERT OR IGNORE INTO docks (station_id, position, public_code, status)
VALUES
  ((SELECT id FROM stations WHERE public_code='dev-station-oudayas'),1,'dev-dock-oudayas-01','available'),
  ((SELECT id FROM stations WHERE public_code='dev-station-oudayas'),2,'dev-dock-oudayas-02','available'),
  ((SELECT id FROM stations WHERE public_code='dev-station-oudayas'),3,'dev-dock-oudayas-03','available'),
  ((SELECT id FROM stations WHERE public_code='dev-station-oudayas'),4,'dev-dock-oudayas-04','available'),
  ((SELECT id FROM stations WHERE public_code='dev-station-hassan'),1,'dev-dock-hassan-01','available'),
  ((SELECT id FROM stations WHERE public_code='dev-station-hassan'),2,'dev-dock-hassan-02','available'),
  ((SELECT id FROM stations WHERE public_code='dev-station-hassan'),3,'dev-dock-hassan-03','available'),
  ((SELECT id FROM stations WHERE public_code='dev-station-hassan'),4,'dev-dock-hassan-04','available');

UPDATE docks SET bike_id=(SELECT id FROM bikes WHERE code='DEV-BIKE-001'),status='occupied',updated_at=CURRENT_TIMESTAMP WHERE public_code='dev-dock-oudayas-01';
UPDATE docks SET bike_id=(SELECT id FROM bikes WHERE code='DEV-BIKE-002'),status='occupied',updated_at=CURRENT_TIMESTAMP WHERE public_code='dev-dock-oudayas-02';
UPDATE docks SET bike_id=(SELECT id FROM bikes WHERE code='DEV-BIKE-005'),status='occupied',updated_at=CURRENT_TIMESTAMP WHERE public_code='dev-dock-oudayas-03';
UPDATE docks SET bike_id=(SELECT id FROM bikes WHERE code='DEV-BIKE-003'),status='occupied',updated_at=CURRENT_TIMESTAMP WHERE public_code='dev-dock-hassan-01';
UPDATE docks SET bike_id=(SELECT id FROM bikes WHERE code='DEV-BIKE-004'),status='occupied',updated_at=CURRENT_TIMESTAMP WHERE public_code='dev-dock-hassan-02';
UPDATE docks SET bike_id=(SELECT id FROM bikes WHERE code='DEV-BIKE-006'),status='occupied',updated_at=CURRENT_TIMESTAMP WHERE public_code='dev-dock-hassan-03';
UPDATE stations SET bikes_available=(SELECT COUNT(*) FROM bikes WHERE bikes.station_id=stations.id AND bikes.status='available'),updated_at=CURRENT_TIMESTAMP
WHERE public_code IN ('dev-station-oudayas','dev-station-hassan');
