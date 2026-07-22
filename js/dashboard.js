let pendingDeleteCard = null;

(async function initDashboard() {
  const user = await requireUser();
  if (!user) return;

  const [profileResult, subResult, cardsResult, viewsResult, savesResult, addonsResult, definitionsResult, leadsResult] = await Promise.all([
    supabaseClient.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
    supabaseClient.from('subscriptions').select('*').eq('user_id', user.id).maybeSingle(),
    supabaseClient.from('digital_cards').select('*').order('updated_at', { ascending: false }),
    supabaseClient.from('card_views').select('id', { count: 'exact', head: true }),
    supabaseClient.from('card_events').select('id', { count: 'exact', head: true }).eq('event_type', 'contact_save'),
    supabaseClient.from('subscription_addons').select('*').eq('user_id', user.id),
    supabaseClient.from('addon_definitions').select('addon_key,name,included_plans,icon,is_sellable').eq('is_active', true).order('sort_order'),
    supabaseClient.from('leads').select('id', { count: 'exact', head: true }).eq('owner_user_id', user.id).eq('status', 'new')
  ]);

  const profile = profileResult.data;
  const subscription = subResult.data;
  const cards = cardsResult.data || [];
  const addons = addonsResult.data || [];
  const definitions = definitionsResult.data || [];
  if (cardsResult.error) toast(cardsResult.error.message);

  const planKey = subscription?.plan_key || 'starter';
  const { data: planDefinition } = await supabaseClient.from('plan_definitions')
    .select('name,card_limit')
    .eq('plan_key', planKey)
    .maybeSingle();

  const active = ['active', 'trialing', 'past_due'].includes(subscription?.status);
  const paidPlan = active && Boolean(subscription?.stripe_subscription_id);
  const name = profile?.full_name || user.user_metadata?.full_name || '';
  const firstName = name.trim().split(' ')[0] || 'there';
  const sellableKeys = new Set(definitions.filter(definition => definition.is_sellable).map(definition => definition.addon_key));
  const paidAddons = addons.filter(row => sellableKeys.has(row.addon_key) && ['active', 'trialing', 'past_due'].includes(row.status));
  const extraCards = paidAddons.find(row => row.addon_key === 'extra_card')?.quantity || 0;
  const baseLimit = planDefinition?.card_limit || 1;
  const limit = baseLimit + Number(extraCards || 0);
  const cardCount = cards.length;
  const published = cards.some(card => card.status === 'published');
  const newLeadCount = leadsResult.count || 0;

  document.getElementById('welcome').textContent = `Welcome back, ${firstName}`;
  document.getElementById('user-email').textContent = user.email;
  document.getElementById('user-chip').textContent = firstName.slice(0, 1).toUpperCase();
  document.getElementById('plan').textContent = planDefinition?.name || 'Starter';
  document.getElementById('plan-status').textContent = active
    ? planKey === 'starter' ? 'Free plan active' : subscription.status === 'past_due' ? 'Payment needs attention' : subscription.status === 'trialing' ? 'Trial active' : 'Paid plan active'
    : 'Plan inactive';
  document.getElementById('renewal-date').textContent = planKey === 'starter' && active
    ? 'Free forever · no renewal'
    : active && subscription.current_period_end
      ? `Renews ${new Date(subscription.current_period_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
      : 'No active renewal';
  document.getElementById('sidebar-plan').textContent = active ? `${planDefinition?.name || 'Starter'} plan` : 'Starter preview';
  document.getElementById('sidebar-plan-copy').textContent = active
    ? paidPlan
      ? `${subscription.billing_interval === 'year' ? 'Yearly' : 'Monthly'} billing · ${paidAddons.length} paid extra${paidAddons.length === 1 ? '' : 's'}.`
      : 'Free forever · 1 published card.'
    : 'Activate Free Starter to publish.';

  document.getElementById('card-count').textContent = String(cardCount);
  document.getElementById('card-usage').textContent = `${Math.max(limit - cardCount, 0)} remaining`;
  document.getElementById('views').textContent = String(viewsResult.count || 0);
  document.getElementById('saves').textContent = String(savesResult.count || 0);
  document.getElementById('new-leads').textContent = String(newLeadCount);
  document.getElementById('addon-count').textContent = String(paidAddons.length);
  document.getElementById('usage-count').textContent = String(cardCount);
  document.getElementById('usage-limit').textContent = String(limit);
  document.getElementById('usage-progress').style.width = `${Math.min(100, cardCount / Math.max(1, limit) * 100)}%`;

  const navLead = document.getElementById('nav-lead-count');
  if (newLeadCount) {
    navLead.hidden = false;
    navLead.textContent = newLeadCount > 99 ? '99+' : String(newLeadCount);
  }

  const complete = [true, cardCount > 0, active, published];
  ['step-account', 'step-card', 'step-plan', 'step-published'].forEach((id, index) => {
    if (complete[index]) {
      const element = document.getElementById(id);
      element.classList.add('done');
      element.querySelector('.check-dot').innerHTML = '<i data-lucide="check" size="14"></i>';
    }
  });
  const percent = Math.round(complete.filter(Boolean).length / complete.length * 100);
  document.getElementById('onboarding-percent').textContent = `${percent}%`;
  document.getElementById('onboarding-progress').style.width = `${percent}%`;
  document.getElementById('upgrade-banner').hidden = active && planKey !== 'starter';

  const includedDefinitions = definitions.filter(def => def.included_plans?.includes(planKey));
  const activeDefinitions = paidAddons.map(row => definitions.find(def => def.addon_key === row.addon_key)).filter(Boolean);
  const uniqueFeatures = [...includedDefinitions, ...activeDefinitions].filter((feature, index, list) => list.findIndex(item => item.addon_key === feature.addon_key) === index);
  const addonChipArea = document.getElementById('dashboard-addon-chips');
  addonChipArea.innerHTML = uniqueFeatures.length
    ? uniqueFeatures.slice(0, 4).map(feature => `<span><i data-lucide="${escapeHtml(feature.icon || 'sparkles')}" size="14"></i>${escapeHtml(feature.name)}</span>`).join('')
    : '<p class="muted" style="font-size:.86rem;margin:0">No add-ons active yet.</p>';

  if (active && !published) {
    document.getElementById('welcome-headline').textContent = 'Your plan is active—publish your first card.';
    document.getElementById('welcome-copy').textContent = 'Finish the details, preview the customer experience, and publish when everything looks right.';
  } else if (published) {
    document.getElementById('welcome-headline').textContent = 'Your digital presence is live.';
    document.getElementById('welcome-copy').textContent = 'Keep your cards fresh, follow engagement, and use add-ons to turn more visitors into customers.';
  }

  const pageParams = new URLSearchParams(location.search);
  if (pageParams.get('purchase') === 'success') toast('Order received. DotCo will follow up with the next steps.');
  else if (pageParams.get('billing') === 'free') toast('Free Starter is active. You can publish one card now.');
  else if (pageParams.get('billing') === 'success') toast('Payment received. Your plan is being activated.');

  setupDeleteCardDialog();
  renderCards(cards);
  document.getElementById('sidebar-toggle')?.addEventListener('click', () => document.getElementById('sidebar')?.classList.toggle('open'));
  if (window.lucide) lucide.createIcons();
})();

function renderCards(cards) {
  const list = document.getElementById('card-list');
  if (!cards.length) {
    list.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><span class="empty-icon"><i data-lucide="badge-plus" size="28"></i></span><h3>Create your first digital card</h3><p class="muted">Add your details, choose a style, connect social media, and preview the exact customer experience.</p><a class="btn btn-primary" href="editor.html">Start building</a></div>`;
    if (window.lucide) lucide.createIcons();
    return;
  }

  list.innerHTML = cards.map(card => {
    const publicUrl = dotcoUrl(`card.html?slug=${encodeURIComponent(card.slug)}`);
    const initials = (card.full_name || 'DC').split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase();
    const avatar = card.profile_image_url ? `<img src="${escapeHtml(card.profile_image_url)}" alt="">` : escapeHtml(initials);
    const cardName = card.company_name || card.full_name || 'Untitled card';
    return `<article class="card card-item" data-card-id="${escapeHtml(card.id)}">
      <div class="card-thumb" style="background:${escapeHtml(card.gradient_background || `linear-gradient(135deg,${card.primary_color || '#5b5cf0'},${card.secondary_color || '#9b5de5'})`)}">
        <span class="card-initials">${avatar}</span><span class="card-thumb-name">${escapeHtml(card.full_name || 'Untitled card')}</span>
      </div>
      <div class="card-meta">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start"><div><h3>${escapeHtml(cardName)}</h3><p class="muted" style="font-size:.86rem;margin-bottom:0">${escapeHtml(card.job_title || 'Add a job title')}</p></div><span class="status-pill ${card.status}">${card.status}</span></div>
        <div class="card-actions">
          <a class="btn btn-light btn-sm" href="editor.html?id=${encodeURIComponent(card.id)}"><i data-lucide="pencil" size="15"></i> Edit</a>
          <a class="btn btn-light btn-sm" href="${publicUrl}" target="_blank" rel="noopener"><i data-lucide="eye" size="15"></i> ${card.status === 'published' ? 'View' : 'Preview'}</a>
          <button class="btn btn-light btn-sm" data-copy="${publicUrl}" aria-label="Copy card link"><i data-lucide="copy" size="15"></i></button>
          <button
            class="btn btn-light btn-sm card-delete-button"
            type="button"
            data-delete-card="${escapeHtml(card.id)}"
            data-delete-name="${escapeHtml(cardName)}"
            aria-label="Delete ${escapeHtml(cardName)}"
          ><i data-lucide="trash-2" size="15"></i> Delete</button>
        </div>
      </div>
    </article>`;
  }).join('');

  list.querySelectorAll('[data-copy]').forEach(button => button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(button.dataset.copy);
      toast('Card link copied');
    } catch {
      toast('Could not copy the card link');
    }
  }));

  list.querySelectorAll('[data-delete-card]').forEach(button => {
    button.addEventListener('click', () => openDeleteCardDialog(button.dataset.deleteCard, button.dataset.deleteName));
  });

  if (window.lucide) lucide.createIcons();
}

