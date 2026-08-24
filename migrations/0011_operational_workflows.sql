-- Pikala V2 support, incidents, notifications and maintenance. Additive only.

ALTER TABLE support_tickets ADD COLUMN public_code TEXT;
ALTER TABLE support_tickets ADD COLUMN topic TEXT NOT NULL DEFAULT 'other'
  CHECK (topic IN ('bike','station','ride','subscription','payment','account','security','other'));
ALTER TABLE support_tickets ADD COLUMN bike_id INTEGER REFERENCES bikes(id) ON DELETE SET NULL;
ALTER TABLE support_tickets ADD COLUMN station_id INTEGER REFERENCES stations(id) ON DELETE SET NULL;
ALTER TABLE support_tickets ADD COLUMN ride_id INTEGER REFERENCES rides(id) ON DELETE SET NULL;

ALTER TABLE bike_incidents ADD COLUMN public_code TEXT;
ALTER TABLE bike_incidents ADD COLUMN incident_type TEXT NOT NULL DEFAULT 'other'
  CHECK (incident_type IN ('brake','wheel','tire','chain','saddle','qr','light','damage','other'));

ALTER TABLE bikes ADD COLUMN maintenance_required INTEGER NOT NULL DEFAULT 0
  CHECK (maintenance_required IN (0,1));

ALTER TABLE maintenance_records ADD COLUMN workflow_stage TEXT NOT NULL DEFAULT 'to_inspect'
  CHECK (workflow_stage IN ('reported','to_inspect','maintenance','repaired','available'));

ALTER TABLE notifications ADD COLUMN action_url TEXT;
ALTER TABLE notifications ADD COLUMN updated_at TEXT;

CREATE TABLE support_ticket_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id INTEGER NOT NULL,
  author_user_id INTEGER,
  author_kind TEXT NOT NULL CHECK (author_kind IN ('user','admin','system')),
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (author_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE workflow_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('support_ticket','incident','maintenance','bike')),
  resource_id INTEGER NOT NULL,
  actor_user_id INTEGER,
  from_status TEXT,
  to_status TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
);

UPDATE support_tickets SET public_code = 'TKT-' || printf('%06d', id) WHERE public_code IS NULL;
UPDATE support_tickets SET topic = CASE category
  WHEN 'bike' THEN 'bike' WHEN 'station' THEN 'station' WHEN 'ride' THEN 'ride'
  WHEN 'payment' THEN 'payment' WHEN 'account' THEN 'account' WHEN 'safety' THEN 'security'
  ELSE 'other' END;

INSERT INTO support_ticket_messages (ticket_id, author_user_id, author_kind, body, created_at)
SELECT id, user_id, 'user', message, created_at FROM support_tickets
WHERE trim(COALESCE(message,'')) <> '';

INSERT INTO workflow_events (resource_type, resource_id, actor_user_id, to_status, created_at)
SELECT 'support_ticket', id, user_id, status, created_at FROM support_tickets;

UPDATE bike_incidents SET public_code = 'INC-' || printf('%06d', id) WHERE public_code IS NULL;
UPDATE bike_incidents SET incident_type = CASE category
  WHEN 'damage' THEN 'damage' WHEN 'lock' THEN 'qr' ELSE 'other' END;

INSERT INTO workflow_events (resource_type, resource_id, actor_user_id, to_status, created_at)
SELECT 'incident', id, reported_by_user_id, status, created_at FROM bike_incidents;

UPDATE maintenance_records SET workflow_stage = CASE status
  WHEN 'open' THEN 'to_inspect' WHEN 'in_progress' THEN 'maintenance'
  WHEN 'resolved' THEN 'repaired' ELSE 'to_inspect' END;

INSERT INTO workflow_events (resource_type, resource_id, actor_user_id, to_status, created_at)
SELECT 'maintenance', id, opened_by_user_id, workflow_stage, opened_at FROM maintenance_records;

UPDATE notifications SET updated_at = COALESCE(read_at, sent_at, created_at) WHERE updated_at IS NULL;

CREATE UNIQUE INDEX idx_support_public_code ON support_tickets(public_code) WHERE public_code IS NOT NULL;
CREATE INDEX idx_support_user_updated ON support_tickets(user_id, updated_at, id);
CREATE INDEX idx_support_topic_status ON support_tickets(topic, status, priority, updated_at);
CREATE INDEX idx_support_messages_ticket ON support_ticket_messages(ticket_id, created_at, id);
CREATE UNIQUE INDEX idx_incident_public_code ON bike_incidents(public_code) WHERE public_code IS NOT NULL;
CREATE INDEX idx_incident_reporter_created ON bike_incidents(reported_by_user_id, created_at, id);
CREATE INDEX idx_workflow_resource ON workflow_events(resource_type, resource_id, created_at, id);
CREATE INDEX idx_notifications_user_read ON notifications(user_id, read_at, created_at, id);

CREATE TRIGGER touch_notifications_updated_at AFTER UPDATE ON notifications
WHEN NEW.updated_at IS OLD.updated_at
BEGIN UPDATE notifications SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; END;

PRAGMA optimize;
