import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import copy from '../sitepikala/assets/js/i18n/subscriptions/copy.js';

const root=resolve(import.meta.dirname,'..');
const errors=[];
const check=(condition,message)=>{if(!condition) errors.push(message);};
const read=(path)=>readFile(resolve(root,path),'utf8');
const [worker,service,provider,migration,frontend,html,docs]=await Promise.all([
  read('src/worker.js'),read('src/payments/service.js'),read('src/payments/provider.js'),read('migrations/0007_subscription_payment_lifecycle.sql'),read('sitepikala/assets/js/subscriptions.js'),read('sitepikala/abonnement.html'),read('docs/payments.md')
]);
for(const route of ['/api/plans','/api/subscriptions/checkout','paymentStatusMatch','/api/admin/plans']) check(worker.includes(route),`Route absente: ${route}`);
for(const status of ['pending','processing','paid','failed','cancelled','refunded']) check(migration.includes(status),`Etat paiement absent: ${status}`);
check(migration.includes('payment_events')&&migration.includes('activation_payment_id'),'Migration paiement incomplete.');
check(migration.includes('guard_paid_subscription_insert')&&migration.includes('active subscription requires a paid payment'),'Protection D1 d activation absente.');
check(provider.includes('constantTimeEqual')&&provider.includes('HMAC'),'Verification cryptographique webhook absente.');
check(service.includes("lifecycle_status = 'paid'")&&service.includes('NOT EXISTS (SELECT 1 FROM subscriptions WHERE activation_payment_id'),'Activation idempotente absente.');
check(!frontend.includes('amountMinor:')&&!frontend.includes('amount_minor:'),'Le frontend tente de fixer le montant.');
check(frontend.includes("api('/api/plans')")&&frontend.includes("api('/api/subscriptions')"),'Offres ou historique non branches aux API.');
check(frontend.includes('Idempotency-Key')&&frontend.includes('crypto.randomUUID'),'Idempotence checkout absente.');
check(!html.includes('data-activate-subscription')&&html.includes('data-subscription-page'),'Ancien flux abonnement encore present.');
check(docs.includes('NEVER')||docs.includes('jamais'),'Documentation de non-activation absente.');
const reference=Object.keys(copy.fr).sort();
for(const locale of ['fr','en','es','pt','ar']) check(reference.every((key)=>Object.hasOwn(copy[locale],key)),`${locale}: traductions abonnement incompletes.`);
if(errors.length){console.error(errors.join('\n'));process.exit(1);}
console.log(`Abonnements valides: ${reference.length} traductions x 5 langues, paiement protege.`);
