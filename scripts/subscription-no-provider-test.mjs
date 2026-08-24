import { checker, createUser } from './subscription-test-utils.mjs';

const base = process.argv[2] || 'http://127.0.0.1:8820';
const { check, report } = checker();
const user = await createUser(base, 'Sans Provider');

let value = await user.request('/api/plans');
check('offres réelles disponibles', value.response.status === 200 && value.data.plans.some((plan) => plan.slug === 'pikala-30' && plan.durationDays === 30 && plan.benefits.length > 0), JSON.stringify(value.data));
check('provider annoncé indisponible', value.data.paymentProvider.configured === false, JSON.stringify(value.data.paymentProvider));
value = await user.request('/api/subscriptions/checkout', { method: 'POST', headers: { 'idempotency-key': `none-${Date.now()}` }, body: { plan: 'pikala-30' } });
check('checkout payant bloqué sans provider', value.response.status === 503 && value.data.code === 'PAYMENT_PROVIDER_UNAVAILABLE', `${value.response.status} ${value.data?.code}`);
value = await user.request('/api/subscriptions');
check('aucun abonnement activé', value.response.status === 200 && value.data.active === null, JSON.stringify(value.data.active));
check('aucun faux paiement créé', value.data.payments.length === 0, JSON.stringify(value.data.payments));
report('Test sans provider valide');
