import { SUPPORTED_LOCALES, getDictionary, getLocale, initI18n, t } from './i18n/index.js';
import { initReveals, initTooltips } from './ui/components.js';

const localeLabels = Object.fromEntries(SUPPORTED_LOCALES.map((locale) => [locale, getDictionary(locale).localeName]));

function languageSwitch() {
  const options = SUPPORTED_LOCALES.map((locale) => `<button type="button" data-lang="${locale}">${localeLabels[locale]}</button>`).join('');
  return `<details class="pk-language-switch" data-language-menu><summary data-language-label>${t('languageLabel')} : ${getLocale().toUpperCase()}</summary><div class="pk-language-switch__menu">${options}</div></details>`;
}

function mountLanguageSwitch() {
  if (document.querySelector('[data-language-menu]')) return;
  const host = document.querySelector('[data-layout-actions]') || document.querySelector('.topbar');
  if (!host) return;
  const wrapper = document.createElement('div');
  wrapper.dataset.sharedLanguageSwitch = '';
  wrapper.innerHTML = languageSwitch();
  host.append(wrapper.firstElementChild);
}

function prepareNavigation() {
  const keys = { dashboard: 'navHome', stations: 'navStations', scanner: 'navScanner', profile: 'navProfile', support: 'navSupport', admin: 'navAdmin' };
  document.querySelectorAll('.nav a').forEach((link) => {
    const page = Object.entries({ 'dashboard.html': 'dashboard', 'stations.html': 'stations', 'scanner.html': 'scanner', 'profil.html': 'profile', 'support.html': 'support', 'admin.html': 'admin' }).find(([href]) => link.getAttribute('href') === href)?.[1];
    const key = keys[page];
    if (key) link.dataset.i18n = key;
  });
  document.querySelectorAll('.quick-actions a').forEach((link) => {
    const page = Object.entries({ 'dashboard.html': 'dashboard', 'stations.html': 'stations', 'scanner.html': 'scanner', 'profil.html': 'profile', 'support.html': 'support', 'admin.html': 'admin' }).find(([href]) => link.getAttribute('href') === href)?.[1];
    const key = keys[page];
    const textNode = Array.from(link.childNodes).find((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
    if (!key || !textNode) return;
    const label = document.createElement('em');
    label.dataset.i18n = key;
    label.textContent = textNode.textContent.trim();
    textNode.replaceWith(label);
  });
  document.querySelectorAll('[data-bottom-nav]').forEach((link) => {
    const key = keys[link.dataset.bottomNav];
    const label = link.querySelector('em');
    if (key && label) label.dataset.i18n = key;
  });
  document.querySelectorAll('.bottom-nav').forEach((nav) => {
    nav.dataset.i18nAttr = 'aria-label:userNavLabel';
  });
}

function prepareLayoutClass() {
  const page = document.body.dataset.userPage;
  if (page === 'admin') document.body.classList.add('pk-admin-layout');
  else if (page) document.body.classList.add('pk-user-layout');
  else document.body.classList.add('pk-public-layout');
}

export function initLayout() {
  prepareLayoutClass();
  prepareNavigation();
  mountLanguageSwitch();
  initI18n();
  initTooltips();
  initReveals();
}
