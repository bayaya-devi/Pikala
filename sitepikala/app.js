const header = document.querySelector('[data-header]');
const menuButton = document.querySelector('[data-menu-button]');
const siteNav = document.querySelector('[data-site-nav]');
const languageButtons = document.querySelectorAll('[data-lang]');

const translations = {
  fr: {
    title: 'Pikala - Explorez Rabat à vélo', skip: 'Aller au contenu', navHow: 'Comment ça marche', navStations: 'Stations', navPricing: 'Tarifs', navContact: 'Contact', navLogin: 'Connexion', navSignup: 'Créer un compte',
    heroEyebrow: 'Vélos en libre-service à Rabat', heroTitle: 'Trouvez un vélo près de vous et partez en quelques secondes.', heroText: 'Pikala rend vos trajets à Rabat plus simples : stations visibles, QR à scanner, abonnement clair et retour dans une station proche.', heroPrimary: 'Créer mon compte', heroSecondary: 'Voir les stations',
    trust1: 'Aucune carte à chercher : scannez et roulez', trust2: 'Prix simple, sans engagement long', trust3: 'Pensé pour les trajets courts à Rabat',
    today: "Aujourd'hui", bikesAvailable: 'vélos disponibles', openHours: 'Stations actives de 8h à 20h', statStations: 'stations', statBikes: 'vélos', statRoutes: 'itinéraires', statDays: 'jours sur 7',
    confidence1Title: 'Moins d’hésitation', confidence1Text: 'Un seul abonnement clair pour commencer.', confidence2Title: 'Plus de visibilité', confidence2Text: 'Les stations et vélos disponibles sont faciles à repérer.', confidence3Title: 'Retour rassurant', confidence3Text: 'Déposez le vélo dans une station et continuez votre journée.',
    howEyebrow: 'Simple et rapide', howTitle: 'Votre trajet en trois étapes.', howText: 'Le parcours doit rester clair : choisir une station, scanner le vélo, puis profiter du trajet.',
    step1Title: 'Trouvez une station', step1Text: 'Consultez les vélos disponibles près de vous depuis votre espace utilisateur.', step2Title: 'Scannez le QR', step2Text: 'Débloquez le vélo en quelques secondes avec le scanner intégré.', step3Title: 'Roulez librement', step3Text: 'Découvrez Rabat à votre rythme, puis déposez le vélo dans une station.',
    stationsEyebrow: 'Stations et parcours', stationsTitle: 'Des lieux faciles à rejoindre.', place1: 'Kasbah des Oudayas', place2: 'Tour Hassan', place3: 'Jardins et parcs', place4: 'Corniche', place1Bikes: '8 vélos disponibles', place2Bikes: '3 vélos disponibles', place3Bikes: '12 vélos disponibles', place4Bikes: '5 vélos disponibles',
    pricingEyebrow: 'Tarif clair', pricingTitle: 'Une formule simple pour commencer.', pricingText: 'Garde la tarification lisible, avec un appel à l’action direct vers l’inscription.', planName: 'Abonnement Pikala', priceUnit: 'MAD / mois', plan1: 'Accès aux vélos en libre-service', plan2: 'Scanner QR intégré', plan3: 'Signalement rapide des problèmes', plan4: 'Support 7j/7', pricingCta: 'Créer mon compte',
    phoneStation: 'Station Kasbah', scan: 'Scanner', appEyebrow: 'Espace utilisateur', appTitle: 'Une expérience mobile plus fluide.', appText: 'La page utilisateur existante peut ensuite reprendre ce style : navigation basse, carte, scanner QR et profil, avec des transitions plus douces.', appCta: "Voir l'espace utilisateur",
    contactTitle: 'Prêt à explorer Rabat ?', contactText: "Créer un compte prend moins d'une minute.", contactSignup: 'S’inscrire', contactEmail: 'Nous contacter', footerText: 'Vélos en libre-service à Rabat.'
  },
  en: {
    title: 'Pikala - Explore Rabat by bike', skip: 'Skip to content', navHow: 'How it works', navStations: 'Stations', navPricing: 'Pricing', navContact: 'Contact', navLogin: 'Log in', navSignup: 'Create account',
    heroEyebrow: 'Bike sharing in Rabat', heroTitle: 'Find a bike near you and start riding in seconds.', heroText: 'Pikala makes short trips in Rabat simpler: visible stations, QR scanning, clear subscription, and easy return to a nearby station.', heroPrimary: 'Create my account', heroSecondary: 'View stations',
    trust1: 'No card to search for: scan and ride', trust2: 'Simple price, no long commitment', trust3: 'Built for short trips in Rabat',
    today: 'Today', bikesAvailable: 'bikes available', openHours: 'Stations open from 8 AM to 8 PM', statStations: 'stations', statBikes: 'bikes', statRoutes: 'routes', statDays: 'days a week',
    confidence1Title: 'Less hesitation', confidence1Text: 'One clear subscription to get started.', confidence2Title: 'More visibility', confidence2Text: 'Stations and available bikes are easy to spot.', confidence3Title: 'Reassuring return', confidence3Text: 'Drop the bike at a station and continue your day.',
    howEyebrow: 'Simple and fast', howTitle: 'Your ride in three steps.', howText: 'The journey stays clear: choose a station, scan the bike, then enjoy the ride.',
    step1Title: 'Find a station', step1Text: 'Check nearby bike availability from your user space.', step2Title: 'Scan the QR code', step2Text: 'Unlock the bike in seconds with the built-in scanner.', step3Title: 'Ride freely', step3Text: 'Discover Rabat at your own pace, then return the bike to a station.',
    stationsEyebrow: 'Stations and routes', stationsTitle: 'Places that are easy to reach.', place1: 'Kasbah of the Oudayas', place2: 'Hassan Tower', place3: 'Gardens and parks', place4: 'Corniche', place1Bikes: '8 bikes available', place2Bikes: '3 bikes available', place3Bikes: '12 bikes available', place4Bikes: '5 bikes available',
    pricingEyebrow: 'Clear pricing', pricingTitle: 'One simple plan to start.', pricingText: 'Keep pricing easy to understand, with a direct call to create an account.', planName: 'Pikala subscription', priceUnit: 'MAD / month', plan1: 'Access to self-service bikes', plan2: 'Built-in QR scanner', plan3: 'Fast issue reporting', plan4: 'Support 7 days a week', pricingCta: 'Create my account',
    phoneStation: 'Kasbah Station', scan: 'Scan', appEyebrow: 'User space', appTitle: 'A smoother mobile experience.', appText: 'The existing user page can reuse this style: bottom navigation, map, QR scanner, profile, and smoother transitions.', appCta: 'View user space',
    contactTitle: 'Ready to explore Rabat?', contactText: 'Creating an account takes less than a minute.', contactSignup: 'Sign up', contactEmail: 'Contact us', footerText: 'Bike sharing in Rabat.'
  },
  ar: {
    title: 'بيكالا - استكشف الرباط بالدراجة', skip: 'انتقل إلى المحتوى', navHow: 'طريقة الاستخدام', navStations: 'المحطات', navPricing: 'الأسعار', navContact: 'اتصل بنا', navLogin: 'تسجيل الدخول', navSignup: 'إنشاء حساب',
    heroEyebrow: 'دراجات مشتركة في الرباط', heroTitle: 'اعثر على دراجة قريبة وانطلق خلال ثوان.', heroText: 'تجعل بيكالا تنقلاتك القصيرة في الرباط أسهل: محطات واضحة، مسح QR، اشتراك بسيط، وإرجاع في محطة قريبة.', heroPrimary: 'إنشاء حسابي', heroSecondary: 'عرض المحطات',
    trust1: 'لا حاجة للبحث عن بطاقة: امسح وانطلق', trust2: 'سعر بسيط بدون التزام طويل', trust3: 'مصمم للتنقلات القصيرة في الرباط',
    today: 'اليوم', bikesAvailable: 'دراجة متاحة', openHours: 'المحطات نشطة من 8 صباحا إلى 8 مساء', statStations: 'محطات', statBikes: 'دراجات', statRoutes: 'مسارات', statDays: 'أيام في الأسبوع',
    confidence1Title: 'تردد أقل', confidence1Text: 'اشتراك واحد واضح للبدء.', confidence2Title: 'رؤية أوضح', confidence2Text: 'المحطات والدراجات المتاحة سهلة التحديد.', confidence3Title: 'إرجاع مطمئن', confidence3Text: 'أعد الدراجة إلى محطة وتابع يومك.',
    howEyebrow: 'بسيط وسريع', howTitle: 'رحلتك في ثلاث خطوات.', howText: 'اختر محطة، امسح رمز الدراجة، ثم استمتع بالرحلة.',
    step1Title: 'ابحث عن محطة', step1Text: 'تحقق من الدراجات المتاحة بالقرب منك من مساحة المستخدم.', step2Title: 'امسح رمز QR', step2Text: 'افتح الدراجة في ثوان عبر الماسح المدمج.', step3Title: 'انطلق بحرية', step3Text: 'اكتشف الرباط بإيقاعك، ثم أعد الدراجة إلى إحدى المحطات.',
    stationsEyebrow: 'المحطات والمسارات', stationsTitle: 'أماكن يسهل الوصول إليها.', place1: 'قصبة الأوداية', place2: 'صومعة حسان', place3: 'الحدائق والمتنزهات', place4: 'الكورنيش', place1Bikes: '8 دراجات متاحة', place2Bikes: '3 دراجات متاحة', place3Bikes: '12 دراجة متاحة', place4Bikes: '5 دراجات متاحة',
    pricingEyebrow: 'سعر واضح', pricingTitle: 'خطة بسيطة للبدء.', pricingText: 'تسعير واضح مع دعوة مباشرة لإنشاء الحساب.', planName: 'اشتراك بيكالا', priceUnit: 'درهم / شهر', plan1: 'الوصول إلى الدراجات بالخدمة الذاتية', plan2: 'ماسح QR مدمج', plan3: 'الإبلاغ السريع عن المشاكل', plan4: 'دعم طوال الأسبوع', pricingCta: 'إنشاء حسابي',
    phoneStation: 'محطة القصبة', scan: 'مسح', appEyebrow: 'مساحة المستخدم', appTitle: 'تجربة هاتفية أكثر سلاسة.', appText: 'يمكن لصفحة المستخدم الحالية استخدام هذا النمط: تنقل سفلي، خريطة، ماسح QR، ملف شخصي، وانتقالات أكثر سلاسة.', appCta: 'عرض مساحة المستخدم',
    contactTitle: 'هل أنت مستعد لاستكشاف الرباط؟', contactText: 'إنشاء الحساب يستغرق أقل من دقيقة.', contactSignup: 'تسجيل', contactEmail: 'راسلنا', footerText: 'دراجات مشتركة في الرباط.'
  }
};

const authLinks = {
  fr: { login: 'connexion.html', signup: 'inscription.html' },
  en: { login: 'connexion.html?lang=en', signup: 'inscription.html?lang=en' },
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

  localStorage.setItem('pikala-lang', lang);
}

function detectPreferredLanguage() {
  const saved = localStorage.getItem('pikala-lang');
  if (saved) return saved;

  const browserLang = (navigator.language || navigator.userLanguage || '').toLowerCase();
  if (browserLang.startsWith('fr')) return 'fr';
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
    closeMenu();
  });
});

setLanguage(detectPreferredLanguage());

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

