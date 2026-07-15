const page = document.body.dataset.page;
const langButtons = document.querySelectorAll('[data-lang]');
const languageMenu = document.querySelector('[data-language-menu]');
const languageSummary = languageMenu?.querySelector('summary');
const toast = document.querySelector('[data-toast]');
const toastText = document.querySelector('[data-toast-text]');

const copy = {
  fr: {
    languageLabel: 'Langue', back: 'Retour au site', loginEyebrow: 'Connexion', loginTitle: 'Heureux de vous revoir.', loginSub: 'Connectez-vous pour accéder à vos vélos, votre carte et votre profil Pikala.', loginVisualTitle: 'Reprenez la route en quelques secondes.', loginVisualText: 'Votre espace Pikala rassemble les stations, le scanner QR et vos trajets dans une expérience mobile simple.', email: 'Adresse e-mail', password: 'Mot de passe', remember: 'Se souvenir de moi', forgot: 'Mot de passe oublié ?', loginSubmit: 'Me connecter', loginLoading: 'Connexion en cours...', loginSuccess: 'Connexion réussie. Redirection vers votre espace.', loginSwitch: 'Pas encore de compte ?', loginSwitchLink: 'Créer un compte', signupEyebrow: 'Inscription', signupTitle: 'Créez votre compte Pikala.', signupSub: 'Quelques informations suffisent pour commencer à explorer Rabat à vélo.', signupVisualTitle: 'Votre prochain trajet commence ici.', signupVisualText: 'Un compte Pikala vous donne accès aux stations, au scanner QR et aux signalements rapides.', firstName: 'Prénom', lastName: 'Nom', phone: 'Téléphone', confirmPassword: 'Confirmer le mot de passe', termsText: 'J’accepte les conditions générales et la politique de confidentialité.', signupSubmit: 'Créer mon compte', signupLoading: 'Création en cours...', signupSuccess: 'Compte créé. Vérifiez votre email pour l’activer.', signupSwitch: 'Déjà un compte ?', signupSwitchLink: 'Me connecter', weak: 'Trop faible', medium: 'Moyen', strong: 'Fort', veryStrong: 'Très fort', required: 'Veuillez remplir tous les champs obligatoires.', badEmail: 'Veuillez entrer une adresse e-mail valide.', badPassword: 'Le mot de passe doit contenir au moins 12 caractères.', mismatch: 'Les mots de passe ne correspondent pas.', acceptTerms: 'Veuillez accepter les conditions.'
  },
  en: {
    languageLabel: 'Language', back: 'Back to site', loginEyebrow: 'Log in', loginTitle: 'Good to see you again.', loginSub: 'Log in to access your bikes, map, and Pikala profile.', loginVisualTitle: 'Get back on the road in seconds.', loginVisualText: 'Your Pikala space brings stations, QR scanning, and rides into one simple mobile experience.', email: 'Email address', password: 'Password', remember: 'Remember me', forgot: 'Forgot password?', loginSubmit: 'Log in', loginLoading: 'Logging in...', loginSuccess: 'Login successful. Redirecting to your space.', loginSwitch: 'No account yet?', loginSwitchLink: 'Create account', signupEyebrow: 'Sign up', signupTitle: 'Create your Pikala account.', signupSub: 'A few details are enough to start exploring Rabat by bike.', signupVisualTitle: 'Your next ride starts here.', signupVisualText: 'A Pikala account gives you access to stations, QR scanning, and fast issue reporting.', firstName: 'First name', lastName: 'Last name', phone: 'Phone', confirmPassword: 'Confirm password', termsText: 'I accept the terms and privacy policy.', signupSubmit: 'Create my account', signupLoading: 'Creating account...', signupSuccess: 'Account created. Check your email to activate it.', signupSwitch: 'Already have an account?', signupSwitchLink: 'Log in', weak: 'Too weak', medium: 'Medium', strong: 'Strong', veryStrong: 'Very strong', required: 'Please fill in all required fields.', badEmail: 'Please enter a valid email address.', badPassword: 'Password must be at least 12 characters.', mismatch: 'Passwords do not match.', acceptTerms: 'Please accept the terms.'
  }
};
copy.es = copy.fr; copy.pt = copy.fr; copy.ar = copy.fr;

