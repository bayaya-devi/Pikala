const PLAN_FIELDS = `plans.id, plans.slug, plans.name, plans.description, plans.amount_minor, plans.currency,
  plans.billing_period, plans.duration_days, plans.benefits_json, plans.translations_json,
  plans.is_featured, plans.status, plans.display_order, plans.version`;

export function parseJson(value, fallback) {
  try { return JSON.parse(value); } catch { return fallback; }
}

export function serializePlan(row) {
  if (!row) return null;
  return {
    id: row.id, slug: row.slug, name: row.name, description: row.description || '',
    amountMinor: Number(row.amount_minor), currency: row.currency, billingPeriod: row.billing_period,
    durationDays: Number(row.duration_days), benefits: parseJson(row.benefits_json, []),
    translations: parseJson(row.translations_json, {}), featured: Boolean(row.is_featured),
    status: row.status, displayOrder: Number(row.display_order), version: Number(row.version),
    amount_minor: Number(row.amount_minor), amount_mad: Number(row.amount_minor) / 100,
    billing_period: row.billing_period, summary: row.description || ''
  };
}

export async function listActivePlans(DB) {
  const { results } = await DB.prepare(`SELECT ${PLAN_FIELDS} FROM plans
    WHERE status = 'active' AND amount_minor IS NOT NULL AND duration_days IS NOT NULL
    ORDER BY display_order, amount_minor, id`).all();
  return (results || []).map(serializePlan);
}

export async function findActivePlan(DB, slug) {
  return DB.prepare(`SELECT ${PLAN_FIELDS} FROM plans WHERE slug = ? AND status = 'active'
    AND amount_minor IS NOT NULL AND duration_days IS NOT NULL LIMIT 1`).bind(slug).first();
}

export async function refreshUserSubscriptions(DB, userId, now = new Date()) {
  const nowIso = now.toISOString();
  await DB.batch([
    DB.prepare(`UPDATE subscriptions SET status = 'expired', expired_at = ?, ends_at = COALESCE(ends_at, ?), updated_at = ?
      WHERE user_id = ? AND status = 'active' AND current_period_end IS NOT NULL AND current_period_end <= ?`)
      .bind(nowIso, nowIso, nowIso, userId, nowIso),
    DB.prepare(`UPDATE subscriptions SET status = 'active', activated_at = COALESCE(activated_at, ?), starts_at = COALESCE(starts_at, current_period_start), updated_at = ?
      WHERE id = (SELECT pending.id FROM subscriptions pending
        JOIN payments ON payments.id = pending.activation_payment_id
        WHERE pending.user_id = ? AND pending.status = 'pending' AND pending.current_period_start <= ?
          AND payments.lifecycle_status = 'paid'
          AND NOT EXISTS (SELECT 1 FROM subscriptions active WHERE active.user_id = ? AND active.status = 'active')
        ORDER BY pending.current_period_start, pending.id LIMIT 1)`)
      .bind(nowIso, nowIso, userId, nowIso, userId)
  ]);
}

const SUBSCRIPTION_SELECT = `subscriptions.id, subscriptions.status, subscriptions.starts_at, subscriptions.ends_at,
  subscriptions.current_period_start, subscriptions.current_period_end, subscriptions.cancel_at_period_end,
  subscriptions.cancelled_at, subscriptions.activated_at, subscriptions.expired_at, subscriptions.auto_renew,
  subscriptions.renewed_from_subscription_id, plans.slug AS plan_slug, plans.name AS plan_name,
  plans.duration_days, plans.translations_json, payments.public_reference AS payment_reference`;

export async function subscriptionOverview(DB, userId) {
  await refreshUserSubscriptions(DB, userId);
  const [activeResult, scheduledResult, historyResult, paymentResult] = await DB.batch([
    DB.prepare(`SELECT ${SUBSCRIPTION_SELECT} FROM subscriptions
      JOIN plans ON plans.id = subscriptions.plan_id LEFT JOIN payments ON payments.id = subscriptions.activation_payment_id
      WHERE subscriptions.user_id = ? AND subscriptions.status = 'active' ORDER BY subscriptions.id DESC LIMIT 1`).bind(userId),
    DB.prepare(`SELECT ${SUBSCRIPTION_SELECT} FROM subscriptions
      JOIN plans ON plans.id = subscriptions.plan_id LEFT JOIN payments ON payments.id = subscriptions.activation_payment_id
      WHERE subscriptions.user_id = ? AND subscriptions.status = 'pending' ORDER BY subscriptions.current_period_start, subscriptions.id`).bind(userId),
    DB.prepare(`SELECT ${SUBSCRIPTION_SELECT} FROM subscriptions
      JOIN plans ON plans.id = subscriptions.plan_id LEFT JOIN payments ON payments.id = subscriptions.activation_payment_id
      WHERE subscriptions.user_id = ? ORDER BY subscriptions.id DESC LIMIT 50`).bind(userId),
    DB.prepare(`SELECT payments.public_reference, payments.lifecycle_status AS status, payments.amount_minor, payments.currency,
      payments.provider, payments.plan_name_snapshot, payments.plan_duration_days_snapshot,
      payments.created_at, payments.paid_at, payments.refunded_at, payments.failure_code, plans.slug AS plan_slug
      FROM payments LEFT JOIN plans ON plans.id = payments.plan_id
      WHERE payments.user_id = ? ORDER BY payments.id DESC LIMIT 50`).bind(userId)
  ]);
  const normalize = (row) => row ? { ...row, cancel_at_period_end: Boolean(row.cancel_at_period_end), auto_renew: Boolean(row.auto_renew), translations: parseJson(row.translations_json, {}) } : null;
  return {
    active: normalize(activeResult.results?.[0] || null),
    scheduled: (scheduledResult.results || []).map(normalize),
    history: (historyResult.results || []).map(normalize),
    payments: paymentResult.results || []
  };
}

