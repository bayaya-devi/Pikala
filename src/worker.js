const USER_FIELDS = 'id, first_name, last_name, email, phone, role, status, locale, created_at, email_verified, auth_version';
const JOINED_USER_FIELDS = USER_FIELDS.split(', ').map((field) => `users.${field} AS ${field}`).join(', ');
const SESSION_COOKIE = '__Host-pikala_session';
const LEGACY_SESSION_COOKIE = 'pikala_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const EMAIL_TOKEN_TTL_SECONDS = 60 * 60 * 24;
const RESET_TOKEN_TTL_SECONDS = 60 * 60;
const PASSWORD_ITERATIONS = 600000;
const MAX_JSON_BYTES = 16 * 1024;
const DB_UNAVAILABLE_MESSAGE = 'Service temporairement indisponible.';

const PAGE_ROUTES = new Map([
  ['/accueil', '/accueil.html'], ['/home', '/index.html'], ['/dashboard', '/dashboard.html'],
  ['/stations', '/stations.html'], ['/scanner', '/scanner.html'], ['/profil', '/profil.html'],
  ['/profile', '/profil.html'], ['/support', '/support.html'], ['/abonnement', '/abonnement.html'],
  ['/connexion', '/connexion.html'], ['/login', '/connexion.html'], ['/inscription', '/inscription.html'],
  ['/signup', '/inscription.html'], ['/mot-de-passe-oublie', '/mot-de-passe-oublie.html'],
  ['/reinitialiser-mot-de-passe', '/reinitialiser-mot-de-passe.html'], ['/admin', '/admin.html']
]);
const PRIVATE_PAGES = new Set([
  '/dashboard', '/dashboard.html', '/stations', '/stations.html', '/scanner', '/scanner.html',
  '/profil', '/profil.html', '/profile', '/support', '/support.html', '/abonnement', '/abonnement.html'
]);
const ADMIN_PAGES = new Set(['/admin', '/admin.html']);
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function assetRequestForCleanPath(request, url) {
  const htmlPath = PAGE_ROUTES.get(url.pathname);
  if (!htmlPath) return request;
  const assetUrl = new URL(request.url);
  assetUrl.pathname = htmlPath;
  return new Request(assetUrl, request);
}

function secureHeaders(extra = {}) {
  return {
    'cache-control': 'no-store',
    'content-security-policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    'referrer-policy': 'no-referrer',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    ...extra
  };
}

function json(data, status = 200, extraHeaders = {}, cookies = []) {
  const headers = new Headers(secureHeaders({ 'content-type': 'application/json; charset=utf-8', ...extraHeaders }));
  cookies.forEach((cookie) => headers.append('set-cookie', cookie));
  return new Response(JSON.stringify(data), { status, headers });
}

function redirect(location, status = 303, cookies = []) {
  const headers = new Headers(secureHeaders({ location }));
  cookies.forEach((cookie) => headers.append('set-cookie', cookie));
  return new Response(null, { status, headers });
}

