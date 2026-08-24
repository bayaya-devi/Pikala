import { getLocale } from './i18n/index.js';

function node(tag, className, content) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (content !== undefined) element.textContent = content;
  return element;
}

function localizedPlan(plan) {
  const copy = plan.translations?.[getLocale()] || plan.translations?.fr || {};
  return { name: copy.name || plan.name, description: copy.description || plan.description, benefits: copy.benefits || plan.benefits || [] };
}

function dateLabel(value) {
  if (!value) return '';
  const date = new Date(String(value).endsWith('Z') ? value : `${String(value).replace(' ', 'T')}Z`);
  return Number.isNaN(date.valueOf()) ? '' : new Intl.DateTimeFormat(getLocale(), { dateStyle: 'medium' }).format(date);
}

function money(plan) {
  return new Intl.NumberFormat(getLocale(), { style: 'currency', currency: plan.currency || 'MAD', maximumFractionDigits: 2 }).format(Number(plan.amountMinor || 0) / 100);
}

function paymentStatusKey(status) {
  return `subscriptionPayment${String(status || 'pending').replace(/^./, (letter) => letter.toUpperCase())}`;
}

function subscriptionStatusKey(status) {
  return `subscriptionStatus${String(status || 'pending').replace(/^./, (letter) => letter.toUpperCase())}`;
}

