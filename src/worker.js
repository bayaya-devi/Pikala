import { getPaymentProvider } from './payments/provider.js';
import { getEmailProvider } from './email/provider.js';
import { logEvent } from './observability.js';
import { handleAdminApi } from './admin/service.js';
import { refreshMaintenanceReminders } from './admin/workshop.js';
import { runSupervision } from './admin/supervision.js';
import { handleDeviceEvent, requestIotReturn, reserveIotRide } from './iot/service.js';
import { handleOperationsApi } from './operations/service.js';
import { hasPermission, loadStaffActor } from './auth/rbac.js';
import { PLAN_FIELDS, activatePaidPayment, findActivePlan, listActivePlans, parseJson, recordNonPaidEvent, refreshUserSubscriptions, serializePlan, subscriptionOverview } from './payments/service.js';
const USER_FIELDS = 'id, first_name, last_name, email, phone, role, status, locale, created_at, email_verified, auth_version';
const JOINED_USER_FIELDS = USER_FIELDS.split(', ').map((field) => `users.${field} AS ${field}`).join(', ');
const SESSION_COOKIE = '__Host-pikala_session';
const LEGACY_SESSION_COOKIE = 'pikala_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const EMAIL_TOKEN_TTL_SECONDS = 60 * 60 * 24;
const RESET_TOKEN_TTL_SECONDS = 60 * 60;
// Cloudflare Workers Web Crypto rejects PBKDF2 work factors above 100,000.
const PASSWORD_ITERATIONS = 100000;
const MAX_JSON_BYTES = 16 * 1024;
const DB_UNAVAILABLE_MESSAGE = 'Service temporairement indisponible.';

const PAGE_ROUTES = new Map([
  ['/', '/index.html'], ['/accueil', '/accueil.html'], ['/home', '/index.html'], ['/dashboard', '/dashboard.html'],
  ['/stations', '/stations.html'], ['/station', '/station.html'], ['/scanner', '/scanner.html'], ['/trajets', '/trajets.html'], ['/trajet', '/trajet.html'], ['/profil', '/profil.html'],
  ['/profile', '/profil.html'], ['/support', '/support.html'], ['/ticket', '/ticket.html'], ['/incidents', '/incidents.html'], ['/notifications', '/notifications.html'], ['/abonnement', '/abonnement.html'],
  ['/connexion', '/connexion.html'], ['/login', '/connexion.html'], ['/inscription', '/inscription.html'],
  ['/signup', '/inscription.html'], ['/terrain', '/terrain.html'], ['/mot-de-passe-oublie', '/mot-de-passe-oublie.html'],
  ['/reinitialiser-mot-de-passe', '/reinitialiser-mot-de-passe.html'], ['/admin', '/admin.html']
]);
const PRIVATE_PAGES = new Set([
  '/dashboard', '/dashboard.html', '/stations', '/stations.html', '/station', '/station.html', '/scanner', '/scanner.html', '/trajets', '/trajets.html', '/trajet', '/trajet.html',
  '/profil', '/profil.html', '/profile', '/support', '/support.html', '/ticket', '/ticket.html', '/incidents', '/incidents.html', '/notifications', '/notifications.html', '/abonnement', '/abonnement.html'
]);
const ADMIN_PAGES = new Set(['/admin', '/admin.html', '/atelier', '/atelier.html', '/terrain', '/terrain.html']);
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const NON_INDEXED_PAGES = new Set([...PRIVATE_PAGES, ...ADMIN_PAGES,
  '/connexion', '/connexion.html', '/login', '/inscription', '/inscription.html', '/signup',
  '/mot-de-passe-oublie', '/mot-de-passe-oublie.html', '/reinitialiser-mot-de-passe',
  '/reinitialiser-mot-de-passe.html', '/accueil', '/accueil.html', '/offline.html'
]);

function hardenAssetResponse(response, url, id) {
  const headers = new Headers(response.headers);
  headers.set('x-content-type-options', 'nosniff');
  headers.set('x-frame-options', 'DENY');
  headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  headers.set('permissions-policy', 'camera=(self), geolocation=(self), microphone=()');
  headers.set('x-request-id', id);
  if (NON_INDEXED_PAGES.has(url.pathname)) headers.set('x-robots-tag', 'noindex, nofollow');
  if (NON_INDEXED_PAGES.has(url.pathname)) headers.set('cache-control', 'private, no-store');
  else if (url.pathname.endsWith('.html') || PAGE_ROUTES.has(url.pathname) || url.pathname === '/') headers.set('cache-control', 'no-cache, must-revalidate');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

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
    if (!Number.isInteger(iterations) || iterations < 10000 || iterations > PASSWORD_ITERATIONS) return false;
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
  } catch { logEvent('api.error', { requestId: requestId(request), code: 'SECURITY_EVENT_WRITE_FAILED' }, 'warn'); }
  const observedAuthEvents = {
    signup: { success: 'auth.signup.success', failure: 'auth.signup.failure', blocked: 'auth.signup.failure' },
    login: { success: 'auth.login.success', failure: 'auth.login.failure', blocked: 'auth.login.failure' }
  };
  const observedEvent = observedAuthEvents[eventType]?.[outcome];
  if (observedEvent) logEvent(observedEvent, { requestId: requestId(request), userId, outcome, code: metadata?.reason });
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

async function requireStaff(request, env, permission = 'staff.access') {
  const session = await requireUser(request, env);
  if (session.response) return session;
  const actor = await loadStaffActor(requireDb(env), session.user, { touch: true });
  if (!actor || !hasPermission(actor, permission)) {
    await securityEvent(requireDb(env), request, 'authorization_denied', 'blocked', session.user.id, { permission });
    return { response: json({ code: 'FORBIDDEN', error: 'Acces refuse.' }, 403) };
  }
  return { ...session, user: actor };
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
  return (await getEmailProvider(env).send({ to, subject, html })).ok;
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
  if (!getEmailProvider(env).configured) return json({ code: 'EMAIL_PROVIDER_UNAVAILABLE', error: "L'inscription est temporairement indisponible car le service email n'est pas configure." }, 503);
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
  if (!emailResult.sent) return json({ code: 'EMAIL_DELIVERY_FAILED', error: "Le compte est en attente, mais l'email de confirmation n'a pas pu etre envoye. Reessayez l'envoi." }, 503);
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
  if (!getEmailProvider(env).configured) return json({ code: 'EMAIL_PROVIDER_UNAVAILABLE', error: 'Le service email est temporairement indisponible.' }, 503);
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
  if (!getEmailProvider(env).configured) return json({ code: 'EMAIL_PROVIDER_UNAVAILABLE', error: 'Le service email est temporairement indisponible.' }, 503);
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

const STATION_FIELDS = `stations.id, stations.public_code, stations.slug, stations.name, stations.city, stations.address, stations.latitude, stations.longitude,
  (SELECT COUNT(*) FROM bikes WHERE bikes.station_id = stations.id AND bikes.status = 'available') AS bikes_available,
  (SELECT COUNT(*) FROM docks WHERE docks.station_id = stations.id AND docks.status = 'available') AS docks_available,
  stations.capacity, stations.is_active,
  CASE WHEN stations.is_active = 1 THEN 'open' ELSE 'closed' END AS status`;

async function stations(env, includeClosed = false) {
  const where = includeClosed ? '' : 'WHERE stations.is_active = 1';
  const { results } = await requireDb(env).prepare(`SELECT ${STATION_FIELDS} FROM stations ${where} ORDER BY stations.name, stations.id`).all();
  return json({ stations: results || [] });
}

function numericCoordinate(value, minimum, maximum) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= minimum && number <= maximum ? number : null;
}

