import fr from './locales/fr.js';
import en from './locales/en.js';
import es from './locales/es.js';
import pt from './locales/pt.js';
import ar from './locales/ar.js';
import pageCopy from './page-copy.js';
import homeCopy from './homepage/copy.js';
import authCopy from './authentication/copy.js';
import userSpaceCopy from './user-space/copy.js';
import realRideCopy from './real-rides/copy.js';
import subscriptionCopy from './subscriptions/copy.js';
import adminCopy from './admin/copy.js';
import adminOperationsCopy from './admin/operations.js';
import operationsCopy from './operations/copy.js';
import operationsErrors from './operations/errors.js';

export const SUPPORTED_LOCALES = Object.freeze(['fr', 'en', 'es', 'pt', 'ar']);
export const RTL_LOCALES = Object.freeze(['ar']);
export const dictionaries = Object.freeze({
  fr: { ...fr, ...pageCopy.fr, ...homeCopy.fr, ...authCopy.fr, ...userSpaceCopy.fr, ...realRideCopy.fr, ...subscriptionCopy.fr, ...adminCopy.fr, ...adminOperationsCopy.fr, ...operationsCopy.fr, ...operationsErrors.fr },
  en: { ...en, ...pageCopy.en, ...homeCopy.en, ...authCopy.en, ...userSpaceCopy.en, ...realRideCopy.en, ...subscriptionCopy.en, ...adminCopy.en, ...adminOperationsCopy.en, ...operationsCopy.en, ...operationsErrors.en },
  es: { ...es, ...pageCopy.es, ...homeCopy.es, ...authCopy.es, ...userSpaceCopy.es, ...realRideCopy.es, ...subscriptionCopy.es, ...adminCopy.es, ...adminOperationsCopy.es, ...operationsCopy.es, ...operationsErrors.es },
  pt: { ...pt, ...pageCopy.pt, ...homeCopy.pt, ...authCopy.pt, ...userSpaceCopy.pt, ...realRideCopy.pt, ...subscriptionCopy.pt, ...adminCopy.pt, ...adminOperationsCopy.pt, ...operationsCopy.pt, ...operationsErrors.pt },
  ar: { ...ar, ...pageCopy.ar, ...homeCopy.ar, ...authCopy.ar, ...userSpaceCopy.ar, ...realRideCopy.ar, ...subscriptionCopy.ar, ...adminCopy.ar, ...adminOperationsCopy.ar, ...operationsCopy.ar, ...operationsErrors.ar }
});

const STORAGE_KEY = 'pikala-lang';
let currentLocale = 'fr';

function normalizeLocale(value) {
  const candidate = String(value || '').toLowerCase().split('-')[0];
  return SUPPORTED_LOCALES.includes(candidate) ? candidate : null;
}

export function detectLocale() {
  const query = normalizeLocale(new URLSearchParams(window.location.search).get('lang'));
  const stored = normalizeLocale(window.localStorage.getItem(STORAGE_KEY));
  const browser = normalizeLocale(navigator.languages?.[0] || navigator.language);
  return query || stored || browser || 'fr';
}

export function getLocale() { return currentLocale; }
export function getDictionary(locale = currentLocale) { return dictionaries[normalizeLocale(locale) || 'fr']; }

export function t(key, variables = {}, locale = currentLocale) {
  const value = getDictionary(locale)[key] ?? dictionaries.fr[key] ?? key;
  return String(value).replace(/\{(\w+)\}/g, (_, name) => String(variables[name] ?? `{${name}}`));
}

function translateAttributes(root) {
  root.querySelectorAll('[data-i18n-attr]').forEach((element) => {
    const declarations = element.dataset.i18nAttr.split(',');
    declarations.forEach((declaration) => {
      const [attribute, key] = declaration.split(':').map((part) => part.trim());
      if (attribute && key) element.setAttribute(attribute, t(key));
    });
  });
}

export function translateDocument(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((element) => {
    const key = element.dataset.i18n;
    if (key) element.textContent = t(key);
  });
  translateAttributes(root);
  root.querySelectorAll('[data-lang]').forEach((button) => {
    const active = button.dataset.lang === currentLocale;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  root.querySelectorAll('[data-language-label], [data-language-menu] > summary').forEach((element) => {
    element.textContent = `${t('languageLabel')} : ${currentLocale.toUpperCase()}`;
  });
}

export function setLocale(locale, { persist = true } = {}) {
  currentLocale = normalizeLocale(locale) || 'fr';
  const rtl = RTL_LOCALES.includes(currentLocale);
  document.documentElement.lang = currentLocale;
  document.documentElement.dir = rtl ? 'rtl' : 'ltr';
  document.body?.classList.toggle('is-rtl', rtl);
  if (persist) window.localStorage.setItem(STORAGE_KEY, currentLocale);
  translateDocument();
  document.dispatchEvent(new CustomEvent('pikala:localechange', { detail: { locale: currentLocale, rtl } }));
  return currentLocale;
}

function wireLanguageMenus() {
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-lang]');
    if (!button) return;
    setLocale(button.dataset.lang);
    const details = button.closest('details');
    if (details) details.open = false;
  });
}

export function initI18n() {
  wireLanguageMenus();
  return setLocale(detectLocale(), { persist: true });
}
