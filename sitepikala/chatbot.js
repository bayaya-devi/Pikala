(function () {
  const ui = {
    fr: {
      title: 'Assistant Pikala',
      subtitle: 'Je reponds directement',
      placeholder: 'Ex: velo proche, scan marche pas...',
      send: 'Envoyer',
      close: 'Fermer',
      open: 'Ouvrir le chat',
      hello: 'Bonjour. Je suis l assistant Pikala. Ecrivez meme une phrase courte ou avec des fautes, je vais essayer de comprendre.',
      fallback: 'Je ne suis pas encore sur a 100%. Demandez-moi par exemple : station proche, prix abonnement, scanner QR, connexion, support ou probleme velo.',
      pageMatch: 'Sur cette page, je vois surtout :',
      linksIntro: 'Vous pouvez aussi ouvrir :',
      suggestions: ['Velo proche', 'Scanner QR', 'Prix abonnement', 'Probleme velo']
    },
    en: {
      title: 'Pikala Assistant',
      subtitle: 'Direct answers',
      placeholder: 'Try: near bike, scan issue...',
      send: 'Send',
      close: 'Close',
      open: 'Open chat',
      hello: 'Hi. I am the Pikala assistant. You can type short or imperfect sentences, I will try to understand.',
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
      hello: 'Hola. Soy el asistente Pikala. Puedes escribir frases cortas o con errores, intentare entender.',
      fallback: 'Todavia no estoy seguro. Preguntame por estacion cercana, precio, escaner QR, conexion, soporte o problema con bici.',
      pageMatch: 'En esta pagina veo sobre todo:',
      linksIntro: 'Tambien puedes abrir:',
      suggestions: ['Bici cerca', 'Escaner QR', 'Precio', 'Problema bici']
    },
    pt: {
      title: 'Assistente Pikala',
      subtitle: 'Respostas diretas',
      placeholder: 'Ex: bike perto, erro QR...',
      send: 'Enviar',
      close: 'Fechar',
      open: 'Abrir chat',
      hello: 'Ola. Sou o assistente Pikala. Pode escrever frases curtas ou com erros, vou tentar entender.',
      fallback: 'Ainda nao tenho certeza. Pergunte sobre estacao perto, preco, scanner QR, login, suporte ou problema com bicicleta.',
      pageMatch: 'Nesta pagina, vejo principalmente:',
      linksIntro: 'Voce tambem pode abrir:',
      suggestions: ['Bike perto', 'Scanner QR', 'Preco', 'Problema bike']
    },
    ar: {
      title: 'Pikala Assistant',
      subtitle: 'Quick answers',
      placeholder: 'Ask about station, QR, price...',
      send: 'Send',
      close: 'Close',
      open: 'Open chat',
      hello: 'Hello. I am the Pikala assistant. You can ask short questions and I will try to understand.',
      fallback: 'I am not fully sure yet. Ask about stations, QR scanner, price, login, support, or bike problems.',
      pageMatch: 'On this page, I mostly see:',
      linksIntro: 'You can also open:',
      suggestions: ['Stations', 'QR scanner', 'Price', 'Support']
    }
  };

  const answers = {
    greeting: {
      fr: 'Bonjour. Je peux vous aider rapidement : trouver une station, comprendre le scanner, voir le prix, gerer le compte ou signaler un probleme.',
      en: 'Hi. I can help you find a station, understand the scanner, check pricing, manage your account, or report a problem.',
      es: 'Hola. Puedo ayudarte con estaciones, escaner, precio, cuenta o soporte.',
      pt: 'Ola. Posso ajudar com estacoes, scanner, preco, conta ou suporte.',
      ar: 'Hello. I can help with stations, scanner, price, account, or support.'
    },
    station: {
      fr: 'Pour trouver un velo, ouvrez Stations. Vous verrez les points comme Kasbah des Oudayas, Tour Hassan, Jardins et Corniche avec le nombre de velos disponibles.',
      en: 'Open Stations to find a bike. You will see places like Kasbah, Hassan Tower, Gardens, and Corniche with available bikes.',
      es: 'Abre Estaciones para encontrar una bici. Veras los puntos disponibles y el numero de bicicletas.',
      pt: 'Abra Estacoes para encontrar uma bike. Voce vera os pontos e o numero de bicicletas disponiveis.',
      ar: 'Open Stations to find available bikes near you.'
    },
    availability: {
      fr: 'Actuellement le site montre des disponibilites de demonstration : 8 velos a Kasbah, 3 a Tour Hassan, 12 aux Jardins et 5 a la Corniche.',
      en: 'The site currently shows demo availability: 8 bikes at Kasbah, 3 at Hassan Tower, 12 at Gardens, and 5 at Corniche.',
      es: 'El sitio muestra datos de prueba: 8 bicis en Kasbah, 3 en Torre Hassan, 12 en Jardines y 5 en Corniche.',
      pt: 'O site mostra dados de demonstracao: 8 bikes em Kasbah, 3 na Torre Hassan, 12 nos Jardins e 5 na Corniche.',
      ar: 'The site currently shows demo bike availability by station.'
    },
    scanner: {
      fr: 'Le scanner sert a debloquer un velo avec son QR code. Pour l instant, la page Scanner simule le parcours. Plus tard, on pourra connecter la camera et une vraie base de donnees.',
      en: 'The scanner unlocks a bike with its QR code. For now, the Scanner page simulates the flow. Later it can connect to camera and database.',
      es: 'El escaner desbloquea una bici con QR. Por ahora la pagina simula el recorrido; luego se puede conectar camara y base de datos.',
      pt: 'O scanner desbloqueia uma bike por QR. Por enquanto a pagina simula o fluxo; depois pode ligar camera e banco de dados.',
      ar: 'The scanner unlocks a bike with QR. It is currently simulated.'
    },
    scannerIssue: {
      fr: 'Si le scan ne marche pas : verifiez la lumiere, nettoyez le QR, rapprochez le telephone, puis essayez un autre velo. Si ca bloque encore, ouvrez Support et signalez le numero du velo.',
      en: 'If scanning fails: check light, clean the QR, move closer, then try another bike. If it still fails, open Support and report the bike number.',
      es: 'Si el escaneo falla: revisa la luz, limpia el QR, acerca el telefono y prueba otra bici. Si sigue, abre Soporte.',
      pt: 'Se o scan falhar: verifique a luz, limpe o QR, aproxime o telefone e tente outra bike. Se continuar, abra Suporte.',
      ar: 'If scanning fails, check light, clean QR, move closer, or report it in Support.'
    },
    subscription: {
      fr: 'Apres inscription, vous arrivez sur Abonnement. La formule de demonstration affiche 200 MAD par mois, puis vous pouvez aller au tableau de bord.',
      en: 'After signup, you land on Subscription. The demo plan shows 200 MAD/month, then you can continue to the dashboard.',
      es: 'Despues del registro llegas a Suscripcion. El plan demo muestra 200 MAD/mes y luego puedes ir al panel.',
      pt: 'Depois do cadastro voce chega em Assinatura. O plano demo mostra 200 MAD/mes e depois vai ao painel.',
      ar: 'After signup, the subscription page shows the demo plan at 200 MAD/month.'
    },
    login: {
      fr: 'Le parcours est simple : inscription vers Abonnement, connexion vers Tableau de bord. Pour tester, remplissez le formulaire avec un email valide et un mot de passe de 8 caracteres minimum.',
      en: 'Flow is simple: signup goes to Subscription, login goes to Dashboard. Use a valid email and an 8-character password to test.',
      es: 'El recorrido: registro a Suscripcion, conexion a Panel. Usa email valido y una contrasena de 8 caracteres.',
      pt: 'Fluxo: cadastro para Assinatura, login para Painel. Use email valido e senha com 8 caracteres.',
      ar: 'Signup goes to Subscription, login goes to Dashboard.'
    },
    dashboard: {
      fr: 'Le tableau de bord donne acces a Stations, Scanner, Profil et Support. C est la page principale apres connexion.',
      en: 'The dashboard gives access to Stations, Scanner, Profile, and Support. It is the main page after login.',
      es: 'El panel da acceso a Estaciones, Escaner, Perfil y Soporte.',
      pt: 'O painel da acesso a Estacoes, Scanner, Perfil e Suporte.',
      ar: 'Dashboard gives access to Stations, Scanner, Profile, and Support.'
    },
    support: {
      fr: 'Pour un probleme, allez sur Support. Indiquez le numero du velo ou la station, puis decrivez le souci : frein, QR, roue, station pleine, etc.',
      en: 'For a problem, open Support. Add bike number or station, then describe the issue: brake, QR, wheel, full station, etc.',
      es: 'Para un problema, abre Soporte. Indica numero de bici o estacion y describe el problema.',
      pt: 'Para problema, abra Suporte. Informe numero da bike ou estacao e descreva o problema.',
      ar: 'For problems, open Support and describe the bike or station issue.'
    },
    profile: {
      fr: 'La page Profil contient les informations du compte, la langue et l abonnement. Plus tard, elle pourra afficher les vraies donnees utilisateur depuis la base.',
      en: 'Profile contains account details, language, and subscription. Later it can show real database data.',
      es: 'Perfil contiene datos de cuenta, idioma y suscripcion.',
      pt: 'Perfil contem dados da conta, idioma e assinatura.',
      ar: 'Profile contains account details, language, and subscription.'
    },
    language: {
      fr: 'Le site propose FR, EN, ES, PT et AR. Le choix est memorise dans le navigateur et le bouton langue s adapte a la langue active.',
      en: 'The site offers FR, EN, ES, PT, and AR. The choice is saved in the browser and the language button adapts.',
      es: 'El sitio ofrece FR, EN, ES, PT y AR. La eleccion se guarda en el navegador.',
      pt: 'O site oferece FR, EN, ES, PT e AR. A escolha fica salva no navegador.',
      ar: 'The site supports FR, EN, ES, PT, and AR.'
    },
    contact: {
      fr: 'Pour contacter Pikala, utilisez la section Contact du site ou la page Support pour un probleme lie a un velo, une station ou un compte.',
      en: 'Use the Contact section or Support page for bike, station, or account issues.',
      es: 'Usa Contacto o Soporte para problemas de bici, estacion o cuenta.',
      pt: 'Use Contato ou Suporte para problemas com bike, estacao ou conta.',
      ar: 'Use Contact or Support for issues.'
    },
    thanks: {
      fr: 'Avec plaisir. Dites-moi ce que vous voulez faire ensuite.',
      en: 'You are welcome. Tell me what you want to do next.',
      es: 'Con gusto. Dime que quieres hacer ahora.',
      pt: 'De nada. Diga o que voce quer fazer agora.',
      ar: 'You are welcome.'
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
      fr: ' Le plus simple : ouvrez le lien correspondant dans le menu, puis suivez l etape affichee.',
      en: ' Easiest path: open the matching page in the menu and follow the step shown there.',
      es: ' Lo mas simple: abre la pagina correspondiente en el menu y sigue el paso indicado.',
      pt: ' O mais simples: abra a pagina correspondente no menu e siga o passo indicado.',
      ar: ' Open the matching page in the menu and follow the step shown there.'
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