function distanceMeters(latitudeA, longitudeA, latitudeB, longitudeB) {
  const radians = (degrees) => degrees * Math.PI / 180;
  const earthRadius = 6371000;
  const deltaLatitude = radians(latitudeB - latitudeA);
  const deltaLongitude = radians(longitudeB - longitudeA);
  const value = Math.sin(deltaLatitude / 2) ** 2 + Math.cos(radians(latitudeA)) * Math.cos(radians(latitudeB)) * Math.sin(deltaLongitude / 2) ** 2;
  return Math.round(earthRadius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value)));
}

async function userStations(request, env) {
  const auth = await requireUser(request, env); if (auth.response) return auth.response;
  return stations(env, true);
}

async function stationDetail(request, env, stationKey) {
  const auth = await requireUser(request, env); if (auth.response) return auth.response;
  let key;
  try { key = decodeURIComponent(stationKey || '').trim().slice(0, 100); }
  catch { return json({ code: 'STATION_KEY_INVALID', error: 'Identifiant de station invalide.' }, 400); }
  if (!key) return json({ code: 'STATION_NOT_FOUND', error: 'Station introuvable.' }, 404);
  const station = await requireDb(env).prepare(`SELECT ${STATION_FIELDS} FROM stations WHERE CAST(stations.id AS TEXT) = ? OR stations.public_code = ? OR stations.slug = ? LIMIT 1`).bind(key, key, key).first();
  if (!station) return json({ code: 'STATION_NOT_FOUND', error: 'Station introuvable.' }, 404);
  return json({ station });
}

async function dashboard(request, env, url) {
  const auth = await requireUser(request, env); if (auth.response) return auth.response;
  const DB = requireDb(env);
  await refreshUserSubscriptions(DB, auth.user.id);
  const [activeResult, subscriptionResult, ridesResult, notificationsResult, stationsResult] = await DB.batch([
    DB.prepare(`SELECT rides.id, rides.status, rides.started_at, bikes.public_code AS bike_code,
      start_station.name AS start_station_name, end_station.name AS end_station_name
      FROM rides LEFT JOIN bikes ON bikes.id = rides.bike_id
      LEFT JOIN stations start_station ON start_station.id = rides.start_station_id
      LEFT JOIN stations end_station ON end_station.id = rides.end_station_id
      WHERE rides.user_id = ? AND rides.status = 'active' ORDER BY rides.started_at DESC LIMIT 1`).bind(auth.user.id),
    DB.prepare(`SELECT subscriptions.id, subscriptions.plan, subscriptions.status, subscriptions.starts_at, subscriptions.ends_at,
      plans.name AS plan_name, plans.billing_period
      FROM subscriptions LEFT JOIN plans ON plans.id = subscriptions.plan_id
      WHERE subscriptions.user_id = ? AND subscriptions.status = 'active' ORDER BY subscriptions.id DESC LIMIT 1`).bind(auth.user.id),
    DB.prepare(`SELECT rides.id, rides.status, rides.started_at, rides.ended_at, rides.duration_seconds, rides.distance_meters,
      bikes.public_code AS bike_code, start_station.name AS start_station_name, end_station.name AS end_station_name
      FROM rides LEFT JOIN bikes ON bikes.id = rides.bike_id
      LEFT JOIN stations start_station ON start_station.id = rides.start_station_id
      LEFT JOIN stations end_station ON end_station.id = rides.end_station_id
      WHERE rides.user_id = ? ORDER BY rides.started_at DESC LIMIT 5`).bind(auth.user.id),
    DB.prepare(`SELECT id, type, title, body, status, created_at FROM notifications
      WHERE user_id = ? AND channel = 'in_app' AND status NOT IN ('dismissed') ORDER BY created_at DESC LIMIT 5`).bind(auth.user.id),
    DB.prepare(`SELECT ${STATION_FIELDS} FROM stations WHERE stations.is_active = 1 ORDER BY stations.name, stations.id`)
  ]);
  const latitude = numericCoordinate(url.searchParams.get('lat'), -90, 90);
  const longitude = numericCoordinate(url.searchParams.get('lng'), -180, 180);
  const stationRows = stationsResult.results || [];
  let nearestStation = null;
  if (latitude !== null && longitude !== null) {
    nearestStation = stationRows
      .filter((station) => station.latitude !== null && station.longitude !== null)
      .map((station) => ({ ...station, distance_meters: distanceMeters(latitude, longitude, Number(station.latitude), Number(station.longitude)) }))
      .sort((a, b) => a.distance_meters - b.distance_meters)[0] || null;
  }
  return json({
    user: auth.user,
    activeRide: activeResult.results?.[0] || null,
    subscription: subscriptionResult.results?.[0] || null,
    recentRides: ridesResult.results || [],
    notifications: notificationsResult.results || [],
    nearestStation,
    summary: {
      stations: stationRows.length,
      bikesAvailable: stationRows.reduce((total, station) => total + Number(station.bikes_available || 0), 0)
    }
  });
}

const RIDE_FIELDS = `rides.id, rides.user_id, rides.bike_id, rides.status, rides.started_at, rides.ended_at,
  rides.duration_seconds, rides.distance_meters, rides.charged_amount_minor,
  bikes.public_code AS bike_code, bikes.model AS bike_model, bikes.battery_level,
  start_station.id AS start_station_id, start_station.name AS start_station_name, start_station.address AS start_station_address,
  end_station.id AS end_station_id, end_station.name AS end_station_name, end_station.address AS end_station_address,
  start_dock.public_code AS start_dock_code, end_dock.public_code AS end_dock_code`;

const RIDE_JOINS = `FROM rides
  LEFT JOIN bikes ON bikes.id = rides.bike_id
  LEFT JOIN stations start_station ON start_station.id = rides.start_station_id
  LEFT JOIN stations end_station ON end_station.id = rides.end_station_id
  LEFT JOIN docks start_dock ON start_dock.id = rides.start_dock_id
  LEFT JOIN docks end_dock ON end_dock.id = rides.end_dock_id`;

function validRideId(value) { return /^[1-9][0-9]{0,15}$/.test(String(value || '')); }

function normalizeQrCode(value, kind, request, env) {
  const raw = String(value || '').trim();
  if (!raw || raw.length > 300) return null;
  const directPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{1,99}$/;
  if (directPattern.test(raw)) return raw;
  try {
    const parsed = new URL(raw);
    const expectedHost = kind === 'bike' ? 'bike' : 'dock';
    let code = null;
    if (parsed.protocol === 'pikala:' && parsed.hostname === expectedHost) code = parsed.pathname.split('/').filter(Boolean)[0];
    if (['http:', 'https:'].includes(parsed.protocol)) {
      const allowedHosts = new Set([new URL(request.url).host]);
      try { allowedHosts.add(new URL(publicOrigin(env)).host); } catch {}
      const parts = parsed.pathname.split('/').filter(Boolean);
      const marker = parts.lastIndexOf(expectedHost);
      if (allowedHosts.has(parsed.host) && marker >= 0) code = parts[marker + 1];
    }
    const decoded = decodeURIComponent(code || '');
    return directPattern.test(decoded) ? decoded : null;
  } catch { return null; }
}

