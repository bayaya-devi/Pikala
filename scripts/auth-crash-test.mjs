const base = process.argv[2] || 'http://127.0.0.1:8795';
const origin = new URL(base).origin;
const stamp = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const email = `crash-${stamp}@example.test`;
const password = 'Pikala phase five password!';
const changedPassword = 'Pikala changed secure password!';
const resetPassword = 'Pikala reset secure password!';
const results = [];

class Client {
  constructor() { this.cookies = new Map(); }
  cookieHeader() { return [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; '); }
  absorb(response) {
    const values = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [response.headers.get('set-cookie')].filter(Boolean);
    for (const header of values.flatMap((value) => value.split(/,(?=\s*[^;,]+=)/))) {
      const [pair, ...attributes] = header.split(';');
      const index = pair.indexOf('=');
      if (index < 1) continue;
      const name = pair.slice(0, index).trim();
      const value = pair.slice(index + 1).trim();
      if (!value || attributes.some((item) => /^\s*Max-Age=0\s*$/i.test(item))) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }
  async request(path, { method = 'GET', body, csrf = true, redirect = 'manual' } = {}) {
    const headers = { accept: 'application/json' };
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (csrf && !['GET', 'HEAD'].includes(method)) { headers['x-pikala-request'] = 'web'; headers.origin = origin; }
    const cookie = this.cookieHeader();
    if (cookie) headers.cookie = cookie;
    const response = await fetch(new URL(path, base), { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect });
    this.absorb(response);
    const type = response.headers.get('content-type') || '';
    const data = type.includes('application/json') ? await response.json() : null;
    return { response, data };
  }
}

function check(name, condition, details = '') {
  if (!condition) throw new Error(`${name}: echec${details ? ` (${details})` : ''}`);
  results.push(name);
}

const anonymous = new Client();
let value = await anonymous.request('/api/signup', { method: 'POST', csrf: false, body: { firstName: 'Crash', lastName: 'Test', email, password } });
check('CSRF refuse sans en-tete', value.response.status === 403 && value.data.code === 'CSRF_REJECTED', `${value.response.status} ${value.data?.code}`);

value = await anonymous.request('/api/signup', { method: 'POST', body: { firstName: 'Crash', lastName: 'Test', email: 'invalide', password } });
check('email invalide', value.response.status === 400 && value.data.code === 'EMAIL_INVALID');

value = await anonymous.request('/api/signup', { method: 'POST', body: { firstName: '<script>', lastName: 'Test', email: `xss-${email}`, password } });
check('nom XSS refuse', value.response.status === 400 && value.data.code === 'FIRST_NAME_INVALID');

value = await anonymous.request('/api/signup', { method: 'POST', body: { firstName: 'Crash', lastName: 'Test', email, password, locale: 'fr' } });
check('inscription normale', value.response.status === 202 && value.data.pendingVerification === true && value.data.verificationUrl, `${value.response.status}`);
let verificationUrl = value.data.verificationUrl;

value = await anonymous.request('/api/signup', { method: 'POST', body: { firstName: 'Crash', lastName: 'Test', email, password, locale: 'fr' } });
check('email deja utilise sans enumeration', value.response.status === 202 && value.data.code === 'EMAIL_IF_ELIGIBLE' && value.data.pendingVerification === true);
verificationUrl = value.data.verificationUrl || verificationUrl;

value = await anonymous.request('/api/login', { method: 'POST', body: { email, password } });
check('email non verifie', value.response.status === 403 && value.data.code === 'EMAIL_NOT_VERIFIED');

let response = await fetch(verificationUrl, { redirect: 'manual' });
check('verification email', response.status === 303 && response.headers.get('location')?.includes('verification=success'));

value = await anonymous.request('/api/login', { method: 'POST', body: { email, password: 'Mauvais mot de passe tres long!' } });
check('mauvais mot de passe', value.response.status === 401 && value.data.code === 'INVALID_CREDENTIALS');
value = await anonymous.request('/api/login', { method: 'POST', body: { email: `absent-${email}`, password: 'Mauvais mot de passe tres long!' } });
check('compte absent meme reponse', value.response.status === 401 && value.data.code === 'INVALID_CREDENTIALS');

const user = new Client();
value = await user.request('/api/login', { method: 'POST', body: { email, password } });
check('connexion', value.response.status === 200 && user.cookies.has('__Host-pikala_session'));
const oldCookie = user.cookieHeader();

response = await fetch(new URL('/dashboard.html', base), { redirect: 'manual' });
check('page privee anonyme', response.status === 302 && response.headers.get('location')?.includes('/connexion.html'));
value = await user.request('/api/me');
check('page privee authentifiee', value.response.status === 200 && value.data.user.email === email);
value = await user.request('/api/admin/overview');
check('route admin compte non admin', value.response.status === 403 && value.data.code === 'FORBIDDEN');

value = await user.request('/api/profile', { method: 'PATCH', body: { firstName: 'Crash', lastName: 'Securite', phone: '+212 600 000 000', locale: 'fr' } });
check('modification profil', value.response.status === 200 && value.data.user.last_name === 'Securite');

value = await user.request('/api/password/change', { method: 'POST', body: { currentPassword: 'Mot de passe actuel incorrect!', newPassword: changedPassword } });
check('mot de passe actuel incorrect', value.response.status === 401 && value.data.code === 'CURRENT_PASSWORD_INVALID');
value = await user.request('/api/password/change', { method: 'POST', body: { currentPassword: password, newPassword: changedPassword } });
check('modification mot de passe', value.response.status === 200 && value.data.code === 'PASSWORD_CHANGED');

const stale = new Client();
for (const part of oldCookie.split('; ')) { const [name, cookieValue] = part.split('='); stale.cookies.set(name, cookieValue); }
value = await stale.request('/api/me');
check('ancienne session revoquee', value.response.status === 401);
value = await user.request('/api/me');
check('nouvelle session active', value.response.status === 200);

value = await anonymous.request('/api/password/forgot', { method: 'POST', body: { email } });
check('mot de passe oublie', value.response.status === 202 && value.data.resetUrl);
const token = new URL(value.data.resetUrl).searchParams.get('token');
value = await anonymous.request('/api/password/reset', { method: 'POST', body: { token, password: resetPassword } });
check('reset mot de passe', value.response.status === 200 && value.data.code === 'PASSWORD_RESET_SUCCESS');
value = await anonymous.request('/api/password/reset', { method: 'POST', body: { token, password: resetPassword } });
check('token reset a usage unique', value.response.status === 400 && value.data.code === 'RESET_TOKEN_INVALID');

const finalUser = new Client();
value = await finalUser.request('/api/login', { method: 'POST', body: { email, password: resetPassword } });
check('connexion nouveau mot de passe', value.response.status === 200);
value = await finalUser.request('/api/logout', { method: 'POST', body: {} });
check('deconnexion', value.response.status === 200 && !finalUser.cookies.has('__Host-pikala_session'));
value = await finalUser.request('/api/me');
check('session invalide apres logout', value.response.status === 401);

const expiring = new Client();
value = await expiring.request('/api/login', { method: 'POST', body: { email, password: resetPassword } });
check('session courte creee', value.response.status === 200);
await new Promise((resolve) => setTimeout(resolve, 2400));
value = await expiring.request('/api/me');
check('session expiree', value.response.status === 401);

const brute = new Client();
let last;
for (let attempt = 0; attempt < 6; attempt += 1) last = await brute.request('/api/login', { method: 'POST', body: { email: `brute-${email}`, password: 'Mauvais mot de passe tres long!' } });
check('brute force limite', last.response.status === 429 && last.data.code === 'RATE_LIMITED');

console.log(`Crash-test auth valide : ${results.length} scenarios.\n${results.map((item) => `- ${item}`).join('\n')}`);
