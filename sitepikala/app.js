const header = document.querySelector('[data-header]');
const menuButton = document.querySelector('[data-menu-button]');
const siteNav = document.querySelector('[data-site-nav]');
const languageButtons = document.querySelectorAll('[data-lang]');
const languageMenu = document.querySelector('[data-language-menu]');
const languageSummary = languageMenu?.querySelector('summary');

const translations = {
  fr: {
    title: 'Pikala - Rabat a velo', languageLabel: 'Langue', skip: 'Aller au contenu', navHow: 'Comment ça marche', navStations: 'Stations', navPricing: 'Tarifs', navContact: 'Contact', navLogin: 'Connexion', navSignup: 'Créer un compte',
    heroEyebrow: 'Vélos en libre-service à Rabat', heroTitle: 'Un velo pres de vous.', heroText: 'Trouvez une station, scannez le QR et partez.', heroPrimary: 'Créer mon compte', heroSecondary: 'Voir les stations',
    trust1: 'Scannez et roulez', trust2: '99 MAD par mois', trust3: 'Pour les trajets courts',
    today: "Aujourd'hui", bikesAvailable: 'vélos disponibles', openHours: 'Stations 8h-20h', statStations: 'stations', statBikes: 'vélos', statRoutes: 'itinéraires', statDays: 'jours sur 7',
    confidence1Title: 'Simple', confidence1Text: 'Un abonnement clair.', confidence2Title: 'Visible', confidence2Text: 'Stations et velos en direct.', confidence3Title: 'Pratique', confidence3Text: 'Retour en station.',
    howEyebrow: 'Simple et rapide', howTitle: 'Trois etapes.', howText: 'Station. QR. Trajet.',
    step1Title: 'Trouvez', step1Text: 'Reperez un velo disponible.', step2Title: 'Scannez', step2Text: 'Debloquez le velo par QR.', step3Title: 'Roulez', step3Text: 'Profitez, puis retournez le velo.',
    stationsEyebrow: 'Stations et parcours', stationsTitle: 'Stations proches.', place1: 'Kasbah des Oudayas', place2: 'Tour Hassan', place3: 'Jardins et parcs', place4: 'Corniche', place1Bikes: '8 vélos disponibles', place2Bikes: '3 vélos disponibles', place3Bikes: '12 vélos disponibles', place4Bikes: '5 vélos disponibles',
    pricingEyebrow: 'Tarif clair', pricingTitle: 'Un abonnement simple.', pricingText: '99 MAD par mois, sans engagement long.', planName: 'Abonnement Pikala', priceUnit: 'MAD / mois', plan1: 'Accès aux vélos en libre-service', plan2: 'Scanner QR intégré', plan3: 'Signalement rapide des problèmes', plan4: 'Support 7j/7', pricingCta: 'Créer mon compte',
    phoneStation: 'Station Kasbah', scan: 'Scanner', appEyebrow: 'Espace utilisateur', appTitle: 'Votre espace mobile.', appText: 'Carte, scanner, profil et support au meme endroit.', appCta: "Voir l'espace utilisateur",
    contactTitle: 'Pret a rouler ?', contactText: "Créer un compte prend moins d'une minute.", contactSignup: 'S’inscrire', contactEmail: 'Nous contacter', footerText: 'Velos en libre-service a Rabat.', footerLegal: 'Mentions légales', footerPrivacy: 'Confidentialité', footerTerms: 'Conditions'
  },
  en: {
    title: 'Pikala - Rabat by bike', languageLabel: 'Language', skip: 'Skip to content', navHow: 'How it works', navStations: 'Stations', navPricing: 'Pricing', navContact: 'Contact', navLogin: 'Log in', navSignup: 'Create account',
    heroEyebrow: 'Bike sharing in Rabat', heroTitle: 'A bike near you.', heroText: 'Find a station, scan the QR code, and ride.', heroPrimary: 'Create my account', heroSecondary: 'View stations',
    trust1: 'Scan and ride', trust2: '99 MAD per month', trust3: 'For short city trips',
    today: 'Today', bikesAvailable: 'bikes available', openHours: 'Stations 8 AM-8 PM', statStations: 'stations', statBikes: 'bikes', statRoutes: 'routes', statDays: 'days a week',
    confidence1Title: 'Simple', confidence1Text: 'One clear plan.', confidence2Title: 'Visible', confidence2Text: 'Live stations and bikes.', confidence3Title: 'Practical', confidence3Text: 'Return at a station.',
    howEyebrow: 'Simple and fast', howTitle: 'Three steps.', howText: 'Station. QR. Ride.',
    step1Title: 'Find', step1Text: 'Spot an available bike.', step2Title: 'Scan', step2Text: 'Unlock it by QR code.', step3Title: 'Ride', step3Text: 'Ride, then return the bike.',
    stationsEyebrow: 'Stations and routes', stationsTitle: 'Nearby stations.', place1: 'Kasbah of the Oudayas', place2: 'Hassan Tower', place3: 'Gardens and parks', place4: 'Corniche', place1Bikes: '8 bikes available', place2Bikes: '3 bikes available', place3Bikes: '12 bikes available', place4Bikes: '5 bikes available',
    pricingEyebrow: 'Clear pricing', pricingTitle: 'One simple plan.', pricingText: '99 MAD per month, no long commitment.', planName: 'Pikala subscription', priceUnit: 'MAD / month', plan1: 'Access to self-service bikes', plan2: 'Built-in QR scanner', plan3: 'Fast issue reporting', plan4: 'Support 7 days a week', pricingCta: 'Create my account',
    phoneStation: 'Kasbah Station', scan: 'Scan', appEyebrow: 'User space', appTitle: 'Your mobile space.', appText: 'Map, scanner, profile, and support in one place.', appCta: 'View user space',
    contactTitle: 'Ready to ride?', contactText: 'Create your account in under a minute.', contactSignup: 'Sign up', contactEmail: 'Contact us', footerText: 'Bike sharing in Rabat.', footerLegal: 'Legal notice', footerPrivacy: 'Privacy', footerTerms: 'Terms'
  },
  es: {
    title: 'Pikala - Rabat en bici', languageLabel: 'Idioma', skip: 'Ir al contenido', navHow: 'Cómo funciona', navStations: 'Estaciones', navPricing: 'Precios', navContact: 'Contacto', navLogin: 'Iniciar sesión', navSignup: 'Crear cuenta',
    heroEyebrow: 'Bicicletas compartidas en Rabat', heroTitle: 'Una bici cerca de ti.', heroText: 'Busca una estacion, escanea el QR y pedalea.', heroPrimary: 'Crear mi cuenta', heroSecondary: 'Ver estaciones',
    trust1: 'Escanea y pedalea', trust2: '99 MAD al mes', trust3: 'Para trayectos cortos',
    today: 'Hoy', bikesAvailable: 'bicicletas disponibles', openHours: 'Estaciones 8h-20h', statStations: 'estaciones', statBikes: 'bicicletas', statRoutes: 'rutas', statDays: 'días a la semana',
    confidence1Title: 'Simple', confidence1Text: 'Un plan claro.', confidence2Title: 'Visible', confidence2Text: 'Estaciones y bicis en vivo.', confidence3Title: 'Practico', confidence3Text: 'Devolucion en estacion.',
    howEyebrow: 'Simple y rápido', howTitle: 'Tres pasos.', howText: 'Estacion. QR. Trayecto.',
    step1Title: 'Busca', step1Text: 'Encuentra una bici disponible.', step2Title: 'Escanea', step2Text: 'Desbloquea con QR.', step3Title: 'Pedalea', step3Text: 'Pedalea y devuelve la bici.',
    stationsEyebrow: 'Estaciones y rutas', stationsTitle: 'Estaciones cercanas.', place1: 'Kasbah de los Oudayas', place2: 'Torre Hassan', place3: 'Jardines y parques', place4: 'Corniche', place1Bikes: '8 bicicletas disponibles', place2Bikes: '3 bicicletas disponibles', place3Bikes: '12 bicicletas disponibles', place4Bikes: '5 bicicletas disponibles',
    pricingEyebrow: 'Precio claro', pricingTitle: 'Un plan simple.', pricingText: '99 MAD al mes, sin compromiso largo.', planName: 'Suscripción Pikala', priceUnit: 'MAD / mes', plan1: 'Acceso a bicicletas de autoservicio', plan2: 'Escáner QR integrado', plan3: 'Reporte rápido de problemas', plan4: 'Soporte 7 días a la semana', pricingCta: 'Crear mi cuenta',
    phoneStation: 'Estación Kasbah', scan: 'Escanear', appEyebrow: 'Espacio de usuario', appTitle: 'Tu espacio movil.', appText: 'Mapa, scanner, perfil y soporte en un lugar.', appCta: 'Ver espacio de usuario',
    contactTitle: 'Listo para pedalear?', contactText: 'Crea tu cuenta en menos de un minuto.', contactSignup: 'Registrarse', contactEmail: 'Contactarnos', footerText: 'Bicicletas compartidas en Rabat.', footerLegal: 'Aviso legal', footerPrivacy: 'Privacidad', footerTerms: 'Condiciones'
  },
  pt: {
    title: 'Pikala - Rabat de bicicleta', languageLabel: 'Idioma', skip: 'Ir para o conteúdo', navHow: 'Como funciona', navStations: 'Estações', navPricing: 'Preços', navContact: 'Contato', navLogin: 'Entrar', navSignup: 'Criar conta',
    heroEyebrow: 'Bicicletas compartilhadas em Rabat', heroTitle: 'Uma bike perto de voce.', heroText: 'Ache uma estacao, escaneie o QR e pedale.', heroPrimary: 'Criar minha conta', heroSecondary: 'Ver estações',
    trust1: 'Escaneie e pedale', trust2: '99 MAD por mes', trust3: 'Para trajetos curtos',
    today: 'Hoje', bikesAvailable: 'bicicletas disponíveis', openHours: 'Estacoes 8h-20h', statStations: 'estações', statBikes: 'bicicletas', statRoutes: 'rotas', statDays: 'dias por semana',
    confidence1Title: 'Simples', confidence1Text: 'Um plano claro.', confidence2Title: 'Visivel', confidence2Text: 'Estacoes e bikes ao vivo.', confidence3Title: 'Pratico', confidence3Text: 'Devolva na estacao.',
    howEyebrow: 'Simples e rápido', howTitle: 'Tres passos.', howText: 'Estacao. QR. Viagem.',
    step1Title: 'Ache', step1Text: 'Veja uma bike disponivel.', step2Title: 'Escaneie', step2Text: 'Desbloqueie por QR.', step3Title: 'Pedale', step3Text: 'Pedale e devolva a bike.',
    stationsEyebrow: 'Estações e rotas', stationsTitle: 'Estacoes perto.', place1: 'Kasbah dos Oudayas', place2: 'Torre Hassan', place3: 'Jardins e parques', place4: 'Corniche', place1Bikes: '8 bicicletas disponíveis', place2Bikes: '3 bicicletas disponíveis', place3Bikes: '12 bicicletas disponíveis', place4Bikes: '5 bicicletas disponíveis',
    pricingEyebrow: 'Preço claro', pricingTitle: 'Um plano simples.', pricingText: '99 MAD por mes, sem compromisso longo.', planName: 'Assinatura Pikala', priceUnit: 'MAD / mês', plan1: 'Acesso a bicicletas self-service', plan2: 'Scanner QR integrado', plan3: 'Relato rápido de problemas', plan4: 'Suporte 7 dias por semana', pricingCta: 'Criar minha conta',
    phoneStation: 'Estação Kasbah', scan: 'Escanear', appEyebrow: 'Espaço do usuário', appTitle: 'Seu espaco movel.', appText: 'Mapa, scanner, perfil e suporte no mesmo lugar.', appCta: 'Ver espaço do usuário',
    contactTitle: 'Pronto para pedalar?', contactText: 'Crie sua conta em menos de um minuto.', contactSignup: 'Cadastrar', contactEmail: 'Fale conosco', footerText: 'Bicicletas compartilhadas em Rabat.', footerLegal: 'Aviso legal', footerPrivacy: 'Privacidade', footerTerms: 'Termos'
  },
  ar: {
    title: 'بيكالا - استكشف الرباط بالدراجة', languageLabel: 'اللغة', skip: 'انتقل إلى المحتوى', navHow: 'طريقة الاستخدام', navStations: 'المحطات', navPricing: 'الأسعار', navContact: 'اتصل بنا', navLogin: 'تسجيل الدخول', navSignup: 'إنشاء حساب',
    heroEyebrow: 'دراجات مشتركة في الرباط', heroTitle: 'اعثر على دراجة قريبة وانطلق خلال ثوان.', heroText: 'تجعل بيكالا تنقلاتك القصيرة في الرباط أسهل: محطات واضحة، مسح QR، اشتراك بسيط، وإرجاع في محطة قريبة.', heroPrimary: 'إنشاء حسابي', heroSecondary: 'عرض المحطات',
    trust1: 'لا حاجة للبحث عن بطاقة: امسح وانطلق', trust2: 'سعر بسيط بدون التزام طويل', trust3: 'مصمم للتنقلات القصيرة في الرباط',
    today: 'اليوم', bikesAvailable: 'دراجة متاحة', openHours: 'المحطات نشطة من 8 صباحا إلى 8 مساء', statStations: 'محطات', statBikes: 'دراجات', statRoutes: 'مسارات', statDays: 'أيام في الأسبوع',
    confidence1Title: 'تردد أقل', confidence1Text: 'اشتراك واحد واضح للبدء.', confidence2Title: 'رؤية أوضح', confidence2Text: 'المحطات والدراجات المتاحة سهلة التحديد.', confidence3Title: 'إرجاع مطمئن', confidence3Text: 'أعد الدراجة إلى محطة وتابع يومك.',
    howEyebrow: 'بسيط وسريع', howTitle: 'رحلتك في ثلاث خطوات.', howText: 'اختر محطة، امسح رمز الدراجة، ثم استمتع بالرحلة.',
    step1Title: 'ابحث عن محطة', step1Text: 'تحقق من الدراجات المتاحة بالقرب منك من مساحة المستخدم.', step2Title: 'امسح رمز QR', step2Text: 'افتح الدراجة في ثوان عبر الماسح المدمج.', step3Title: 'انطلق بحرية', step3Text: 'اكتشف الرباط بإيقاعك، ثم أعد الدراجة إلى إحدى المحطات.',
    stationsEyebrow: 'المحطات والمسارات', stationsTitle: 'أماكن يسهل الوصول إليها.', place1: 'قصبة الأوداية', place2: 'صومعة حسان', place3: 'الحدائق والمتنزهات', place4: 'الكورنيش', place1Bikes: '8 دراجات متاحة', place2Bikes: '3 دراجات متاحة', place3Bikes: '12 دراجة متاحة', place4Bikes: '5 دراجات متاحة',
    pricingEyebrow: 'سعر واضح', pricingTitle: 'خطة بسيطة للبدء.', pricingText: 'تسعير واضح مع دعوة مباشرة لإنشاء الحساب.', planName: 'اشتراك بيكالا', priceUnit: 'درهم / شهر', plan1: 'الوصول إلى الدراجات بالخدمة الذاتية', plan2: 'ماسح QR مدمج', plan3: 'الإبلاغ السريع عن المشاكل', plan4: 'دعم طوال الأسبوع', pricingCta: 'إنشاء حسابي',
    phoneStation: 'محطة القصبة', scan: 'مسح', appEyebrow: 'مساحة المستخدم', appTitle: 'تجربة هاتفية أكثر سلاسة.', appText: 'يمكن لصفحة المستخدم الحالية استخدام هذا النمط: تنقل سفلي، خريطة، ماسح QR، ملف شخصي، وانتقالات أكثر سلاسة.', appCta: 'عرض مساحة المستخدم',
    contactTitle: 'هل أنت مستعد لاستكشاف الرباط؟', contactText: 'إنشاء الحساب يستغرق أقل من دقيقة.', contactSignup: 'تسجيل', contactEmail: 'راسلنا', footerText: 'دراجات مشتركة في الرباط.', footerLegal: 'الإشعار القانوني', footerPrivacy: 'الخصوصية', footerTerms: 'الشروط'
  }
};

