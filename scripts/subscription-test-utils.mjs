export class Client {
  constructor(base) { this.base = base; this.origin = new URL(base).origin; this.cookies = new Map(); }
  absorb(response) {
    const values = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [response.headers.get('set-cookie')].filter(Boolean);
    for (const header of values) { const pair = header.split(';')[0]; const index = pair.indexOf('='); if (index > 0) this.cookies.set(pair.slice(0, index), pair.slice(index + 1)); }
  }
  async request(path, { method = 'GET', body, headers = {} } = {}) {
    const requestHeaders = { accept: 'application/json', ...headers };
    if (body !== undefined) requestHeaders['content-type'] = 'application/json';
    if (!['GET', 'HEAD'].includes(method)) { requestHeaders['x-pikala-request'] = 'web'; requestHeaders.origin = this.origin; }
    if (this.cookies.size) requestHeaders.cookie = [...this.cookies].map(([key, value]) => `${key}=${value}`).join('; ');
    const response = await fetch(new URL(path, this.base), { method, headers: requestHeaders, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
    this.absorb(response);
    const data = (response.headers.get('content-type') || '').includes('json') ? await response.json() : null;
    return { response, data };
  }
}

export function checker() {
  const checks = [];
  return {
    check(name, condition, detail = '') { if (!condition) throw new Error(`${name}: ${detail || 'échec'}`); checks.push(name); },
    report(label) { console.log(`${label} : ${checks.length} contrôles.\n${checks.map((item) => `- ${item}`).join('\n')}`); }
  };
}

export async function createUser(base, label = 'Abonnement') {
  const client = new Client(base);
  const email = `subscription-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;
  const password = 'Pikala subscription secure password!';
  let value = await client.request('/api/signup', { method: 'POST', body: { firstName: 'Test', lastName: label, email, password, locale: 'fr' } });
  if (value.response.status !== 202 || !value.data.verificationUrl) throw new Error(`Inscription test impossible: ${value.response.status}`);
  const verified = await fetch(value.data.verificationUrl, { redirect: 'manual' });
  if (verified.status !== 303) throw new Error(`Vérification test impossible: ${verified.status}`);
  value = await client.request('/api/login', { method: 'POST', body: { email, password } });
  if (value.response.status !== 200) throw new Error(`Connexion test impossible: ${value.response.status}`);
  return client;
}

function base64Url(bytes) { return Buffer.from(bytes).toString('base64url'); }
export async function webhook(base, secret, payload, signatureOverride) {
  const raw = JSON.stringify(payload);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = signatureOverride ?? base64Url(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw))));
  const response = await fetch(new URL('/api/payments/webhooks/test', base), { method: 'POST', headers: { 'content-type': 'application/json', 'x-pikala-signature': signature }, body: raw });
  return { response, data: await response.json() };
}
