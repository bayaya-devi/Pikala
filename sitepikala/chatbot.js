(function () {
  const ui = {
    fr: {
      title: 'Assistant Pikala',
      subtitle: 'Réponses directes',
      placeholder: 'Ex. : vélo proche, problème de QR...',
      send: 'Envoyer',
      close: 'Fermer',
      open: 'Ouvrir le chat',
      hello: 'Bonjour. Je suis l’assistant Pikala. Vous pouvez écrire une question courte, même avec des fautes : je ferai de mon mieux pour comprendre.',
      fallback: 'Je ne suis pas encore certain d’avoir compris. Vous pouvez me demander, par exemple : station proche, prix de l’abonnement, scanner QR, connexion, support ou problème avec un vélo.',
      pageMatch: 'Sur cette page, je vois surtout :',
      linksIntro: 'Vous pouvez aussi ouvrir :',
      suggestions: ['Vélo proche', 'Scanner QR', 'Prix de l’abonnement', 'Problème avec un vélo']
    },
    en: {
      title: 'Pikala Assistant',
      subtitle: 'Direct answers',
      placeholder: 'Try: near bike, scan issue...',
      send: 'Send',
      close: 'Close',
      open: 'Open chat',
      hello: 'Hi. I am the Pikala assistant. You can type short or imperfect sentences, and I will do my best to understand.',
      fallback: 'I am not fully sure yet. Try asking: nearby station, subscription price, QR scanner, login, support, or bike issue.',
      pageMatch: 'On this page, I mostly see:',
      linksIntro: 'You can also open:',
      suggestions: ['Nearby bike', 'QR scanner', 'Price', 'Bike problem']
    },
    es: {
      title: 'Asistente Pikala',
      subtitle: 'Respuestas directas',
      placeholder: 'Ej: bici cerca, problema QR...',
      send: 'Enviar',
      close: 'Cerrar',
      open: 'Abrir chat',
      hello: 'Hola. Soy el asistente Pikala. Puedes escribir frases cortas o con errores; intentaré entender.',
      fallback: 'Todavía no estoy seguro de haber entendido. Puedes preguntarme por una estación cercana, el precio, el escáner QR, la conexión, el soporte o un problema con una bici.',
      pageMatch: 'En esta página veo sobre todo:',
      linksIntro: 'También puedes abrir:',
      suggestions: ['Bici cerca', 'Escáner QR', 'Precio', 'Problema con una bici']
    },
    pt: {
      title: 'Assistente Pikala',
      subtitle: 'Respostas diretas',
      placeholder: 'Ex: bike perto, erro QR...',
      send: 'Enviar',
      close: 'Fechar',
      open: 'Abrir chat',
      hello: 'Olá. Sou o assistente Pikala. Pode escrever frases curtas ou com erros; vou tentar entender.',
      fallback: 'Ainda não tenho certeza de ter entendido. Pergunte sobre estação próxima, preço, scanner QR, login, suporte ou problema com bicicleta.',
      pageMatch: 'Nesta página, vejo principalmente:',
      linksIntro: 'Você também pode abrir:',
      suggestions: ['Bike perto', 'Scanner QR', 'Preço', 'Problema com bike']
    },
    ar: {
      title: 'مساعد بيكالا',
      subtitle: 'إجابات مباشرة',
      placeholder: 'اسأل عن المحطات أو QR أو السعر...',
      send: 'إرسال',
      close: 'إغلاق',
      open: 'فتح المحادثة',
      hello: 'مرحباً. أنا مساعد بيكالا. يمكنك كتابة سؤال قصير، وسأحاول فهمه.',
      fallback: 'لست متأكداً من أنني فهمت سؤالك. يمكنك أن تسألني عن المحطات أو ماسح QR أو السعر أو تسجيل الدخول أو الدعم.',
      pageMatch: 'في هذه الصفحة أرى خصوصاً:',
      linksIntro: 'يمكنك أيضاً فتح:',
      suggestions: ['المحطات', 'ماسح QR', 'السعر', 'الدعم']
    }
  };

  const answers = {
    greeting: {
      fr: 'Bonjour. Je peux vous aider rapidement à trouver une station, comprendre le scanner, consulter le prix, gérer votre compte ou signaler un problème.',
      en: 'Hi. I can help you find a station, understand the scanner, check pricing, manage your account, or report a problem.',
      es: 'Hola. Puedo ayudarte con estaciones, escáner, precio, cuenta o soporte.',
      pt: 'Olá. Posso ajudar com estações, scanner, preço, conta ou suporte.',
      ar: 'مرحباً. يمكنني مساعدتك في المحطات، وماسح QR، والسعر، والحساب، والدعم.'
    },
    station: {
      fr: 'Pour trouver un vélo, ouvrez la page Stations. Vous verrez les points comme la Kasbah des Oudayas, la Tour Hassan, les Jardins et la Corniche, avec le nombre de vélos disponibles.',
      en: 'Open Stations to find a bike. You will see places like Kasbah, Hassan Tower, Gardens, and Corniche with available bikes.',
      es: 'Abre Estaciones para encontrar una bici. Verás los puntos disponibles y el número de bicicletas.',
      pt: 'Abra Estações para encontrar uma bike. Você verá os pontos e o número de bicicletas disponíveis.',
      ar: 'افتح صفحة المحطات للعثور على الدراجات المتاحة بالقرب منك.'
    },
    availability: {
      fr: 'Actuellement, le site affiche des disponibilités de démonstration : 8 vélos à la Kasbah, 3 à la Tour Hassan, 12 aux Jardins et 5 à la Corniche.',
      en: 'The site currently shows demo availability: 8 bikes at Kasbah, 3 at Hassan Tower, 12 at Gardens, and 5 at Corniche.',
      es: 'El sitio muestra datos de prueba: 8 bicis en Kasbah, 3 en la Torre Hassan, 12 en Jardines y 5 en Corniche.',
      pt: 'O site mostra dados de demonstração: 8 bikes em Kasbah, 3 na Torre Hassan, 12 nos Jardins e 5 na Corniche.',
      ar: 'يعرض الموقع حالياً بيانات تجريبية لتوفر الدراجات حسب المحطة.'
    },
    scanner: {
      fr: 'Le scanner sert à débloquer un vélo avec son QR code. Pour l’instant, la page Scanner simule le parcours. Plus tard, elle pourra être reliée à la caméra et à une vraie base de données.',
      en: 'The scanner unlocks a bike with its QR code. For now, the Scanner page simulates the flow. Later it can connect to camera and database.',
      es: 'El escáner desbloquea una bici con QR. Por ahora, la página simula el recorrido; más adelante se podrá conectar la cámara y una base de datos.',
      pt: 'O scanner desbloqueia uma bike por QR. Por enquanto, a página simula o fluxo; depois poderá conectar a câmera e o banco de dados.',
      ar: 'يفتح ماسح QR الدراجة. في الوقت الحالي، هذه الميزة تجريبية.'
    },
    scannerIssue: {
      fr: 'Si le scan ne fonctionne pas, vérifiez la lumière, nettoyez le QR code, rapprochez le téléphone, puis essayez un autre vélo. Si le problème continue, ouvrez Support et indiquez le numéro du vélo.',
      en: 'If scanning fails: check light, clean the QR, move closer, then try another bike. If it still fails, open Support and report the bike number.',
      es: 'Si el escaneo falla, revisa la luz, limpia el QR, acerca el teléfono y prueba otra bici. Si continúa, abre Soporte.',
      pt: 'Se o scan falhar, verifique a luz, limpe o QR, aproxime o telefone e tente outra bike. Se continuar, abra Suporte.',
      ar: 'إذا لم يعمل المسح، تحقق من الإضاءة ونظافة رمز QR، ثم أبلغ الدعم إذا استمرت المشكلة.'
    },
    subscription: {
      fr: 'Après l’inscription, vous arrivez sur la page Abonnement. La formule de démonstration affiche 200 MAD par mois, puis vous pouvez accéder au tableau de bord.',
      en: 'After signup, you land on Subscription. The demo plan shows 200 MAD/month, then you can continue to the dashboard.',
      es: 'Después del registro, llegas a Suscripción. El plan de demostración muestra 200 MAD al mes y luego puedes ir al panel.',
      pt: 'Depois do cadastro, você chega à página Assinatura. O plano de demonstração mostra 200 MAD por mês e depois leva ao painel.',
      ar: 'بعد التسجيل، تعرض صفحة الاشتراك الخطة التجريبية بسعر 200 درهم شهرياً.'
    },
    login: {
      fr: 'Le parcours est simple : l’inscription mène vers Abonnement, et la connexion mène vers le Tableau de bord. Pour tester, utilisez une adresse e-mail valide et un mot de passe d’au moins 8 caractères.',
      en: 'Flow is simple: signup goes to Subscription, login goes to Dashboard. Use a valid email and an 8-character password to test.',
      es: 'El recorrido es simple: registro hacia Suscripción y conexión hacia el Panel. Usa un email válido y una contraseña de al menos 8 caracteres.',
      pt: 'O fluxo é simples: cadastro para Assinatura e login para Painel. Use um e-mail válido e uma senha com pelo menos 8 caracteres.',
      ar: 'ينقلك التسجيل إلى صفحة الاشتراك، وينقلك تسجيل الدخول إلى لوحة التحكم.'
    },
    dashboard: {
      fr: 'Le tableau de bord donne accès à Stations, Scanner, Profil et Support. C’est la page principale après la connexion.',
      en: 'The dashboard gives access to Stations, Scanner, Profile, and Support. It is the main page after login.',
      es: 'El panel da acceso a Estaciones, Escáner, Perfil y Soporte.',
      pt: 'O painel dá acesso a Estações, Scanner, Perfil e Suporte.',
      ar: 'تمنحك لوحة التحكم الوصول إلى المحطات، والماسح، والملف الشخصي، والدعم.'
    },
    support: {
      fr: 'Pour signaler un problème, allez sur Support. Indiquez le numéro du vélo ou la station, puis décrivez le souci : frein, QR code, roue, station pleine, etc.',
      en: 'For a problem, open Support. Add bike number or station, then describe the issue: brake, QR, wheel, full station, etc.',
      es: 'Para un problema, abre Soporte. Indica el número de la bici o la estación y describe el problema.',
      pt: 'Para relatar um problema, abra Suporte. Informe o número da bike ou a estação e descreva o problema.',
      ar: 'للإبلاغ عن مشكلة، افتح صفحة الدعم وصف مشكلة الدراجة أو المحطة.'
    },
    profile: {
      fr: 'La page Profil contient les informations du compte, la langue et l’abonnement. Plus tard, elle pourra afficher les vraies données utilisateur depuis la base.',
      en: 'Profile contains account details, language, and subscription. Later it can show real database data.',
      es: 'Perfil contiene los datos de la cuenta, el idioma y la suscripción.',
      pt: 'Perfil contém os dados da conta, o idioma e a assinatura.',
      ar: 'تحتوي صفحة الملف الشخصي على بيانات الحساب واللغة والاشتراك.'
    },
    language: {
      fr: 'Le site propose FR, EN, ES, PT et AR. Le choix est mémorisé dans le navigateur, et le bouton de langue s’adapte à la langue active.',
      en: 'The site offers FR, EN, ES, PT, and AR. The choice is saved in the browser and the language button adapts.',
      es: 'El sitio ofrece FR, EN, ES, PT y AR. La elección se guarda en el navegador.',
      pt: 'O site oferece FR, EN, ES, PT e AR. A escolha fica salva no navegador.',
      ar: 'يدعم الموقع اللغات FR وEN وES وPT وAR.'
    },
    contact: {
      fr: 'Pour contacter Pikala, utilisez la section Contact du site ou la page Support pour un problème lié à un vélo, une station ou un compte.',
      en: 'Use the Contact section or Support page for bike, station, or account issues.',
      es: 'Usa Contacto o Soporte para problemas de bici, estación o cuenta.',
      pt: 'Use Contato ou Suporte para problemas com bike, estação ou conta.',
      ar: 'استخدم صفحة الاتصال أو الدعم للمشكلات.'
    },
    thanks: {
      fr: 'Avec plaisir. Dites-moi ce que vous voulez faire ensuite.',
      en: 'You are welcome. Tell me what you want to do next.',
      es: 'Con gusto. Dime que quieres hacer ahora.',
      pt: 'De nada. Diga o que você quer fazer agora.',
      ar: 'على الرحب والسعة.'
    }
  };

  const intentRules = [
    { id: 'greeting', words: ['bonjour', 'bjr', 'salut', 'slt', 'hello', 'hi', 'hola', 'ola', 'salam', 'مرحبا'], weight: 4 },
    { id: 'station', words: ['station', 'stations', 'gare', 'proche', 'pres', 'ou', 'map', 'carte', 'localisation', 'kasbah', 'hassan', 'corniche', 'jardin', 'estacion', 'estacoes'], weight: 5 },
    { id: 'availability', words: ['disponible', 'dispo', 'combien', 'nombre', 'velos', 'velo', 'bike', 'bikes', 'bici', 'bicicleta', 'available'], weight: 5 },
    { id: 'scannerIssue', words: ['scan marche pas', 'scanner marche pas', 'qr marche pas', 'scan probleme', 'erreur scan', 'bloque', 'marche pas', 'impossible scanner'], weight: 8 },
    { id: 'scanner', words: ['scanner', 'scan', 'qr', 'code', 'debloquer', 'unlock', 'camera', 'escaner'], weight: 6 },
    { id: 'subscription', words: ['abonnement', 'abonement', 'abonman', 'prix', 'tarif', 'payer', 'paiement', 'mad', 'subscription', 'suscripcion', 'assinatura', 'plan'], weight: 6 },
    { id: 'login', words: ['connexion', 'connection', 'connecter', 'login', 'inscription', 'signup', 'register', 'compte creer', 'mot de passe', 'email'], weight: 6 },
    { id: 'dashboard', words: ['dashboard', 'tableau', 'bord', 'accueil utilisateur', 'espace utilisateur', 'apres connexion'], weight: 5 },
    { id: 'support', words: ['support', 'aide', 'probleme', 'souci', 'panne', 'signaler', 'cassé', 'casse', 'frein', 'roue', 'help', 'soporte', 'suporte'], weight: 6 },
    { id: 'profile', words: ['profil', 'profile', 'perfil', 'information', 'infos', 'langue compte'], weight: 5 },
    { id: 'language', words: ['langue', 'language', 'idioma', 'francais', 'anglais', 'arabe', 'espagnol', 'portugais'], weight: 5 },
    { id: 'contact', words: ['contact', 'contacter', 'telephone', 'mail', 'email pikala'], weight: 5 },
    { id: 'thanks', words: ['merci', 'thanks', 'gracias', 'obrigado', 'choukran'], weight: 4 }
  ];

  const spellingHints = {
    abonement: 'abonnement',
    abonman: 'abonnement',
    abbonement: 'abonnement',
    conection: 'connexion',
    connexionn: 'connexion',
    conecter: 'connecter',
    insription: 'inscription',
    inscrption: 'inscription',
    scaner: 'scanner',
    scanne: 'scanner',
    velo: 'velo',
    velos: 'velos',
    bick: 'bike',
    probleme: 'probleme',
    problem: 'probleme',
    suport: 'support',
    lang: 'langue'
  };

  let lastIntent = '';

  const getLang = () => {
    const saved = localStorage.getItem('pikala-lang');
    const htmlLang = document.documentElement.lang;
    return ui[saved] ? saved : ui[htmlLang] ? htmlLang : 'fr';
  };

  const normalize = (text) => text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const tokenize = (text) => normalize(text)
    .split(' ')
    .map((token) => spellingHints[token] || token)
    .filter((token) => token.length > 1);

  function distance(a, b) {
    if (a === b) return 0;
    if (Math.abs(a.length - b.length) > 2) return 3;
    const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
    for (let i = 1; i <= a.length; i += 1) {
      let last = i - 1;
      previous[0] = i;
      for (let j = 1; j <= b.length; j += 1) {
        const old = previous[j];
        previous[j] = Math.min(
          previous[j] + 1,
          previous[j - 1] + 1,
          last + (a[i - 1] === b[j - 1] ? 0 : 1)
        );
        last = old;
      }
    }
    return previous[b.length];
  }

  function tokenMatches(token, keyword) {
    const cleanKeyword = normalize(keyword);
    if (!cleanKeyword) return false;
    if (cleanKeyword.includes(' ')) return false;
    if (token === cleanKeyword || token.includes(cleanKeyword) || cleanKeyword.includes(token)) return true;
    if (token.length >= 4 && cleanKeyword.length >= 4 && distance(token, cleanKeyword) <= 1) return true;
    if (token.length >= 7 && cleanKeyword.length >= 7 && distance(token, cleanKeyword) <= 2) return true;
    return false;
  }

  function detectIntent(question) {
    const normalizedQuestion = normalize(question);
    const tokens = tokenize(question);
    if (!tokens.length && lastIntent) return lastIntent;

    const scores = intentRules.map((rule) => {
      let score = 0;
      rule.words.forEach((keyword) => {
        const normalizedKeyword = normalize(keyword);
        if (normalizedKeyword.includes(' ')) {
          if (normalizedQuestion.includes(normalizedKeyword)) score += rule.weight + 3;
          return;
        }
        if (tokens.some((token) => tokenMatches(token, normalizedKeyword))) score += rule.weight;
      });
      return { id: rule.id, score };
    }).sort((a, b) => b.score - a.score);

    const best = scores[0];
    if (best?.score >= 4) return best.id;
    if (['oui', 'yes', 'ok', 'daccord', 'comment', 'pourquoi'].some((word) => tokens.includes(word)) && lastIntent) return lastIntent;
    return '';
  }

  function collectPageContext() {
    const nodes = Array.from(document.querySelectorAll('main h1, main h2, main h3, main p, main li, main a, main button'));
    const sentences = nodes
      .filter((node) => !node.closest('.pikala-chatbot'))
      .map((node) => node.textContent.trim())
      .filter((text) => text.length > 12 && text.length < 190)
      .slice(0, 90);
    const links = Array.from(document.querySelectorAll('main a[href], nav a[href]'))
      .filter((link) => !link.closest('.pikala-chatbot'))
      .map((link) => ({ text: link.textContent.trim(), href: link.getAttribute('href') }))
      .filter((link) => link.text && link.href && !link.href.startsWith('#'))
      .slice(0, 8);
    return { sentences, links };
  }

  function pageAnswer(question, labels) {
    const tokens = tokenize(question).filter((token) => token.length > 3);
    if (!tokens.length) return '';
    const { sentences, links } = collectPageContext();
    const scored = sentences
      .map((sentence) => {
        const text = normalize(sentence);
        return { sentence, score: tokens.filter((token) => text.includes(token)).length };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 2);
    if (!scored.length) return '';
    const linkText = links.length
      ? `\n\n${labels.linksIntro} ${links.slice(0, 3).map((link) => `${link.text} (${link.href})`).join(', ')}`
      : '';
    return `${labels.pageMatch}\n${scored.map((item) => `- ${item.sentence}`).join('\n')}${linkText}`;
  }

  function humanize(base, question, lang) {
    const tokens = tokenize(question);
    const wantsAction = tokens.some((token) => ['faire', 'aller', 'ouvrir', 'go', 'open', 'comment', 'how'].includes(token));
    if (!wantsAction) return base;
    const extra = {
      fr: ' Le plus simple : ouvrez le lien correspondant dans le menu, puis suivez l’étape affichée.',
      en: ' Easiest path: open the matching page in the menu and follow the step shown there.',
      es: ' Lo más simple: abre la página correspondiente en el menú y sigue el paso indicado.',
      pt: ' O mais simples: abra a página correspondente no menu e siga o passo indicado.',
      ar: 'افتح الصفحة المناسبة من القائمة، ثم اتبع الخطوة المعروضة.'
    };
    return `${base}${extra[lang] || extra.fr}`;
  }

  function answer(question) {
    const lang = getLang();
    const labels = ui[lang] || ui.fr;
    const intent = detectIntent(question);
    if (intent && answers[intent]) {
      lastIntent = intent;
      return humanize(answers[intent][lang] || answers[intent].fr, question, lang);
    }
    return pageAnswer(question, labels) || labels.fallback;
  }

  function createMessage(container, text, type) {
    const message = document.createElement('div');
    message.className = `chatbot-message ${type}`;
    message.textContent = text;
    container.appendChild(message);
    container.scrollTop = container.scrollHeight;
  }

  function initChatbot() {
    if (document.querySelector('.pikala-chatbot')) return;
    const labels = ui[getLang()] || ui.fr;
    const root = document.createElement('section');
    root.className = 'pikala-chatbot';
    root.setAttribute('aria-label', labels.title);
    root.innerHTML = `
      <div class="chatbot-panel" role="dialog" aria-label="${labels.title}">
        <div class="chatbot-header">
          <div class="chatbot-title">
            <div class="chatbot-avatar" aria-hidden="true">P</div>
            <div><strong></strong><span></span></div>
          </div>
          <button class="chatbot-close" type="button" aria-label="${labels.close}">x</button>
        </div>
        <div class="chatbot-messages" aria-live="polite"></div>
        <div class="chatbot-suggestions"></div>
        <form class="chatbot-form">
          <input type="text" autocomplete="off">
          <button type="submit" aria-label="${labels.send}">></button>
        </form>
      </div>
      <button class="chatbot-toggle" type="button" aria-label="${labels.open}" aria-expanded="false">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M5 6.5C5 4.57 6.57 3 8.5 3h7C17.43 3 19 4.57 19 6.5v5C19 13.43 17.43 15 15.5 15H11l-4.2 3.2c-.66.5-1.6.03-1.6-.8V15.1A3.5 3.5 0 0 1 2 11.62V6.5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
          <path d="M8 8h8M8 11h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
      </button>
    `;

    document.body.appendChild(root);
    const toggle = root.querySelector('.chatbot-toggle');
    const close = root.querySelector('.chatbot-close');
    const form = root.querySelector('.chatbot-form');
    const input = root.querySelector('input');
    const messages = root.querySelector('.chatbot-messages');
    const suggestions = root.querySelector('.chatbot-suggestions');

    const renderLabels = () => {
      const activeLabels = ui[getLang()] || ui.fr;
      root.setAttribute('aria-label', activeLabels.title);
      root.querySelector('.chatbot-panel').setAttribute('aria-label', activeLabels.title);
      root.querySelector('.chatbot-title strong').textContent = activeLabels.title;
      root.querySelector('.chatbot-title span').textContent = activeLabels.subtitle;
      close.setAttribute('aria-label', activeLabels.close);
      toggle.setAttribute('aria-label', activeLabels.open);
      input.placeholder = activeLabels.placeholder;
      suggestions.replaceChildren();
      activeLabels.suggestions.forEach((suggestion) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = suggestion;
        button.addEventListener('click', () => {
          createMessage(messages, suggestion, 'user');
          createMessage(messages, answer(suggestion), 'bot');
        });
        suggestions.appendChild(button);
      });
    };

    renderLabels();
    new MutationObserver(renderLabels).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    createMessage(messages, labels.hello, 'bot');

    toggle.addEventListener('click', () => {
      const isOpen = root.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(isOpen));
      if (isOpen) window.setTimeout(() => input.focus(), 80);
    });

    close.addEventListener('click', () => {
      root.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const question = input.value.trim();
      if (!question) return;
      createMessage(messages, question, 'user');
      input.value = '';
      window.setTimeout(() => createMessage(messages, answer(question), 'bot'), 120);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChatbot);
  } else {
    initChatbot();
  }
})();
