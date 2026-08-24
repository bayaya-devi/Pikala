import { getDictionary, getLocale, t } from './assets/js/i18n/index.js';
import { initLayout } from './assets/js/layouts.js';
import { showToast } from './assets/js/ui/components.js';

const page = document.body.dataset.page;
const form = document.querySelector('[data-auth-form]');
const submit = form?.querySelector('[type="submit"]');
const submitKey = { signup: 'signupSubmit', login: 'loginSubmit', forgot: 'authForgotSubmit', reset: 'authResetSubmit' }[page];
const loadingKey = { signup: 'signupLoading', login: 'loginLoading', forgot: 'commonLoading', reset: 'commonLoading' }[page];

function dictionary() { return getDictionary(); }
function validEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254; }
function validPassword(value) { return value.length >= 15 && value.length <= 128; }
function setLoading(loading) {
  if (!(submit instanceof HTMLButtonElement)) return;
  submit.disabled = loading;
  submit.textContent = t(loading ? loadingKey : submitKey);
}

function safeNext() {
  const raw = new URLSearchParams(window.location.search).get('next');
  if (!raw) return 'dashboard.html';
  try {
    const target = new URL(raw, window.location.origin);
    const allowed = new Set(['/dashboard', '/dashboard.html', '/stations', '/stations.html', '/scanner', '/scanner.html', '/profil', '/profil.html', '/support', '/support.html', '/abonnement', '/abonnement.html']);
    return target.origin === window.location.origin && allowed.has(target.pathname) ? `${target.pathname}${target.search}` : 'dashboard.html';
  } catch { return 'dashboard.html'; }
}

const errorKeys = {
  INVALID_CREDENTIALS: 'authInvalidCredentials', RATE_LIMITED: 'authRateLimited', EMAIL_NOT_VERIFIED: 'authEmailNotVerified',
  EMAIL_IF_ELIGIBLE: 'authEmailIfEligible', RESET_TOKEN_INVALID: 'authResetInvalid', PASSWORD_INVALID: 'authPasswordRule',
  PHONE_INVALID: 'authPhoneInvalid', FIRST_NAME_INVALID: 'authNameInvalid', LAST_NAME_INVALID: 'authNameInvalid',
  NAME_INVALID: 'authNameInvalid', SERVER_ERROR: 'authServerError', FORBIDDEN: 'authForbidden', DB_UNAVAILABLE: 'dbUnavailable'
};

function friendlyApiMessage(data, fallback = 'commonError') {
  return t(errorKeys[data?.code] || fallback);
}

