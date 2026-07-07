(function () {
  const dictionary = {
    fr: {
      title: 'Assistant Pikala',
      subtitle: 'Réponses rapides',
      placeholder: 'Posez une question...',
      send: 'Envoyer',
      close: 'Fermer',
      open: 'Ouvrir le chat',
      hello: 'Bonjour, je suis l’assistant Pikala. Je peux vous aider avec les stations, le scanner, l’abonnement, le profil ou le support.',
      fallback: 'Je n’ai pas encore une réponse parfaite, mais voici ce que je peux faire : consulter les stations, expliquer le scanner, aider avec l’abonnement ou vous orienter vers le support.',
      pageMatch: 'Sur cette page, j’ai trouvé ceci :',
      linksIntro: 'Liens utiles :',
      suggestions: ['Stations', 'Scanner', 'Abonnement', 'Support'],
      topics: {
        station: 'Les stations affichent les vélos disponibles et leur état. Depuis le tableau de bord, ouvrez “Stations” pour choisir le point le plus proche.',
        scanner: 'Le scanner sert à débloquer un vélo avec son QR code. La page actuelle simule le parcours avant l’ajout du vrai scanner caméra.',
        abonnement: 'Après inscription, Pikala vous propose une page abonnement. Vous pouvez activer la formule ou passer vers le tableau de bord.',
        profil: 'La page Profil regroupe vos informations, votre langue et l’état de votre abonnement.',
        support: 'Le support sert à signaler un problème avec un vélo, une station ou le scanner.',
        login: 'Après connexion, vous arrivez sur le tableau de bord. Après inscription, vous arrivez sur la page Abonnement.',
        language: 'Le site garde la langue choisie et adapte les textes principaux selon la langue active.'
      }
    },
    en: {
      title: 'Pikala Assistant',
      subtitle: 'Quick answers',
      placeholder: 'Ask a question...',
      send: 'Send',
      close: 'Close',
      open: 'Open chat',
      hello: 'Hi, I am the Pikala assistant. I can help with stations, scanner, subscription, profile, or support.',
      fallback: 'I do not have a perfect answer yet, but I can help with stations, scanner, subscription, or support.',
      pageMatch: 'On this page, I found this:',
      linksIntro: 'Useful links:',
      suggestions: ['Stations', 'Scanner', 'Subscription', 'Support'],
      topics: {
        station: 'Stations show available bikes and their status. From the dashboard, open “Stations” to choose the closest point.',
        scanner: 'The scanner unlocks a bike with its QR code. The current page simulates the flow before the real camera scanner is added.',
        abonnement: 'After signup, Pikala shows a subscription page. You can activate the plan or continue to the dashboard.',
        profil: 'The profile page gathers your information, language, and subscription status.',
        support: 'Support lets you report a bike, station, or scanner issue.',
        login: 'After login, you land on the dashboard. After signup, you land on the subscription page.',
        language: 'The site remembers the selected language and adapts key text to the active language.'
      }
    },
    es: {
      title: 'Asistente Pikala',
      subtitle: 'Respuestas rápidas',
      placeholder: 'Haz una pregunta...',
      send: 'Enviar',
      close: 'Cerrar',
      open: 'Abrir chat',
      hello: 'Hola, soy el asistente Pikala. Puedo ayudar con estaciones, escáner, suscripción, perfil o soporte.',
      fallback: 'Todavía no tengo una respuesta perfecta, pero puedo ayudar con estaciones, escáner, suscripción o soporte.',
      pageMatch: 'En esta página encontré esto:',
      linksIntro: 'Enlaces útiles:',
      suggestions: ['Estaciones', 'Escáner', 'Suscripción', 'Soporte'],
      topics: {
        station: 'Las estaciones muestran bicicletas disponibles y su estado. Desde el panel, abre “Estaciones” para elegir el punto más cercano.',
        scanner: 'El escáner desbloquea una bicicleta con su código QR. La página actual simula el recorrido antes de añadir la cámara real.',
        abonnement: 'Después del registro, Pikala muestra una página de suscripción. Puedes activar el plan o continuar al panel.',
        profil: 'La página de perfil reúne tu información, idioma y estado de suscripción.',
        support: 'Soporte permite reportar un problema con una bicicleta, estación o escáner.',
        login: 'Después de iniciar sesión llegas al panel. Después del registro llegas a la página de suscripción.',
        language: 'El sitio recuerda el idioma elegido y adapta los textos principales.'
      }
    },
    pt: {
      title: 'Assistente Pikala',
      subtitle: 'Respostas rápidas',
      placeholder: 'Faça uma pergunta...',
      send: 'Enviar',
      close: 'Fechar',
      open: 'Abrir chat',
      hello: 'Olá, sou o assistente Pikala. Posso ajudar com estações, scanner, assinatura, perfil ou suporte.',
      fallback: 'Ainda não tenho uma resposta perfeita, mas posso ajudar com estações, scanner, assinatura ou suporte.',
      pageMatch: 'Nesta página, encontrei isto:',
      linksIntro: 'Links úteis:',
      suggestions: ['Estações', 'Scanner', 'Assinatura', 'Suporte'],
      topics: {
        station: 'As estações mostram bicicletas disponíveis e seu estado. No painel, abra “Estações” para escolher o ponto mais próximo.',
        scanner: 'O scanner desbloqueia uma bicicleta com o QR code. A página atual simula o fluxo antes do scanner real por câmera.',
        abonnement: 'Após o cadastro, a Pikala mostra uma página de assinatura. Você pode ativar o plano ou continuar para o painel.',
        profil: 'A página Perfil reúne suas informações, idioma e status da assinatura.',
        support: 'O suporte permite relatar um problema com bicicleta, estação ou scanner.',
        login: 'Após entrar, você chega ao painel. Após o cadastro, chega à página de assinatura.',
        language: 'O site lembra o idioma escolhido e adapta os principais textos.'
      }
    },
    ar: {
      title: 'مساعد بيكالا',
      subtitle: 'إجابات سريعة',
      placeholder: 'اكتب سؤالك...',
      send: 'إرسال',
      close: 'إغلاق',
      open: 'فتح المحادثة',
      hello: 'مرحبا، أنا مساعد بيكالا. أستطيع مساعدتك في المحطات والماسح والاشتراك والملف الشخصي والدعم.',
      fallback: 'ليست لدي إجابة مثالية بعد، لكن يمكنني مساعدتك في المحطات أو الماسح أو الاشتراك أو الدعم.',
      pageMatch: 'وجدت في هذه الصفحة:',
      linksIntro: 'روابط مفيدة:',
      suggestions: ['المحطات', 'الماسح', 'الاشتراك', 'الدعم'],
      topics: {
        station: 'تعرض المحطات الدراجات المتاحة وحالتها. من لوحة التحكم افتح صفحة المحطات لاختيار أقرب نقطة.',
        scanner: 'يستعمل الماسح لفتح الدراجة عبر رمز QR. الصفحة الحالية تحاكي المسار قبل إضافة ماسح الكاميرا الحقيقي.',
        abonnement: 'بعد إنشاء الحساب تظهر صفحة الاشتراك. يمكنك تفعيل الخطة أو المتابعة إلى لوحة التحكم.',
        profil: 'تجمع صفحة الملف الشخصي معلوماتك واللغة وحالة الاشتراك.',
        support: 'يساعدك الدعم على الإبلاغ عن مشكلة في دراجة أو محطة أو ماسح.',
        login: 'بعد تسجيل الدخول تصل إلى لوحة التحكم. بعد التسجيل تصل إلى صفحة الاشتراك.',
        language: 'يحفظ الموقع اللغة المختارة ويغير النصوص الأساسية حسبها.'
      }
    }
  };

  const topicWords = {
    station: ['station', 'stations', 'gare', 'map', 'carte', 'vélo proche', 'bicicleta', 'estación', 'estações', 'محطة', 'المحطات'],
    scanner: ['scanner', 'scan', 'qr', 'code', 'débloquer', 'desbloquear', 'escáner', 'ماسح'],
    abonnement: ['abonnement', 'subscription', 'suscripción', 'assinatura', 'prix', 'tarif', 'paiement', 'اشتراك'],
    profil: ['profil', 'profile', 'perfil', 'compte', 'account', 'حساب'],
    support: ['support', 'aide', 'problème', 'signaler', 'help', 'soporte', 'suporte', 'دعم'],
    login: ['connexion', 'login', 'inscription', 'signup', 'register', 'connecter', 'تسجيل'],
    language: ['langue', 'language', 'idioma', 'arabe', 'anglais', 'français', 'اللغة']
  };

  const getLang = () => {
    const saved = localStorage.getItem('pikala-lang');
    const htmlLang = document.documentElement.lang;
    return dictionary[saved] ? saved : dictionary[htmlLang] ? htmlLang : 'fr';
  };

  const normalize = (text) => text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  function collectPageContext() {
    const nodes = Array.from(document.querySelectorAll('main h1, main h2, main h3, main p, main li, main a, main button'));
    const sentences = nodes
      .filter((node) => !node.closest('.pikala-chatbot'))
      .map((node) => node.textContent.trim())
      .filter((text) => text.length > 12 && text.length < 180)
      .slice(0, 80);
    const links = Array.from(document.querySelectorAll('main a[href], nav a[href]'))
      .filter((link) => !link.closest('.pikala-chatbot'))
      .map((link) => ({ text: link.textContent.trim(), href: link.getAttribute('href') }))
      .filter((link) => link.text && link.href && !link.href.startsWith('#'))
      .slice(0, 8);
    return { sentences, links };
  }

  function findTopic(question) {
    const normalized = normalize(question);
    return Object.entries(topicWords).find(([, words]) => words.some((word) => normalized.includes(normalize(word))))?.[0];
  }

  function findPageAnswer(question, labels) {
    const { sentences, links } = collectPageContext();
    const terms = normalize(question).split(' ').filter((term) => term.length > 3);
    const scored = sentences
      .map((sentence) => {
        const text = normalize(sentence);
        return { sentence, score: terms.filter((term) => text.includes(term)).length };
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

  function createMessage(container, text, type) {
    const message = document.createElement('div');
    message.className = `chatbot-message ${type}`;
    message.textContent = text;
    container.appendChild(message);
    container.scrollTop = container.scrollHeight;
  }

  function answer(question) {
    const lang = getLang();
    const labels = dictionary[lang] || dictionary.fr;
    const topic = findTopic(question);
    if (topic && labels.topics[topic]) return labels.topics[topic];
    return findPageAnswer(question, labels) || labels.fallback;
  }

  function initChatbot() {
    if (document.querySelector('.pikala-chatbot')) return;
    const lang = getLang();
    const labels = dictionary[lang] || dictionary.fr;
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
          <button class="chatbot-close" type="button" aria-label="${labels.close}">×</button>
        </div>
        <div class="chatbot-messages" aria-live="polite"></div>
        <div class="chatbot-suggestions"></div>
        <form class="chatbot-form">
          <input type="text" autocomplete="off">
          <button type="submit" aria-label="${labels.send}">➜</button>
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
      const activeLabels = dictionary[getLang()] || dictionary.fr;
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
      window.setTimeout(() => createMessage(messages, answer(question), 'bot'), 160);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChatbot);
  } else {
    initChatbot();
  }
})();
