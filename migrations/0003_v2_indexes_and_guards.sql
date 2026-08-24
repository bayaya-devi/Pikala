-- Query indexes and compatibility guards for legacy columns that cannot receive
-- a CHECK constraint through SQLite ADD COLUMN without rebuilding their table.

CREATE UNIQUE INDEX idx_users_email_normalized ON users(lower(email));
CREATE INDEX idx_users_status_role ON users(status, role);
CREATE INDEX idx_sessions_user_expiry ON sessions(user_id, expires_at);
CREATE INDEX idx_sessions_valid_token ON sessions(token_hash, expires_at) WHERE revoked_at IS NULL;
CREATE INDEX idx_email_verifications_user_expiry ON email_verifications(user_id, expires_at);
CREATE INDEX idx_password_reset_user_expiry ON password_reset_tokens(user_id, expires_at);
CREATE UNIQUE INDEX idx_stations_public_code ON stations(public_code) WHERE public_code IS NOT NULL;
CREATE UNIQUE INDEX idx_stations_slug ON stations(slug) WHERE slug IS NOT NULL;
CREATE INDEX idx_stations_active_city ON stations(is_active, city);
CREATE UNIQUE INDEX idx_bikes_public_code ON bikes(public_code) WHERE public_code IS NOT NULL;
CREATE UNIQUE INDEX idx_bikes_serial_number ON bikes(serial_number) WHERE serial_number IS NOT NULL;
CREATE INDEX idx_bikes_station_status ON bikes(station_id, status);
CREATE INDEX idx_docks_station_status ON docks(station_id, status);
CREATE INDEX idx_plans_status_order ON plans(status, display_order, id);
CREATE UNIQUE INDEX idx_subscriptions_one_active_user ON subscriptions(user_id) WHERE status = 'active';
CREATE UNIQUE INDEX idx_subscriptions_provider_id ON subscriptions(provider_subscription_id) WHERE provider_subscription_id IS NOT NULL;
CREATE INDEX idx_subscriptions_user_status ON subscriptions(user_id, status, starts_at);
CREATE UNIQUE INDEX idx_payments_provider_id ON payments(provider, provider_payment_id) WHERE provider_payment_id IS NOT NULL;
CREATE UNIQUE INDEX idx_payments_idempotency ON payments(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX idx_payments_user_created ON payments(user_id, created_at);
CREATE UNIQUE INDEX idx_rides_one_active_bike ON rides(bike_id) WHERE status = 'active' AND bike_id IS NOT NULL;
CREATE INDEX idx_rides_user_started ON rides(user_id, started_at);
CREATE INDEX idx_rides_status_started ON rides(status, started_at);
CREATE INDEX idx_support_status_created ON support_tickets(status, created_at);
CREATE INDEX idx_support_assignee_status ON support_tickets(assigned_to_user_id, status);
CREATE INDEX idx_incidents_bike_status ON bike_incidents(bike_id, status, created_at);
CREATE INDEX idx_incidents_assignee_status ON bike_incidents(assigned_to_user_id, status);
CREATE INDEX idx_notifications_user_status ON notifications(user_id, status, created_at);
CREATE INDEX idx_audit_actor_created ON admin_audit_logs(actor_user_id, created_at);
CREATE INDEX idx_audit_target ON admin_audit_logs(target_type, target_id, created_at);

CREATE TRIGGER guard_audit_no_update BEFORE UPDATE ON admin_audit_logs
BEGIN SELECT RAISE(ABORT, 'admin audit logs are append-only'); END;
CREATE TRIGGER guard_audit_no_delete BEFORE DELETE ON admin_audit_logs
BEGIN SELECT RAISE(ABORT, 'admin audit logs are append-only'); END;

CREATE TRIGGER guard_users_role_insert BEFORE INSERT ON users
WHEN NEW.role NOT IN ('user', 'support', 'operator', 'admin')
BEGIN SELECT RAISE(ABORT, 'invalid users.role'); END;
CREATE TRIGGER guard_users_role_update BEFORE UPDATE OF role ON users
WHEN NEW.role NOT IN ('user', 'support', 'operator', 'admin')
BEGIN SELECT RAISE(ABORT, 'invalid users.role'); END;

CREATE TRIGGER guard_stations_insert BEFORE INSERT ON stations
WHEN NEW.is_active NOT IN (0, 1) OR NEW.bikes_available < 0
  OR (NEW.latitude IS NOT NULL AND (NEW.latitude < -90 OR NEW.latitude > 90))
  OR (NEW.longitude IS NOT NULL AND (NEW.longitude < -180 OR NEW.longitude > 180))
BEGIN SELECT RAISE(ABORT, 'invalid station values'); END;
CREATE TRIGGER guard_stations_update BEFORE UPDATE ON stations
WHEN NEW.is_active NOT IN (0, 1) OR NEW.bikes_available < 0
  OR (NEW.latitude IS NOT NULL AND (NEW.latitude < -90 OR NEW.latitude > 90))
  OR (NEW.longitude IS NOT NULL AND (NEW.longitude < -180 OR NEW.longitude > 180))
BEGIN SELECT RAISE(ABORT, 'invalid station values'); END;

CREATE TRIGGER guard_bikes_insert BEFORE INSERT ON bikes
WHEN NEW.status NOT IN ('available', 'reserved', 'in_use', 'maintenance', 'disabled', 'lost', 'retired')
  OR (NEW.battery_level IS NOT NULL AND (NEW.battery_level < 0 OR NEW.battery_level > 100))
BEGIN SELECT RAISE(ABORT, 'invalid bike values'); END;
CREATE TRIGGER guard_bikes_update BEFORE UPDATE ON bikes
WHEN NEW.status NOT IN ('available', 'reserved', 'in_use', 'maintenance', 'disabled', 'lost', 'retired')
  OR (NEW.battery_level IS NOT NULL AND (NEW.battery_level < 0 OR NEW.battery_level > 100))
BEGIN SELECT RAISE(ABORT, 'invalid bike values'); END;

CREATE TRIGGER guard_subscriptions_insert BEFORE INSERT ON subscriptions
WHEN NEW.status NOT IN ('pending', 'trialing', 'active', 'past_due', 'paused', 'cancelled', 'expired', 'inactive')
BEGIN SELECT RAISE(ABORT, 'invalid subscriptions.status'); END;
CREATE TRIGGER guard_subscriptions_update BEFORE UPDATE OF status ON subscriptions
WHEN NEW.status NOT IN ('pending', 'trialing', 'active', 'past_due', 'paused', 'cancelled', 'expired', 'inactive')
BEGIN SELECT RAISE(ABORT, 'invalid subscriptions.status'); END;

CREATE TRIGGER guard_rides_insert BEFORE INSERT ON rides
WHEN NEW.status NOT IN ('reserved', 'active', 'completed', 'cancelled', 'disputed')
BEGIN SELECT RAISE(ABORT, 'invalid rides.status'); END;
CREATE TRIGGER guard_rides_update BEFORE UPDATE OF status ON rides
WHEN NEW.status NOT IN ('reserved', 'active', 'completed', 'cancelled', 'disputed')
BEGIN SELECT RAISE(ABORT, 'invalid rides.status'); END;

CREATE TRIGGER guard_support_insert BEFORE INSERT ON support_tickets
WHEN NEW.status NOT IN ('open', 'in_progress', 'waiting_user', 'resolved', 'closed')
BEGIN SELECT RAISE(ABORT, 'invalid support_tickets.status'); END;
CREATE TRIGGER guard_support_update BEFORE UPDATE OF status ON support_tickets
WHEN NEW.status NOT IN ('open', 'in_progress', 'waiting_user', 'resolved', 'closed')
BEGIN SELECT RAISE(ABORT, 'invalid support_tickets.status'); END;

CREATE TRIGGER touch_users_updated_at AFTER UPDATE ON users
WHEN NEW.updated_at IS OLD.updated_at BEGIN UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; END;
CREATE TRIGGER touch_stations_updated_at AFTER UPDATE ON stations
WHEN NEW.updated_at IS OLD.updated_at BEGIN UPDATE stations SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; END;
CREATE TRIGGER touch_bikes_updated_at AFTER UPDATE ON bikes
WHEN NEW.updated_at IS OLD.updated_at BEGIN UPDATE bikes SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; END;
CREATE TRIGGER touch_docks_updated_at AFTER UPDATE ON docks
WHEN NEW.updated_at IS OLD.updated_at BEGIN UPDATE docks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; END;
CREATE TRIGGER touch_plans_updated_at AFTER UPDATE ON plans
WHEN NEW.updated_at IS OLD.updated_at BEGIN UPDATE plans SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; END;
CREATE TRIGGER touch_subscriptions_updated_at AFTER UPDATE ON subscriptions
WHEN NEW.updated_at IS OLD.updated_at BEGIN UPDATE subscriptions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; END;
CREATE TRIGGER touch_payments_updated_at AFTER UPDATE ON payments
WHEN NEW.updated_at IS OLD.updated_at BEGIN UPDATE payments SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; END;
CREATE TRIGGER touch_rides_updated_at AFTER UPDATE ON rides
WHEN NEW.updated_at IS OLD.updated_at BEGIN UPDATE rides SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; END;
CREATE TRIGGER touch_support_updated_at AFTER UPDATE ON support_tickets
WHEN NEW.updated_at IS OLD.updated_at BEGIN UPDATE support_tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; END;
CREATE TRIGGER touch_incidents_updated_at AFTER UPDATE ON bike_incidents
WHEN NEW.updated_at IS OLD.updated_at BEGIN UPDATE bike_incidents SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; END;

PRAGMA optimize;
