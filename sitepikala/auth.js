import { getDictionary, t } from './assets/js/i18n/index.js';
import { initLayout } from './assets/js/layouts.js';
import { showToast } from './assets/js/ui/components.js';

const page = document.body.dataset.page;
const form = document.querySelector('[data-auth-form]');

function dictionary() { return getDictionary(); }
function validEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
function setLoading(button, loading, label) { button.disabled = loading; button.textContent = label; }
function redirectTo(target) { window.setTimeout(() => { window.location.href = target; }, 650); }

function updateTitle() {
  document.title = page === 'signup' ? t('signupTitle') : t('loginTitle');
}

function friendlyApiMessage(data, fallback) {
  const raw = String(data?.error || data?.message || '');
  if (data?.code === 'DB_UNAVAILABLE' || raw.includes('D1 DB') || raw.toLowerCase().includes('base de donn')) return t('dbUnavailable');
  return raw || fallback;
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

const signupPassword = document.querySelector('#password');
const strengthBars = document.querySelectorAll('[data-strength] span');
const strengthLabel = document.querySelector('[data-strength-label]');
signupPassword?.addEventListener('input', () => {
  const value = signupPassword.value;
  const rules = [value.length >= 12, /\p{Lu}/u.test(value), /\d/.test(value), /[^\p{L}\p{N}]/u.test(value)];
  const score = rules.filter(Boolean).length;
  const labels = [t('weak'), t('medium'), t('strong'), t('veryStrong')];
  const colors = ['#b42318', '#a96500', '#4e9f0c', '#2f7d32'];
  strengthBars.forEach((bar, index) => { bar.style.background = index < score ? colors[Math.max(score - 1, 0)] : 'var(--pk-color-border)'; });
  if (strengthLabel) {
    strengthLabel.textContent = value ? labels[Math.max(score - 1, 0)] : '';
    strengthLabel.style.color = value ? colors[Math.max(score - 1, 0)] : 'var(--pk-color-muted)';
  }
});

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const copy = dictionary();
  const submit = form.querySelector('[type="submit"]');
  const email = form.querySelector('#email')?.value.trim() || '';
  const password = form.querySelector('#password')?.value || '';
  const firstName = form.querySelector('#firstName')?.value.trim() || '';
  const lastName = form.querySelector('#lastName')?.value.trim() || '';
  if (page === 'signup' && !firstName) return showToast(copy.firstNameRequired || copy.required, { tone: 'error' });
  if (page === 'signup' && !lastName) return showToast(copy.lastNameRequired || copy.required, { tone: 'error' });
  if (!email) return showToast(copy.emailRequired || copy.required, { tone: 'error' });
  if (!validEmail(email)) return showToast(copy.badEmail, { tone: 'error' });
  if (!password) return showToast(page === 'signup' ? copy.passwordRequired : copy.loginPasswordRequired, { tone: 'error' });
  if (password.length < 12) return showToast(copy.badPassword, { tone: 'error' });
  if (page === 'signup') {
    const confirmation = form.querySelector('#confirmPassword')?.value || '';
    if (password !== confirmation) return showToast(copy.mismatch, { tone: 'error' });
    if (!form.querySelector('#terms')?.checked) return showToast(copy.acceptTerms, { tone: 'error' });
  }
  if (submit instanceof HTMLButtonElement) setLoading(submit, true, page === 'signup' ? copy.signupLoading : copy.loginLoading);
  try {
    const payload = page === 'signup' ? { firstName, lastName, phone: form.querySelector('#phone')?.value.trim() || '', email, password } : { email, password };
    const response = await fetch(page === 'signup' ? '/api/signup' : '/api/login', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return showToast(friendlyApiMessage(data, copy.required), { tone: 'error' });
    showToast(data.message || (page === 'signup' ? copy.signupSuccess : copy.loginSuccess));
    redirectTo(page === 'signup' ? 'abonnement.html' : 'dashboard.html');
  } catch {
    showToast(t('apiOffline'), { tone: 'error' });
  } finally {
    if (submit instanceof HTMLButtonElement) setLoading(submit, false, page === 'signup' ? copy.signupSubmit : copy.loginSubmit);
  }
});

initLayout();
updateTitle();