async function api(path, payload) {
  const response = await fetch(path, {
    method: 'POST', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-Pikala-Request': 'web' },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(friendlyApiMessage(data));
    error.code = data?.code;
    error.data = data;
    throw error;
  }
  return data;
}

function updateTitle() {
  const key = { signup: 'signupTitle', login: 'loginTitle', forgot: 'authForgotTitle', reset: 'authResetTitle' }[page] || 'title';
  document.title = `${t(key)} - Pikala`;
  if (submit instanceof HTMLButtonElement && !submit.disabled) submit.textContent = t(submitKey);
}

function revealResend(email) {
  const panel = document.querySelector('[data-resend-panel]');
  if (!panel) return;
  panel.hidden = false;
  panel.dataset.email = email;
}

document.addEventListener('pikala:localechange', updateTitle);
document.querySelectorAll('[data-toggle-password]').forEach((button) => {
  button.addEventListener('click', () => {
    const input = document.querySelector(button.dataset.togglePassword);
    if (!(input instanceof HTMLInputElement)) return;
    input.type = input.type === 'password' ? 'text' : 'password';
    button.textContent = t(input.type === 'password' ? 'showPassword' : 'hidePassword');
  });
});

document.querySelector('#password')?.addEventListener('input', (event) => {
  if (!['signup', 'reset'].includes(page)) return;
  const value = event.target.value;
  const rules = [value.length >= 15, value.length >= 20, /\p{L}/u.test(value), /[^\p{L}\p{N}]/u.test(value)];
  const score = rules.filter(Boolean).length;
  const colors = ['#b42318', '#a96500', '#4e9f0c', '#2f7d32'];
  document.querySelectorAll('[data-strength] span').forEach((bar, index) => { bar.style.background = index < score ? colors[Math.max(score - 1, 0)] : 'var(--pk-color-border)'; });
  const label = document.querySelector('[data-strength-label]');
  if (label) { label.textContent = value ? t(['weak', 'medium', 'strong', 'veryStrong'][Math.max(score - 1, 0)]) : ''; label.style.color = value ? colors[Math.max(score - 1, 0)] : 'var(--pk-color-muted)'; }
});

document.querySelector('[data-resend-verification]')?.addEventListener('click', async () => {
  const panel = document.querySelector('[data-resend-panel]');
  const email = panel?.dataset.email || document.querySelector('#email')?.value.trim() || '';
  try { await api('/api/verification/resend', { email }); showToast(t('authEmailIfEligible')); } catch (error) { showToast(error.message, { tone: 'error' }); }
});

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const copy = dictionary();
  const email = form.querySelector('#email')?.value.trim() || '';
  const password = form.querySelector('#password')?.value || '';
  if (['signup', 'login', 'forgot'].includes(page) && (!email || !validEmail(email))) return showToast(email ? copy.badEmail : copy.emailRequired, { tone: 'error' });
  if (page === 'signup') {
    const firstName = form.querySelector('#firstName')?.value.trim() || '';
    const lastName = form.querySelector('#lastName')?.value.trim() || '';
    if (!firstName) return showToast(copy.firstNameRequired, { tone: 'error' });
    if (!lastName) return showToast(copy.lastNameRequired, { tone: 'error' });
    if (!validPassword(password)) return showToast(t('authPasswordRule'), { tone: 'error' });
    if (password !== (form.querySelector('#confirmPassword')?.value || '')) return showToast(copy.mismatch, { tone: 'error' });
    if (!form.querySelector('#terms')?.checked) return showToast(copy.acceptTerms, { tone: 'error' });
  }
  if (page === 'login' && !password) return showToast(copy.loginPasswordRequired, { tone: 'error' });
  if (page === 'reset') {
    if (!validPassword(password)) return showToast(t('authPasswordRule'), { tone: 'error' });
    if (password !== (form.querySelector('#confirmPassword')?.value || '')) return showToast(copy.mismatch, { tone: 'error' });
  }
  setLoading(true);
  try {
    if (page === 'signup') {
      const data = await api('/api/signup', {
        firstName: form.querySelector('#firstName').value.trim(), lastName: form.querySelector('#lastName').value.trim(),
        phone: form.querySelector('#phone')?.value.trim() || '', email, password, locale: getLocale()
      });
      revealResend(email);
      showToast(friendlyApiMessage(data, 'authEmailIfEligible'));
    } else if (page === 'login') {
      await api('/api/login', { email, password });
      showToast(t('loginSuccess'));
      window.setTimeout(() => { window.location.href = safeNext(); }, 350);
    } else if (page === 'forgot') {
      const data = await api('/api/password/forgot', { email });
      showToast(friendlyApiMessage(data, 'authEmailIfEligible'));
    } else if (page === 'reset') {
      const token = new URLSearchParams(window.location.search).get('token') || '';
      await api('/api/password/reset', { token, password });
      showToast(t('authResetSuccess'));
      window.setTimeout(() => { window.location.href = 'connexion.html?password=reset'; }, 700);
    }
  } catch (error) {
    if (error.code === 'EMAIL_NOT_VERIFIED') revealResend(email);
    showToast(error.message || t('authServerError'), { tone: 'error' });
  } finally { setLoading(false); }
});

initLayout();
updateTitle();

if (page === 'login') {
  const verification = new URLSearchParams(window.location.search).get('verification');
  if (verification === 'success') showToast(t('authVerificationSuccess'));
  if (verification === 'invalid') showToast(t('authVerificationInvalid'), { tone: 'error' });
}
if (page === 'reset' && !(new URLSearchParams(window.location.search).get('token') || '').trim()) {
  if (submit instanceof HTMLButtonElement) submit.disabled = true;
  showToast(t('authResetInvalid'), { tone: 'error' });
}
