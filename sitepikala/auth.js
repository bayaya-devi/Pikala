const page = document.body.dataset.page;
const langButtons = document.querySelectorAll('[data-lang]');
const languageMenu = document.querySelector('[data-language-menu]');
const languageSummary = languageMenu?.querySelector('summary');
const toast = document.querySelector('[data-toast]');
const toastText = document.querySelector('[data-toast-text]');

const copy = {
  fr: {
    languageLabel: 'Langue', back: 'Retour au site', loginEyebrow: 'Connexion', loginTitle: 'Heureux de vous revoir.', loginSub: 'Connectez-vous pour accéder à vos vélos, votre carte et votre profil Pikala.', loginVisualTitle: 'Reprenez la route en quelques secondes.', loginVisualText: 'Votre espace Pikala rassemble les stations, le scanner QR et vos trajets dans une expérience mobile simple.', email: 'Adresse e-mail', password: 'Mot de passe', remember: 'Se souvenir de moi', forgot: 'Mot de passe oublié ?', loginSubmit: 'Me connecter', loginLoading: 'Connexion en cours...', loginSuccess: 'Connexion réussie. Redirection vers votre espace.', loginSwitch: 'Pas encore de compte ?', loginSwitchLink: 'Créer un compte',
    signupEyebrow: 'Inscription', signupTitle: 'Créez votre compte Pikala.', signupSub: 'Quelques informations suffisent pour commencer à explorer Rabat à vélo.', signupVisualTitle: 'Votre prochain trajet commence ici.', signupVisualText: 'Un compte Pikala vous donne accès aux stations, au scanner QR et aux signalements rapides.', firstName: 'Prénom', lastName: 'Nom', phone: 'Téléphone', confirmPassword: 'Confirmer le mot de passe', termsText: 'J’accepte les conditions générales et la politique de confidentialité.', signupSubmit: 'Créer mon compte', signupLoading: 'Création en cours...', signupSuccess: 'Compte créé. Vous pouvez maintenant choisir votre abonnement.', signupSwitch: 'Déjà un compte ?', signupSwitchLink: 'Me connecter', weak: 'Trop faible', medium: 'Moyen', strong: 'Fort', veryStrong: 'Très fort', required: 'Veuillez remplir tous les champs obligatoires.', badEmail: 'Veuillez entrer une adresse e-mail valide.', badPassword: 'Le mot de passe doit contenir au moins 8 caractères.', mismatch: 'Les mots de passe ne correspondent pas.', acceptTerms: 'Veuillez accepter les conditions.'
  },
  en: {
    languageLabel: 'Language', back: 'Back to site', loginEyebrow: 'Log in', loginTitle: 'Good to see you again.', loginSub: 'Log in to access your bikes, map, and Pikala profile.', loginVisualTitle: 'Get back on the road in seconds.', loginVisualText: 'Your Pikala space brings stations, QR scanning, and rides into one simple mobile experience.', email: 'Email address', password: 'Password', remember: 'Remember me', forgot: 'Forgot password?', loginSubmit: 'Log in', loginLoading: 'Logging in...', loginSuccess: 'Login successful. Redirecting to your space.', loginSwitch: 'No account yet?', loginSwitchLink: 'Create account',
    signupEyebrow: 'Sign up', signupTitle: 'Create your Pikala account.', signupSub: 'A few details are enough to start exploring Rabat by bike.', signupVisualTitle: 'Your next ride starts here.', signupVisualText: 'A Pikala account gives you access to stations, QR scanning, and fast issue reporting.', firstName: 'First name', lastName: 'Last name', phone: 'Phone', confirmPassword: 'Confirm password', termsText: 'I accept the terms and privacy policy.', signupSubmit: 'Create my account', signupLoading: 'Creating account...', signupSuccess: 'Account created. You can now choose your subscription.', signupSwitch: 'Already have an account?', signupSwitchLink: 'Log in', weak: 'Too weak', medium: 'Medium', strong: 'Strong', veryStrong: 'Very strong', required: 'Please fill in all required fields.', badEmail: 'Please enter a valid email address.', badPassword: 'Password must be at least 8 characters.', mismatch: 'Passwords do not match.', acceptTerms: 'Please accept the terms.'
  },
  es: {
    languageLabel: 'Idioma', back: 'Volver al sitio', loginEyebrow: 'Iniciar sesión', loginTitle: 'Nos alegra verte de nuevo.', loginSub: 'Inicia sesión para acceder a tus bicicletas, mapa y perfil Pikala.', loginVisualTitle: 'Vuelve a la ruta en segundos.', loginVisualText: 'Tu espacio Pikala reúne estaciones, escaneo QR y trayectos en una experiencia móvil simple.', email: 'Correo electrónico', password: 'Contraseña', remember: 'Recordarme', forgot: '¿Olvidaste tu contraseña?', loginSubmit: 'Iniciar sesión', loginLoading: 'Iniciando sesión...', loginSuccess: 'Sesión iniciada. Redirección a tu espacio.', loginSwitch: '¿Aún no tienes cuenta?', loginSwitchLink: 'Crear cuenta',
    signupEyebrow: 'Registro', signupTitle: 'Crea tu cuenta Pikala.', signupSub: 'Unos pocos datos bastan para empezar a explorar Rabat en bicicleta.', signupVisualTitle: 'Tu próximo trayecto empieza aquí.', signupVisualText: 'Una cuenta Pikala te da acceso a estaciones, escaneo QR y reporte rápido de problemas.', firstName: 'Nombre', lastName: 'Apellido', phone: 'Teléfono', confirmPassword: 'Confirmar contraseña', termsText: 'Acepto los términos y la política de privacidad.', signupSubmit: 'Crear mi cuenta', signupLoading: 'Creando cuenta...', signupSuccess: 'Cuenta creada. Ahora puedes elegir tu suscripción.', signupSwitch: '¿Ya tienes cuenta?', signupSwitchLink: 'Iniciar sesión', weak: 'Muy débil', medium: 'Medio', strong: 'Fuerte', veryStrong: 'Muy fuerte', required: 'Completa todos los campos obligatorios.', badEmail: 'Introduce un correo electrónico válido.', badPassword: 'La contraseña debe tener al menos 8 caracteres.', mismatch: 'Las contraseñas no coinciden.', acceptTerms: 'Acepta los términos.'
  },
  pt: {
    languageLabel: 'Idioma', back: 'Voltar ao site', loginEyebrow: 'Entrar', loginTitle: 'Bom ver você de novo.', loginSub: 'Entre para acessar suas bicicletas, mapa e perfil Pikala.', loginVisualTitle: 'Volte à rota em segundos.', loginVisualText: 'Seu espaço Pikala reúne estações, leitura de QR e viagens em uma experiência móvel simples.', email: 'E-mail', password: 'Senha', remember: 'Lembrar-me', forgot: 'Esqueceu a senha?', loginSubmit: 'Entrar', loginLoading: 'Entrando...', loginSuccess: 'Login realizado. Redirecionando para seu espaço.', loginSwitch: 'Ainda não tem conta?', loginSwitchLink: 'Criar conta',
    signupEyebrow: 'Cadastro', signupTitle: 'Crie sua conta Pikala.', signupSub: 'Poucas informações bastam para começar a explorar Rabat de bicicleta.', signupVisualTitle: 'Sua próxima viagem começa aqui.', signupVisualText: 'Uma conta Pikala dá acesso a estações, leitura de QR e relato rápido de problemas.', firstName: 'Nome', lastName: 'Sobrenome', phone: 'Telefone', confirmPassword: 'Confirmar senha', termsText: 'Aceito os termos e a política de privacidade.', signupSubmit: 'Criar minha conta', signupLoading: 'Criando conta...', signupSuccess: 'Conta criada. Agora você pode escolher sua assinatura.', signupSwitch: 'Já tem uma conta?', signupSwitchLink: 'Entrar', weak: 'Muito fraca', medium: 'Média', strong: 'Forte', veryStrong: 'Muito forte', required: 'Preencha todos os campos obrigatórios.', badEmail: 'Digite um e-mail válido.', badPassword: 'A senha deve ter pelo menos 8 caracteres.', mismatch: 'As senhas não coincidem.', acceptTerms: 'Aceite os termos.'
  },
  ar: {
    languageLabel: 'اللغة', back: 'العودة إلى الموقع', loginEyebrow: 'تسجيل الدخول', loginTitle: 'سعداء بعودتك.', loginSub: 'سجل الدخول للوصول إلى الدراجات والخريطة وملفك في بيكالا.', loginVisualTitle: 'عد إلى الطريق في ثوان.', loginVisualText: 'تجمع مساحة بيكالا المحطات وماسح QR ورحلاتك في تجربة هاتفية بسيطة.', email: 'البريد الإلكتروني', password: 'كلمة المرور', remember: 'تذكرني', forgot: 'نسيت كلمة المرور؟', loginSubmit: 'تسجيل الدخول', loginLoading: 'جاري تسجيل الدخول...', loginSuccess: 'تم تسجيل الدخول. سيتم تحويلك إلى مساحتك.', loginSwitch: 'ليس لديك حساب؟', loginSwitchLink: 'إنشاء حساب',
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
  button.addEventListener('click', () => {
    setLanguage(button.dataset.lang || 'fr');
    if (languageMenu instanceof HTMLDetailsElement) languageMenu.open = false;
  });
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
form?.addEventListener('submit', async (event) => {
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

  try {
    const payload = page === 'signup'
      ? {
          firstName: form.querySelector('#firstName')?.value.trim() || '',
          lastName: form.querySelector('#lastName')?.value.trim() || '',
          phone: form.querySelector('#phone')?.value.trim() || '',
          email,
          password
        }
      : { email, password };

    const response = await fetch(page === 'signup' ? '/api/signup' : '/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      showToast(data.error || dictionary.required);
      return;
    }

    if (data.user) localStorage.setItem('pikala-user', JSON.stringify(data.user));
    showToast(page === 'signup' ? dictionary.signupSuccess : dictionary.loginSuccess);
    redirectTo(page === 'signup' ? 'abonnement.html' : 'dashboard.html');
  } catch {
    showToast('Connexion au serveur impossible. Réessayez dans un instant.');
  } finally {
    if (submit instanceof HTMLButtonElement) {
      setLoading(submit, false, page === 'signup' ? dictionary.signupSubmit : dictionary.loginSubmit);
    }
  }
});
setLanguage(detectPreferredLanguage());