export function createSubscriptionFlows({ api, requireUser, t, showToast, refreshIcons }) {
  let plans = [];
  let overview = null;
  let selectedSlug = null;
  let pollingTimer = null;

  function planBySlug(slug) { return plans.find((plan) => plan.slug === slug); }

  function heading(title, copy) {
    const wrapper = node('div', 'subscription-section-heading');
    wrapper.append(node('h2', '', title));
    if (copy) wrapper.append(node('p', 'muted', copy));
    return wrapper;
  }

  function currentSection() {
    const section = node('section', 'surface subscription-current user-reveal');
    section.append(heading(t('subscriptionCurrent')));
    const active = overview.active;
    if (!active) {
      section.append(node('h3', '', t('subscriptionNoActive')), node('p', 'muted', t('subscriptionNoActiveCopy')));
      return section;
    }
    const plan = localizedPlan({ name: active.plan_name, translations: active.translations });
    const row = node('div', 'subscription-current-row');
    const copy = node('div');
    copy.append(node('h3', '', plan.name), node('p', 'muted', active.cancel_at_period_end
      ? t('subscriptionCancelledAtEnd', { date: dateLabel(active.current_period_end) })
      : t('subscriptionActiveUntil', { date: dateLabel(active.current_period_end) })));
    row.append(copy);
    if (active.auto_renew && !active.cancel_at_period_end) {
      const cancel = node('button', 'button secondary', t('subscriptionCancel'));
      cancel.type = 'button';
      cancel.addEventListener('click', () => cancelRenewal(active.id, cancel));
      row.append(cancel);
    }
    section.append(row);
    (overview.scheduled || []).forEach((scheduled) => {
      const scheduledPlan = localizedPlan({ name: scheduled.plan_name, translations: scheduled.translations });
      const notice = node('div', 'subscription-scheduled');
      notice.append(node('strong', '', t('subscriptionScheduled')), node('span', '', `${scheduledPlan.name} · ${t('subscriptionStartsOn', { date: dateLabel(scheduled.current_period_start) })}`));
      section.append(notice);
    });
    return section;
  }

  function planCard(plan) {
    const copy = localizedPlan(plan);
    const article = node('article', `subscription-plan${plan.featured ? ' is-featured' : ''}`);
    if (plan.featured) article.append(node('span', 'status-badge', t('subscriptionRecommended')));
    article.append(node('h3', '', copy.name), node('p', 'muted plan-description', copy.description));
    const price = node('p', 'subscription-price');
    price.append(node('strong', '', money(plan)), node('span', '', ` / ${t('subscriptionDuration', { days: plan.durationDays })}`));
    article.append(price);
    const list = node('ul', 'subscription-benefits');
    copy.benefits.forEach((benefit) => { const item = node('li'); const icon = node('i'); icon.dataset.lucide = 'check'; item.append(icon, document.createTextNode(benefit)); list.append(item); });
    article.append(list);
    const choose = node('button', plan.featured ? 'button primary' : 'button secondary', overview.active ? t('subscriptionRenew') : t('subscriptionChoose'));
    choose.type = 'button'; choose.addEventListener('click', () => selectPlan(plan.slug)); article.append(choose);
    return article;
  }

  function offersSection() {
    const section = node('section', 'subscription-offers user-reveal');
    section.append(heading(t('subscriptionOffers'), t('subscriptionOffersCopy')));
    const grid = node('div', 'subscription-plan-grid'); plans.forEach((plan) => grid.append(planCard(plan))); section.append(grid);
    return section;
  }

  function comparisonSection() {
    if (plans.length < 2) return null;
    const section = node('section', 'surface subscription-comparison user-reveal'); section.append(heading(t('subscriptionComparison')));
    const scroll = node('div', 'subscription-table-scroll'); const table = node('table', 'subscription-table');
    const head = node('thead'); const headRow = node('tr'); headRow.append(node('th', '', t('subscriptionFeature')));
    plans.forEach((plan) => headRow.append(node('th', '', localizedPlan(plan).name))); head.append(headRow); table.append(head);
    const body = node('tbody');
    const rows = [[t('subscriptionAmount'), (plan) => money(plan)], [t('subscriptionPeriod'), (plan) => t('subscriptionDuration', { days: plan.durationDays })], [t('subscriptionFeature'), (plan) => localizedPlan(plan).benefits.join(' · ')]];
    rows.forEach(([label, value]) => { const row = node('tr'); row.append(node('th', '', label)); plans.forEach((plan) => row.append(node('td', '', value(plan)))); body.append(row); });
    table.append(body); scroll.append(table); section.append(scroll); return section;
  }

  function summarySection(plan) {
    const copy = localizedPlan(plan); const section = node('section', 'surface subscription-summary user-reveal'); section.id = 'subscription-summary';
    section.append(heading(t('subscriptionSummary')));
    const grid = node('div', 'subscription-summary-grid');
    [[t('subscriptionSelected'), copy.name], [t('subscriptionAmount'), money(plan)], [t('subscriptionPeriod'), t('subscriptionDuration', { days: plan.durationDays })]].forEach(([label, value]) => { const item = node('div'); item.append(node('span', '', label), node('strong', '', value)); grid.append(item); });
    section.append(grid, node('p', 'subscription-secure-notice', t('subscriptionSecureNotice')));
    const action = node('button', 'button primary', t('subscriptionPay')); action.type = 'button';
    const canCheckout = Number(plan.amountMinor) === 0 || overview.paymentProvider?.configured;
    action.disabled = !canCheckout; action.addEventListener('click', () => startCheckout(plan, action)); section.append(action);
    if (!canCheckout) section.append(node('p', 'inline-message is-error', t('subscriptionProviderUnavailable')));
    return section;
  }

  function recordRow(title, meta, status, type = 'payment') {
    const row = node('div', 'data-row subscription-history-row'); row.append(node('strong', '', title), node('p', '', meta));
    if (status) row.append(node('span', `status-badge payment-${status}`, t(type === 'subscription' ? subscriptionStatusKey(status) : paymentStatusKey(status)))); return row;
  }

  function historySection() {
    const section = node('section', 'subscription-history-grid user-reveal');
    const subscriptions = node('div', 'surface'); subscriptions.append(heading(t('subscriptionHistory')));
    const subscriptionRows = (overview.history || []).map((item) => recordRow(localizedPlan({ name: item.plan_name, translations: item.translations }).name, t(item.status === 'pending' ? 'subscriptionStartsOn' : 'subscriptionActiveUntil', { date: dateLabel(item.status === 'pending' ? item.current_period_start : item.current_period_end) }), item.status, 'subscription'));
    subscriptions.append(...(subscriptionRows.length ? subscriptionRows : [node('p', 'muted', t('subscriptionNoHistory'))]));
    const payments = node('div', 'surface'); payments.append(heading(t('subscriptionPaymentHistory')));
    const paymentRows = (overview.payments || []).map((item) => recordRow(item.plan_name_snapshot, `${t('subscriptionCreatedOn', { date: dateLabel(item.created_at) })} · ${new Intl.NumberFormat(getLocale(), { style:'currency', currency:item.currency }).format(item.amount_minor / 100)}`, item.status));
    payments.append(...(paymentRows.length ? paymentRows : [node('p', 'muted', t('subscriptionNoHistory'))])); section.append(subscriptions, payments); return section;
  }

  function render() {
    const host = document.querySelector('[data-subscription-page]'); if (!host || !overview) return;
    host.setAttribute('aria-busy', 'false'); host.replaceChildren(currentSection(), offersSection());
    const comparison = comparisonSection(); if (comparison) host.append(comparison);
    const selected = planBySlug(selectedSlug); if (selected) host.append(summarySection(selected));
    host.append(historySection()); refreshIcons();
  }

  function selectPlan(slug) {
    selectedSlug = slug; render(); document.querySelector('#subscription-summary')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function refresh() {
    const [planData, subscriptionData] = await Promise.all([api('/api/plans'), api('/api/subscriptions')]);
    plans = planData.plans || []; overview = { ...subscriptionData, paymentProvider: planData.paymentProvider || subscriptionData.paymentProvider }; render();
  }

  async function cancelRenewal(id, button) {
    if (!window.confirm(t('subscriptionCancelConfirm'))) return;
    button.disabled = true;
    try { await api(`/api/subscriptions/${encodeURIComponent(id)}/cancel`, { method:'POST', body:'{}' }); showToast(t('subscriptionCancelled')); await refresh(); }
    catch (error) { showToast(error.message, { tone:'error' }); button.disabled = false; }
  }

  async function pollPayment(reference) {
    window.clearTimeout(pollingTimer);
    try {
      const { payment } = await api(`/api/payments/${encodeURIComponent(reference)}`);
      showToast(t(paymentStatusKey(payment.status)), { tone: payment.status === 'paid' ? 'success' : ['failed','cancelled','refunded'].includes(payment.status) ? 'error' : 'info' });
      if (payment.status === 'paid') { await refresh(); return; }
      if (['pending','processing'].includes(payment.status)) pollingTimer = window.setTimeout(() => pollPayment(reference), 5000);
    } catch (error) { showToast(error.message, { tone:'error' }); }
  }

  async function startCheckout(plan, button) {
    button.disabled = true;
    try {
      const result = await api('/api/subscriptions/checkout', { method:'POST', headers:{ 'Idempotency-Key': crypto.randomUUID() }, body:JSON.stringify({ plan:plan.slug }) });
      if (result.checkoutUrl) {
        const target = new URL(result.checkoutUrl, location.origin);
        if (target.protocol !== 'https:' && target.hostname !== 'localhost' && target.hostname !== '127.0.0.1') throw new Error(t('subscriptionPaymentStartError'));
        location.assign(target.href); return;
      }
      if (result.subscription || result.payment?.status === 'paid') await refresh();
      if (result.payment) await pollPayment(result.payment.reference);
    } catch (error) { showToast(error.message, { tone:'error' }); }
    finally { button.disabled = false; }
  }

  async function loadSubscription() {
    if (!(await requireUser())) return;
    try { await refresh(); } catch (error) {
      const host = document.querySelector('[data-subscription-page]'); const state = node('section', 'surface error-state');
      state.append(node('p', '', error.message || t('subscriptionLoadError'))); const retry = node('button', 'button secondary', t('subscriptionRetry')); retry.type='button'; retry.addEventListener('click', loadSubscription); state.append(retry); host?.replaceChildren(state);
    }
  }

  return { loadSubscription, rerender: render };
}
