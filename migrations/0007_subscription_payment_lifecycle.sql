-- Subscription and payment lifecycle. Additive: no existing row is deleted.

ALTER TABLE plans ADD COLUMN duration_days INTEGER CHECK (duration_days IS NULL OR duration_days > 0);
ALTER TABLE plans ADD COLUMN benefits_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(benefits_json) AND json_type(benefits_json) = 'array');
ALTER TABLE plans ADD COLUMN translations_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(translations_json) AND json_type(translations_json) = 'object');
ALTER TABLE plans ADD COLUMN is_featured INTEGER NOT NULL DEFAULT 0 CHECK (is_featured IN (0, 1));
ALTER TABLE plans ADD COLUMN version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0);

ALTER TABLE subscriptions ADD COLUMN activation_payment_id INTEGER REFERENCES payments(id) ON DELETE RESTRICT;
ALTER TABLE subscriptions ADD COLUMN renewed_from_subscription_id INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL;
ALTER TABLE subscriptions ADD COLUMN activated_at TEXT;
ALTER TABLE subscriptions ADD COLUMN expired_at TEXT;
ALTER TABLE subscriptions ADD COLUMN auto_renew INTEGER NOT NULL DEFAULT 0 CHECK (auto_renew IN (0, 1));

ALTER TABLE payments ADD COLUMN plan_id INTEGER REFERENCES plans(id) ON DELETE RESTRICT;
ALTER TABLE payments ADD COLUMN public_reference TEXT;
ALTER TABLE payments ADD COLUMN lifecycle_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (lifecycle_status IN ('pending', 'processing', 'paid', 'failed', 'cancelled', 'refunded'));
ALTER TABLE payments ADD COLUMN provider_session_id TEXT;
ALTER TABLE payments ADD COLUMN provider_event_id TEXT;
ALTER TABLE payments ADD COLUMN checkout_expires_at TEXT;
ALTER TABLE payments ADD COLUMN provider_confirmed_at TEXT;
ALTER TABLE payments ADD COLUMN plan_name_snapshot TEXT;
ALTER TABLE payments ADD COLUMN plan_duration_days_snapshot INTEGER CHECK (plan_duration_days_snapshot IS NULL OR plan_duration_days_snapshot > 0);
ALTER TABLE payments ADD COLUMN benefits_json_snapshot TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(benefits_json_snapshot));
ALTER TABLE payments ADD COLUMN metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json));

UPDATE payments SET lifecycle_status = CASE status
  WHEN 'paid' THEN 'paid'
  WHEN 'failed' THEN 'failed'
  WHEN 'cancelled' THEN 'cancelled'
  WHEN 'refunded' THEN 'refunded'
  WHEN 'partially_refunded' THEN 'refunded'
  WHEN 'requires_action' THEN 'processing'
  ELSE 'pending' END;

CREATE TABLE payment_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  payment_id INTEGER,
  event_type TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  processing_status TEXT NOT NULL DEFAULT 'received'
    CHECK (processing_status IN ('received', 'processed', 'ignored', 'failed')),
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TEXT,
  error_code TEXT,
  FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL,
  UNIQUE (provider, provider_event_id)
);

CREATE UNIQUE INDEX idx_payments_public_reference ON payments(public_reference) WHERE public_reference IS NOT NULL;
CREATE UNIQUE INDEX idx_payments_provider_session ON payments(provider, provider_session_id) WHERE provider_session_id IS NOT NULL;
CREATE INDEX idx_payments_user_lifecycle ON payments(user_id, lifecycle_status, created_at);
CREATE UNIQUE INDEX idx_subscriptions_activation_payment ON subscriptions(activation_payment_id) WHERE activation_payment_id IS NOT NULL;
CREATE INDEX idx_subscriptions_user_period ON subscriptions(user_id, current_period_end, status);
CREATE INDEX idx_payment_events_payment ON payment_events(payment_id, received_at);

CREATE TRIGGER guard_payment_lifecycle_insert BEFORE INSERT ON payments
WHEN NEW.lifecycle_status NOT IN ('pending', 'processing', 'paid', 'failed', 'cancelled', 'refunded')
BEGIN SELECT RAISE(ABORT, 'invalid payment lifecycle status'); END;

