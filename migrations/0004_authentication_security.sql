-- Pikala V2 authentication and session hardening.
-- This migration is additive and preserves all existing users and sessions.

ALTER TABLE users ADD COLUMN auth_version INTEGER NOT NULL DEFAULT 1 CHECK (auth_version > 0);
ALTER TABLE users ADD COLUMN email_verified_at TEXT;
ALTER TABLE users ADD COLUMN password_changed_at TEXT;
ALTER TABLE users ADD COLUMN failed_login_count INTEGER NOT NULL DEFAULT 0 CHECK (failed_login_count >= 0);
ALTER TABLE users ADD COLUMN locked_until TEXT;

ALTER TABLE sessions ADD COLUMN auth_version INTEGER NOT NULL DEFAULT 1 CHECK (auth_version > 0);
ALTER TABLE sessions ADD COLUMN csrf_token_hash TEXT;
ALTER TABLE sessions ADD COLUMN authenticated_at TEXT;

CREATE TABLE auth_rate_limits (
  rate_key TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  window_started_at TEXT NOT NULL,
  blocked_until TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE security_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  event_type TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('success', 'failure', 'blocked')),
  request_id TEXT NOT NULL,
  ip_hash TEXT,
  metadata_json TEXT CHECK (metadata_json IS NULL OR json_valid(metadata_json)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

UPDATE users
SET email_verified_at = COALESCE(email_verified_at, created_at)
WHERE email_verified = 1;

UPDATE users
SET password_changed_at = COALESCE(password_changed_at, created_at);

UPDATE sessions
SET authenticated_at = COALESCE(authenticated_at, created_at),
    auth_version = COALESCE(auth_version, 1);

CREATE INDEX idx_users_lockout ON users(locked_until) WHERE locked_until IS NOT NULL;
CREATE INDEX idx_sessions_auth_version ON sessions(user_id, auth_version, expires_at) WHERE revoked_at IS NULL;
CREATE INDEX idx_rate_limits_action_updated ON auth_rate_limits(action, updated_at);
CREATE INDEX idx_security_events_user_created ON security_events(user_id, created_at);
CREATE INDEX idx_security_events_type_created ON security_events(event_type, created_at);

CREATE TRIGGER guard_security_events_no_update BEFORE UPDATE ON security_events
BEGIN SELECT RAISE(ABORT, 'security events are append-only'); END;

CREATE TRIGGER guard_security_events_no_delete BEFORE DELETE ON security_events
BEGIN SELECT RAISE(ABORT, 'security events are append-only'); END;

PRAGMA optimize;
