import { t } from './assets/js/i18n/index.js';
import { initLayout } from './assets/js/layouts.js';

const header = document.querySelector('[data-header]');
const menuButton = document.querySelector('[data-menu-button]');
const siteNav = document.querySelector('[data-site-nav]');

function setHeaderState() {
  header?.classList.toggle('scrolled', window.scrollY > 12);
}

function closeMenu() {
  siteNav?.classList.remove('open');
  menuButton?.setAttribute('aria-expanded', 'false');
}

function updateLocalizedLinks() {
  document.title = t('title');
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
document.addEventListener('pikala:localechange', updateLocalizedLinks);
initLayout();
updateLocalizedLinks();

const revealGroups = ['.hero-copy', '.hero-media', '.hero-card', '.stat', '.confidence-item', '.section-intro', '.step-card', '.destination-card', '.price-card', '.phone', '.contact-inner', '.legal-block'];
document.querySelectorAll(revealGroups.join(',')).forEach((item, index) => {
  item.classList.add('reveal');
  const explicitDelay = Number(item.getAttribute('data-delay')) || 0;
  item.style.setProperty('--delay', `${explicitDelay || Math.min(index % 4, 3) * 90}ms`);
});

const counterState = new WeakSet();
function animateCounter(element) {
  if (counterState.has(element)) return;
  counterState.add(element);
  const target = Number(element.getAttribute('data-count')) || 0;
  const duration = 1100;
  const start = performance.now();
  const tick = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    element.textContent = String(Math.round(target * (1 - Math.pow(1 - progress, 3))));
    if (progress < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

const revealItems = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      entry.target.querySelectorAll('[data-count]').forEach(animateCounter);
      if (entry.target.matches('[data-count]')) animateCounter(entry.target);
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.18, rootMargin: '0px 0px -40px' });
  revealItems.forEach((item) => observer.observe(item));
  document.querySelectorAll('[data-count]').forEach((item) => observer.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add('is-visible'));
  document.querySelectorAll('[data-count]').forEach(animateCounter);
}
