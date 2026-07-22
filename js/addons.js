let addonUser = null;
let addonSubscription = null;
let addonPlan = null;
let addonDefinitions = [];
let addonRows = [];
let addonCards = [];
let domainRequests = [];
let oneTimeOffers = [];
let pendingRemoval = null;
const activeAddonStatuses = new Set(['active', 'trialing', 'past_due']);

(async function initAddons() {
  addonUser = await requireUser();
  if (!addonUser) return;

  const [subscriptionResult, definitionsResult, addonResult, cardsResult, domainsResult, offersResult] = await Promise.all([
    supabaseClient.from('subscriptions').select('*').eq('user_id', addonUser.id).maybeSingle(),
    supabaseClient.from('addon_definitions').select('*').eq('is_active', true).order('sort_order'),
    supabaseClient.from('subscription_addons').select('*').eq('user_id', addonUser.id),
    supabaseClient.from('digital_cards').select('id,full_name,company_name,slug,status').order('updated_at', { ascending: false }),
    supabaseClient.from('domain_requests').select('*').eq('user_id', addonUser.id).order('created_at', { ascending: false }),
    supabaseClient.from('one_time_offers').select('*').eq('is_active', true).order('sort_order')
  ]);

  if (subscriptionResult.error) toast(subscriptionResult.error.message);
  if (definitionsResult.error) toast(definitionsResult.error.message);
  if (addonResult.error) toast(addonResult.error.message);
  if (cardsResult.error) toast(cardsResult.error.message);
  if (domainsResult.error) toast(domainsResult.error.message);
  if (offersResult.error) toast(offersResult.error.message);

  addonSubscription = subscriptionResult.data;
  addonDefinitions = definitionsResult.data || [];
  addonRows = addonResult.data || [];
  addonCards = cardsResult.data || [];
  domainRequests = domainsResult.data || [];
  oneTimeOffers = offersResult.data || [];

  const planKey = addonSubscription?.plan_key || 'starter';
  const { data: planDefinition } = await supabaseClient.from('plan_definitions')
    .select('plan_key,name,card_limit')
    .eq('plan_key', planKey)
    .maybeSingle();
  addonPlan = planDefinition || { plan_key: planKey, name: titleCase(planKey), card_limit: 1 };

  renderSubscriptionSummary();
  renderAddons();
  renderDomainWorkspace();
  renderOneTimeOffers();
  wireAddonPage();
  if (window.lucide) lucide.createIcons();
})();

function wireAddonPage() {
  document.getElementById('sidebar-toggle')?.addEventListener('click', () => document.getElementById('sidebar')?.classList.toggle('open'));

  document.querySelectorAll('[data-filter]').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('[data-filter]').forEach(item => item.classList.toggle('active', item === button));
      document.querySelectorAll('.addon-card').forEach(card => {
        card.hidden = button.dataset.filter !== 'all' && card.dataset.category !== button.dataset.filter;
      });
    });
  });

  document.getElementById('close-remove-dialog')?.addEventListener('click', closeRemoveDialog);
  document.getElementById('cancel-remove-addon')?.addEventListener('click', closeRemoveDialog);
  document.getElementById('confirm-remove-addon')?.addEventListener('click', async () => {
    if (!pendingRemoval) return;
    const key = pendingRemoval;
    closeRemoveDialog();
    await changeAddon(key, 'remove', 1);
  });

  document.getElementById('domain-form')?.addEventListener('submit', submitDomainRequest);
}