export function periodForPayment(payment, activeSubscription, now = new Date()) {
  const activeEnd = activeSubscription?.current_period_end ? new Date(activeSubscription.current_period_end) : null;
  const start = activeEnd && activeEnd > now ? activeEnd : now;
  const end = new Date(start.getTime() + Number(payment.plan_duration_days_snapshot) * 86400000);
  return { start: start.toISOString(), end: end.toISOString(), status: activeEnd && activeEnd > now ? 'pending' : 'active' };
}

export async function activatePaidPayment(DB, payment, event, now = new Date()) {
  await refreshUserSubscriptions(DB, payment.user_id, now);
  const active = await DB.prepare("SELECT id, current_period_end FROM subscriptions WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1").bind(payment.user_id).first();
  const period = periodForPayment(payment, active, now);
  const legacyStatus = 'paid';
  const nowIso = now.toISOString();
  const results = await DB.batch([
    DB.prepare(`INSERT INTO payment_events (provider, provider_event_id, payment_id, event_type, payload_hash)
      VALUES (?, ?, ?, ?, ?)`).bind(payment.provider, event.eventId, payment.id, event.eventType, event.payloadHash),
    DB.prepare(`UPDATE payments SET lifecycle_status = 'paid', status = ?, provider_event_id = ?, provider_confirmed_at = ?, paid_at = COALESCE(paid_at, ?), updated_at = ?
      WHERE id = ? AND lifecycle_status IN ('pending', 'processing')`).bind(legacyStatus, event.eventId, nowIso, nowIso, nowIso, payment.id),
    DB.prepare(`INSERT INTO subscriptions
      (user_id, plan, plan_id, status, starts_at, ends_at, current_period_start, current_period_end,
       activation_payment_id, renewed_from_subscription_id, activated_at, auto_renew, updated_at)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?
      WHERE EXISTS (SELECT 1 FROM payments WHERE id = ? AND lifecycle_status = 'paid')
        AND NOT EXISTS (SELECT 1 FROM subscriptions WHERE activation_payment_id = ?)`)
      .bind(payment.user_id, payment.plan_name_snapshot, payment.plan_id, period.status, period.start, period.end,
        period.start, period.end, payment.id, active?.id || null, period.status === 'active' ? nowIso : null,
        nowIso, payment.id, payment.id),
    DB.prepare(`UPDATE payments SET subscription_id = (SELECT id FROM subscriptions WHERE activation_payment_id = ?), updated_at = ?
      WHERE id = ? AND lifecycle_status = 'paid'`).bind(payment.id, nowIso, payment.id),
    DB.prepare(`UPDATE payment_events SET processing_status = 'processed', processed_at = ?
      WHERE provider = ? AND provider_event_id = ?`).bind(nowIso, payment.provider, event.eventId)
  ]);
  return { changed: Boolean(results[1].meta.changes), subscriptionId: results[2].meta.last_row_id || payment.subscription_id || null };
}

export async function recordNonPaidEvent(DB, payment, event, now = new Date()) {
  const allowed = {
    pending: new Set(['processing', 'failed', 'cancelled']),
    processing: new Set(['failed', 'cancelled']),
    paid: new Set(['refunded'])
  };
  const next = event.status;
  const accepted = allowed[payment.lifecycle_status]?.has(next) || false;
  const legacy = next === 'processing' ? 'requires_action' : next;
  const nowIso = now.toISOString();
  const statements = [
    DB.prepare(`INSERT INTO payment_events (provider, provider_event_id, payment_id, event_type, payload_hash, processing_status, processed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(payment.provider, event.eventId, payment.id, event.eventType, event.payloadHash, accepted ? 'processed' : 'ignored', nowIso)
  ];
  if (accepted) statements.push(DB.prepare(`UPDATE payments SET lifecycle_status = ?, status = ?, provider_event_id = ?, provider_confirmed_at = ?,
    refunded_at = CASE WHEN ? = 'refunded' THEN ? ELSE refunded_at END, updated_at = ? WHERE id = ? AND lifecycle_status = ?`)
    .bind(next, legacy, event.eventId, nowIso, next, nowIso, nowIso, payment.id, payment.lifecycle_status));
  if (accepted && next === 'refunded') statements.push(DB.prepare(`UPDATE subscriptions SET status = 'cancelled', cancelled_at = ?, ends_at = MIN(COALESCE(ends_at, ?), ?), updated_at = ?
    WHERE activation_payment_id = ? AND status IN ('active', 'pending')`).bind(nowIso, nowIso, nowIso, nowIso, payment.id));
  const results = await DB.batch(statements);
  return { changed: accepted && Boolean(results[1]?.meta.changes), ignored: !accepted };
}

export { PLAN_FIELDS };
