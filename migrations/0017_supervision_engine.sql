-- Phase 7: moteur déterministe, indépendant des anciennes alertes Control Center.
CREATE TABLE supervision_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  threshold_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(threshold_json)),
  severity TEXT NOT NULL CHECK (severity IN ('info','warning','critical')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  automatic_action TEXT,
  notify INTEGER NOT NULL DEFAULT 1 CHECK (notify IN (0,1)),
  cooldown_seconds INTEGER NOT NULL DEFAULT 3600 CHECK (cooldown_seconds BETWEEN 60 AND 604800),
  future_ai_mode TEXT NOT NULL DEFAULT 'deterministic' CHECK (future_ai_mode IN ('deterministic','assistive')),
  created_by_user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE supervision_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_id INTEGER NOT NULL,
  dedupe_key TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info','warning','critical')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','acknowledged','in_progress','resolved','ignored')),
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  recommendation TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json)),
  detected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_detected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  acknowledged_by_user_id INTEGER,
  acknowledged_at TEXT,
  in_progress_by_user_id INTEGER,
  in_progress_at TEXT,
  resolved_by_user_id INTEGER,
  resolved_at TEXT,
  ignored_by_user_id INTEGER,
  ignored_at TEXT,
  FOREIGN KEY (rule_id) REFERENCES supervision_rules(id) ON DELETE RESTRICT,
  FOREIGN KEY (acknowledged_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (in_progress_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (resolved_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (ignored_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE supervision_alert_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alert_id INTEGER NOT NULL,
  actor_user_id INTEGER,
  event_type TEXT NOT NULL,
  details_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(details_json)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (alert_id) REFERENCES supervision_alerts(id) ON DELETE CASCADE,
  FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX idx_supervision_alert_active_dedupe ON supervision_alerts(dedupe_key) WHERE status IN ('new','acknowledged','in_progress');
CREATE INDEX idx_supervision_alert_status_seen ON supervision_alerts(status,severity,last_detected_at DESC);
CREATE INDEX idx_supervision_rules_active ON supervision_rules(is_active,category);

CREATE TRIGGER guard_supervision_events_immutable_update BEFORE UPDATE ON supervision_alert_events BEGIN SELECT RAISE(ABORT,'supervision alert events are immutable'); END;
CREATE TRIGGER guard_supervision_events_immutable_delete BEFORE DELETE ON supervision_alert_events BEGIN SELECT RAISE(ABORT,'supervision alert events are immutable'); END;

CREATE TRIGGER guard_supervision_alert_transition BEFORE UPDATE OF status ON supervision_alerts
WHEN NOT (
  OLD.status='new' AND NEW.status IN ('acknowledged','in_progress','resolved','ignored') OR
  OLD.status='acknowledged' AND NEW.status IN ('in_progress','resolved','ignored') OR
  OLD.status='in_progress' AND NEW.status IN ('resolved','ignored') OR
  OLD.status IN ('resolved','ignored') AND NEW.status='new' OR
  OLD.status=NEW.status
)
BEGIN SELECT RAISE(ABORT,'invalid supervision alert transition'); END;

INSERT INTO supervision_rules(code,name,category,description,threshold_json,severity,automatic_action,cooldown_seconds) VALUES
('station_low','Station presque vide','stations','Station avec trop peu de vélos disponibles.',json_object('bikes',2),'warning',NULL,1800),
('station_full','Station presque pleine','stations','Station avec trop peu de places libres.',json_object('freeDocks',2),'warning',NULL,1800),
('long_ride','Trajet anormalement long','rides','Trajet actif dépassant la durée attendue.',json_object('minutes',180),'critical',NULL,3600),
('bike_incidents','Incidents vélo répétés','bikes','Vélo avec plusieurs incidents ouverts.',json_object('count',3),'critical','bike_maintenance',3600),
('maintenance_due','Maintenance en retard','maintenance','Maintenance ou inspection arrivée à échéance.',json_object(),'warning',NULL,3600),
('ticket_urgent','Ticket urgent non traité','support','Ticket urgent sans traitement dans le délai.',json_object('minutes',60),'critical',NULL,1800),
('bike_dock_inconsistent','Incohérence vélo et dock','infrastructure','État vélo, station ou dock incohérent.',json_object(),'critical',NULL,900),
('field_task_overdue','Mission terrain en retard','field','Mission terrain active après son échéance.',json_object(),'warning',NULL,1800),
('device_offline','Équipement hors ligne','devices','Équipement actif sans communication récente.',json_object('minutes',30),'warning',NULL,1800);