function renderSubscriptionSummary() {
  const activePlan = addonSubscription && activeAddonStatuses.has(addonSubscription.status);
  const paidPlan = activePlan && Boolean(addonSubscription.stripe_subscription_id);
  const interval = addonSubscription?.billing_interval === 'year' ? 'year' : 'month';
  const activePaid = addonDefinitions.filter(def => def.is_sellable && (() => {
    const row = addonRow(def.addon_key);
    return row && activeAddonStatuses.has(row.status) && !isIncluded(def);
  })());
  const included = addonDefinitions.filter(isIncluded);
  const totalCents = activePaid.reduce((sum, def) => {
    const row = addonRow(def.addon_key);
    const price = interval === 'year' ? def.yearly_price_cents : def.monthly_price_cents;
    return sum + price * Math.max(1, row?.quantity || 1);
  }, 0);

  document.getElementById('current-plan').textContent = `${addonPlan?.name || 'Starter'} plan`;
  const status = document.getElementById('current-plan-status');
  status.textContent = activePlan ? (addonSubscription.status === 'past_due' ? 'Payment attention' : 'Active') : 'Inactive';
  status.className = `status-pill ${activePlan ? (addonSubscription.status === 'past_due' ? 'past_due' : 'active') : 'draft'}`;

  document.getElementById('billing-summary').textContent = activePlan
    ? paidPlan
      ? `${interval === 'year' ? 'Yearly' : 'Monthly'} billing · ${addonPlan.card_limit} base card${addonPlan.card_limit === 1 ? '' : 's'} · Recurring extras renew with your plan.`
      : `Free Starter · ${addonPlan.card_limit} published card · Upgrade to Pro or Agency before adding recurring extras.`
    : 'Activate Free Starter, Pro, or Agency to begin.';
  document.getElementById('active-addon-count').textContent = String(activePaid.length);
  document.getElementById('included-addon-count').textContent = String(included.length);
  document.getElementById('addon-total').textContent = formatMoney(interval === 'year' ? Math.round(totalCents / 12) : totalCents);
  document.getElementById('addon-total-label').textContent = interval === 'year' ? 'monthly equivalent' : 'per month';

  document.getElementById('sidebar-plan').textContent = activePlan ? `${addonPlan.name} plan` : 'Plan inactive';
  document.getElementById('sidebar-plan-copy').textContent = activePlan
    ? paidPlan
      ? `${interval === 'year' ? 'Yearly' : 'Monthly'} billing · ${activePaid.length} paid extra${activePaid.length === 1 ? '' : 's'}.`
      : 'Free forever · 1 published card.'
    : 'Choose a plan to publish.';

  const chips = [
    ...included.map(def => `<span class="active-addon-chip included"><i data-lucide="circle-check" size="15"></i>${escapeHtml(def.name)} <small>Included</small></span>`),
    ...activePaid.map(def => {
      const row = addonRow(def.addon_key);
      const quantity = def.is_quantity && row?.quantity > 1 ? ` ×${row.quantity}` : '';
      return `<span class="active-addon-chip"><i data-lucide="sparkles" size="15"></i>${escapeHtml(def.name)}${quantity}</span>`;
    })
  ];
  const strip = document.getElementById('active-addon-strip');
  if (chips.length) {
    strip.hidden = false;
    document.getElementById('active-addon-chips').innerHTML = chips.join('');
  } else {
    strip.hidden = true;
  }
}