async function rides(request, env) {
  const auth = await requireUser(request, env); if (auth.response) return auth.response;
  const { results } = await requireDb(env).prepare(`SELECT ${RIDE_FIELDS} ${RIDE_JOINS}
    WHERE rides.user_id = ? ORDER BY rides.started_at DESC LIMIT 100`).bind(auth.user.id).all();
  return json({ rides: results || [] });
}

async function activeRide(request, env) {
  const auth = await requireUser(request, env); if (auth.response) return auth.response;
  const rideRow = await requireDb(env).prepare(`SELECT ${RIDE_FIELDS} ${RIDE_JOINS}
    WHERE rides.user_id = ? AND rides.status = 'active' ORDER BY rides.id DESC LIMIT 1`).bind(auth.user.id).first();
  return json({ ride: rideRow || null });
}

async function rideDetail(request, env, rideId) {
  const auth = await requireUser(request, env); if (auth.response) return auth.response;
  if (!validRideId(rideId)) return json({ code: 'RIDE_NOT_FOUND', error: 'Trajet introuvable.' }, 404);
  const rideRow = await requireDb(env).prepare(`SELECT ${RIDE_FIELDS} ${RIDE_JOINS}
    WHERE rides.id = ? AND rides.user_id = ? LIMIT 1`).bind(rideId, auth.user.id).first();
  if (!rideRow) return json({ code: 'RIDE_NOT_FOUND', error: 'Trajet introuvable.' }, 404);
  return json({ ride: rideRow });
}

function paymentPublic(row) {
  if (!row) return null;
  return { reference: row.public_reference, status: row.lifecycle_status, amountMinor: Number(row.amount_minor),
    currency: row.currency, provider: row.provider || null, planName: row.plan_name_snapshot,
    durationDays: Number(row.plan_duration_days_snapshot), createdAt: row.created_at,
    paidAt: row.paid_at || null, refundedAt: row.refunded_at || null, failureCode: row.failure_code || null };
}

async function plans(request, env) {
  const provider = getPaymentProvider(env);
  const rows = await listActivePlans(requireDb(env));
  const compatible = rows.map((plan) => ({ ...plan, amount_minor: plan.amountMinor, amount_mad: plan.amountMinor / 100,
    billing_period: plan.billingPeriod, summary: plan.description }));
  return json({ plans: compatible, paymentProvider: { configured: provider.configured, name: provider.name } }, 200, { 'cache-control': 'public, max-age=300' });
}

async function subscriptions(request, env) {
  const auth = await requireUser(request, env); if (auth.response) return auth.response;
  const provider = getPaymentProvider(env);
  const overview = await subscriptionOverview(requireDb(env), auth.user.id);
  return json({ ...overview, paymentProvider: { configured: provider.configured, name: provider.name } });
}

function validIdempotencyKey(value) { return /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(String(value || '')); }

async function checkoutSubscription(request, env) {
  const auth = await requireUser(request, env); if (auth.response) return auth.response;
  const body = await readJson(request);
  const planSlug = String(body?.plan || body?.planSlug || '').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,79}$/.test(planSlug)) return json({ code: 'PLAN_REQUIRED', error: 'Veuillez choisir une offre.' }, 400);
  const rawIdempotency = request.headers.get('idempotency-key') || body?.idempotencyKey;
  if (!validIdempotencyKey(rawIdempotency)) return json({ code: 'IDEMPOTENCY_KEY_REQUIRED', error: "Une cle d'idempotence valide est requise." }, 400);
  const DB = requireDb(env);
  await refreshUserSubscriptions(DB, auth.user.id);
  const plan = await findActivePlan(DB, planSlug);
  if (!plan) return json({ code: 'PLAN_NOT_FOUND', error: "Cette offre n'est pas disponible." }, 404);
  const idempotencyKey = await sha256(`payment:${auth.user.id}:${rawIdempotency}`);
  const existing = await DB.prepare(`SELECT public_reference, lifecycle_status, amount_minor, currency, provider,
    plan_name_snapshot, plan_duration_days_snapshot, created_at, paid_at, refunded_at, failure_code
    FROM payments WHERE idempotency_key = ? AND user_id = ? LIMIT 1`).bind(idempotencyKey, auth.user.id).first();
  if (existing) return json({ payment: paymentPublic(existing), idempotent: true }, 200);
  const provider = Number(plan.amount_minor) === 0 ? { name: 'free', configured: true } : getPaymentProvider(env);
  if (!provider.configured) return json({ code: 'PAYMENT_PROVIDER_UNAVAILABLE', error: "Le paiement en ligne sera bientot disponible. Aucun debit ni abonnement n'a ete cree." }, 503);
  const reference = `pay_${base64Url(crypto.getRandomValues(new Uint8Array(18)))}`;
  const insert = await DB.prepare(`INSERT INTO payments
    (user_id, plan_id, amount_minor, currency, status, lifecycle_status, provider, public_reference,
     idempotency_key, plan_name_snapshot, plan_duration_days_snapshot, benefits_json_snapshot, metadata_json)
    VALUES (?, ?, ?, ?, 'pending', 'pending', ?, ?, ?, ?, ?, ?, '{}')`)
    .bind(auth.user.id, plan.id, plan.amount_minor, plan.currency, provider.name, reference, idempotencyKey,
      plan.name, plan.duration_days, plan.benefits_json).run();
  let row = await DB.prepare('SELECT * FROM payments WHERE id = ?').bind(insert.meta.last_row_id).first();
  if (Number(plan.amount_minor) === 0) {
    const event = { eventId: `free:${reference}`, eventType: 'payment.paid', status: 'paid', payloadHash: await sha256(reference) };
    row.provider_payment_id = `free:${reference}`;
    await DB.prepare('UPDATE payments SET provider_payment_id = ? WHERE id = ?').bind(row.provider_payment_id, row.id).run();
    await activatePaidPayment(DB, row, event);
    row = await DB.prepare('SELECT * FROM payments WHERE id = ?').bind(row.id).first();
    return json({ payment: paymentPublic(row), subscription: (await subscriptionOverview(DB, auth.user.id)).active }, 201);
  }
  try {
    const checkout = await provider.createCheckout({ reference, amountMinor: Number(plan.amount_minor), currency: plan.currency, planSlug: plan.slug, userId: auth.user.id });
    const lifecycle = checkout.status === 'processing' ? 'processing' : 'pending';
    const legacy = lifecycle === 'processing' ? 'requires_action' : 'pending';
    await DB.prepare(`UPDATE payments SET lifecycle_status = ?, status = ?, provider_payment_id = ?, provider_session_id = ?,
      checkout_expires_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND lifecycle_status = 'pending'`)
      .bind(lifecycle, legacy, checkout.providerPaymentId, checkout.providerSessionId || null, checkout.expiresAt || null, row.id).run();
    row = await DB.prepare('SELECT * FROM payments WHERE id = ?').bind(row.id).first();
    return json({ payment: paymentPublic(row), checkoutUrl: checkout.checkoutUrl || null }, 202);
  } catch (error) {
    await DB.prepare("UPDATE payments SET lifecycle_status = 'failed', status = 'failed', failure_code = 'PROVIDER_CREATE_FAILED', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(row.id).run();
    return json({ code: error?.code === 'PAYMENT_PROVIDER_UNAVAILABLE' ? error.code : 'PAYMENT_START_FAILED', error: "Le paiement n'a pas pu etre initialise. Aucun abonnement n'a ete active." }, 503);
  }
}

