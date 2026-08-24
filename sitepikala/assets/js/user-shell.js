const primaryItems = [
  ['dashboard', 'dashboard.html', 'house', 'userNavHome'],
  ['stations', 'stations.html', 'map', 'userNavMap'],
  ['scanner', 'scanner.html', 'scan-line', 'userNavScanner'],
  ['rides', 'trajets.html', 'route', 'userNavRides'],
  ['profile', 'profil.html', 'user-round', 'userNavProfile']
];

function navigationItem([page, href, icon, key], current, mobile = false) {
  const active = page === current;
  const className = `${mobile ? 'user-bottom-link' : 'user-side-link'}${page === 'scanner' ? ' is-scanner' : ''}${active ? ' is-active' : ''}`;
  return `<a class="${className}" href="${href}"${active ? ' aria-current="page"' : ''} data-user-destination="${page}">
    <i data-lucide="${icon}" aria-hidden="true"></i><span data-i18n="${key}">${page}</span>
  </a>`;
}

export function mountUserShell() {
  const host = document.querySelector('[data-user-shell]');
  if (!host) return;
  const current = document.body.dataset.userPage || 'dashboard';
  host.innerHTML = `
    <aside class="user-sidebar">
      <a class="user-brand" href="index.html"><img src="logo.jpeg" alt="Pikala"><strong>Pikala</strong></a>
      <nav class="user-side-nav" data-i18n-attr="aria-label:userNavigationLabel">
        ${primaryItems.map((item) => navigationItem(item, current)).join('')}
      </nav>
      <div class="user-side-utility">
        <a href="abonnement.html"><i data-lucide="credit-card" aria-hidden="true"></i><span data-i18n="userSubscription">Abonnement</span></a>
        <a href="support.html"><i data-lucide="life-buoy" aria-hidden="true"></i><span data-i18n="userSupport">Support</span></a>
        <a class="is-hidden" href="admin.html" data-admin-link><i data-lucide="shield-check" aria-hidden="true"></i><span data-i18n="navAdmin">Admin</span></a>
      </div>
    </aside>
    <nav class="user-bottom-nav" data-i18n-attr="aria-label:userNavigationLabel">
      ${primaryItems.map((item) => navigationItem(item, current, true)).join('')}
    </nav>`;
  window.lucide?.createIcons({ attrs: { 'stroke-width': 2 } });
}

export function refreshUserIcons(root = document) {
  window.lucide?.createIcons({ attrs: { 'stroke-width': 2 }, root });
}
