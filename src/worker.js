const USER_FIELDS = 'id, first_name, last_name, email, phone, role, created_at, email_verified';
const JOINED_USER_FIELDS = 'users.id AS id, users.first_name AS first_name, users.last_name AS last_name, users.email AS email, users.phone AS phone, users.role AS role, users.created_at AS created_at, users.email_verified AS email_verified';
const SESSION_COOKIE = 'pikala_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const EMAIL_TOKEN_TTL_SECONDS = 60 * 60 * 24;
const REQUIRE_EMAIL_VERIFICATION = false;
const PASSWORD_ITERATIONS = 100000;
const DB_UNAVAILABLE_MESSAGE = 'Service temporairement indisponible : la base Cloudflare D1 doit être reconnectée au Worker avec le binding DB.';
const FALLBACK_STATIONS = [
  { id: 1, name: 'Kasbah des Oudayas', city: 'Rabat', address: 'Kasbah des Oudayas', latitude: 34.0318, longitude: -6.8361, bikes_available: 8, is_active: 1 },
  { id: 2, name: 'Tour Hassan', city: 'Rabat', address: 'Tour Hassan', latitude: 34.0224, longitude: -6.8225, bikes_available: 3, is_active: 1 },
  { id: 3, name: 'Jardins et parcs', city: 'Rabat', address: 'Centre de Rabat', latitude: 34.0209, longitude: -6.8416, bikes_available: 12, is_active: 1 },
  { id: 4, name: 'Corniche', city: 'Rabat', address: 'Corniche de Rabat', latitude: 34.0059, longitude: -6.8445, bikes_available: 5, is_active: 1 }
];

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      ...extraHeaders
    }
  });
}