async function paymentStatus(request, env, reference) {
  const auth = await requireUser(request, env); if (auth.response) return auth.response;
  if (!/^pay_[A-Za-z0-9_-]{20,80}$/.test(reference)) return json({ code: 'PAYMENT_NOT_FOUND', error: 'Paiement introuvable.' }, 404);
  const row = await requireDb(env).prepare(`SELECT public_reference, lifecycle_status, amount_minor, currency, provider,
    plan_name_snapshot, plan_duration_days_snapshot, created_at, paid_at, refunded_at, failure_code
    FROM payments WHERE public_reference = ? AND user_id = ? LIMIT 1`).bind(reference, auth.user.id).first();
  return row ? json({ payment: paymentPublic(row) }) : json({ code: 'PAYMENT_NOT_FOUND', error: 'Paiement introuvable.' }, 404);
}

async function paymentWebhook(request, env, providerName) {
  const provider = getPaymentProvider(env);
  if (!provider.configured || provider.name !== providerName) return json({ code: 'PAYMENT_PROVIDER_UNAVAILABLE', error: 'Provider inconnu.' }, 404);
  const event = await provider.verifyWebhook(request);
  if (!event.ok) return json({ code: event.code, error: 'Webhook refuse.' }, event.code === 'WEBHOOK_SIGNATURE_INVALID' ? 401 : 400);
  const DB = requireDb(env);
  const duplicate = await DB.prepare('SELECT processing_status FROM payment_events WHERE provider = ? AND provider_event_id = ?').bind(provider.name, event.eventId).first();
  if (duplicate) return json({ received: true, duplicate: true });
  const payment = await DB.prepare('SELECT * FROM payments WHERE provider = ? AND provider_payment_id = ? LIMIT 1').bind(provider.name, event.providerPaymentId).first();
  if (!payment) {
    await DB.prepare(`INSERT INTO payment_events (provider, provider_event_id, event_type, payload_hash, processing_status, processed_at, error_code)
      VALUES (?, ?, ?, ?, 'ignored', CURRENT_TIMESTAMP, 'PAYMENT_NOT_FOUND')`).bind(provider.name, event.eventId, event.eventType, event.payloadHash).run();
    return json({ received: true, ignored: true }, 202);
  }
  try {
    const result = event.status === 'paid' ? await activatePaidPayment(DB, payment, event) : await recordNonPaidEvent(DB, payment, event);
    logEvent('payment.updated', { requestId: requestId(request), userId: payment.user_id, resourceType: 'payment', resourceId: payment.id, outcome: event.status, provider: provider.name });
    return json({ received: true, ...result });
  } catch (error) {
    if (String(error?.message || '').includes('UNIQUE constraint failed: payment_events')) return json({ received: true, duplicate: true });
    throw error;
  }
}

async function cancelSubscription(request, env, subscriptionId) {
  const auth = await requireUser(request, env); if (auth.response) return auth.response;
  if (!validRideId(subscriptionId)) return json({ code: 'SUBSCRIPTION_NOT_FOUND', error: 'Abonnement introuvable.' }, 404);
  const result = await requireDb(env).prepare(`UPDATE subscriptions SET cancel_at_period_end = 1, auto_renew = 0, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ? AND status = 'active'`).bind(subscriptionId, auth.user.id).run();
  return result.meta.changes ? json({ success: true }) : json({ code: 'SUBSCRIPTION_NOT_FOUND', error: 'Abonnement introuvable.' }, 404);
}

function normalizePlanInput(body, existing = {}) {
  const slug = String(body?.slug ?? existing.slug ?? '').trim().toLowerCase();
  const name = String(body?.name ?? existing.name ?? '').trim();
  const description = String(body?.description ?? existing.description ?? '').trim();
  const amountMinor = Number(body?.amountMinor ?? existing.amount_minor);
  const currency = String(body?.currency ?? existing.currency ?? 'MAD').trim().toUpperCase();
  const durationDays = Number(body?.durationDays ?? existing.duration_days);
  const billingPeriod = String(body?.billingPeriod ?? existing.billing_period ?? 'month');
  const status = String(body?.status ?? existing.status ?? 'draft');
  const displayOrder = Number(body?.displayOrder ?? existing.display_order ?? 0);
  const featured = body?.featured === undefined ? Boolean(existing.is_featured) : Boolean(body.featured);
  const benefits = body?.benefits ?? parseJson(existing.benefits_json, []);
  const translations = body?.translations ?? parseJson(existing.translations_json, {});
  const validTranslations = translations && typeof translations === 'object' && !Array.isArray(translations)
    && Object.entries(translations).every(([locale, value]) => ['fr','en','es','pt','ar'].includes(locale)
      && value && typeof value === 'object' && String(value.name || '').length <= 120
      && String(value.description || '').length <= 600 && Array.isArray(value.benefits || [])
      && value.benefits.length <= 12 && value.benefits.every((item) => typeof item === 'string' && item.length <= 140));
  if (!/^[a-z0-9][a-z0-9-]{1,79}$/.test(slug) || name.length < 2 || name.length > 120 || description.length > 600
    || !Number.isInteger(amountMinor) || amountMinor < 0 || amountMinor > 100000000 || !/^[A-Z]{3}$/.test(currency)
    || !Number.isInteger(durationDays) || durationDays < 1 || durationDays > 3650
    || !new Set(['day','week','month','year','one_time']).has(billingPeriod)
    || !new Set(['draft','active','archived','legacy']).has(status) || !Number.isInteger(displayOrder) || Math.abs(displayOrder) > 100000
    || !Array.isArray(benefits) || benefits.length > 12 || benefits.some((item) => typeof item !== 'string' || item.length < 1 || item.length > 140)
    || !validTranslations) return null;
  return { slug, name, description, amountMinor, currency, durationDays, billingPeriod, status, displayOrder, featured, benefits, translations };
}