function setupDeleteCardDialog() {
  const dialog = document.getElementById('delete-card-dialog');
  const input = document.getElementById('delete-confirm-input');
  const cancelButton = document.getElementById('cancel-delete-card');
  const confirmButton = document.getElementById('confirm-delete-card');
  if (!dialog || !input || !cancelButton || !confirmButton || dialog.dataset.ready === 'true') return;

  dialog.dataset.ready = 'true';

  input.addEventListener('input', () => {
    confirmButton.disabled = input.value.trim().toUpperCase() !== 'DELETE';
  });

  cancelButton.addEventListener('click', () => closeDeleteCardDialog());

  dialog.addEventListener('cancel', event => {
    event.preventDefault();
    closeDeleteCardDialog();
  });

  dialog.addEventListener('click', event => {
    if (event.target === dialog) closeDeleteCardDialog();
  });

  confirmButton.addEventListener('click', deletePendingCard);
}

function openDeleteCardDialog(cardId, cardName) {
  const dialog = document.getElementById('delete-card-dialog');
  const input = document.getElementById('delete-confirm-input');
  const confirmButton = document.getElementById('confirm-delete-card');
  const cardNameElement = document.getElementById('delete-card-name');
  if (!dialog || !input || !confirmButton || !cardNameElement || !cardId) return;

  pendingDeleteCard = { id: cardId, name: cardName || 'Untitled card' };
  cardNameElement.textContent = pendingDeleteCard.name;
  input.value = '';
  confirmButton.disabled = true;
  confirmButton.innerHTML = '<i data-lucide="trash-2" size="16"></i> Delete permanently';

  if (typeof dialog.showModal === 'function') {
    dialog.showModal();
  } else {
    dialog.setAttribute('open', '');
  }

  if (window.lucide) lucide.createIcons();
  setTimeout(() => input.focus(), 50);
}

