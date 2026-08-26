-- LOCAL IOT CRASH-TEST ONLY. Never execute this file with --remote.
PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO devices
  (public_code,device_type,bike_id,status,hardware_id,hardware_type,provider,connectivity_status,last_seen_at)
SELECT 'iot-lock-bike-005','bike_lock',id,'online','test-lock-bike-005','bike_lock','test','online',CURRENT_TIMESTAMP
FROM bikes WHERE public_code='dev-bike-005';

INSERT OR IGNORE INTO devices
  (public_code,device_type,dock_id,station_id,status,hardware_id,hardware_type,provider,connectivity_status,last_seen_at)
SELECT 'iot-dock-oudayas-04','dock_controller',docks.id,NULL,'online','test-dock-oudayas-04','dock','test','online',CURRENT_TIMESTAMP
FROM docks WHERE docks.public_code='dev-dock-oudayas-04';