CREATE TRIGGER guard_payment_lifecycle_update BEFORE UPDATE OF lifecycle_status ON payments
WHEN NEW.lifecycle_status NOT IN ('pending', 'processing', 'paid', 'failed', 'cancelled', 'refunded')
BEGIN SELECT RAISE(ABORT, 'invalid payment lifecycle status'); END;

CREATE TRIGGER guard_paid_subscription_insert BEFORE INSERT ON subscriptions
WHEN NEW.status = 'active' AND (
  NEW.activation_payment_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM payments paid_payment
    WHERE paid_payment.id = NEW.activation_payment_id
      AND paid_payment.user_id = NEW.user_id
      AND paid_payment.plan_id = NEW.plan_id
      AND paid_payment.lifecycle_status = 'paid'
  )
)
BEGIN SELECT RAISE(ABORT, 'active subscription requires a paid payment'); END;

CREATE TRIGGER guard_paid_subscription_update BEFORE UPDATE OF status, activation_payment_id, user_id, plan_id ON subscriptions
WHEN NEW.status = 'active' AND (
  NEW.activation_payment_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM payments paid_payment
    WHERE paid_payment.id = NEW.activation_payment_id
      AND paid_payment.user_id = NEW.user_id
      AND paid_payment.plan_id = NEW.plan_id
      AND paid_payment.lifecycle_status = 'paid'
  )
)
BEGIN SELECT RAISE(ABORT, 'active subscription requires a paid payment'); END;

INSERT OR IGNORE INTO plans
  (slug, name, description, amount_minor, currency, billing_period, status, display_order,
   duration_days, benefits_json, translations_json, is_featured, version)
VALUES
  ('pikala-30', 'Pikala 30 jours', 'Accès aux vélos Pikala pendant 30 jours.', 9900, 'MAD', 'month', 'active', 10, 30,
   json_array('Trajets inclus', 'Scanner QR', 'Support Pikala'),
   json_object(
     'fr', json_object('name','Pikala 30 jours','description','Accès aux vélos Pikala pendant 30 jours.','benefits',json_array('Trajets inclus','Scanner QR','Support Pikala')),
     'en', json_object('name','Pikala 30 days','description','Access Pikala bikes for 30 days.','benefits',json_array('Rides included','QR scanner','Pikala support')),
     'es', json_object('name','Pikala 30 días','description','Acceso a las bicicletas Pikala durante 30 días.','benefits',json_array('Trayectos incluidos','Escáner QR','Soporte Pikala')),
     'pt', json_object('name','Pikala 30 dias','description','Acesso às bicicletas Pikala durante 30 dias.','benefits',json_array('Viagens incluídas','Leitor QR','Apoio Pikala')),
     'ar', json_object('name','بيكالا 30 يومًا','description','استخدام دراجات بيكالا لمدة 30 يومًا.','benefits',json_array('الرحلات مشمولة','ماسح QR','دعم بيكالا'))
   ), 1, 1),
  ('pikala-365', 'Pikala 365 jours', 'Accès aux vélos Pikala pendant un an.', 89900, 'MAD', 'year', 'active', 20, 365,
   json_array('Trajets inclus', 'Scanner QR', 'Support prioritaire'),
   json_object(
     'fr', json_object('name','Pikala 365 jours','description','Accès aux vélos Pikala pendant un an.','benefits',json_array('Trajets inclus','Scanner QR','Support prioritaire')),
     'en', json_object('name','Pikala 365 days','description','Access Pikala bikes for one year.','benefits',json_array('Rides included','QR scanner','Priority support')),
     'es', json_object('name','Pikala 365 días','description','Acceso a las bicicletas Pikala durante un año.','benefits',json_array('Trayectos incluidos','Escáner QR','Soporte prioritario')),
     'pt', json_object('name','Pikala 365 dias','description','Acesso às bicicletas Pikala durante um ano.','benefits',json_array('Viagens incluídas','Leitor QR','Apoio prioritário')),
     'ar', json_object('name','بيكالا 365 يومًا','description','استخدام دراجات بيكالا لمدة عام.','benefits',json_array('الرحلات مشمولة','ماسح QR','دعم ذو أولوية'))
   ), 0, 1);

PRAGMA optimize;