function renderAddons() {
  const grid = document.getElementById('addon-grid');
  const sellableDefinitions = addonDefinitions.filter(definition => definition.is_sellable);
  if (!sellableDefinitions.length) {
    grid.innerHTML = '<div class="card empty-state" style="grid-column:1/-1"><span class="empty-icon"><i data-lucide="blocks" size="28"></i></span><h3>No add-ons available</h3><p class="muted">The marketplace is being prepared.</p></div>';
    return;
  }

  const interval = addonSubscription?.billing_interval === 'year' ? 'year' : 'month';
  const activePlan = addonSubscription && activeAddonStatuses.has(addonSubscription.status);
  const paidPlan = activePlan && Boolean(addonSubscription.stripe_subscription_id);

  grid.innerHTML = sellableDefinitions.map(def => {
    const row = addonRow(def.addon_key);
    const active = row && activeAddonStatuses.has(row.status);
    const included = isIncluded(def);
    const priceCents = interval === 'year' ? def.yearly_price_cents : def.monthly_price_cents;
    const monthlyEquivalent = interval === 'year' ? Math.round(priceCents / 12) : priceCents;
    const quantity = Math.max(1, Number(row?.quantity || 1));
    const statusClass = included ? 'included' : active ? 'active' : '';
    const configure = configureHref(def);
    let controls = '';

    if (included) {
      controls = `<div class="addon-ready-row"><div class="addon-included"><i data-lucide="badge-check" size="18"></i> Included with ${escapeHtml(addonPlan.name)}</div>${configure ? `<a class="btn btn-light btn-sm" href="${configure}">Configure</a>` : ''}</div>`;
    } else if (!paidPlan) {
      controls = `<a class="btn btn-primary btn-block" href="pricing.html">Choose Pro or Agency</a>`;
    } else if (active && def.is_quantity) {
      controls = `<div class="addon-quantity-row">
        <div class="quantity-control" aria-label="Extra card quantity">
          <button type="button" data-qty-change="-1" data-addon-key="${def.addon_key}" aria-label="Decrease quantity"><i data-lucide="minus" size="15"></i></button>
          <input type="number" min="1" max="${def.max_quantity}" value="${quantity}" data-addon-quantity="${def.addon_key}" aria-label="Quantity">
          <button type="button" data-qty-change="1" data-addon-key="${def.addon_key}" aria-label="Increase quantity"><i data-lucide="plus" size="15"></i></button>
        </div>
        <button class="btn btn-primary btn-sm" type="button" data-update-addon="${def.addon_key}">Update</button>
        <a class="btn btn-light btn-sm" href="${configure || 'editor.html'}">Create card</a>
        <button class="btn btn-ghost btn-sm danger-text" type="button" data-remove-addon="${def.addon_key}">Remove</button>
      </div>`;
    } else if (active) {
      controls = `<div class="addon-active-actions"><span><i data-lucide="circle-check" size="17"></i> Active now</span><div>${configure ? `<a class="btn btn-light btn-sm" href="${configure}">Configure</a>` : ''}<button class="btn btn-ghost btn-sm danger-text" type="button" data-remove-addon="${def.addon_key}">Remove</button></div></div>`;
    } else {
      controls = `<button class="btn btn-primary btn-block" type="button" data-add-addon="${def.addon_key}"><i data-lucide="plus" size="17"></i> Add to ${escapeHtml(addonPlan.name)}</button>`;
    }

    return `<article class="card addon-card ${statusClass}" data-category="${escapeHtml(def.category)}">
      <div class="addon-card-top">
        <span class="addon-icon"><i data-lucide="${escapeHtml(def.icon)}" size="23"></i></span>
        ${included ? '<span class="addon-badge included">Included</span>' : active ? '<span class="addon-badge active">Active</span>' : '<span class="addon-badge">Optional</span>'}
      </div>
      <div class="addon-card-copy">
        <p class="addon-category">${escapeHtml(titleCase(def.category))}</p>
        <h3>${escapeHtml(def.name)}</h3>
        <p>${escapeHtml(def.short_description)}</p>
      </div>
      <div class="addon-price-row">
        <div><strong>${formatMoney(monthlyEquivalent)}</strong><span>/month${def.is_quantity ? ' each' : ''}</span></div>
        <small>${included ? `Included in ${escapeHtml(addonPlan.name)}` : active ? 'Active on your subscription' : interval === 'year' ? `${formatMoney(priceCents)} billed yearly` : 'Added to your monthly subscription'}</small>
      </div>
      <div class="addon-controls">${controls}</div>
    </article>`;
  }).join('');

  grid.querySelectorAll('[data-add-addon]').forEach(button => button.addEventListener('click', () => changeAddon(button.dataset.addAddon, 'add', 1, button)));
  grid.querySelectorAll('[data-update-addon]').forEach(button => button.addEventListener('click', () => {
    const input = document.querySelector(`[data-addon-quantity="${button.dataset.updateAddon}"]`);
    changeAddon(button.dataset.updateAddon, 'set_quantity', Number(input?.value || 1), button);
  }));
  grid.querySelectorAll('[data-remove-addon]').forEach(button => button.addEventListener('click', () => openRemoveDialog(button.dataset.removeAddon)));
  grid.querySelectorAll('[data-qty-change]').forEach(button => button.addEventListener('click', () => {
    const input = document.querySelector(`[data-addon-quantity="${button.dataset.addonKey}"]`);
    if (!input) return;
    const definition = addonDefinitions.find(item => item.addon_key === button.dataset.addonKey);
    const next = Math.max(1, Math.min(Number(definition?.max_quantity || 20), Number(input.value || 1) + Number(button.dataset.qtyChange)));
    input.value = String(next);
  }));

  if (window.lucide) lucide.createIcons();
}

