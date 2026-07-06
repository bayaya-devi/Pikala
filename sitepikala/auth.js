const page = document.body.dataset.page;
const langButtons = document.querySelectorAll('[data-lang]');
const toast = document.querySelector('[data-toast]');
const toastText = document.querySelector('[data-toast-text]');

const copy = {
  fr: {
    back: 'Retour au site', loginEyebrow: 'Connexion', loginTitle: 'Heureux de vous revoir.', loginSub: 'Connectez-vous pour accéder à vos vélos, votre carte et votre profil Pikala.', loginVisualTitle: 'Reprenez la route en quelques secondes.', loginVisualText: 'Votre espace Pikala rassemble les stations, le scanner QR et vos trajets dans une expérience mobile simple.', email: 'Adresse e-mail', password: 'Mot de passe', remember: 'Se souvenir de moi', forgot: 'Mot de passe oublié ?', loginSubmit: 'Me connecter', loginLoading: 'Connexion en cours...', loginSuccess: 'Connexion réussie. Redirection vers votre espace.', loginSwitch: 'Pas encore de compte ?', loginSwitchLink: 'Créer un compte',
    signupEyebrow: 'Inscription', signupTitle: 'Créez votre compte Pikala.', signupSub: 'Quelques informations suffisent pour commencer à explorer Rabat à vélo.', signupVisualTitle: 'Votre prochain trajet commence ici.', signupVisualText: 'Un compte Pikala vous donne accès aux stations, au scanner QR et aux signalements rapides.', firstName: 'Prénom', lastName: 'Nom', phone: 'Téléphone', confirmPassword: 'Confirmer le mot de passe', termsText: 'J’accepte les conditions générales et la politique de confidentialité.', signupSubmit: 'Créer mon compte', signupLoading: 'Création en cours...', signupSuccess: 'Compte créé. Vous pouvez maintenant choisir votre abonnement.', signupSwitch: 'Déjà un compte ?', signupSwitchLink: 'Me connecter', weak: 'Trop faible', medium: 'Moyen', strong: 'Fort', veryStrong: 'Très fort', required: 'Veuillez remplir tous les champs obligatoires.', badEmail: 'Veuillez entrer une adresse e-mail valide.', badPassword: 'Le mot de passe doit contenir au moins 8 caractères.', mismatch: 'Les mots de passe ne correspondent pas.', acceptTerms: 'Veuillez accepter les conditions.'
  },
  en: {
    back: 'Back to site', loginEyebrow: 'Log in', loginTitle: 'Good to see you again.', loginSub: 'Log in to access your bikes, map, and Pikala profile.', loginVisualTitle: 'Get back on the road in seconds.', loginVisualText: 'Your Pikala space brings stations, QR scanning, and rides into one simple mobile experience.', email: 'Email address', password: 'Password', remember: 'Remember me', forgot: 'Forgot password?', loginSubmit: 'Log in', loginLoading: 'Logging in...', loginSuccess: 'Login successful. Redirecting to your space.', loginSwitch: 'No account yet?', loginSwitchLink: 'Create account',
    signupEyebrow: 'Sign up', signupTitle: 'Create your Pikala account.', signupSub: 'A few details are enough to start exploring Rabat by bike.', signupVisualTitle: 'Your next ride starts here.', signupVisualText: 'A Pikala account gives you access to stations, QR scanning, and fast issue reporting.', firstName: 'First name', lastName: 'Last name', phone: 'Phone', confirmPassword: 'Confirm password', termsText: 'I accept the terms and privacy policy.', signupSubmit: 'Create my account', signupLoading: 'Creating account...', signupSuccess: 'Account created. You can now choose your subscription.', signupSwitch: 'Already have an account?', signupSwitchLink: 'Log in', weak: 'Too weak', medium: 'Medium', strong: 'Strong', veryStrong: 'Very strong', required: 'Please fill in all required fields.', badEmail: 'Please enter a valid email address.', badPassword: 'Password must be at least 8 characters.', mismatch: 'Passwords do not match.', acceptTerms: 'Please accept the terms.'
  },
  ar: {
    back: 'العودة إلى الموقع', loginEyebrow: 'تسجيل الدخول', loginTitle: 'سعداء بعودتك.', loginSub: 'سجل الدخول للوصول إلى الدراجات والخريطة وملفك في بيكالا.', loginVisualTitle: 'عد إلى الطريق في ثوان.', loginVisualText: 'تجمع مساحة بيكالا المحطات وماسح QR ورحلاتك في تجربة هاتفية بسيطة.', email: 'البريد الإلكتروني', password: 'كلمة المرور', remember: 'تذكرني', forgot: 'نسيت كلمة المرور؟', loginSubmit: 'تسجيل الدخول', loginLoading: 'جاري تسجيل الدخول...', loginSuccess: 'تم تسجيل الدخول. سيتم تحويلك إلى مساحتك.', loginSwitch: 'ليس لديك حساب؟', loginSwitchLink: 'إنشاء حساب',
    signupEyebrow: 'إنشاء حساب', signupTitle: 'أنشئ حسابك في بيكالا.', signupSub: 'بعض المعلومات تكفي لبدء استكشاف الرباط بالدراجة.', signupVisualTitle: 'رحلتك القادمة تبدأ هنا.', signupVisualText: 'يمنحك حساب بيكالا الوصول إلى المحطات وماسح QR والإبلاغ السريع عن المشاكل.', firstName: 'الاسم الشخصي', lastName: 'الاسم العائلي', phone: 'الهاتف', confirmPassword: 'تأكيد كلمة المرور', termsText: 'أوافق على الشروط العامة وسياسة الخصوصية.', signupSubmit: 'إنشاء حسابي', signupLoading: 'جاري إنشاء الحساب...', signupSuccess: 'تم إنشاء الحساب. يمكنك الآن اختيار الاشتراك.', signupSwitch: 'لديك حساب بالفعل؟', signupSwitchLink: 'تسجيل الدخول', weak: 'ضعيف جدا', medium: 'متوسط', strong: 'قوي', veryStrong: 'قوي جدا', required: 'يرجى ملء جميع الحقول المطلوبة.', badEmail: 'يرجى إدخال بريد إلكتروني صحيح.', badPassword: 'يجب أن تتكون كلمة المرور من 8 أحرف على الأقل.', mismatch: 'كلمتا المرور غير متطابقتين.', acceptTerms: 'يرجى قبول الشروط.'
  }
};

