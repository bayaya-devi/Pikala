let toastRegion;

function getToastRegion() {
  if (toastRegion?.isConnected) return toastRegion;
  toastRegion = document.createElement('div');
  toastRegion.className = 'pk-toast-region';
  toastRegion.setAttribute('role', 'status');
  toastRegion.setAttribute('aria-live', 'polite');
  document.body.append(toastRegion);
  return toastRegion;
}

export function showToast(message, { tone = 'info', duration = 4200 } = {}) {
  const toast = document.createElement('div');
  toast.className = 'pk-toast';
  toast.dataset.tone = tone;
  toast.textContent = message;
  getToastRegion().append(toast);
  window.setTimeout(() => toast.remove(), duration);
  return toast;
}

export function openDialog(dialog) {
  if (!(dialog instanceof HTMLDialogElement)) return false;
  dialog.showModal();
  return true;
}

export function closeDialog(dialog) {
  if (!(dialog instanceof HTMLDialogElement)) return false;
  dialog.close();
  return true;
}

export function toggleLayer(element, force) {
  if (!(element instanceof HTMLElement)) return false;
  const open = force ?? !element.classList.contains('is-open');
  element.classList.toggle('is-open', open);
  element.setAttribute('aria-hidden', String(!open));
  return open;
}

export function initTooltips() {
  document.querySelectorAll('[title]').forEach((element) => {
    if (!element.dataset.tooltip) element.dataset.tooltip = element.title;
    element.classList.add('pk-tooltip');
  });
}

export function initReveals(root = document) {
  const elements = root.querySelectorAll('[data-reveal], .user-reveal');
  if (!elements.length) return;
  elements.forEach((element) => element.classList.add('pk-reveal'));
  if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    elements.forEach((element) => element.classList.add('is-visible'));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -24px' });
  elements.forEach((element) => observer.observe(element));
}