function configureHref(definition) {
  const firstCard = addonCards[0];
  const editorBase = firstCard ? `editor.html?id=${encodeURIComponent(firstCard.id)}` : 'editor.html';
  const joiner = editorBase.includes('?') ? '&' : '?';
  const map = {
    advanced_analytics: 'analytics.html',
    premium_templates: `${editorBase}${joiner}tab=design&feature=premium_templates`,
    appointment_booking: `${editorBase}${joiner}tab=tools&feature=appointment_booking`,
    lead_capture: `${editorBase}${joiner}tab=tools&feature=lead_capture`,
    product_showcase: `${editorBase}${joiner}tab=tools&feature=product_showcase`,
    extra_card: 'editor.html',
    custom_domain: '#domain-workspace'
  };
  return map[definition?.addon_key] || '';
}

async function changeAddon(addonKey, action, quantity = 1, trigger = null) {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return location.href = dotcoUrl('login.html');
  const definition = addonDefinitions.find(item => item.addon_key === addonKey);
  setButtonBusy(trigger, true, action === 'remove' ? 'Removing…' : 'Updating…');

  try {
    const response = await fetch(`${DOTCO_CONFIG.supabaseUrl}/functions/v1/manage-addon`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ addonKey, action, quantity })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to update add-on');
    toast(data.message || `${definition?.name || 'Add-on'} updated`);
    if (data.paymentUrl) {
      setTimeout(() => location.href = data.paymentUrl, 450);
      return;
    }

    const existing = addonRows.find(row => row.addon_key === addonKey);
    const nextStatus = data.active === false || action === 'remove' ? 'canceled' : 'active';
    if (existing) {
      existing.status = nextStatus;
      existing.quantity = Math.max(1, Number(data.quantity || quantity || 1));
    } else {
      addonRows.push({ addon_key: addonKey, status: nextStatus, quantity: Math.max(1, Number(data.quantity || quantity || 1)) });
    }
    renderSubscriptionSummary();
    renderAddons();
    renderDomainWorkspace();
    setButtonBusy(trigger, false);

    const configure = configureHref(definition);
    if (configure && action !== 'remove' && !configure.startsWith('#')) {
      const card = document.querySelector(`.addon-card[data-category="${definition.category}"]`);
      card?.classList.add('addon-just-activated');
    }
  } catch (error) {
    toast(error.message);
    setButtonBusy(trigger, false);
  }
}

function setButtonBusy(button, busy, label = 'Working…') {
  if (!button) return;
  button.dataset.original = button.dataset.original || button.innerHTML;
  button.disabled = busy;
  button.innerHTML = busy ? `<span class="button-spinner"></span>${label}` : button.dataset.original;
}

function openRemoveDialog(addonKey) {
  pendingRemoval = addonKey;
  const definition = addonDefinitions.find(item => item.addon_key === addonKey);
  document.getElementById('remove-addon-copy').textContent = `${definition?.name || 'This add-on'} will stop being available. Stripe will calculate any applicable prorated credit.`;
  document.getElementById('remove-addon-dialog').showModal();
}

function closeRemoveDialog() {
  pendingRemoval = null;
  document.getElementById('remove-addon-dialog').close();
}