function currentCopy() {
  return copy[document.documentElement.lang] || copy.fr;
}

function setLanguage(lang) {
  const dictionary = copy[lang] || copy.fr;
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.body.classList.toggle('is-rtl', lang === 'ar');
  document.title = page === 'signup' ? dictionary.signupTitle : dictionary.loginTitle;

  document.querySelectorAll('[data-i18n]').forEach((element) => {
    const key = element.getAttribute('data-i18n');
    if (key && dictionary[key]) element.textContent = dictionary[key];
  });

  document.querySelectorAll('[data-placeholder]').forEach((element) => {
    const key = element.getAttribute('data-placeholder');
    if (key && dictionary[key]) element.setAttribute('placeholder', dictionary[key]);
  });

  langButtons.forEach((button) => {
    const active = button.dataset.lang === lang;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  localStorage.setItem('pikala-lang', lang);
}

function detectPreferredLanguage() {
  const queryLang = new URLSearchParams(window.location.search).get('lang');
  if (queryLang) return queryLang;

  const saved = localStorage.getItem('pikala-lang');
  if (saved) return saved;

  const browserLang = (navigator.language || navigator.userLanguage || '').toLowerCase();
  if (browserLang.startsWith('fr')) return 'fr';
  if (browserLang.startsWith('ar')) return 'ar';
  return 'en';
}

function showToast(message) {
  if (!toast || !toastText) return;
  toastText.textContent = message;
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 2600);
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function setLoading(button, isLoading, label) {
  button.disabled = isLoading;
  button.textContent = label;
}

function redirectTo(target) {
  window.setTimeout(() => { window.location.href = target; }, 850);
}

langButtons.forEach((button) => {
  button.addEventListener('click', () => setLanguage(button.dataset.lang || 'fr'));
});

document.querySelectorAll('[data-toggle-password]').forEach((button) => {
  button.addEventListener('click', () => {
    const input = document.querySelector(button.dataset.togglePassword);
    if (!(input instanceof HTMLInputElement)) return;
    input.type = input.type === 'password' ? 'text' : 'password';
    button.textContent = input.type === 'password' ? 'Voir' : 'Cacher';
  });
});

const signupPassword = document.querySelector('#password');
const strengthBars = document.querySelectorAll('[data-strength] span');
const strengthLabel = document.querySelector('[data-strength-label]');

signupPassword?.addEventListener('input', () => {
  const value = signupPassword.value;
  let score = 0;
  if (value.length >= 8) score += 1;
  if (/[A-ZÀ-Ÿ]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-zÀ-ÿ0-9]/.test(value)) score += 1;
  const labels = [currentCopy().weak, currentCopy().medium, currentCopy().strong, currentCopy().veryStrong];
  const colors = ['#dc3f3f', '#e39a1f', '#72c31a', '#3f7f10'];
  strengthBars.forEach((bar, index) => { bar.style.background = index < score ? colors[Math.max(score - 1, 0)] : 'var(--line)'; });
  if (strengthLabel) {
    strengthLabel.textContent = value ? labels[Math.max(score - 1, 0)] : '';
    strengthLabel.style.color = value ? colors[Math.max(score - 1, 0)] : 'var(--muted)';
  }
});

const form = document.querySelector('[data-auth-form]');
form?.addEventListener('submit', (event) => {
  event.preventDefault();
  const dictionary = currentCopy();
  const submit = form.querySelector('[type="submit"]');
  const email = form.querySelector('#email')?.value.trim() || '';
  const password = form.querySelector('#password')?.value || '';

  if (!email || !password || (page === 'signup' && (!form.querySelector('#firstName')?.value.trim() || !form.querySelector('#lastName')?.value.trim()))) {
    showToast(dictionary.required);
    return;
  }
  if (!validEmail(email)) { showToast(dictionary.badEmail); return; }
  if (password.length < 8) { showToast(dictionary.badPassword); return; }
  if (page === 'signup') {
    const confirm = form.querySelector('#confirmPassword')?.value || '';
    const terms = form.querySelector('#terms')?.checked;
    if (password !== confirm) { showToast(dictionary.mismatch); return; }
    if (!terms) { showToast(dictionary.acceptTerms); return; }
  }

  if (submit instanceof HTMLButtonElement) {
    setLoading(submit, true, page === 'signup' ? dictionary.signupLoading : dictionary.loginLoading);
  }
  showToast(page === 'signup' ? dictionary.signupSuccess : dictionary.loginSuccess);
  redirectTo(page === 'signup' ? 'abonement.html' : 'Pageuser.html');
});

setLanguage(detectPreferredLanguage());