async function readJson(request) {
  const type = request.headers.get('content-type') || '';
  if (!type.toLowerCase().startsWith('application/json')) return null;
  const declaredSize = Number(request.headers.get('content-length') || 0);
  if (declaredSize > MAX_JSON_BYTES) return null;
  try {
    const text = await request.text();
    if (!text || new TextEncoder().encode(text).length > MAX_JSON_BYTES) return null;
    const value = JSON.parse(text);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

function validEmail(value) { return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
function validName(value) { return value.length >= 1 && value.length <= 80 && /^[\p{L}\p{M}][\p{L}\p{M} '\-]*$/u.test(value); }
function validPhone(value) { return !value || (value.length <= 30 && /^\+?[0-9 ()-]{7,30}$/.test(value)); }
function validPassword(value) { return value.length >= 15 && value.length <= 128; }

function requireDb(env) {
  if (!env.DB) {
    const error = new Error('database binding unavailable');
    error.code = 'DB_UNAVAILABLE';
    throw error;
  }
  return env.DB;
}

function base64Url(bytes) {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function base64ToBytes(value) {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function sha256(value) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return base64Url(new Uint8Array(digest));
}

async function hashPassword(password, iterations = PASSWORD_ITERATIONS) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, 256);
  return `pbkdf2$${iterations}$${base64Url(salt)}$${base64Url(new Uint8Array(bits))}`;
}

async function verifyPassword(password, storedHash) {
  try {
    const parts = String(storedHash || '').split('$');
    if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
    const iterations = Number(parts[1]);
    if (!Number.isInteger(iterations) || iterations < 10000 || iterations > 2000000) return false;
    const salt = base64ToBytes(parts[2]);
    const expected = base64ToBytes(parts[3]);
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, 256);
    const actual = new Uint8Array(bits);
    if (actual.length !== expected.length) return false;
    let diff = 0;
    actual.forEach((byte, index) => { diff |= byte ^ expected[index]; });
    return diff === 0;
  } catch { return false; }
}

let dummyPasswordHash;
async function verifyWithDummy(password) {
  if (!dummyPasswordHash) dummyPasswordHash = await hashPassword('Pikala dummy password value');
  await verifyPassword(password, dummyPasswordHash);
}

function parseCookies(request) {
  const header = request.headers.get('cookie') || '';
  return Object.fromEntries(header.split(';').map((part) => {
    const index = part.indexOf('=');
    if (index === -1) return null;
    try { return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())]; } catch { return null; }
  }).filter(Boolean));
}

function sessionTtl(env) {
  if (env.EMAIL_DEV_MODE === '1') {
    const testTtl = Number(env.AUTH_TEST_SESSION_TTL_SECONDS || 0);
    if (Number.isInteger(testTtl) && testTtl >= 1 && testTtl <= 300) return testTtl;
  }
  return SESSION_TTL_SECONDS;
}

function sessionCookie(token, ttl) { return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${ttl}; HttpOnly; Secure; SameSite=Strict`; }
function clearSessionCookies() {
  return [
    `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`,
    `${LEGACY_SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`
  ];
}

function publicUser(row) {
  if (!row) return null;
  return { id: row.id, first_name: row.first_name, last_name: row.last_name, email: row.email,
    phone: row.phone, role: row.role, locale: row.locale, created_at: row.created_at,
    email_verified: Boolean(row.email_verified) };
}

function requestId(request) { return String(request.headers.get('cf-ray') || crypto.randomUUID()).slice(0, 80); }
async function ipHash(request) {
  const ip = String(request.headers.get('cf-connecting-ip') || 'unknown').slice(0, 80);
  return sha256(`pikala-ip:${ip}`);
}

async function securityEvent(DB, request, eventType, outcome, userId = null, metadata = null) {
  try {
    await DB.prepare('INSERT INTO security_events (user_id, event_type, outcome, request_id, ip_hash, metadata_json) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(userId, eventType, outcome, requestId(request), await ipHash(request), metadata ? JSON.stringify(metadata) : null).run();
  } catch { console.warn('security_event_write_failed', eventType); }
}

async function rateLimit(DB, request, action, subject, limit, windowSeconds, blockSeconds) {
  const key = await sha256(`${action}:${String(subject).toLowerCase()}`);
  const now = Date.now();
  const row = await DB.prepare('SELECT attempts, window_started_at, blocked_until FROM auth_rate_limits WHERE rate_key = ?').bind(key).first();
  if (row?.blocked_until && Date.parse(row.blocked_until) > now) return { allowed: false, retryAfter: Math.max(1, Math.ceil((Date.parse(row.blocked_until) - now) / 1000)) };
  const windowExpired = !row || !Number.isFinite(Date.parse(row.window_started_at)) || now - Date.parse(row.window_started_at) >= windowSeconds * 1000;
  const attempts = windowExpired ? 1 : Number(row.attempts || 0) + 1;
  const windowStartedAt = windowExpired ? new Date(now).toISOString() : row.window_started_at;
  const blockedUntil = attempts > limit ? new Date(now + blockSeconds * 1000).toISOString() : null;
  await DB.prepare(`INSERT INTO auth_rate_limits (rate_key, action, attempts, window_started_at, blocked_until, updated_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(rate_key) DO UPDATE SET attempts = excluded.attempts, window_started_at = excluded.window_started_at,
      blocked_until = excluded.blocked_until, updated_at = CURRENT_TIMESTAMP`)
    .bind(key, action, attempts, windowStartedAt, blockedUntil).run();
  return blockedUntil ? { allowed: false, retryAfter: blockSeconds } : { allowed: true, key };
}

async function clearRateLimit(DB, key) { if (key) await DB.prepare('DELETE FROM auth_rate_limits WHERE rate_key = ?').bind(key).run(); }

function csrfAllowed(request, env) {
  if (SAFE_METHODS.has(request.method)) return true;
  if (!new URL(request.url).pathname.startsWith('/api/')) return true;
  if (request.headers.get('x-pikala-request') !== 'web') return false;
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite === 'cross-site' || fetchSite === 'same-site') return false;
  const origin = request.headers.get('origin');
  if (!origin) return true;
  const allowed = new Set([new URL(request.url).origin]);
  if (env.PUBLIC_ORIGIN) { try { allowed.add(new URL(env.PUBLIC_ORIGIN).origin); } catch {} }
  return allowed.has(origin);
}

async function createSession(DB, user, request, env) {
  const token = base64Url(crypto.getRandomValues(new Uint8Array(32)));
  const ttl = sessionTtl(env);
  await DB.prepare(`INSERT INTO sessions
    (id, user_id, token_hash, expires_at, user_agent, ip_hint, auth_version, csrf_token_hash, authenticated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`)
    .bind(crypto.randomUUID(), user.id, await sha256(token), new Date(Date.now() + ttl * 1000).toISOString(),
      (request.headers.get('user-agent') || '').slice(0, 240), (await ipHash(request)).slice(0, 32),
      Number(user.auth_version || 1), await sha256(base64Url(crypto.getRandomValues(new Uint8Array(32))))).run();
  return { token, ttl };
}

async function currentUser(request, env) {
  const DB = requireDb(env);
  const cookies = parseCookies(request);
  const token = cookies[SESSION_COOKIE] || cookies[LEGACY_SESSION_COOKIE];
  if (!token) return null;
  const row = await DB.prepare(`SELECT ${JOINED_USER_FIELDS}, sessions.id AS session_id, sessions.authenticated_at
    FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ? AND sessions.revoked_at IS NULL AND sessions.expires_at > ?
      AND sessions.auth_version = users.auth_version AND users.status = 'active'`)
    .bind(await sha256(token), new Date().toISOString()).first();
  return row ? { user: publicUser(row), sessionId: row.session_id, authVersion: row.auth_version, authenticatedAt: row.authenticated_at } : null;
}

async function requireUser(request, env) {
  const session = await currentUser(request, env);
  if (!session) return { response: json({ code: 'AUTH_REQUIRED', error: 'Authentification requise.' }, 401, {}, clearSessionCookies()) };
  return session;
}

async function requireRole(request, env, roles) {
  const session = await requireUser(request, env);
  if (session.response) return session;
  if (!roles.includes(session.user.role)) {
    await securityEvent(requireDb(env), request, 'authorization_denied', 'blocked', session.user.id, { requiredRole: roles.join(',') });
    return { response: json({ code: 'FORBIDDEN', error: 'Acces refuse.' }, 403) };
  }
  return session;
}

function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])); }
function publicOrigin(env) { try { return new URL(env.PUBLIC_ORIGIN || 'https://pikala.aetbconseil.workers.dev').origin; } catch { return 'https://pikala.aetbconseil.workers.dev'; } }

async function sendEmail(env, { to, subject, html }) {
  if (!env.RESEND_API_KEY || !env.FROM_EMAIL) return false;
  const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify({ from: env.FROM_EMAIL, to, subject, html }) });
  return response.ok;
}

async function sendVerificationEmail(env, email, token, firstName) {
  const verifyUrl = `${publicOrigin(env)}/api/verify-email?token=${encodeURIComponent(token)}`;
  const sent = await sendEmail(env, { to: email, subject: 'Confirmez votre compte Pikala', html: `<p>Bonjour ${escapeHtml(firstName)},</p><p>Confirmez votre compte Pikala :</p><p><a href="${escapeHtml(verifyUrl)}">Confirmer mon email</a></p><p>Ce lien expire dans 24 heures.</p>` });
  return { sent, url: env.EMAIL_DEV_MODE === '1' ? verifyUrl : undefined };
}

async function sendResetEmail(env, email, token, firstName) {
  const resetUrl = `${publicOrigin(env)}/reinitialiser-mot-de-passe.html?token=${encodeURIComponent(token)}`;
  const sent = await sendEmail(env, { to: email, subject: 'Reinitialisez votre mot de passe Pikala', html: `<p>Bonjour ${escapeHtml(firstName)},</p><p>Utilisez ce lien pour choisir un nouveau mot de passe :</p><p><a href="${escapeHtml(resetUrl)}">Reinitialiser mon mot de passe</a></p><p>Ce lien expire dans une heure.</p>` });
  return { sent, url: env.EMAIL_DEV_MODE === '1' ? resetUrl : undefined };
}

async function createEmailToken(DB, table, userId, request, ttlSeconds) {
  if (!new Set(['email_verifications', 'password_reset_tokens']).has(table)) throw new Error('invalid token table');
  const token = base64Url(crypto.getRandomValues(new Uint8Array(32)));
  await DB.prepare(`INSERT INTO ${table} (user_id, token_hash, expires_at, requested_ip) VALUES (?, ?, ?, ?)`)
    .bind(userId, await sha256(token), new Date(Date.now() + ttlSeconds * 1000).toISOString(), (await ipHash(request)).slice(0, 32)).run();
  return token;
}

function genericEmailResponse(extra = {}) { return json({ success: true, code: 'EMAIL_IF_ELIGIBLE', message: 'Si cette adresse est eligible, un email va etre envoye.', ...extra }, 202); }

async function signup(request, env) {
  const body = await readJson(request);
  if (!body) return json({ code: 'INVALID_REQUEST', error: 'Requete invalide.' }, 400);
  const firstName = String(body.firstName || '').trim();
  const lastName = String(body.lastName || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const phone = String(body.phone || '').trim();
  const password = String(body.password || '');
  const locale = ['fr', 'en', 'es', 'pt', 'ar'].includes(body.locale) ? body.locale : 'fr';
  if (!validName(firstName)) return json({ code: 'FIRST_NAME_INVALID', error: 'Prenom invalide.' }, 400);
  if (!validName(lastName)) return json({ code: 'LAST_NAME_INVALID', error: 'Nom invalide.' }, 400);
  if (!validEmail(email)) return json({ code: 'EMAIL_INVALID', error: 'Adresse email invalide.' }, 400);
  if (!validPhone(phone)) return json({ code: 'PHONE_INVALID', error: 'Numero de telephone invalide.' }, 400);
  if (!validPassword(password)) return json({ code: 'PASSWORD_INVALID', error: 'Le mot de passe doit contenir entre 15 et 128 caracteres.' }, 400);
  const DB = requireDb(env);
  const limit = await rateLimit(DB, request, 'signup', email, 5, 900, 900);
  if (!limit.allowed) return json({ code: 'RATE_LIMITED', error: 'Trop de tentatives. Reessayez plus tard.' }, 429, { 'retry-after': String(limit.retryAfter) });
  const existing = await DB.prepare('SELECT id, first_name, email, email_verified FROM users WHERE lower(email) = ?').bind(email).first();
  if (existing) {
    await hashPassword(password);
    let existingVerificationUrl;
    if (Number(existing.email_verified) === 0) {
      await DB.prepare('UPDATE email_verifications SET used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND used_at IS NULL').bind(existing.id).run();
      const existingToken = await createEmailToken(DB, 'email_verifications', existing.id, request, EMAIL_TOKEN_TTL_SECONDS);
      existingVerificationUrl = (await sendVerificationEmail(env, existing.email, existingToken, existing.first_name)).url;
    } else {
      await sendEmail(env, { to: existing.email, subject: 'Tentative de creation de compte Pikala', html: '<p>Une demande de creation de compte a utilise votre adresse. Votre compte existe deja et reste protege.</p>' });
    }
    await securityEvent(DB, request, 'signup', 'failure', existing.id);
    return genericEmailResponse({ pendingVerification: true, verificationUrl: existingVerificationUrl });
  }
  const result = await DB.prepare(`INSERT INTO users (first_name, last_name, email, phone, password_hash, email_verified, locale, password_changed_at) VALUES (?, ?, ?, ?, ?, 0, ?, CURRENT_TIMESTAMP)`)
    .bind(firstName, lastName, email, phone || null, await hashPassword(password), locale).run();
  const token = await createEmailToken(DB, 'email_verifications', result.meta.last_row_id, request, EMAIL_TOKEN_TTL_SECONDS);
  const emailResult = await sendVerificationEmail(env, email, token, firstName);
  await securityEvent(DB, request, 'signup', 'success', result.meta.last_row_id, { emailDispatched: emailResult.sent });
  return genericEmailResponse({ pendingVerification: true, verificationUrl: emailResult.url });
}

async function verifyEmail(request, env) {
  const DB = requireDb(env);
  const token = new URL(request.url).searchParams.get('token') || '';
  if (token.length < 32 || token.length > 256) return redirect('/connexion.html?verification=invalid');
  const row = await DB.prepare('SELECT id, user_id FROM email_verifications WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?').bind(await sha256(token), new Date().toISOString()).first();
  if (!row) return redirect('/connexion.html?verification=invalid');
  await DB.batch([
    DB.prepare('UPDATE users SET email_verified = 1, email_verified_at = CURRENT_TIMESTAMP WHERE id = ?').bind(row.user_id),
    DB.prepare('UPDATE email_verifications SET used_at = CURRENT_TIMESTAMP WHERE id = ? AND used_at IS NULL').bind(row.id)
  ]);
  await securityEvent(DB, request, 'email_verified', 'success', row.user_id);
  return redirect('/connexion.html?verification=success');
}

async function resendVerification(request, env) {
  const body = await readJson(request);
  const email = String(body?.email || '').trim().toLowerCase();
  if (!validEmail(email)) return genericEmailResponse();
  const DB = requireDb(env);
  const limit = await rateLimit(DB, request, 'resend_verification', email, 3, 3600, 3600);
  if (!limit.allowed) return genericEmailResponse();
  const user = await DB.prepare('SELECT id, first_name, email FROM users WHERE lower(email) = ? AND email_verified = 0 AND status = ?').bind(email, 'active').first();
  if (user) {
    await DB.prepare('UPDATE email_verifications SET used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND used_at IS NULL').bind(user.id).run();
    const token = await createEmailToken(DB, 'email_verifications', user.id, request, EMAIL_TOKEN_TTL_SECONDS);
    const result = await sendVerificationEmail(env, user.email, token, user.first_name);
    await securityEvent(DB, request, 'verification_resent', 'success', user.id, { emailDispatched: result.sent });
    return genericEmailResponse({ verificationUrl: result.url });
  }
  return genericEmailResponse();
}

async function login(request, env) {
  const body = await readJson(request);
  if (!body) return json({ code: 'INVALID_REQUEST', error: 'Requete invalide.' }, 400);
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!validEmail(email) || !password || password.length > 128) return json({ code: 'INVALID_CREDENTIALS', error: 'Email ou mot de passe incorrect.' }, 401);
  const DB = requireDb(env);
  const limit = await rateLimit(DB, request, 'login', email, 5, 900, 900);
  if (!limit.allowed) { await securityEvent(DB, request, 'login', 'blocked'); return json({ code: 'RATE_LIMITED', error: 'Trop de tentatives. Reessayez plus tard.' }, 429, { 'retry-after': String(limit.retryAfter) }); }
  const row = await DB.prepare(`SELECT ${USER_FIELDS}, password_hash FROM users WHERE lower(email) = ?`).bind(email).first();
  const passwordOk = row ? await verifyPassword(password, row.password_hash) : (await verifyWithDummy(password), false);
  if (!row || !passwordOk || row.status !== 'active') {
    if (row) await DB.prepare('UPDATE users SET failed_login_count = failed_login_count + 1 WHERE id = ?').bind(row.id).run();
    await securityEvent(DB, request, 'login', 'failure', row?.id || null);
    return json({ code: 'INVALID_CREDENTIALS', error: 'Email ou mot de passe incorrect.' }, 401);
  }
  if (Number(row.email_verified) === 0) { await securityEvent(DB, request, 'login', 'blocked', row.id, { reason: 'email_unverified' }); return json({ code: 'EMAIL_NOT_VERIFIED', error: 'Confirmez votre email avant de vous connecter.', pendingVerification: true }, 403); }
  const cookies = parseCookies(request);
  const oldToken = cookies[SESSION_COOKIE] || cookies[LEGACY_SESSION_COOKIE];
  if (oldToken) await DB.prepare('UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = ?').bind(await sha256(oldToken)).run();
  if (!String(row.password_hash).startsWith(`pbkdf2$${PASSWORD_ITERATIONS}$`)) {
    row.password_hash = await hashPassword(password);
    await DB.prepare('UPDATE users SET password_hash = ?, password_changed_at = CURRENT_TIMESTAMP WHERE id = ?').bind(row.password_hash, row.id).run();
  }
  await DB.prepare('UPDATE users SET failed_login_count = 0, locked_until = NULL, last_login_at = CURRENT_TIMESTAMP WHERE id = ?').bind(row.id).run();
  await clearRateLimit(DB, limit.key);
  const session = await createSession(DB, row, request, env);
  await securityEvent(DB, request, 'login', 'success', row.id);
  return json({ success: true, user: publicUser(row) }, 200, {}, [...clearSessionCookies(), sessionCookie(session.token, session.ttl)]);
}

async function logout(request, env) {
  const DB = requireDb(env);
  const cookies = parseCookies(request);
  const token = cookies[SESSION_COOKIE] || cookies[LEGACY_SESSION_COOKIE];
  let userId = null;
  if (token) {
    const tokenHash = await sha256(token);
    userId = (await DB.prepare('SELECT user_id FROM sessions WHERE token_hash = ?').bind(tokenHash).first())?.user_id || null;
    await DB.prepare('UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = ?').bind(tokenHash).run();
  }
  await securityEvent(DB, request, 'logout', 'success', userId);
  return json({ success: true }, 200, {}, clearSessionCookies());
}

async function forgotPassword(request, env) {
  const body = await readJson(request);
  const email = String(body?.email || '').trim().toLowerCase();
  if (!validEmail(email)) return genericEmailResponse();
  const DB = requireDb(env);
  const limit = await rateLimit(DB, request, 'forgot_password', email, 3, 3600, 3600);
  if (!limit.allowed) return genericEmailResponse();
  const user = await DB.prepare('SELECT id, first_name, email FROM users WHERE lower(email) = ? AND status = ?').bind(email, 'active').first();
  if (user) {
    await DB.prepare('UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND used_at IS NULL').bind(user.id).run();
    const token = await createEmailToken(DB, 'password_reset_tokens', user.id, request, RESET_TOKEN_TTL_SECONDS);
    const result = await sendResetEmail(env, user.email, token, user.first_name);
    await securityEvent(DB, request, 'password_reset_requested', 'success', user.id, { emailDispatched: result.sent });
    return genericEmailResponse({ resetUrl: result.url });
  }
  await verifyWithDummy('Pikala forgot password timing');
  return genericEmailResponse();
}

async function resetPassword(request, env) {
  const body = await readJson(request);
  const token = String(body?.token || '');
  const password = String(body?.password || '');
  if (token.length < 32 || token.length > 256) return json({ code: 'RESET_TOKEN_INVALID', error: 'Lien invalide ou expire.' }, 400);
  if (!validPassword(password)) return json({ code: 'PASSWORD_INVALID', error: 'Le mot de passe doit contenir entre 15 et 128 caracteres.' }, 400);
  const DB = requireDb(env);
  const limit = await rateLimit(DB, request, 'reset_password', await ipHash(request), 10, 900, 900);
  if (!limit.allowed) return json({ code: 'RATE_LIMITED', error: 'Trop de tentatives. Reessayez plus tard.' }, 429, { 'retry-after': String(limit.retryAfter) });
  const row = await DB.prepare('SELECT id, user_id FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?').bind(await sha256(token), new Date().toISOString()).first();
  if (!row) return json({ code: 'RESET_TOKEN_INVALID', error: 'Lien invalide ou expire.' }, 400);
  await DB.batch([
    DB.prepare('UPDATE users SET password_hash = ?, password_changed_at = CURRENT_TIMESTAMP, auth_version = auth_version + 1, failed_login_count = 0, locked_until = NULL WHERE id = ?').bind(await hashPassword(password), row.user_id),
    DB.prepare('UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ? AND used_at IS NULL').bind(row.id),
    DB.prepare('UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL').bind(row.user_id)
  ]);
  await securityEvent(DB, request, 'password_reset', 'success', row.user_id);
  return json({ success: true, code: 'PASSWORD_RESET_SUCCESS' }, 200, {}, clearSessionCookies());
}

async function changePassword(request, env) {
  const auth = await requireUser(request, env);
  if (auth.response) return auth.response;
  const body = await readJson(request);
  const currentPassword = String(body?.currentPassword || '');
  const newPassword = String(body?.newPassword || '');
  if (!currentPassword || !validPassword(newPassword)) return json({ code: 'PASSWORD_INVALID', error: 'Mot de passe invalide.' }, 400);
  if (currentPassword === newPassword) return json({ code: 'PASSWORD_UNCHANGED', error: 'Choisissez un mot de passe different.' }, 400);
  const DB = requireDb(env);
  const row = await DB.prepare('SELECT id, password_hash, auth_version FROM users WHERE id = ?').bind(auth.user.id).first();
  if (!row || !(await verifyPassword(currentPassword, row.password_hash))) { await securityEvent(DB, request, 'password_change', 'failure', auth.user.id); return json({ code: 'CURRENT_PASSWORD_INVALID', error: 'Mot de passe actuel incorrect.' }, 401); }
  const newAuthVersion = Number(row.auth_version || 1) + 1;
  await DB.batch([
    DB.prepare('UPDATE users SET password_hash = ?, password_changed_at = CURRENT_TIMESTAMP, auth_version = ? WHERE id = ?').bind(await hashPassword(newPassword), newAuthVersion, row.id),
    DB.prepare('UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL').bind(row.id)
  ]);
  const session = await createSession(DB, { ...auth.user, id: row.id, auth_version: newAuthVersion }, request, env);
  await securityEvent(DB, request, 'password_change', 'success', row.id);
  return json({ success: true, code: 'PASSWORD_CHANGED' }, 200, {}, [...clearSessionCookies(), sessionCookie(session.token, session.ttl)]);
}

async function me(request, env) { const session = await requireUser(request, env); return session.response || json({ user: session.user }); }

async function updateProfile(request, env) {
  const auth = await requireUser(request, env);
  if (auth.response) return auth.response;
  const body = await readJson(request);
  if (!body) return json({ code: 'INVALID_REQUEST', error: 'Requete invalide.' }, 400);
  const firstName = String(body.firstName ?? auth.user.first_name).trim();
  const lastName = String(body.lastName ?? auth.user.last_name).trim();
  const phone = String(body.phone ?? auth.user.phone ?? '').trim();
  const locale = String(body.locale ?? auth.user.locale);
  if (!validName(firstName) || !validName(lastName)) return json({ code: 'NAME_INVALID', error: 'Nom invalide.' }, 400);
  if (!validPhone(phone)) return json({ code: 'PHONE_INVALID', error: 'Numero de telephone invalide.' }, 400);
  if (!['fr', 'en', 'es', 'pt', 'ar'].includes(locale)) return json({ code: 'LOCALE_INVALID', error: 'Langue invalide.' }, 400);
  const DB = requireDb(env);
  await DB.prepare('UPDATE users SET first_name = ?, last_name = ?, phone = ?, locale = ? WHERE id = ?').bind(firstName, lastName, phone || null, locale, auth.user.id).run();
  const row = await DB.prepare(`SELECT ${USER_FIELDS} FROM users WHERE id = ?`).bind(auth.user.id).first();
  await securityEvent(DB, request, 'profile_updated', 'success', auth.user.id);
  return json({ success: true, user: publicUser(row) });
}

async function stations(env) {
  const { results } = await requireDb(env).prepare(`SELECT stations.id, stations.public_code, stations.name, stations.city, stations.address, stations.latitude, stations.longitude,
    CASE WHEN EXISTS (SELECT 1 FROM bikes WHERE bikes.station_id = stations.id) THEN (SELECT COUNT(*) FROM bikes WHERE bikes.station_id = stations.id AND bikes.status = 'available') ELSE stations.bikes_available END AS bikes_available,
    stations.capacity, stations.is_active FROM stations WHERE stations.is_active = 1 ORDER BY stations.name, stations.id`).all();
  return json({ stations: results || [] });
}

async function plans(env) {
  const { results } = await requireDb(env).prepare(`SELECT id, slug, name, description AS summary, amount_minor, amount_minor / 100.0 AS amount_mad, currency, billing_period FROM plans WHERE status = 'active' AND amount_minor IS NOT NULL ORDER BY display_order, amount_minor, id`).all();
  return json({ plans: results || [] }, 200, { 'cache-control': 'public, max-age=300' });
}

async function subscription(request, env) {
  const auth = await requireUser(request, env); if (auth.response) return auth.response;
  const body = await readJson(request); const requestedPlan = String(body?.plan || '').trim().slice(0, 80);
  if (!requestedPlan) return json({ code: 'PLAN_REQUIRED', error: 'Veuillez choisir un abonnement.' }, 400);
  const DB = requireDb(env);
  const plan = await DB.prepare("SELECT id, name FROM plans WHERE (slug = ? OR name = ?) AND status IN ('active', 'legacy') LIMIT 1").bind(requestedPlan, requestedPlan).first();
  if (!plan) return json({ code: 'PLAN_NOT_FOUND', error: "Cet abonnement n'est pas disponible." }, 404);
  await DB.prepare("UPDATE subscriptions SET status = 'inactive', ends_at = CURRENT_TIMESTAMP, cancelled_at = CURRENT_TIMESTAMP WHERE user_id = ? AND status = 'active'").bind(auth.user.id).run();
  const result = await DB.prepare("INSERT INTO subscriptions (user_id, plan, plan_id, status, current_period_start) VALUES (?, ?, ?, 'active', CURRENT_TIMESTAMP)").bind(auth.user.id, plan.name, plan.id).run();
  return json({ success: true, subscription: await DB.prepare('SELECT id, user_id, plan, plan_id, status, starts_at, ends_at FROM subscriptions WHERE id = ?').bind(result.meta.last_row_id).first() }, 201);
}

async function profile(request, env) {
  const auth = await requireUser(request, env); if (auth.response) return auth.response;
  const DB = requireDb(env);
  const subscriptionRow = await DB.prepare("SELECT id, plan, status, starts_at, ends_at FROM subscriptions WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1").bind(auth.user.id).first();
  const { results: rides } = await DB.prepare('SELECT id, status, started_at, ended_at FROM rides WHERE user_id = ? ORDER BY id DESC LIMIT 5').bind(auth.user.id).all();
  return json({ user: auth.user, subscription: subscriptionRow, rides: rides || [] });
}

async function support(request, env) {
  const auth = await requireUser(request, env); if (auth.response) return auth.response;
  const body = await readJson(request); const subject = String(body?.subject || 'Signalement Pikala').trim().slice(0, 140); const message = String(body?.message || '').trim().slice(0, 4000);
  if (!message) return json({ code: 'MESSAGE_REQUIRED', error: 'Veuillez decrire le probleme.' }, 400);
  await requireDb(env).prepare('INSERT INTO support_tickets (user_id, name, email, subject, message) VALUES (?, ?, ?, ?, ?)').bind(auth.user.id, `${auth.user.first_name} ${auth.user.last_name}`.trim(), auth.user.email, subject, message).run();
  return json({ success: true }, 201);
}

async function ride(request, env) {
  const auth = await requireUser(request, env); if (auth.response) return auth.response;
  const DB = requireDb(env); const station = await DB.prepare('SELECT id FROM stations WHERE is_active = 1 ORDER BY id LIMIT 1').first();
  const result = await DB.prepare("INSERT INTO rides (user_id, start_station_id, status) VALUES (?, ?, 'active')").bind(auth.user.id, station?.id || null).run();
  return json({ success: true, ride: await DB.prepare('SELECT id, user_id, start_station_id, status, started_at FROM rides WHERE id = ?').bind(result.meta.last_row_id).first() }, 201);
}

async function adminOverview(request, env) {
  const auth = await requireRole(request, env, ['admin']); if (auth.response) return auth.response;
  const values = await requireDb(env).batch([
    requireDb(env).prepare('SELECT COUNT(*) AS count FROM users'), requireDb(env).prepare('SELECT COUNT(*) AS count FROM stations WHERE is_active = 1'),
    requireDb(env).prepare("SELECT COUNT(*) AS count FROM bikes WHERE status = 'available'"), requireDb(env).prepare("SELECT COUNT(*) AS count FROM support_tickets WHERE status IN ('open', 'in_progress')")
  ]);
  return json({ users: values[0].results[0]?.count || 0, stations: values[1].results[0]?.count || 0, bikes: values[2].results[0]?.count || 0, openTickets: values[3].results[0]?.count || 0 });
}

async function guardPrivatePage(request, env, url) {
  if (!PRIVATE_PAGES.has(url.pathname) && !ADMIN_PAGES.has(url.pathname)) return null;
  const auth = ADMIN_PAGES.has(url.pathname) ? await requireRole(request, env, ['admin']) : await requireUser(request, env);
  if (!auth.response) return null;
  return auth.response.status === 403 ? redirect('/dashboard.html?access=denied') : redirect(`/connexion.html?next=${encodeURIComponent(url.pathname + url.search)}`, 302, clearSessionCookies());
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (!csrfAllowed(request, env)) return json({ code: 'CSRF_REJECTED', error: 'Requete refusee.' }, 403);
      if (request.method === 'GET' && url.pathname === '/api/health') return json({ ok: true });
      if (request.method === 'POST' && url.pathname === '/api/signup') return signup(request, env);
      if (request.method === 'GET' && url.pathname === '/api/verify-email') return verifyEmail(request, env);
      if (request.method === 'POST' && url.pathname === '/api/verification/resend') return resendVerification(request, env);
      if (request.method === 'POST' && url.pathname === '/api/login') return login(request, env);
      if (request.method === 'POST' && url.pathname === '/api/logout') return logout(request, env);
      if (request.method === 'POST' && url.pathname === '/api/password/forgot') return forgotPassword(request, env);
      if (request.method === 'POST' && url.pathname === '/api/password/reset') return resetPassword(request, env);
      if (request.method === 'POST' && url.pathname === '/api/password/change') return changePassword(request, env);
      if (request.method === 'GET' && url.pathname === '/api/me') return me(request, env);
      if (request.method === 'PATCH' && url.pathname === '/api/profile') return updateProfile(request, env);
      if (request.method === 'GET' && url.pathname === '/api/stations') return stations(env);
      if (request.method === 'GET' && url.pathname === '/api/plans') return plans(env);
      if (request.method === 'GET' && url.pathname === '/api/profile') return profile(request, env);
      if (request.method === 'POST' && url.pathname === '/api/subscriptions') return subscription(request, env);
      if (request.method === 'POST' && url.pathname === '/api/support') return support(request, env);
      if (request.method === 'POST' && url.pathname === '/api/rides') return ride(request, env);
      if (request.method === 'GET' && url.pathname === '/api/admin/overview') return adminOverview(request, env);
      const privateResponse = await guardPrivatePage(request, env, url);
      if (privateResponse) return privateResponse;
    } catch (error) {
      const id = requestId(request);
      console.error('request_failed', id, error?.name || 'Error', error?.code || 'SERVER_ERROR');
      const unavailable = error?.code === 'DB_UNAVAILABLE';
      return json({ code: unavailable ? 'DB_UNAVAILABLE' : 'SERVER_ERROR', error: unavailable ? DB_UNAVAILABLE_MESSAGE : 'Une erreur interne est survenue.', requestId: id }, unavailable ? 503 : 500);
    }
    if (env.ASSETS) return env.ASSETS.fetch(assetRequestForCleanPath(request, url));
    return json({ code: 'NOT_FOUND', error: 'Route introuvable.' }, 404);
  }
};
