-- DEVELOPMENT ONLY. Never apply this file to pikala-db with --remote.
-- Values below are fixtures for local UI and API testing.
PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO plans
  (slug, name, description, amount_minor, currency, billing_period, status, display_order)
VALUES
  ('dev-monthly', 'Pikala Dev Mensuel', 'Offre fictive reservee aux tests locaux.', 9900, 'MAD', 'month', 'active', 10);

INSERT OR IGNORE INTO stations
  (public_code, slug, name, city, address, latitude, longitude, capacity, bikes_available, is_active, updated_at)
VALUES
  ('dev-station-oudayas', 'dev-oudayas', 'Station Dev Oudayas', 'Rabat', 'Kasbah des Oudayas', 34.0318, -6.8361, 8, 2, 1, CURRENT_TIMESTAMP),
  ('dev-station-hassan', 'dev-hassan', 'Station Dev Hassan', 'Rabat', 'Tour Hassan', 34.0224, -6.8225, 8, 1, 1, CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO bikes
  (code, public_code, station_id, status, battery_level, model, updated_at)
VALUES
  ('DEV-BIKE-001', 'dev-bike-001', (SELECT id FROM stations WHERE public_code = 'dev-station-oudayas'), 'available', 100, 'Test', CURRENT_TIMESTAMP),
  ('DEV-BIKE-002', 'dev-bike-002', (SELECT id FROM stations WHERE public_code = 'dev-station-oudayas'), 'available', 80, 'Test', CURRENT_TIMESTAMP),
  ('DEV-BIKE-003', 'dev-bike-003', (SELECT id FROM stations WHERE public_code = 'dev-station-hassan'), 'available', 90, 'Test', CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO docks
  (station_id, position, public_code, status, bike_id)
VALUES
  ((SELECT id FROM stations WHERE public_code = 'dev-station-oudayas'), 1, 'dev-dock-oudayas-01', 'occupied', (SELECT id FROM bikes WHERE code = 'DEV-BIKE-001')),
  ((SELECT id FROM stations WHERE public_code = 'dev-station-oudayas'), 2, 'dev-dock-oudayas-02', 'occupied', (SELECT id FROM bikes WHERE code = 'DEV-BIKE-002')),
  ((SELECT id FROM stations WHERE public_code = 'dev-station-hassan'), 1, 'dev-dock-hassan-01', 'occupied', (SELECT id FROM bikes WHERE code = 'DEV-BIKE-003'));


-- Phase 8 free plan used only by local automated tests.
UPDATE plans SET amount_minor = 0, duration_days = 30, display_order = -100,
  benefits_json = json_array('Local ride tests'),
  translations_json = json_object('fr', json_object('name','Plan de test local','description','Réservé aux tests locaux.','benefits',json_array('Tests locaux')))
WHERE slug = 'dev-monthly';