function currentCopy() { return copy[document.documentElement.lang] || copy.fr; }
function setLanguage(lang) {
  const dictionary = copy[lang] || copy.fr;
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.body.classList.toggle('is-rtl', lang === 'ar');
  document.title = page === 'signup' ? dictionary.signupTitle : dictionary.loginTitle;
  document.querySelectorAll('[data-i18n]').forEach((element) => { const key = element.getAttribute('data-i18n'); if (key && dictionary[key]) element.textContent = dictionary[key]; });
  langButtons.forEach((button) => { const active = button.dataset.lang === lang; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); });
  if (languageSummary) languageSummary.textContent = `${dictionary.languageLabel} : ${lang.toUpperCase()}`;
  localStorage.setItem('pikala-lang', lang);
}
function detectPreferredLanguage() {
  const queryLang = new URLSearchParams(window.location.search).get('lang');
  if (queryLang) return queryLang;
  const saved = localStorage.getItem('pikala-lang');
  if (saved) return saved;
  const browserLang = (navigator.language || navigator.userLanguage || '').toLowerCase();
  if (browserLang.startsWith('fr')) return 'fr';
  if (browserLang.startsWith('es')) return 'es';
  if (browserLang.startsWith('pt')) return 'pt';
  if (browserLang.startsWith('ar')) return 'ar';
  return 'en';
}
function showToast(message) { if (!toast || !toastText) return; toastText.textContent = message; toast.classList.add('show'); window.setTimeout(() => toast.classList.remove('show'), 4200); }
function validEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
function setLoading(button, isLoading, label) { button.disabled = isLoading; button.textContent = label; }
function redirectTo(target) { window.setTimeout(() => { window.location.href = target; }, 850); }
function friendlyApiMessage(data, fallback) {
  const raw = String(data?.error || data?.message || '');
  if (data?.code === 'DB_UNAVAILABLE' || raw.includes('D1 DB') || raw.includes('base de données')) {
    return 'Service compte temporairement indisponible. La base Cloudflare D1 doit être reconnectée.';
  }
  return raw || fallback;
}

langButtons.forEach((button) => { button.addEventListener('click', () => { setLanguage(button.dataset.lang || 'fr'); if (languageMenu instanceof HTMLDetailsElement) languageMenu.open = false; }); });
document.querySelectorAll('[data-toggle-password]').forEach((button) => { button.addEventListener('click', () => { const input = document.querySelector(button.dataset.togglePassword); if (!(input instanceof HTMLInputElement)) return; input.type = input.type === 'password' ? 'text' : 'password'; button.textContent = input.type === 'password' ? 'Voir' : 'Cacher'; }); });

const signupPassword = document.querySelector('#password');
const strengthBars = document.querySelectorAll('[data-strength] span');
const strengthLabel = document.querySelector('[data-strength-label]');
signupPassword?.addEventListener('input', () => {
  const value = signupPassword.value;
  let score = 0;
  if (value.length >= 12) score += 1;
  if (/[A-ZÀ-Ÿ]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-zÀ-ÿ0-9]/.test(value)) score += 1;
  const labels = [currentCopy().weak, currentCopy().medium, currentCopy().strong, currentCopy().veryStrong];
  const colors = ['#dc3f3f', '#e39a1f', '#72c31a', '#3f7f10'];
  strengthBars.forEach((bar, index) => { bar.style.background = index < score ? colors[Math.max(score - 1, 0)] : 'var(--line)'; });
  if (strengthLabel) { strengthLabel.textContent = value ? labels[Math.max(score - 1, 0)] : ''; strengthLabel.style.color = value ? colors[Math.max(score - 1, 0)] : 'var(--muted)'; }
});

const form = document.querySelector('[data-auth-form]');
form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const dictionary = currentCopy();
  const submit = form.querySelector('[type="submit"]');
  const email = form.querySelector('#email')?.value.trim() || '';
  const password = form.querySelector('#password')?.value || '';
  if (!email || !password || (page === 'signup' && (!form.querySelector('#firstName')?.value.trim() || !form.querySelector('#lastName')?.value.trim()))) { showToast(dictionary.required); return; }
  if (!validEmail(email)) { showToast(dictionary.badEmail); return; }
  if (password.length < 12) { showToast(dictionary.badPassword); return; }
  if (page === 'signup') {
    const confirm = form.querySelector('#confirmPassword')?.value || '';
    const terms = form.querySelector('#terms')?.checked;
    if (password !== confirm) { showToast(dictionary.mismatch); return; }
    if (!terms) { showToast(dictionary.acceptTerms); return; }
  }
  if (submit instanceof HTMLButtonElement) setLoading(submit, true, page === 'signup' ? dictionary.signupLoading : dictionary.loginLoading);
  try {
    const payload = page === 'signup' ? { firstName: form.querySelector('#firstName')?.value.trim() || '', lastName: form.querySelector('#lastName')?.value.trim() || '', phone: form.querySelector('#phone')?.value.trim() || '', email, password } : { email, password };
    const response = await fetch(page === 'signup' ? '/api/signup' : '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { showToast(friendlyApiMessage(data, dictionary.required)); return; }
    showToast(data.message || (page === 'signup' ? dictionary.signupSuccess : dictionary.loginSuccess));
    if (data.verificationUrl) console.info('Pikala verification URL:', data.verificationUrl);
    if (page === 'login') redirectTo('dashboard.html');
  } catch {
    showToast('Connexion au serveur impossible. Réessayez dans un instant.');
  } finally {
    if (submit instanceof HTMLButtonElement) setLoading(submit, false, page === 'signup' ? dictionary.signupSubmit : dictionary.loginSubmit);
  }
});
setLanguage(detectPreferredLanguage());