function renderOneTimeOffers() {
  const grid = document.getElementById('one-time-offer-grid');
  if (!grid) return;
  if (!oneTimeOffers.length) {
    grid.innerHTML = '<div class="card empty-state" style="grid-column:1/-1"><h3>Services are being prepared</h3></div>';
    return;
  }

  grid.innerHTML = oneTimeOffers.map(offer => `<article class="card one-time-offer-card ${offer.offer_key === 'done_for_you' ? 'featured' : ''}">
    ${offer.badge ? `<span class="offer-badge">${escapeHtml(offer.badge)}</span>` : ''}
    <span class="offer-icon"><i data-lucide="${escapeHtml(offer.icon || 'sparkles')}"></i></span>
    <h3>${escapeHtml(offer.name)}</h3>
    <p>${escapeHtml(offer.short_description)}</p>
    <div class="offer-price">${formatMoney(offer.price_cents)} <small>one time</small></div>
    <button class="btn ${offer.offer_key === 'done_for_you' ? 'btn-primary' : 'btn-light'} btn-block" type="button" data-purchase-offer="${escapeHtml(offer.offer_key)}">Buy now</button>
  </article>`).join('');

  grid.querySelectorAll('[data-purchase-offer]').forEach(button => {
    button.addEventListener('click', () => checkoutOneTime(button.dataset.purchaseOffer, button));
  });
  if (window.lucide) lucide.createIcons();
}

function renderDomainWorkspace() {
  const domainDefinition = addonDefinitions.find(item => item.addon_key === 'custom_domain');
  const row = addonRow('custom_domain');
  const enabled = domainDefinition && row && activeAddonStatuses.has(row.status);
  const section = document.getElementById('domain-workspace');
  section.hidden = !enabled;
  if (!enabled) return;

  const select = document.getElementById('domain-card');
  select.innerHTML = addonCards.length
    ? addonCards.map(card => `<option value="${card.id}">${escapeHtml(card.company_name || card.full_name || card.slug)}</option>`).join('')
    : '<option value="">Create a card first</option>';
  document.getElementById('domain-form').querySelector('button[type="submit"]').disabled = !addonCards.length;
  renderDomainRequests();
}

function renderDomainRequests() {
  const area = document.getElementById('domain-requests');
  if (!domainRequests.length) {
    area.innerHTML = '<div class="domain-empty"><i data-lucide="globe-2" size="20"></i><span>No domain requests yet.</span></div>';
    return;
  }
  area.innerHTML = domainRequests.map(request => `<article class="domain-request-row">
    <div><strong>${escapeHtml(request.domain_name)}</strong><span>${escapeHtml(request.preferred_path || 'Root domain')}</span></div>
    <span class="status-pill ${escapeHtml(request.status)}">${escapeHtml(titleCase(request.status))}</span>
  </article>`).join('');
  if (window.lucide) lucide.createIcons();
}

async function submitDomainRequest(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const domainName = normalizeDomain(document.getElementById('domain-name').value);
  const cardId = document.getElementById('domain-card').value;
  const preferredPath = document.getElementById('domain-path').value.trim();
  if (!domainName || !cardId) return toast('Enter a valid domain and choose a card');

  setButtonBusy(button, true, 'Submitting…');
  const { data, error } = await supabaseClient.from('domain_requests').insert({
    user_id: addonUser.id,
    card_id: cardId,
    domain_name: domainName,
    preferred_path: preferredPath || null,
    dns_status: 'awaiting_instructions'
  }).select().single();
  setButtonBusy(button, false);
  if (error) return toast(error.message);
  domainRequests.unshift(data);
  form.reset();
  renderDomainRequests();
  toast('Domain request submitted');
}

function addonRow(key) {
  return addonRows.find(row => row.addon_key === key) || null;
}

function isIncluded(definition) {
  return Boolean(definition?.included_plans?.includes(addonSubscription?.plan_key));
}

function normalizeDomain(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/[^a-z0-9.-]/g, '')
    .replace(/^\.+|\.+$/g, '');
}

function formatMoney(cents) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: cents % 100 ? 2 : 0 }).format(Number(cents || 0) / 100);
}

function titleCase(value) {
  return String(value || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}