function closeDeleteCardDialog() {
  const dialog = document.getElementById('delete-card-dialog');
  const input = document.getElementById('delete-confirm-input');
  if (dialog?.open && typeof dialog.close === 'function') dialog.close();
  else dialog?.removeAttribute('open');
  if (input) input.value = '';
  pendingDeleteCard = null;
}

async function deletePendingCard() {
  if (!pendingDeleteCard?.id) return;

  const dialog = document.getElementById('delete-card-dialog');
  const input = document.getElementById('delete-confirm-input');
  const confirmButton = document.getElementById('confirm-delete-card');
  const cancelButton = document.getElementById('cancel-delete-card');
  if (!confirmButton || !cancelButton || input?.value.trim().toUpperCase() !== 'DELETE') return;

  const cardToDelete = { ...pendingDeleteCard };
  confirmButton.disabled = true;
  cancelButton.disabled = true;
  confirmButton.innerHTML = '<i data-lucide="loader-circle" size="16"></i> Deleting…';
  if (window.lucide) lucide.createIcons();

  try {
    const { data, error } = await supabaseClient
      .from('digital_cards')
      .delete()
      .eq('id', cardToDelete.id)
      .select('id')
      .maybeSingle();

    if (error) throw error;
    if (!data?.id) throw new Error('Card not found or you do not have permission to delete it.');

    const cardElement = document.querySelector(`[data-card-id="${CSS.escape(cardToDelete.id)}"]`);
    cardElement?.remove();

    if (dialog?.open && typeof dialog.close === 'function') dialog.close();
    else dialog?.removeAttribute('open');

    pendingDeleteCard = null;
    toast(`${cardToDelete.name} was permanently deleted`);

    setTimeout(() => window.location.reload(), 650);
  } catch (error) {
    toast(error?.message || 'Could not delete this card');
    confirmButton.disabled = false;
    cancelButton.disabled = false;
    confirmButton.innerHTML = '<i data-lucide="trash-2" size="16"></i> Delete permanently';
    if (window.lucide) lucide.createIcons();
  }
}