async function readJson(request) {
  const type = request.headers.get('content-type') || '';
  if (!type.includes('application/json')) return null;
  try { return await request.json(); } catch { return null; }
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function dbUnavailable() {
  return json({ error: DB_UNAVAILABLE_MESSAGE, code: 'DB_UNAVAILABLE' }, 503);
}

function requireDb(env) {
  if (!env.DB) {
    const error = new Error(DB_UNAVAILABLE_MESSAGE);
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
  const parts = String(storedHash || '').split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = Number(parts[1]);
  const salt = base64ToBytes(parts[2]);
  const expected = base64ToBytes(parts[3]);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, 256);
  const actual = new Uint8Array(bits);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  actual.forEach((byte, index) => { diff |= byte ^ expected[index]; });
  return diff === 0;
}

function parseCookies(request) {
  const header = request.headers.get('cookie') || '';
  return Object.fromEntries(header.split(';').map((part) => {
    const index = part.indexOf('=');
    if (index === -1) return null;
    return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
  }).filter(Boolean));
}

function sessionCookie(token) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${SESSION_TTL_SECONDS}; HttpOnly; Secure; SameSite=Lax`;
}

function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    first_name: row.first_name,
    last_name: row.last_name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    created_at: row.created_at,
    email_verified: Boolean(row.email_verified)
  };
}

async function ensureSchema(DB) {
  await DB.prepare("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, first_name TEXT NOT NULL, last_name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, phone TEXT, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, email_verified INTEGER NOT NULL DEFAULT 0)").run();
  await DB.prepare('CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, token_hash TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, expires_at TEXT NOT NULL, revoked_at TEXT, user_agent TEXT, ip_hint TEXT, FOREIGN KEY (user_id) REFERENCES users(id))').run();
  await DB.prepare('CREATE TABLE IF NOT EXISTS email_verifications (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, token_hash TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, expires_at TEXT NOT NULL, used_at TEXT, FOREIGN KEY (user_id) REFERENCES users(id))').run();
  await DB.prepare("CREATE TABLE IF NOT EXISTS stations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, city TEXT NOT NULL DEFAULT 'Rabat', address TEXT, latitude REAL, longitude REAL, bikes_available INTEGER NOT NULL DEFAULT 0, is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
  await DB.prepare("CREATE TABLE IF NOT EXISTS subscriptions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, plan TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', starts_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, ends_at TEXT, FOREIGN KEY (user_id) REFERENCES users(id))").run();
  await DB.prepare("CREATE TABLE IF NOT EXISTS rides (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, start_station_id INTEGER, end_station_id INTEGER, status TEXT NOT NULL DEFAULT 'active', started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, ended_at TEXT, FOREIGN KEY (user_id) REFERENCES users(id), FOREIGN KEY (start_station_id) REFERENCES stations(id), FOREIGN KEY (end_station_id) REFERENCES stations(id))").run();
  await DB.prepare("CREATE TABLE IF NOT EXISTS support_tickets (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, name TEXT, email TEXT, subject TEXT NOT NULL, message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id))").run();
  try { await DB.prepare('ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0').run(); } catch {}
  const stationCount = await DB.prepare('SELECT COUNT(*) AS count FROM stations').first();
  if (!stationCount || Number(stationCount.count) === 0) {
    for (const station of FALLBACK_STATIONS) {
      await DB.prepare('INSERT INTO stations (name, city, address, latitude, longitude, bikes_available, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(station.name, station.city, station.address, station.latitude, station.longitude, station.bikes_available, station.is_active)
        .run();
    }
  }
}

async function createSession(DB, userId, request) {
  const token = base64Url(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = await sha256(token);
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
  const userAgent = (request.headers.get('user-agent') || '').slice(0, 240);
  const ipHint = (request.headers.get('cf-connecting-ip') || '').slice(0, 80);
  await DB.prepare('INSERT INTO sessions (id, user_id, token_hash, expires_at, user_agent, ip_hint) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, userId, tokenHash, expiresAt, userAgent, ipHint)
    .run();
  return token;
}

async function currentUser(request, env) {
  const DB = requireDb(env);
  await ensureSchema(DB);
  const token = parseCookies(request)[SESSION_COOKIE];
  if (!token) return null;
  const tokenHash = await sha256(token);
  const now = new Date().toISOString();
  const row = await DB.prepare(`SELECT ${JOINED_USER_FIELDS}, sessions.id AS session_id FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token_hash = ? AND sessions.revoked_at IS NULL AND sessions.expires_at > ?`)
    .bind(tokenHash, now)
    .first();
  return row ? { user: publicUser(row), sessionId: row.session_id } : null;
}

async function requireUser(request, env) {
  const session = await currentUser(request, env);
  if (!session) return { response: json({ error: 'Authentification requise.' }, 401) };
  return session;
}

async function sendVerificationEmail(env, email, token, firstName) {
  const origin = env.PUBLIC_ORIGIN || 'https://pikala.aetbconseil.workers.dev';
  const verifyUrl = `${origin}/api/verify-email?token=${encodeURIComponent(token)}`;
  if (!env.RESEND_API_KEY || !env.FROM_EMAIL) {
    return { sent: false, verifyUrl };
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      from: env.FROM_EMAIL,
      to: email,
      subject: 'Confirmez votre compte Pikala',
      html: `<p>Bonjour ${firstName},</p><p>Confirmez votre compte Pikala :</p><p><a href="${verifyUrl}">Confirmer mon email</a></p><p>Ce lien expire dans 24 heures.</p>`
    })
  });
  return { sent: response.ok, verifyUrl: env.EMAIL_DEV_MODE === '1' ? verifyUrl : undefined };
}

async function createVerification(DB, userId) {
  const token = base64Url(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = await sha256(token);
  const expiresAt = new Date(Date.now() + EMAIL_TOKEN_TTL_SECONDS * 1000).toISOString();
  await DB.prepare('INSERT INTO email_verifications (user_id, token_hash, expires_at) VALUES (?, ?, ?)')
    .bind(userId, tokenHash, expiresAt)
    .run();
  return token;
}

async function debugSchema(env) {
  const DB = requireDb(env);
  const steps = [];
  try { await DB.prepare('SELECT 1 AS ok').first(); steps.push('select ok'); } catch (error) { return json({ step: 'select', error: String(error.message || error) }, 500); }
  try { await DB.prepare('CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, token_hash TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, expires_at TEXT NOT NULL, revoked_at TEXT, user_agent TEXT, ip_hint TEXT)').run(); steps.push('sessions ok'); } catch (error) { return json({ step: 'sessions', error: String(error.message || error), steps }, 500); }
  try { await DB.prepare('CREATE TABLE IF NOT EXISTS email_verifications (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, token_hash TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, expires_at TEXT NOT NULL, used_at TEXT)').run(); steps.push('email_verifications ok'); } catch (error) { return json({ step: 'email_verifications', error: String(error.message || error), steps }, 500); }
  try { await DB.prepare('ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0').run(); steps.push('alter ok'); } catch (error) { steps.push(`alter skipped: ${String(error.message || error)}`); }
  return json({ ok: true, steps });
}
async function signup(request, env) {
  const body = await readJson(request);
  if (!body) return json({ error: 'Requête invalide.' }, 400);

  const firstName = String(body.firstName || '').trim();
  const lastName = String(body.lastName || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const phone = String(body.phone || '').trim();
  const password = String(body.password || '');

  if (!firstName) return json({ code: 'FIRST_NAME_REQUIRED', error: 'Veuillez entrer votre prénom.' }, 400);
  if (!lastName) return json({ code: 'LAST_NAME_REQUIRED', error: 'Veuillez entrer votre nom.' }, 400);
  if (!email) return json({ code: 'EMAIL_REQUIRED', error: 'Veuillez entrer votre adresse email.' }, 400);
  if (!validEmail(email)) return json({ code: 'EMAIL_INVALID', error: 'Veuillez entrer une adresse email valide.' }, 400);
  if (!password) return json({ code: 'PASSWORD_REQUIRED', error: 'Veuillez choisir un mot de passe.' }, 400);
  if (password.length < 12) return json({ code: 'PASSWORD_TOO_SHORT', error: 'Le mot de passe doit contenir au moins 12 caractères.' }, 400);
  if (!env.DB) return dbUnavailable();

  const DB = requireDb(env);
  await ensureSchema(DB);
  const existing = await DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (existing) return json({ code: 'EMAIL_ALREADY_USED', error: 'Cette adresse email est déjà utilisée. Connectez-vous ou utilisez une autre adresse.' }, 409);

  const passwordHash = await hashPassword(password);
  const result = await DB.prepare('INSERT INTO users (first_name, last_name, email, phone, password_hash, email_verified) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(firstName, lastName, email, phone || null, passwordHash, REQUIRE_EMAIL_VERIFICATION ? 0 : 1)
    .run();
  if (!REQUIRE_EMAIL_VERIFICATION) {
    const user = await DB.prepare(`SELECT ${USER_FIELDS} FROM users WHERE id = ?`).bind(result.meta.last_row_id).first();
    const sessionToken = await createSession(DB, result.meta.last_row_id, request);
    return json({ success: true, user: publicUser(user), message: 'Compte créé. Vous êtes connecté.' }, 201, { 'set-cookie': sessionCookie(sessionToken) });
  }
  const token = await createVerification(DB, result.meta.last_row_id);
  const emailResult = await sendVerificationEmail(env, email, token, firstName);
  return json({ success: true, pendingVerification: true, emailSent: emailResult.sent, message: 'Compte créé. Vérifiez votre email pour l’activer.', verificationUrl: emailResult.verifyUrl }, 201);
}

async function verifyEmail(request, env) {
  const DB = requireDb(env);
  await ensureSchema(DB);
  const url = new URL(request.url);
  const token = url.searchParams.get('token') || '';
  if (!token) return json({ error: 'Lien de confirmation invalide.' }, 400);
  const tokenHash = await sha256(token);
  const now = new Date().toISOString();
  const row = await DB.prepare('SELECT id, user_id FROM email_verifications WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?')
    .bind(tokenHash, now)
    .first();
  if (!row) return json({ error: 'Lien de confirmation invalide ou expiré.' }, 400);
  await DB.batch([
    DB.prepare('UPDATE users SET email_verified = 1 WHERE id = ?').bind(row.user_id),
    DB.prepare('UPDATE email_verifications SET used_at = CURRENT_TIMESTAMP WHERE id = ?').bind(row.id)
  ]);
  return new Response('<!doctype html><meta charset="utf-8"><title>Pikala</title><p>Email confirmé. Vous pouvez maintenant vous connecter à Pikala.</p><p><a href="/connexion.html">Se connecter</a></p>', { headers: { 'content-type': 'text/html; charset=utf-8' } });
}

async function login(request, env) {
  const body = await readJson(request);
  if (!body) return json({ code: 'INVALID_REQUEST', error: 'Requête invalide. Actualisez la page puis réessayez.' }, 400);

  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!email) return json({ code: 'EMAIL_REQUIRED', error: 'Veuillez entrer votre adresse email.' }, 400);
  if (!validEmail(email)) return json({ code: 'EMAIL_INVALID', error: 'Veuillez entrer une adresse email valide.' }, 400);
  if (!password) return json({ code: 'PASSWORD_REQUIRED', error: 'Veuillez entrer votre mot de passe.' }, 400);
  if (!env.DB) return dbUnavailable();

  const DB = requireDb(env);
  await ensureSchema(DB);
  const row = await DB.prepare(`SELECT ${USER_FIELDS}, password_hash FROM users WHERE email = ?`).bind(email).first();
  if (!row) return json({ code: 'ACCOUNT_NOT_FOUND', error: 'Aucun compte Pikala ne correspond à cette adresse email.' }, 404);
  if (!(await verifyPassword(password, row.password_hash))) return json({ code: 'WRONG_PASSWORD', error: 'Mot de passe incorrect. Vérifiez votre saisie puis réessayez.' }, 401);
  if (REQUIRE_EMAIL_VERIFICATION && !row.email_verified) return json({ code: 'EMAIL_NOT_VERIFIED', error: 'Veuillez confirmer votre email avant de vous connecter.', pendingVerification: true }, 403);

  const token = await createSession(DB, row.id, request);
  if (!String(row.password_hash).startsWith(`pbkdf2$${PASSWORD_ITERATIONS}$`)) {
    const freshHash = await hashPassword(password);
    await DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(freshHash, row.id).run();
  }
  return json({ success: true, user: publicUser(row) }, 200, { 'set-cookie': sessionCookie(token) });
}

async function logout(request, env) {
  const DB = requireDb(env);
  await ensureSchema(DB);
  const token = parseCookies(request)[SESSION_COOKIE];
  if (token) {
    const tokenHash = await sha256(token);
    await DB.prepare('UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = ?').bind(tokenHash).run();
  }
  return json({ success: true }, 200, { 'set-cookie': clearSessionCookie() });
}

async function me(request, env) {
  const session = await requireUser(request, env);
  if (session.response) return session.response;
  return json({ user: session.user });
}

async function stations(env) {
  if (!env.DB) {
    return json({ stations: FALLBACK_STATIONS, degraded: true, message: 'Base D1 indisponible : stations de démonstration affichées.' });
  }
  const DB = requireDb(env);
  await ensureSchema(DB);
  const { results } = await DB.prepare(`
    SELECT
      id,
      name,
      city,
      address,
      COALESCE(latitude, CASE
        WHEN LOWER(name) LIKE '%oudaya%' THEN 34.0318
        WHEN LOWER(name) LIKE '%hassan%' THEN 34.0224
        WHEN LOWER(name) LIKE '%jardin%' OR LOWER(name) LIKE '%parc%' THEN 34.0209
        WHEN LOWER(name) LIKE '%corniche%' THEN 34.0059
        ELSE 34.0209
      END) AS latitude,
      COALESCE(longitude, CASE
        WHEN LOWER(name) LIKE '%oudaya%' THEN -6.8361
        WHEN LOWER(name) LIKE '%hassan%' THEN -6.8225
        WHEN LOWER(name) LIKE '%jardin%' OR LOWER(name) LIKE '%parc%' THEN -6.8416
        WHEN LOWER(name) LIKE '%corniche%' THEN -6.8445
        ELSE -6.8416
      END) AS longitude,
      bikes_available,
      is_active
    FROM stations
    WHERE is_active = 1
    ORDER BY id
  `).all();
  return json({ stations: results || [] });
}

async function subscription(request, env) {
  const session = await requireUser(request, env);
  if (session.response) return session.response;
  const DB = requireDb(env);
  const body = await readJson(request);
  const plan = String(body?.plan || 'Premium').trim().slice(0, 40);
  await DB.prepare("UPDATE subscriptions SET status = 'inactive', ends_at = CURRENT_TIMESTAMP WHERE user_id = ? AND status = 'active'").bind(session.user.id).run();
  const result = await DB.prepare("INSERT INTO subscriptions (user_id, plan, status) VALUES (?, ?, 'active')").bind(session.user.id, plan).run();
  const sub = await DB.prepare('SELECT id, user_id, plan, status, starts_at, ends_at FROM subscriptions WHERE id = ?').bind(result.meta.last_row_id).first();
  return json({ success: true, subscription: sub }, 201);
}

async function profile(request, env) {
  const session = await requireUser(request, env);
  if (session.response) return session.response;
  const DB = requireDb(env);
  const subscription = await DB.prepare("SELECT id, plan, status, starts_at, ends_at FROM subscriptions WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1").bind(session.user.id).first();
  const { results: rides } = await DB.prepare('SELECT id, status, started_at, ended_at FROM rides WHERE user_id = ? ORDER BY id DESC LIMIT 5').bind(session.user.id).all();
  return json({ user: session.user, subscription, rides: rides || [] });
}

async function support(request, env) {
  const session = await requireUser(request, env);
  if (session.response) return session.response;
  const DB = requireDb(env);
  const body = await readJson(request);
  const subject = String(body?.subject || 'Signalement Pikala').trim().slice(0, 140);
  const message = String(body?.message || '').trim().slice(0, 4000);
  if (!message) return json({ error: 'Veuillez décrire le problème.' }, 400);
  const name = `${session.user.first_name} ${session.user.last_name}`.trim();
  await DB.prepare('INSERT INTO support_tickets (user_id, name, email, subject, message) VALUES (?, ?, ?, ?, ?)').bind(session.user.id, name, session.user.email, subject, message).run();
  return json({ success: true }, 201);
}

async function ride(request, env) {
  const session = await requireUser(request, env);
  if (session.response) return session.response;
  const DB = requireDb(env);
  const station = await DB.prepare('SELECT id FROM stations WHERE is_active = 1 ORDER BY id LIMIT 1').first();
  const result = await DB.prepare("INSERT INTO rides (user_id, start_station_id, status) VALUES (?, ?, 'active')").bind(session.user.id, station?.id || null).run();
  const rideRow = await DB.prepare('SELECT id, user_id, start_station_id, status, started_at FROM rides WHERE id = ?').bind(result.meta.last_row_id).first();
  return json({ success: true, ride: rideRow }, 201);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (request.method === 'GET' && url.pathname === '/api/health') return json({ ok: true });
      if (request.method === 'POST' && url.pathname === '/api/signup') return await signup(request, env);
      if (request.method === 'GET' && url.pathname === '/api/verify-email') return await verifyEmail(request, env);
      if (request.method === 'POST' && url.pathname === '/api/login') return await login(request, env);
      if (request.method === 'POST' && url.pathname === '/api/logout') return await logout(request, env);
      if (request.method === 'GET' && url.pathname === '/api/me') return await me(request, env);
      if (request.method === 'GET' && url.pathname === '/api/stations') return await stations(env);
      if (request.method === 'GET' && url.pathname === '/api/profile') return await profile(request, env);
      if (request.method === 'POST' && url.pathname === '/api/subscriptions') return await subscription(request, env);
      if (request.method === 'POST' && url.pathname === '/api/support') return await support(request, env);
      if (request.method === 'POST' && url.pathname === '/api/rides') return await ride(request, env);
    } catch (error) {
      return json({ error: error.message || 'Erreur serveur.', code: error.code || 'SERVER_ERROR' }, error.code === 'DB_UNAVAILABLE' ? 503 : 500);
    }
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return json({ error: 'Route introuvable.' }, 404);
  }
};
