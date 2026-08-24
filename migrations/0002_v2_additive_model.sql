-- Additive Pikala V2 data model.
-- Existing identifiers and legacy columns are intentionally preserved.
PRAGMA defer_foreign_keys = ON;

ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'disabled'));
ALTER TABLE users ADD COLUMN locale TEXT NOT NULL DEFAULT 'fr' CHECK (locale IN ('fr', 'en', 'es', 'pt', 'ar'));
ALTER TABLE users ADD COLUMN updated_at TEXT;
ALTER TABLE users ADD COLUMN last_login_at TEXT;

ALTER TABLE sessions ADD COLUMN last_seen_at TEXT;
ALTER TABLE sessions ADD COLUMN device_name TEXT;

ALTER TABLE email_verifications ADD COLUMN requested_ip TEXT;

CREATE TABLE password_reset_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  requested_ip TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

ALTER TABLE stations ADD COLUMN public_code TEXT;
ALTER TABLE stations ADD COLUMN slug TEXT;
ALTER TABLE stations ADD COLUMN capacity INTEGER CHECK (capacity IS NULL OR capacity >= 0);
ALTER TABLE stations ADD COLUMN timezone TEXT NOT NULL DEFAULT 'Africa/Casablanca';
ALTER TABLE stations ADD COLUMN updated_at TEXT;

CREATE TABLE docks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  station_id INTEGER NOT NULL,
  position INTEGER NOT NULL CHECK (position > 0),
  public_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'maintenance', 'disabled')),
  bike_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE RESTRICT,
  FOREIGN KEY (bike_id) REFERENCES bikes(id) ON DELETE SET NULL,
  UNIQUE (station_id, position),
  UNIQUE (bike_id)
);

ALTER TABLE bikes ADD COLUMN public_code TEXT;
ALTER TABLE bikes ADD COLUMN model TEXT;
ALTER TABLE bikes ADD COLUMN serial_number TEXT;
ALTER TABLE bikes ADD COLUMN last_service_at TEXT;
ALTER TABLE bikes ADD COLUMN updated_at TEXT;
ALTER TABLE bikes ADD COLUMN retired_at TEXT;

CREATE TABLE plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  amount_minor INTEGER CHECK (amount_minor IS NULL OR amount_minor >= 0),
  currency TEXT NOT NULL DEFAULT 'MAD' CHECK (length(currency) = 3),
  billing_period TEXT NOT NULL DEFAULT 'month' CHECK (billing_period IN ('day', 'week', 'month', 'year', 'one_time')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived', 'legacy')),
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE subscriptions ADD COLUMN plan_id INTEGER REFERENCES plans(id) ON DELETE RESTRICT;
ALTER TABLE subscriptions ADD COLUMN current_period_start TEXT;
ALTER TABLE subscriptions ADD COLUMN current_period_end TEXT;
ALTER TABLE subscriptions ADD COLUMN cancel_at_period_end INTEGER NOT NULL DEFAULT 0 CHECK (cancel_at_period_end IN (0, 1));
ALTER TABLE subscriptions ADD COLUMN cancelled_at TEXT;
ALTER TABLE subscriptions ADD COLUMN provider_subscription_id TEXT;
ALTER TABLE subscriptions ADD COLUMN updated_at TEXT;

CREATE TABLE payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  subscription_id INTEGER,
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
  currency TEXT NOT NULL DEFAULT 'MAD' CHECK (length(currency) = 3),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'requires_action', 'paid', 'failed', 'cancelled', 'refunded', 'partially_refunded')),
  provider TEXT,
  provider_payment_id TEXT,
  idempotency_key TEXT,
  failure_code TEXT,
  paid_at TEXT,
  refunded_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL
);

ALTER TABLE rides ADD COLUMN start_dock_id INTEGER REFERENCES docks(id) ON DELETE SET NULL;
ALTER TABLE rides ADD COLUMN end_dock_id INTEGER REFERENCES docks(id) ON DELETE SET NULL;
ALTER TABLE rides ADD COLUMN duration_seconds INTEGER CHECK (duration_seconds IS NULL OR duration_seconds >= 0);
ALTER TABLE rides ADD COLUMN distance_meters INTEGER CHECK (distance_meters IS NULL OR distance_meters >= 0);
ALTER TABLE rides ADD COLUMN charged_amount_minor INTEGER CHECK (charged_amount_minor IS NULL OR charged_amount_minor >= 0);
ALTER TABLE rides ADD COLUMN updated_at TEXT;

ALTER TABLE support_tickets ADD COLUMN category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'account', 'payment', 'station', 'bike', 'ride', 'safety'));
ALTER TABLE support_tickets ADD COLUMN priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent'));
ALTER TABLE support_tickets ADD COLUMN assigned_to_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE support_tickets ADD COLUMN updated_at TEXT;
ALTER TABLE support_tickets ADD COLUMN closed_at TEXT;

CREATE TABLE bike_incidents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bike_id INTEGER NOT NULL,
  ride_id INTEGER,
  station_id INTEGER,
  reported_by_user_id INTEGER,
  assigned_to_user_id INTEGER,
  category TEXT NOT NULL CHECK (category IN ('damage', 'mechanical', 'battery', 'lock', 'missing', 'safety', 'other')),
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'triaged', 'in_progress', 'resolved', 'closed')),
  description TEXT NOT NULL,
  resolution_notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT,
  FOREIGN KEY (bike_id) REFERENCES bikes(id) ON DELETE RESTRICT,
  FOREIGN KEY (ride_id) REFERENCES rides(id) ON DELETE SET NULL,
  FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE SET NULL,
  FOREIGN KEY (reported_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_to_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app', 'email', 'push')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'read', 'dismissed')),
  payload_json TEXT CHECK (payload_json IS NULL OR json_valid(payload_json)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at TEXT,
  read_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE admin_audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_user_id INTEGER,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  request_id TEXT,
  ip_hint TEXT,
  metadata_json TEXT CHECK (metadata_json IS NULL OR json_valid(metadata_json)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Backfill only the new columns; legacy values remain untouched.
UPDATE users SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE sessions SET last_seen_at = created_at WHERE last_seen_at IS NULL;
UPDATE stations SET public_code = 'station-' || printf('%06d', id) WHERE public_code IS NULL;
UPDATE stations SET slug = 'station-' || printf('%06d', id) WHERE slug IS NULL;
UPDATE stations SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE bikes SET public_code = code WHERE public_code IS NULL;
UPDATE bikes SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE rides SET updated_at = COALESCE(ended_at, started_at) WHERE updated_at IS NULL;
UPDATE support_tickets SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE subscriptions SET current_period_start = starts_at WHERE current_period_start IS NULL;
UPDATE subscriptions SET current_period_end = ends_at WHERE current_period_end IS NULL AND ends_at IS NOT NULL;
UPDATE subscriptions SET updated_at = COALESCE(ends_at, starts_at) WHERE updated_at IS NULL;

-- Preserve each legacy plan label and link subscriptions without inventing a price.
INSERT OR IGNORE INTO plans (slug, name, amount_minor, status, description)
SELECT 'legacy-' || lower(hex(CAST(plan AS BLOB))), plan, NULL, 'legacy', 'Imported from the Pikala V1 subscription label.'
FROM subscriptions
GROUP BY plan;

UPDATE subscriptions
SET plan_id = (
  SELECT plans.id FROM plans
  WHERE plans.slug = 'legacy-' || lower(hex(CAST(subscriptions.plan AS BLOB)))
)
WHERE plan_id IS NULL;

PRAGMA defer_foreign_keys = OFF;