const authLinks = {
  fr: { login: 'connexion.html', signup: 'inscription.html' },
  en: { login: 'connexion.html?lang=en', signup: 'inscription.html?lang=en' },
  es: { login: 'connexion.html?lang=es', signup: 'inscription.html?lang=es' },
  pt: { login: 'connexion.html?lang=pt', signup: 'inscription.html?lang=pt' },
  ar: { login: 'connexion.html?lang=ar', signup: 'inscription.html?lang=ar' }
};

function setHeaderState() {
  header?.classList.toggle('scrolled', window.scrollY > 12);
}

function closeMenu() {
  siteNav?.classList.remove('open');
  menuButton?.setAttribute('aria-expanded', 'false');
}

function setLanguage(lang) {
  const dictionary = translations[lang] || translations.fr;
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.body.classList.toggle('is-rtl', lang === 'ar');
  document.title = dictionary.title;

  document.querySelectorAll('[data-i18n]').forEach((element) => {
    const key = element.getAttribute('data-i18n');
    if (key && dictionary[key]) element.textContent = dictionary[key];
  });

  document.querySelectorAll('[data-auth-link]').forEach((element) => {
    const type = element.getAttribute('data-auth-link');
    if (type && authLinks[lang]?.[type]) element.setAttribute('href', authLinks[lang][type]);
  });

  languageButtons.forEach((button) => {
    const isActive = button.getAttribute('data-lang') === lang;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
  if (languageSummary) languageSummary.textContent = `${dictionary.languageLabel} : ${lang.toUpperCase()}`;

  localStorage.setItem('pikala-lang', lang);
}

function detectPreferredLanguage() {
  const saved = localStorage.getItem('pikala-lang');
  if (saved) return saved;

  const browserLang = (navigator.language || navigator.userLanguage || '').toLowerCase();
  if (browserLang.startsWith('fr')) return 'fr';
  if (browserLang.startsWith('es')) return 'es';
  if (browserLang.startsWith('pt')) return 'pt';
  if (browserLang.startsWith('ar')) return 'ar';
  return 'en';
}

setHeaderState();
window.addEventListener('scroll', setHeaderState, { passive: true });

menuButton?.addEventListener('click', () => {
  const isOpen = siteNav?.classList.toggle('open');
  menuButton.setAttribute('aria-expanded', String(Boolean(isOpen)));
});

siteNav?.addEventListener('click', (event) => {
  if (event.target instanceof HTMLAnchorElement) closeMenu();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeMenu();
});

languageButtons.forEach((button) => {
  button.addEventListener('click', () => {
    setLanguage(button.getAttribute('data-lang') || 'fr');
    if (languageMenu instanceof HTMLDetailsElement) languageMenu.open = false;
    closeMenu();
  });
});

setLanguage(detectPreferredLanguage());

function prepareScrollReveals() {
  const groups = ['.hero-copy', '.hero-media', '.hero-card', '.stat', '.confidence-item', '.section-intro', '.step-card', '.destination-card', '.price-card', '.phone', '.contact-inner', '.legal-block'];
  document.querySelectorAll(groups.join(',')).forEach((item, index) => {
    item.classList.add('reveal');
    if (!item.style.getPropertyValue('--delay')) item.style.setProperty('--delay', String(Math.min(index % 4, 3) * 90) + 'ms');
  });
}

prepareScrollReveals();
const revealItems = document.querySelectorAll('.reveal');
revealItems.forEach((item) => {
  const delay = item.getAttribute('data-delay');
  if (delay) item.style.setProperty('--delay', `${Number(delay) || 0}ms`);
});

const counterState = new WeakSet();
function animateCounter(element) {
  if (counterState.has(element)) return;
  counterState.add(element);
  const target = Number(element.getAttribute('data-count')) || 0;
  const duration = 1100;
  const start = performance.now();

  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    element.textContent = String(Math.round(target * eased));
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('is-visible');
    entry.target.querySelectorAll('[data-count]').forEach(animateCounter);
    if (entry.target.matches('[data-count]')) animateCounter(entry.target);
    observer.unobserve(entry.target);
  });
}, { threshold: 0.18, rootMargin: '0px 0px -40px 0px' });

revealItems.forEach((item) => observer.observe(item));
document.querySelectorAll('[data-count]').forEach((item) => observer.observe(item));

