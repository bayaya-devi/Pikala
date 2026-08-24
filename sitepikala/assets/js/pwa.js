const secureContext = location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname);

if ('serviceWorker' in navigator && secureContext) {
  addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // L'application reste utilisable en ligne lorsque l'enregistrement est refuse.
    });
  }, { once: true });
}
