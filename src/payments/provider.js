const EVENT_STATUSES = new Set(['processing', 'paid', 'failed', 'cancelled', 'refunded']);
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,159}$/;

function base64Url(bytes) {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

async function digest(value) {
  const result = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return base64Url(new Uint8Array(result));
}

async function hmac(secret, value) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return base64Url(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))));
}

function constantTimeEqual(left, right) {
  const a = new TextEncoder().encode(String(left || ''));
  const b = new TextEncoder().encode(String(right || ''));
  if (a.length !== b.length) return false;
  let difference = 0;
  a.forEach((value, index) => { difference |= value ^ b[index]; });
  return difference === 0;
}

function unavailableProvider() {
  return {
    name: null,
    configured: false,
    async createCheckout() { throw Object.assign(new Error('payment provider unavailable'), { code: 'PAYMENT_PROVIDER_UNAVAILABLE' }); },
    async verifyWebhook() { return { ok: false, code: 'PAYMENT_PROVIDER_UNAVAILABLE' }; }
  };
}

function testProvider(env) {
  const enabled = env.ENVIRONMENT === 'development' && typeof env.PAYMENT_TEST_SECRET === 'string' && env.PAYMENT_TEST_SECRET.length >= 24;
  if (!enabled) return unavailableProvider();
  return {
    name: 'test',
    configured: true,
    async createCheckout({ reference }) {
      return {
        providerPaymentId: `test:${reference}`,
        providerSessionId: `session:${reference}`,
        status: 'processing',
        checkoutUrl: null,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString()
      };
    },
    async verifyWebhook(request) {
      const declaredSize = Number(request.headers.get('content-length') || 0);
      if (declaredSize > 16 * 1024) return { ok: false, code: 'WEBHOOK_INVALID' };
      const raw = await request.text();
      if (!raw || new TextEncoder().encode(raw).length > 16 * 1024) return { ok: false, code: 'WEBHOOK_INVALID' };
      const expected = await hmac(env.PAYMENT_TEST_SECRET, raw);
      if (!constantTimeEqual(expected, request.headers.get('x-pikala-signature'))) return { ok: false, code: 'WEBHOOK_SIGNATURE_INVALID' };
      let payload;
      try { payload = JSON.parse(raw); } catch { return { ok: false, code: 'WEBHOOK_INVALID' }; }
      const eventId = String(payload?.eventId || '');
      const providerPaymentId = String(payload?.providerPaymentId || '');
      const status = String(payload?.status || '');
      if (!SAFE_ID.test(eventId) || !SAFE_ID.test(providerPaymentId) || !EVENT_STATUSES.has(status)) return { ok: false, code: 'WEBHOOK_INVALID' };
      return { ok: true, eventId, providerPaymentId, status, eventType: `payment.${status}`, payloadHash: await digest(raw) };
    }
  };
}

export function getPaymentProvider(env) {
  const requested = String(env.PAYMENT_PROVIDER || '').trim().toLowerCase();
  if (requested === 'test') return testProvider(env);
  return unavailableProvider();
}
