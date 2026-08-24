import { checker, createUser, webhook } from './subscription-test-utils.mjs';

const base = process.argv[2] || 'http://127.0.0.1:8821';
const secret = process.argv[3] || 'Pikala-payment-test-secret-2026';
const { check, report } = checker();
const owner = await createUser(base, 'Paiement');
const outsider = await createUser(base, 'Externe');

let value = await owner.request('/api/plans');
check('plans pilotés par D1', value.response.status === 200 && value.data.plans.length >= 2 && value.data.plans.every((plan) => plan.amountMinor >= 0 && plan.currency && plan.durationDays), JSON.stringify(value.data.plans));
check('traductions et avantages en base', value.data.plans.filter((plan) => plan.slug.startsWith('pikala-')).every((plan) => plan.translations.ar && Array.isArray(plan.benefits)), 'données incomplètes');
check('provider de test configuré', value.data.paymentProvider.configured === true && value.data.paymentProvider.name === 'test', JSON.stringify(value.data.paymentProvider));

const idempotency = `checkout-${Date.now()}`;
value = await owner.request('/api/subscriptions/checkout', { method: 'POST', headers: { 'idempotency-key': idempotency }, body: { plan: 'pikala-30', amountMinor: 1, currency: 'EUR' } });
check('montant frontend ignoré', value.response.status === 202 && value.data.payment.amountMinor === 9900 && value.data.payment.currency === 'MAD', JSON.stringify(value.data));
check('paiement seulement processing', value.data.payment.status === 'processing', JSON.stringify(value.data.payment));
const payment = value.data.payment;
const providerPaymentId = `test:${payment.reference}`;

value = await owner.request('/api/subscriptions/checkout', { method: 'POST', headers: { 'idempotency-key': idempotency }, body: { plan: 'pikala-365' } });
check('double checkout idempotent', value.response.status === 200 && value.data.idempotent && value.data.payment.reference === payment.reference, JSON.stringify(value.data));
value = await owner.request('/api/subscriptions');
check('processing ne donne aucun droit', value.data.active === null && value.data.payments[0].status === 'processing', JSON.stringify(value.data));
value = await outsider.request(`/api/payments/${payment.reference}`);
check('paiement tiers masqué', value.response.status === 404 && value.data.code === 'PAYMENT_NOT_FOUND', `${value.response.status}`);

let event = await webhook(base, secret, { eventId: `evt_invalid_${Date.now()}`, providerPaymentId, status: 'paid' }, 'invalid-signature');
check('signature webhook invalide refusée', event.response.status === 401 && event.data.code === 'WEBHOOK_SIGNATURE_INVALID', `${event.response.status} ${event.data?.code}`);
value = await owner.request('/api/subscriptions');
check('signature invalide sans activation', value.data.active === null, JSON.stringify(value.data.active));

event = await webhook(base, secret, { eventId: `evt_unknown_${Date.now()}`, providerPaymentId: 'test:pay_unknown_reference_123456', status: 'paid' });
check('événement inconnu ignoré proprement', event.response.status === 202 && event.data.ignored, JSON.stringify(event.data));

const paidEvent = { eventId: `evt_paid_${Date.now()}`, providerPaymentId, status: 'paid' };
event = await webhook(base, secret, paidEvent);
check('confirmation signée acceptée', event.response.status === 200 && event.data.received && event.data.changed, JSON.stringify(event.data));
event = await webhook(base, secret, paidEvent);
check('replay webhook idempotent', event.response.status === 200 && event.data.duplicate, JSON.stringify(event.data));
event = await webhook(base, secret, { ...paidEvent, eventId: `evt_paid_duplicate_${Date.now()}` });
check('double confirmation sans double abonnement', event.response.status === 200 && event.data.changed === false, JSON.stringify(event.data));

value = await owner.request('/api/subscriptions');
check('abonnement activé uniquement après paid', value.data.active?.plan_slug === 'pikala-30' && value.data.active.status === 'active', JSON.stringify(value.data.active));
check('expiration calculée', Date.parse(value.data.active.current_period_end) > Date.now(), value.data.active.current_period_end);
check('historique abonnement présent', value.data.history.length === 1 && value.data.payments[0].status === 'paid', JSON.stringify(value.data));
const activeId = value.data.active.id;
value = await owner.request(`/api/subscriptions/${activeId}/cancel`, { method: 'POST', body: {} });
check('annulation en fin de période', value.response.status === 200, `${value.response.status}`);
value = await owner.request('/api/subscriptions');
check('accès conservé jusqu’à expiration', value.data.active?.cancel_at_period_end === true, JSON.stringify(value.data.active));

const renewalKey = `renew-${Date.now()}`;
value = await owner.request('/api/subscriptions/checkout', { method: 'POST', headers: { 'idempotency-key': renewalKey }, body: { plan: 'pikala-30' } });
check('renouvellement créé sans remplacer actif', value.response.status === 202 && value.data.payment.status === 'processing', JSON.stringify(value.data));
const renewal = value.data.payment;
event = await webhook(base, secret, { eventId: `evt_failed_${Date.now()}`, providerPaymentId: `test:${renewal.reference}`, status: 'failed' });
check('échec de renouvellement enregistré', event.response.status === 200 && event.data.changed, JSON.stringify(event.data));
value = await owner.request('/api/subscriptions');
check('échec ne désactive pas abonnement actuel', value.data.active?.id === activeId && value.data.payments.some((item) => item.status === 'failed'), JSON.stringify(value.data));

const cancelledKey = `cancelled-${Date.now()}`;
value = await owner.request('/api/subscriptions/checkout', { method: 'POST', headers: { 'idempotency-key': cancelledKey }, body: { plan: 'pikala-365' } });
const cancelledPayment = value.data.payment;
event = await webhook(base, secret, { eventId: `evt_cancelled_${Date.now()}`, providerPaymentId: `test:${cancelledPayment.reference}`, status: 'cancelled' });
check('paiement annulé enregistré', event.response.status === 200 && event.data.changed, JSON.stringify(event.data));

event = await webhook(base, secret, { eventId: `evt_refund_${Date.now()}`, providerPaymentId, status: 'refunded' });
check('remboursement signé enregistré', event.response.status === 200 && event.data.changed, JSON.stringify(event.data));
value = await owner.request('/api/subscriptions');
check('remboursement retire abonnement lié', value.data.active === null && value.data.payments.some((item) => item.status === 'refunded'), JSON.stringify(value.data));

value = await owner.request('/api/admin/plans');
check('gestion plans interdite au non-admin', value.response.status === 403 && value.data.code === 'FORBIDDEN', `${value.response.status}`);
report('Crash-test abonnements valide');
