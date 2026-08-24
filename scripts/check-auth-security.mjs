import fs from 'node:fs';

const worker = fs.readFileSync(new URL('../src/worker.js', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../migrations/0004_authentication_security.sql', import.meta.url), 'utf8');
const auth = fs.readFileSync(new URL('../sitepikala/auth.js', import.meta.url), 'utf8');
const userSpace = fs.readFileSync(new URL('../sitepikala/user-space.js', import.meta.url), 'utf8');
const failures = [];

function expect(condition, message) { if (!condition) failures.push(message); }

expect(worker.includes('const PASSWORD_ITERATIONS = 600000'), 'PBKDF2 doit utiliser 600 000 iterations.');
expect(worker.includes("const SESSION_COOKIE = '__Host-pikala_session'"), 'Le cookie de session doit utiliser le prefixe __Host-.');
expect(worker.includes('HttpOnly; Secure; SameSite=Strict'), 'Les attributs de cookie securises sont incomplets.');
expect(worker.includes("request.headers.get('x-pikala-request') !== 'web'"), 'La protection CSRF par en-tete personnalise manque.');
expect(worker.includes("fetchSite === 'cross-site'"), 'La protection Fetch Metadata manque.');
expect(worker.includes('auth_rate_limits'), 'La limitation des tentatives manque.');
expect(worker.includes("code: 'INVALID_CREDENTIALS'"), 'La reponse generique de connexion manque.');
expect(!worker.includes('ACCOUNT_NOT_FOUND') && !worker.includes('WRONG_PASSWORD'), 'Les reponses permettent encore l’enumeration de comptes.');
expect(worker.includes('sessions.auth_version = users.auth_version'), 'Les sessions ne sont pas liees a la version d’authentification.');
expect(worker.includes("requireRole(request, env, ['admin'])"), 'L’autorisation admin cote serveur manque.');
expect(worker.includes("error: unavailable ? DB_UNAVAILABLE_MESSAGE : 'Une erreur interne est survenue.'"), 'Les erreurs internes ne sont pas correctement filtrees.');
expect(!/json\(\{\s*error:\s*error\.message/.test(worker), 'Une exception technique est encore renvoyee au client.');
expect(worker.includes('escapeHtml(firstName)') && worker.includes('escapeHtml(verifyUrl)'), 'Le contenu HTML des emails n’est pas encode.');
expect(migration.includes('CREATE TABLE auth_rate_limits') && migration.includes('CREATE TABLE security_events'), 'Les tables de securite D1 manquent.');
expect(migration.includes('guard_security_events_no_update') && migration.includes('guard_security_events_no_delete'), 'Le journal de securite doit etre append-only.');
expect(auth.includes("'X-Pikala-Request': 'web'") && userSpace.includes("'X-Pikala-Request': 'web'"), 'Le frontend n’envoie pas l’en-tete CSRF.');
expect(auth.includes('safeNext()'), 'La redirection apres connexion n’est pas filtree.');

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}
console.log('Controles statiques auth valides : cookies, PBKDF2, CSRF, rate limit, sessions, RBAC et erreurs.');
