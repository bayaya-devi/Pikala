const page = document.body.dataset.page;
const langButtons = document.querySelectorAll('[data-lang]');
const languageMenu = document.querySelector('[data-language-menu]');
const languageSummary = languageMenu?.querySelector('summary');
const toast = document.querySelector('[data-toast]');
const toastText = document.querySelector('[data-toast-text]');

const copy = {
  fr: {
    languageLabel: 'Langue', back: 'Retour au site', loginEyebrow: 'Connexion', loginTitle: 'Heureux de vous revoir.', loginSub: 'Connectez-vous pour accéder à vos vélos, votre carte et votre profil Pikala.', loginVisualTitle: 'Reprenez la route en quelques secondes.', loginVisualText: 'Votre espace Pikala rassemble les stations, le scanner QR et vos trajets dans une expérience mobile simple.', email: 'Adresse e-mail', password: 'Mot de passe', remember: 'Se souvenir de moi', forgot: 'Mot de passe oublié ?', loginSubmit: 'Me connecter', loginLoading: 'Connexion en cours...', loginSuccess: 'Connexion réussie. Redirection vers votre espace.', loginSwitch: 'Pas encore de compte ?', loginSwitchLink: 'Créer un compte', signupEyebrow: 'Inscription', signupTitle: 'Créez votre compte Pikala.', signupSub: 'Quelques informations suffisent pour commencer à explorer Rabat à vélo.', signupVisualTitle: 'Votre prochain trajet commence ici.', signupVisualText: 'Un compte Pikala vous donne accès aux stations, au scanner QR et aux signalements rapides.', firstName: 'Prénom', lastName: 'Nom', phone: 'Téléphone', confirmPassword: 'Confirmer le mot de passe', termsText: 'J’accepte les conditions générales et la politique de confidentialité.', signupSubmit: 'Créer mon compte', signupLoading: 'Création en cours...', signupSuccess: 'Compte créé. Vérifiez votre email pour l’activer.', signupSwitch: 'Déjà un compte ?', signupSwitchLink: 'Me connecter', weak: 'Trop faible', medium: 'Moyen', strong: 'Fort', veryStrong: 'Très fort', required: 'Veuillez remplir tous les champs obligatoires.', firstNameRequired: 'Veuillez entrer votre prénom.', lastNameRequired: 'Veuillez entrer votre nom.', emailRequired: 'Veuillez entrer votre adresse email.', passwordRequired: 'Veuillez choisir un mot de passe.', loginPasswordRequired: 'Veuillez entrer votre mot de passe.', badEmail: 'Veuillez entrer une adresse e-mail valide.', badPassword: 'Le mot de passe doit contenir au moins 12 caractères.', mismatch: 'Les mots de passe ne correspondent pas.', acceptTerms: 'Veuillez accepter les conditions.'
  },
  en: {
    languageLabel: 'Language', back: 'Back to site', loginEyebrow: 'Log in', loginTitle: 'Good to see you again.', loginSub: 'Log in to access your bikes, map, and Pikala profile.', loginVisualTitle: 'Get back on the road in seconds.', loginVisualText: 'Your Pikala space brings stations, QR scanning, and rides into one simple mobile experience.', email: 'Email address', password: 'Password', remember: 'Remember me', forgot: 'Forgot password?', loginSubmit: 'Log in', loginLoading: 'Logging in...', loginSuccess: 'Login successful. Redirecting to your space.', loginSwitch: 'No account yet?', loginSwitchLink: 'Create account', signupEyebrow: 'Sign up', signupTitle: 'Create your Pikala account.', signupSub: 'A few details are enough to start exploring Rabat by bike.', signupVisualTitle: 'Your next ride starts here.', signupVisualText: 'A Pikala account gives you access to stations, QR scanning, and fast issue reporting.', firstName: 'First name', lastName: 'Last name', phone: 'Phone', confirmPassword: 'Confirm password', termsText: 'I accept the terms and privacy policy.', signupSubmit: 'Create my account', signupLoading: 'Creating account...', signupSuccess: 'Account created. Check your email to activate it.', signupSwitch: 'Already have an account?', signupSwitchLink: 'Log in', weak: 'Too weak', medium: 'Medium', strong: 'Strong', veryStrong: 'Very strong', required: 'Please fill in all required fields.', firstNameRequired: 'Please enter your first name.', lastNameRequired: 'Please enter your last name.', emailRequired: 'Please enter your email address.', passwordRequired: 'Please choose a password.', loginPasswordRequired: 'Please enter your password.', badEmail: 'Please enter a valid email address.', badPassword: 'Password must be at least 12 characters.', mismatch: 'Passwords do not match.', acceptTerms: 'Please accept the terms.'
  }
};
copy.es = {
  ...copy.en,
  languageLabel: 'Idioma', back: 'Volver al sitio', loginEyebrow: 'Conexión', loginTitle: 'Nos alegra verte de nuevo.', loginSub: 'Conéctate para acceder a tus bicicletas, mapa y perfil Pikala.', loginVisualTitle: 'Vuelve a pedalear en segundos.', loginVisualText: 'Tu espacio Pikala reúne estaciones, escáner QR y trayectos en una experiencia móvil sencilla.', loginSubmit: 'Conectarme', loginLoading: 'Conectando...', loginSuccess: 'Conexión correcta. Redirección a tu espacio.', loginSwitch: '¿Aún no tienes cuenta?', loginSwitchLink: 'Crear cuenta', signupEyebrow: 'Registro', signupTitle: 'Crea tu cuenta Pikala.', signupSub: 'Solo unos datos para empezar a explorar Rabat en bicicleta.', signupVisualTitle: 'Tu próximo trayecto empieza aquí.', signupVisualText: 'Una cuenta Pikala te da acceso a estaciones, escáner QR y reportes rápidos.', firstName: 'Nombre', lastName: 'Apellido', phone: 'Teléfono', confirmPassword: 'Confirmar contraseña', termsText: 'Acepto las condiciones y la política de privacidad.', signupSubmit: 'Crear mi cuenta', signupLoading: 'Creando cuenta...', signupSuccess: 'Cuenta creada. Revisa tu email para activarla.', signupSwitch: '¿Ya tienes cuenta?', signupSwitchLink: 'Conectarme', required: 'Completa todos los campos obligatorios.', firstNameRequired: 'Introduce tu nombre.', lastNameRequired: 'Introduce tu apellido.', emailRequired: 'Introduce tu email.', passwordRequired: 'Elige una contraseña.', loginPasswordRequired: 'Introduce tu contraseña.', badEmail: 'Introduce un email válido.', badPassword: 'La contraseña debe tener al menos 12 caracteres.', mismatch: 'Las contraseñas no coinciden.', acceptTerms: 'Acepta las condiciones.'
};
copy.pt = {
  ...copy.en,
  languageLabel: 'Idioma', back: 'Voltar ao site', loginEyebrow: 'Entrar', loginTitle: 'Bom ver você de novo.', loginSub: 'Entre para acessar suas bicicletas, mapa e perfil Pikala.', loginVisualTitle: 'Volte à estrada em segundos.', loginVisualText: 'O seu espaço Pikala reúne estações, scanner QR e viagens numa experiência móvel simples.', loginSubmit: 'Entrar', loginLoading: 'A entrar...', loginSuccess: 'Sessão iniciada. Redirecionando para o seu espaço.', loginSwitch: 'Ainda não tem conta?', loginSwitchLink: 'Criar conta', signupEyebrow: 'Cadastro', signupTitle: 'Crie a sua conta Pikala.', signupSub: 'Alguns dados bastam para começar a explorar Rabat de bicicleta.', signupVisualTitle: 'A sua próxima viagem começa aqui.', signupVisualText: 'Uma conta Pikala dá acesso às estações, ao scanner QR e a reportes rápidos.', firstName: 'Nome', lastName: 'Sobrenome', phone: 'Telefone', confirmPassword: 'Confirmar senha', termsText: 'Aceito os termos e a política de privacidade.', signupSubmit: 'Criar minha conta', signupLoading: 'Criando conta...', signupSuccess: 'Conta criada. Verifique o seu email para ativá-la.', signupSwitch: 'Já tem conta?', signupSwitchLink: 'Entrar', required: 'Preencha todos os campos obrigatórios.', firstNameRequired: 'Insira o seu nome.', lastNameRequired: 'Insira o seu sobrenome.', emailRequired: 'Insira o seu email.', passwordRequired: 'Escolha uma senha.', loginPasswordRequired: 'Insira a sua senha.', badEmail: 'Insira um email válido.', badPassword: 'A senha deve ter pelo menos 12 caracteres.', mismatch: 'As senhas não coincidem.', acceptTerms: 'Aceite os termos.'
};
copy.ar = {
  ...copy.en,
  languageLabel: 'اللغة', back: 'العودة إلى الموقع', loginEyebrow: 'تسجيل الدخول', loginTitle: 'سعداء بعودتك.', loginSub: 'سجل الدخول للوصول إلى الدراجات والخريطة وملفك في Pikala.', loginVisualTitle: 'عد إلى الطريق خلال ثوان.', loginVisualText: 'مساحتك في Pikala تجمع المحطات ومسح QR ورحلاتك في تجربة بسيطة.', email: 'البريد الإلكتروني', password: 'كلمة المرور', remember: 'تذكرني', forgot: 'نسيت كلمة المرور؟', loginSubmit: 'تسجيل الدخول', loginLoading: 'جار تسجيل الدخول...', loginSuccess: 'تم تسجيل الدخول. جار تحويلك إلى مساحتك.', loginSwitch: 'ليس لديك حساب؟', loginSwitchLink: 'إنشاء حساب', signupEyebrow: 'التسجيل', signupTitle: 'أنشئ حساب Pikala.', signupSub: 'بعض المعلومات تكفي لبدء استكشاف الرباط بالدراجة.', signupVisualTitle: 'رحلتك القادمة تبدأ هنا.', signupVisualText: 'حساب Pikala يمنحك الوصول إلى المحطات وماسح QR والإبلاغ السريع.', firstName: 'الاسم الشخصي', lastName: 'الاسم العائلي', phone: 'الهاتف', confirmPassword: 'تأكيد كلمة المرور', termsText: 'أوافق على الشروط وسياسة الخصوصية.', signupSubmit: 'إنشاء حسابي', signupLoading: 'جار إنشاء الحساب...', signupSuccess: 'تم إنشاء الحساب. تحقق من بريدك لتفعيله.', signupSwitch: 'لديك حساب؟', signupSwitchLink: 'تسجيل الدخول', required: 'يرجى ملء كل الحقول المطلوبة.', firstNameRequired: 'يرجى إدخال الاسم الشخصي.', lastNameRequired: 'يرجى إدخال الاسم العائلي.', emailRequired: 'يرجى إدخال البريد الإلكتروني.', passwordRequired: 'يرجى اختيار كلمة مرور.', loginPasswordRequired: 'يرجى إدخال كلمة المرور.', badEmail: 'يرجى إدخال بريد إلكتروني صالح.', badPassword: 'يجب أن تحتوي كلمة المرور على 12 حرفا على الأقل.', mismatch: 'كلمتا المرور غير متطابقتين.', acceptTerms: 'يرجى قبول الشروط.'
};

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
  const firstName = form.querySelector('#firstName')?.value.trim() || '';
  const lastName = form.querySelector('#lastName')?.value.trim() || '';
  if (page === 'signup' && !firstName) { showToast(dictionary.firstNameRequired || dictionary.required); return; }
  if (page === 'signup' && !lastName) { showToast(dictionary.lastNameRequired || dictionary.required); return; }
  if (!email) { showToast(dictionary.emailRequired || dictionary.required); return; }
  if (!validEmail(email)) { showToast(dictionary.badEmail); return; }
  if (!password) { showToast(page === 'signup' ? (dictionary.passwordRequired || dictionary.required) : (dictionary.loginPasswordRequired || dictionary.required)); return; }
  if (password.length < 12) { showToast(dictionary.badPassword); return; }
  if (page === 'signup') {
    const confirm = form.querySelector('#confirmPassword')?.value || '';
    const terms = form.querySelector('#terms')?.checked;
    if (password !== confirm) { showToast(dictionary.mismatch); return; }
    if (!terms) { showToast(dictionary.acceptTerms); return; }
  }
  if (submit instanceof HTMLButtonElement) setLoading(submit, true, page === 'signup' ? dictionary.signupLoading : dictionary.loginLoading);
  try {
    const payload = page === 'signup' ? { firstName, lastName, phone: form.querySelector('#phone')?.value.trim() || '', email, password } : { email, password };
    const response = await fetch(page === 'signup' ? '/api/signup' : '/api/login', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { showToast(friendlyApiMessage(data, dictionary.required)); return; }
    showToast(data.message || (page === 'signup' ? dictionary.signupSuccess : dictionary.loginSuccess));
    if (data.verificationUrl) console.info('Pikala verification URL:', data.verificationUrl);
    if (page === 'login' || (page === 'signup' && data.user)) redirectTo('dashboard.html');
  } catch {
    showToast('Connexion au serveur impossible. Vérifiez votre connexion puis réessayez.');
  } finally {
    if (submit instanceof HTMLButtonElement) setLoading(submit, false, page === 'signup' ? dictionary.signupSubmit : dictionary.loginSubmit);
  }
});
setLanguage(detectPreferredLanguage());