async function adminPlans(request, env, actor) {
  const DB = requireDb(env);
  if (request.method === 'GET') {
    const { results } = await DB.prepare(`SELECT ${PLAN_FIELDS} FROM plans ORDER BY display_order, id`).all();
    return json({ plans: (results || []).map(serializePlan) });
  }
  const input = normalizePlanInput(await readJson(request));
  if (!input) return json({ code: 'PLAN_INVALID', error: 'Donnees de plan invalides.' }, 400);
  const result = await DB.prepare(`INSERT INTO plans
    (slug,name,description,amount_minor,currency,billing_period,status,display_order,duration_days,benefits_json,translations_json,is_featured,version)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1)`).bind(input.slug,input.name,input.description,input.amountMinor,input.currency,input.billingPeriod,input.status,input.displayOrder,input.durationDays,JSON.stringify(input.benefits),JSON.stringify(input.translations),input.featured?1:0).run();
  await DB.prepare('INSERT INTO admin_audit_logs (actor_user_id, action, target_type, target_id, request_id, ip_hint) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(actor.id, 'plan.create', 'plan', String(result.meta.last_row_id), requestId(request), (await ipHash(request)).slice(0,32)).run();
  return json({ plan: serializePlan(await DB.prepare(`SELECT ${PLAN_FIELDS} FROM plans WHERE id = ?`).bind(result.meta.last_row_id).first()) }, 201);
}

async function adminPlanUpdate(request, env, planId, actor) {
  if (!validRideId(planId)) return json({ code: 'PLAN_NOT_FOUND', error: 'Offre introuvable.' }, 404);
  const DB = requireDb(env); const existing = await DB.prepare('SELECT * FROM plans WHERE id = ?').bind(planId).first();
  if (!existing) return json({ code: 'PLAN_NOT_FOUND', error: 'Offre introuvable.' }, 404);
  const input = normalizePlanInput(await readJson(request), existing);
  if (!input) return json({ code: 'PLAN_INVALID', error: 'Donnees de plan invalides.' }, 400);
  await DB.prepare(`UPDATE plans SET slug=?,name=?,description=?,amount_minor=?,currency=?,billing_period=?,status=?,display_order=?,
    duration_days=?,benefits_json=?,translations_json=?,is_featured=?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
    .bind(input.slug,input.name,input.description,input.amountMinor,input.currency,input.billingPeriod,input.status,input.displayOrder,input.durationDays,JSON.stringify(input.benefits),JSON.stringify(input.translations),input.featured?1:0,planId).run();
  await DB.prepare('INSERT INTO admin_audit_logs (actor_user_id, action, target_type, target_id, request_id, ip_hint) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(actor.id, 'plan.update', 'plan', String(planId), requestId(request), (await ipHash(request)).slice(0,32)).run();
  return json({ plan: serializePlan(await DB.prepare(`SELECT ${PLAN_FIELDS} FROM plans WHERE id = ?`).bind(planId).first()) });
}

async function profile(request, env) {
  const auth = await requireUser(request, env); if (auth.response) return auth.response;
  const DB = requireDb(env); const overview = await subscriptionOverview(DB, auth.user.id);
  const { results: rides } = await DB.prepare('SELECT id, status, started_at, ended_at FROM rides WHERE user_id = ? ORDER BY id DESC LIMIT 5').bind(auth.user.id).all();
  return json({ user: auth.user, subscription: overview.active, rides: rides || [] });
}

async function support(request, env) {
  const auth = await requireUser(request, env); if (auth.response) return auth.response;
  const body = await readJson(request); const subject = String(body?.subject || 'Signalement Pikala').trim().slice(0, 140); const message = String(body?.message || '').trim().slice(0, 4000);
  if (!message) return json({ code: 'MESSAGE_REQUIRED', error: 'Veuillez decrire le probleme.' }, 400);
  await requireDb(env).prepare('INSERT INTO support_tickets (user_id, name, email, subject, message) VALUES (?, ?, ?, ?, ?)').bind(auth.user.id, `${auth.user.first_name} ${auth.user.last_name}`.trim(), auth.user.email, subject, message).run();
  return json({ success: true }, 201);
}

async function startRide(request, env) {
  const auth = await requireUser(request, env); if (auth.response) return auth.response;
  const body = await readJson(request);
  if (!body) return json({ code: 'INVALID_REQUEST', error: 'Requete invalide.' }, 400);
  const bikeCode = normalizeQrCode(body.qrPayload ?? body.bikeCode, 'bike', request, env);
  if (!bikeCode) return json({ code: 'QR_INVALID', error: 'QR velo invalide.' }, 400);
  const DB = requireDb(env);
  const [subscriptionResult, currentRideResult, bikeResult] = await DB.batch([
    DB.prepare(`SELECT id, plan, currency FROM (
      SELECT subscriptions.id, subscriptions.plan, plans.currency, subscriptions.ends_at
      FROM subscriptions LEFT JOIN plans ON plans.id = subscriptions.plan_id
      WHERE subscriptions.user_id = ? AND subscriptions.status = 'active'
        AND (subscriptions.ends_at IS NULL OR subscriptions.ends_at > CURRENT_TIMESTAMP)
      UNION ALL
      SELECT -manual_entitlements.id, 'manual:' || manual_entitlements.benefit_type, COALESCE(plans.currency,'MAD'), manual_entitlements.ends_at
      FROM manual_entitlements LEFT JOIN plans ON plans.id = manual_entitlements.plan_id
      WHERE manual_entitlements.user_id = ? AND manual_entitlements.status = 'active'
        AND manual_entitlements.benefit_type IN ('ride_access','subscription_extension')
        AND manual_entitlements.starts_at <= CURRENT_TIMESTAMP AND manual_entitlements.ends_at > CURRENT_TIMESTAMP
    ) ORDER BY ends_at DESC LIMIT 1`).bind(auth.user.id, auth.user.id),
    DB.prepare("SELECT id FROM rides WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1").bind(auth.user.id),
    DB.prepare(`SELECT bikes.id, bikes.public_code, bikes.station_id, bikes.status, bikes.maintenance_required, stations.is_active AS station_active,
      docks.id AS dock_id, docks.status AS dock_status
      FROM bikes LEFT JOIN stations ON stations.id = bikes.station_id
      LEFT JOIN docks ON docks.bike_id = bikes.id
      WHERE bikes.code = ? OR bikes.public_code = ? ORDER BY docks.id LIMIT 1`).bind(bikeCode, bikeCode)
  ]);
  const subscriptionRow = subscriptionResult.results?.[0];
  const currentRide = currentRideResult.results?.[0];
  const bike = bikeResult.results?.[0];
  if (!subscriptionRow) return json({ code: 'SUBSCRIPTION_REQUIRED', error: 'Un abonnement actif est necessaire.' }, 409);
  if (!bike) return json({ code: 'QR_UNKNOWN', error: 'Ce QR ne correspond a aucun velo Pikala.' }, 404);
  try {
    const pending = await reserveIotRide(DB, env, {
      userId: auth.user.id, bike, requestId: requestId(request),
      idempotencyKey: String(body.idempotencyKey || request.headers.get('idempotency-key') || '').trim()
    });
    if (pending) {
      logEvent('ride.unlock.requested', { requestId: requestId(request), userId: auth.user.id, resourceType: 'ride', resourceId: pending.rideId, outcome: 'pending' });
      return json({ success: true, pendingHardware: true, ride: { id: pending.rideId, status: 'reserved' }, command: { id: pending.command.command_id, status: pending.command.status } }, 202);
    }
  } catch (error) {
    const messages={IOT_COMMAND_INVALID:'Une nouvelle tentative est necessaire.',DEVICE_PROVIDER_UNAVAILABLE:'Le service de deverrouillage est indisponible.',BIKE_LOCK_UNAVAILABLE:'La serrure de ce velo est indisponible.',DEVICE_OFFLINE:'La serrure de ce velo est hors ligne.',BIKE_UNAVAILABLE:'Ce velo vient de devenir indisponible.',BIKE_MAINTENANCE:'Ce velo est en maintenance.',STATION_CLOSED:'La station de ce velo est fermee.',BIKE_DOCK_INVALID:"Le velo n'est pas correctement attache a un dock.",RIDE_ALREADY_ACTIVE:'Un trajet est deja en cours.'};
    if(messages[error?.code])return json({code:error.code,error:messages[error.code]},error.code==='IOT_COMMAND_INVALID'?400:409);
    throw error;
  }
  if (currentRide) return json({ code: 'RIDE_ALREADY_ACTIVE', error: 'Un trajet est deja en cours.' }, 409);
  if (bike.status === 'maintenance' || Number(bike.maintenance_required) === 1) return json({ code: 'BIKE_MAINTENANCE', error: 'Ce velo est en maintenance.' }, 409);
  if (bike.status !== 'available') return json({ code: 'BIKE_UNAVAILABLE', error: 'Ce velo est deja utilise ou indisponible.' }, 409);
  if (!bike.station_id || Number(bike.station_active) !== 1) return json({ code: 'STATION_CLOSED', error: 'La station de ce velo est fermee.' }, 409);
  if (!bike.dock_id || bike.dock_status !== 'occupied') return json({ code: 'BIKE_DOCK_INVALID', error: "Le velo n'est pas correctement attache a un dock." }, 409);
  const claimTimestamp = new Date().toISOString();
  let results;
  try {
    results = await DB.batch([
      DB.prepare(`UPDATE docks SET status = 'available', bike_id = NULL, lock_status='unlocked', updated_at = ?
        WHERE id = ? AND station_id = ? AND status = 'occupied' AND bike_id = ?`).bind(claimTimestamp, bike.dock_id, bike.station_id, bike.id),
      DB.prepare(`UPDATE bikes SET status = 'in_use', station_id = NULL, lock_status='unlocked', updated_at = ?
        WHERE id = ? AND status = 'available' AND maintenance_required = 0 AND station_id = ?
        AND EXISTS (SELECT 1 FROM docks WHERE id = ? AND status = 'available' AND bike_id IS NULL AND updated_at = ?)`).bind(claimTimestamp, bike.id, bike.station_id, bike.dock_id, claimTimestamp),
      DB.prepare(`INSERT INTO rides (user_id, bike_id, start_station_id, start_dock_id, status, updated_at)
        SELECT ?, ?, ?, ?, 'active', ? WHERE EXISTS (
          SELECT 1 FROM bikes WHERE id = ? AND status = 'in_use' AND station_id IS NULL AND updated_at = ?
        ) AND EXISTS (
          SELECT 1 FROM docks WHERE id = ? AND status = 'available' AND bike_id IS NULL AND updated_at = ?
        )`).bind(auth.user.id, bike.id, bike.station_id, bike.dock_id, claimTimestamp, bike.id, claimTimestamp, bike.dock_id, claimTimestamp),
      DB.prepare(`UPDATE stations SET bikes_available = (SELECT COUNT(*) FROM bikes WHERE station_id = ? AND status = 'available')
        WHERE id = ?`).bind(bike.station_id, bike.station_id),
      DB.prepare(`INSERT INTO notifications (user_id,type,title,body,channel,status,sent_at,action_url,updated_at)
        SELECT ?,'ride_started','Trajet demarre','Votre velo Pikala est debloque. Bonne route.','in_app','sent',CURRENT_TIMESTAMP,?,CURRENT_TIMESTAMP
        WHERE EXISTS (SELECT 1 FROM rides WHERE user_id = ? AND bike_id = ? AND status = 'active' AND updated_at = ?)` )
        .bind(auth.user.id, '/trajet.html', auth.user.id, bike.id, claimTimestamp)
    ]);
  } catch (error) {
    const message = String(error?.message || '');
    if (message.includes('user already has an active ride')) return json({ code: 'RIDE_ALREADY_ACTIVE', error: 'Un trajet est deja en cours.' }, 409);
    if (message.includes('UNIQUE constraint failed')) return json({ code: 'BIKE_UNAVAILABLE', error: 'Ce velo vient de devenir indisponible.' }, 409);
    throw error;
  }
  if (!results[0].meta.changes || !results[1].meta.changes || !results[2].meta.changes) return json({ code: 'BIKE_UNAVAILABLE', error: 'Ce velo vient de devenir indisponible.' }, 409);
  const rideRow = await DB.prepare(`SELECT ${RIDE_FIELDS} ${RIDE_JOINS} WHERE rides.id = ?`).bind(results[2].meta.last_row_id).first();
  logEvent('ride.start', { requestId: requestId(request), userId: auth.user.id, resourceType: 'ride', resourceId: rideRow?.id, outcome: 'success' });
  return json({ success: true, ride: rideRow }, 201);
}

function calculateRideChargeMinor() {
  // Current Pikala plans include rides. A future per-minute tariff must be a versioned plan field.
  return 0;
}

async function returnRide(request, env, rideId) {
  const auth = await requireUser(request, env); if (auth.response) return auth.response;
  if (!validRideId(rideId)) return json({ code: 'RIDE_NOT_FOUND', error: 'Trajet introuvable.' }, 404);
  const body = await readJson(request);
  if (!body) return json({ code: 'INVALID_REQUEST', error: 'Requete invalide.' }, 400);
  const dockCode = normalizeQrCode(body.qrPayload ?? body.dockCode, 'dock', request, env);
  if (!dockCode) return json({ code: 'DOCK_QR_INVALID', error: 'QR dock invalide.' }, 400);
  const DB = requireDb(env);
  const [rideResult, dockResult] = await DB.batch([
    DB.prepare(`SELECT rides.id, rides.user_id, rides.bike_id, rides.status, rides.started_at, bikes.status AS bike_status
      FROM rides LEFT JOIN bikes ON bikes.id = rides.bike_id WHERE rides.id = ? LIMIT 1`).bind(rideId),
    DB.prepare(`SELECT docks.id, docks.station_id, docks.status, docks.bike_id, stations.is_active AS station_active
      FROM docks JOIN stations ON stations.id = docks.station_id WHERE docks.public_code = ? LIMIT 1`).bind(dockCode)
  ]);
  const rideRow = rideResult.results?.[0];
  const dock = dockResult.results?.[0];
  if (!rideRow || Number(rideRow.user_id) !== Number(auth.user.id)) return json({ code: 'RIDE_NOT_FOUND', error: 'Trajet introuvable.' }, 404);
  if (rideRow.status !== 'active') return json({ code: 'RIDE_ALREADY_ENDED', error: 'Ce trajet est deja termine.' }, 409);
  if (rideRow.bike_status !== 'in_use') return json({ code: 'BIKE_STATE_INVALID', error: "L'etat du velo doit etre verifie par le support." }, 409);
  if (!dock) return json({ code: 'DOCK_UNKNOWN', error: 'Ce QR ne correspond a aucun dock Pikala.' }, 404);
  if (Number(dock.station_active) !== 1) return json({ code: 'STATION_CLOSED', error: 'Cette station est fermee.' }, 409);
  if (dock.status !== 'available' || dock.bike_id !== null) return json({ code: 'DOCK_UNAVAILABLE', error: "Ce dock n'est pas disponible." }, 409);
  try {
    const pending = await requestIotReturn(DB, env, {
      userId: auth.user.id, ride: rideRow, dock, requestId: requestId(request),
      idempotencyKey: String(body.idempotencyKey || request.headers.get('idempotency-key') || '').trim()
    });
    if (pending) {
      logEvent('ride.lock.requested', { requestId: requestId(request), userId: auth.user.id, resourceType: 'ride', resourceId: rideRow.id, outcome: 'pending' });
      return json({ success: true, pendingHardware: true, ride: { ...rideRow, status: 'active' }, command: { id: pending.command.command_id, status: pending.command.status } }, 202);
    }
  } catch (error) {
    const messages={IOT_COMMAND_INVALID:'Une nouvelle tentative est necessaire.',DEVICE_PROVIDER_UNAVAILABLE:'Le service de verrouillage est indisponible.',DOCK_DEVICE_UNAVAILABLE:'Le dispositif de restitution est indisponible.',DEVICE_OFFLINE:'Le dispositif de restitution est hors ligne.'};
    if(messages[error?.code])return json({code:error.code,error:messages[error.code]},error.code==='IOT_COMMAND_INVALID'?400:409);
    throw error;
  }
  const endedAt = new Date().toISOString();
  const chargeMinor = calculateRideChargeMinor();
  const results = await DB.batch([
    DB.prepare(`UPDATE rides SET status = 'completed', end_station_id = ?, end_dock_id = ?, ended_at = ?,
      duration_seconds = MAX(0, CAST((julianday(?) - julianday(started_at)) * 86400 AS INTEGER)),
      charged_amount_minor = ?, updated_at = ?
      WHERE id = ? AND user_id = ? AND bike_id = ? AND status = 'active'
      AND EXISTS (SELECT 1 FROM bikes WHERE id = ? AND status = 'in_use')
      AND EXISTS (SELECT 1 FROM docks WHERE id = ? AND station_id = ? AND status = 'available' AND bike_id IS NULL)`).bind(dock.station_id, dock.id, endedAt, endedAt, chargeMinor, endedAt, rideRow.id, auth.user.id, rideRow.bike_id, rideRow.bike_id, dock.id, dock.station_id),
    DB.prepare(`UPDATE bikes SET status = CASE WHEN maintenance_required = 1 THEN 'maintenance' ELSE 'available' END, station_id = ?, lock_status='locked',
      total_rides=total_rides+1,total_usage_seconds=total_usage_seconds+COALESCE((SELECT duration_seconds FROM rides WHERE id=?),0),
      odometer_meters=odometer_meters+COALESCE((SELECT distance_meters FROM rides WHERE id=?),0),updated_at = ?
      WHERE id = ? AND status = 'in_use'
      AND EXISTS (SELECT 1 FROM rides WHERE id = ? AND status = 'completed' AND updated_at = ?)`).bind(dock.station_id,rideRow.id,rideRow.id,endedAt,rideRow.bike_id,rideRow.id,endedAt),
    DB.prepare(`UPDATE docks SET status = 'occupied', bike_id = ?, lock_status='locked', updated_at = ?
      WHERE id = ? AND station_id = ? AND status = 'available' AND bike_id IS NULL
      AND EXISTS (SELECT 1 FROM rides WHERE id = ? AND status = 'completed' AND updated_at = ?)
      AND EXISTS (SELECT 1 FROM bikes WHERE id = ? AND status IN ('available','maintenance') AND station_id = ? AND updated_at = ?)`).bind(rideRow.bike_id, endedAt, dock.id, dock.station_id, rideRow.id, endedAt, rideRow.bike_id, dock.station_id, endedAt),
    DB.prepare(`INSERT INTO maintenance_records (bike_id,incident_id,opened_by_user_id,status,reason,workflow_stage,process_version,workshop_stage,problem_text)
      SELECT ?,bike_incidents.id,?,'open',bike_incidents.description,'reported',2,'reported',bike_incidents.description FROM bike_incidents
      WHERE bike_incidents.bike_id=? AND bike_incidents.status IN ('open','triaged','in_progress')
      AND EXISTS (SELECT 1 FROM bikes WHERE id=? AND maintenance_required=1)
      AND NOT EXISTS (SELECT 1 FROM maintenance_records WHERE bike_id=? AND status IN ('open','in_progress'))
      ORDER BY bike_incidents.id DESC LIMIT 1`).bind(rideRow.bike_id,auth.user.id,rideRow.bike_id,rideRow.bike_id,rideRow.bike_id),
    DB.prepare(`UPDATE stations SET bikes_available = (SELECT COUNT(*) FROM bikes WHERE station_id = ? AND status = 'available')
      WHERE id = ?`).bind(dock.station_id, dock.station_id),
    DB.prepare(`INSERT INTO notifications (user_id,type,title,body,channel,status,sent_at,action_url,updated_at)
      SELECT ?,'ride_completed','Trajet termine','Votre velo a bien ete restitue. Le resume est disponible.','in_app','sent',CURRENT_TIMESTAMP,?,CURRENT_TIMESTAMP
      WHERE EXISTS (SELECT 1 FROM rides WHERE id = ? AND user_id = ? AND status = 'completed' AND updated_at = ?)` )
      .bind(auth.user.id, '/trajet.html?id=' + rideRow.id, rideRow.id, auth.user.id, endedAt)
  ]);
  if (!results[0].meta.changes || !results[1].meta.changes || !results[2].meta.changes) {
    const latest = await DB.prepare('SELECT status FROM rides WHERE id = ? AND user_id = ?').bind(rideRow.id, auth.user.id).first();
    return json({ code: latest?.status === 'completed' ? 'RIDE_ALREADY_ENDED' : 'RETURN_CONFLICT', error: latest?.status === 'completed' ? 'Ce trajet est deja termine.' : 'La restitution a echoue. Reessayez.' }, 409);
  }
  if (results[3]?.meta?.changes) { const record = await DB.prepare("SELECT id FROM maintenance_records WHERE bike_id=? AND status IN ('open','in_progress') ORDER BY id DESC LIMIT 1").bind(rideRow.bike_id).first(); if (record) await DB.prepare("INSERT INTO workflow_events (resource_type,resource_id,actor_user_id,to_status,note) VALUES ('maintenance',?,?,'reported','Incident critique déclaré pendant le trajet')").bind(record.id,auth.user.id).run(); }
  const completedRide = await DB.prepare(`SELECT ${RIDE_FIELDS} ${RIDE_JOINS} WHERE rides.id = ?`).bind(rideRow.id).first();
  logEvent('ride.end', { requestId: requestId(request), userId: auth.user.id, resourceType: 'ride', resourceId: rideRow.id, outcome: 'success' });
  return json({ success: true, ride: completedRide, pricing: { amountMinor: chargeMinor, currency: 'MAD', includedInPlan: chargeMinor === 0 } });
}

async function reportRideIncident(request, env, rideId) {
  const auth = await requireUser(request, env); if (auth.response) return auth.response;
  if (!validRideId(rideId)) return json({ code: 'RIDE_NOT_FOUND', error: 'Trajet introuvable.' }, 404);
  const body = await readJson(request);
  const category = String(body?.category || '').trim();
  const description = String(body?.description || '').trim();
  const categories = new Set(['damage', 'mechanical', 'battery', 'lock', 'missing', 'safety', 'other']);
  if (!categories.has(category)) return json({ code: 'INCIDENT_CATEGORY_INVALID', error: "Categorie d'incident invalide." }, 400);
  if (description.length < 5 || description.length > 1000) return json({ code: 'INCIDENT_DESCRIPTION_INVALID', error: "Decrivez l'incident en 5 a 1000 caracteres." }, 400);
  const DB = requireDb(env);
  const rideRow = await DB.prepare('SELECT id, user_id, bike_id, start_station_id FROM rides WHERE id = ? AND user_id = ? LIMIT 1').bind(rideId, auth.user.id).first();
  if (!rideRow) return json({ code: 'RIDE_NOT_FOUND', error: 'Trajet introuvable.' }, 404);
  const result = await DB.prepare(`INSERT INTO bike_incidents
    (bike_id, ride_id, station_id, reported_by_user_id, category, description)
    VALUES (?, ?, ?, ?, ?, ?)`).bind(rideRow.bike_id, rideRow.id, rideRow.start_station_id, auth.user.id, category, description).run();
  return json({ success: true, incident: { id: result.meta.last_row_id, rideId: rideRow.id, category, status: 'open' } }, 201);
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
  const auth = ADMIN_PAGES.has(url.pathname) ? await requireStaff(request, env) : await requireUser(request, env);
  if (!auth.response) return null;
  return auth.response.status === 403 ? redirect('/dashboard.html?access=denied') : redirect(`/connexion.html?next=${encodeURIComponent(url.pathname + url.search)}`, 302, clearSessionCookies());
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      const paymentWebhookMatch = url.pathname.match(/^\/api\/payments\/webhooks\/([a-z0-9-]+)$/);
      const iotEventPath = request.method === 'POST' && url.pathname === '/api/iot/events';
      if (!paymentWebhookMatch && !iotEventPath && !csrfAllowed(request, env)) return json({ code: 'CSRF_REJECTED', error: 'Requete refusee.' }, 403);
      if (request.method === 'POST' && paymentWebhookMatch) return paymentWebhook(request, env, paymentWebhookMatch[1]);
      if (iotEventPath) return handleDeviceEvent(request, env, { json });
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
      if (request.method === 'GET' && url.pathname === '/api/user/stations') return userStations(request, env);
      if (request.method === 'GET' && url.pathname === '/api/dashboard') return dashboard(request, env, url);
      if (request.method === 'GET' && url.pathname === '/api/rides') return rides(request, env);
      if (request.method === 'GET' && url.pathname === '/api/rides/active') return activeRide(request, env);
      const rideDetailMatch = url.pathname.match(/^\/api\/rides\/([1-9][0-9]*)$/);
      if (request.method === 'GET' && rideDetailMatch) return rideDetail(request, env, rideDetailMatch[1]);
      const rideReturnMatch = url.pathname.match(/^\/api\/rides\/([1-9][0-9]*)\/return$/);
      if (request.method === 'POST' && rideReturnMatch) return returnRide(request, env, rideReturnMatch[1]);
      const rideIncidentMatch = url.pathname.match(/^\/api\/rides\/([1-9][0-9]*)\/incidents$/);
      if (request.method === 'POST' && rideIncidentMatch) return reportRideIncident(request, env, rideIncidentMatch[1]);
      if (request.method === 'GET' && url.pathname.startsWith('/api/stations/')) return stationDetail(request, env, url.pathname.slice('/api/stations/'.length));
      if (request.method === 'GET' && url.pathname === '/api/plans') return plans(request, env);
      if (request.method === 'GET' && url.pathname === '/api/profile') return profile(request, env);
      if (request.method === 'GET' && url.pathname === '/api/subscriptions') return subscriptions(request, env);
      if (request.method === 'POST' && ['/api/subscriptions', '/api/subscriptions/checkout'].includes(url.pathname)) return checkoutSubscription(request, env);
      const subscriptionCancelMatch = url.pathname.match(/^\/api\/subscriptions\/([1-9][0-9]*)\/cancel$/);
      if (request.method === 'POST' && subscriptionCancelMatch) return cancelSubscription(request, env, subscriptionCancelMatch[1]);
      const paymentStatusMatch = url.pathname.match(/^\/api\/payments\/(pay_[A-Za-z0-9_-]+)$/);
      if (request.method === 'GET' && paymentStatusMatch) return paymentStatus(request, env, paymentStatusMatch[1]);
      if (url.pathname === '/api/support' || url.pathname.startsWith('/api/support/') || url.pathname === '/api/incidents' || url.pathname.startsWith('/api/incidents/') || url.pathname === '/api/notifications' || url.pathname.startsWith('/api/notifications/')) {
        const auth = await requireUser(request, env); if (auth.response) return auth.response;
        return handleOperationsApi(request, env, auth.user, { json, readJson, logEvent, requestId: requestId(request) });
      }
      if (request.method === 'POST' && url.pathname === '/api/rides') return startRide(request, env);
      if (url.pathname.startsWith('/api/admin/')) {
        const auth = await requireStaff(request, env); if (auth.response) return auth.response;
        if (['GET','POST'].includes(request.method) && url.pathname === '/api/admin/plans') {
          const permission=request.method==='GET'?'plans.read':'plans.manage';
          if(!hasPermission(auth.user,permission))return json({code:'FORBIDDEN',error:'Permission insuffisante.'},403);
          return adminPlans(request,env,auth.user);
        }
        const adminPlanMatch=url.pathname.match(/^\/api\/admin\/plans\/([1-9][0-9]*)$/);
        if(request.method==='PATCH'&&adminPlanMatch){if(!hasPermission(auth.user,'plans.manage'))return json({code:'FORBIDDEN',error:'Permission insuffisante.'},403);return adminPlanUpdate(request,env,adminPlanMatch[1],auth.user);}
        return handleAdminApi(request, env, auth.user, { json, readJson, requestId: requestId(request), ipHint: (await ipHash(request)).slice(0, 32), logEvent });
      }
      if (request.method === 'GET' && ['/Pageuser.html', '/Pageuseren.html'].includes(url.pathname)) return redirect('/dashboard', 301);
      const privateResponse = await guardPrivatePage(request, env, url);
      if (privateResponse) return privateResponse;
    } catch (error) {
      const id = requestId(request);
      logEvent('api.error', { requestId: id, code: error?.code || 'SERVER_ERROR', status: error?.name || 'Error' }, 'error');
      const unavailable = error?.code === 'DB_UNAVAILABLE';
      return json({ code: unavailable ? 'DB_UNAVAILABLE' : 'SERVER_ERROR', error: unavailable ? DB_UNAVAILABLE_MESSAGE : 'Une erreur interne est survenue.', requestId: id }, unavailable ? 503 : 500);
    }
    if (env.ASSETS) {
      const id = requestId(request);
      const response = await env.ASSETS.fetch(assetRequestForCleanPath(request, url));
      return hardenAssetResponse(response, url, id);
    }
    return json({ code: 'NOT_FOUND', error: 'Route introuvable.' }, 404);
  },
  async scheduled(_controller,env){if(!env.DB)return;try{const result=await refreshMaintenanceReminders(env.DB);const supervision=await runSupervision(env.DB);logEvent('maintenance.reminders.generated',{count:Number(result.meta?.changes||0),outcome:'success'});logEvent('supervision.run',{count:supervision.created,outcome:'success'});}catch(error){logEvent('supervision.failure',{code:error?.code||'SCHEDULE_ERROR',outcome:'failure'},'error');throw error;}}
};
