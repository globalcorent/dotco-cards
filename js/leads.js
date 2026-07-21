let leadsUser = null;
let leadsData = [];
let leadCards = [];
let leadAccess = false;

(async function initLeads() {
  leadsUser = await requireUser();
  if (!leadsUser) return;
  const [{ data: subscription }, { data: addons }, { data: cards }, { data: leads, error }] = await Promise.all([
    supabaseClient.from('subscriptions').select('plan_key,status').eq('user_id', leadsUser.id).maybeSingle(),
    supabaseClient.from('subscription_addons').select('addon_key,status').eq('user_id', leadsUser.id),
    supabaseClient.from('digital_cards').select('id,full_name,company_name,slug'),
    supabaseClient.from('leads').select('*').eq('owner_user_id', leadsUser.id).order('created_at', { ascending: false })
  ]);
  if (error) toast(error.message);
  leadsData = leads || [];
  leadCards = cards || [];
  leadAccess = subscription?.plan_key === 'agency' || (addons || []).some(row => row.addon_key === 'lead_capture' && ['active', 'trialing', 'past_due'].includes(row.status));
  document.getElementById('sidebar-plan').textContent = `${titleCase(subscription?.plan_key || 'starter')} plan`;
  document.getElementById('sidebar-plan-copy').textContent = leadAccess ? 'Lead Capture enabled.' : 'Lead Capture is not active.';
  document.getElementById('leads-lock').hidden = leadAccess;
  document.getElementById('leads-content').classList.toggle('analytics-blurred', !leadAccess);

  document.getElementById('lead-search').addEventListener('input', renderLeads);
  document.getElementById('lead-filter').addEventListener('change', renderLeads);
  document.getElementById('close-lead-dialog').addEventListener('click', () => document.getElementById('lead-dialog').close());
  document.getElementById('sidebar-toggle')?.addEventListener('click', () => document.getElementById('sidebar')?.classList.toggle('open'));
  renderLeads();
  if (window.lucide) lucide.createIcons();
})();

function renderLeads() {
  document.getElementById('lead-new-count').textContent = leadsData.filter(lead => lead.status === 'new').length;
  document.getElementById('lead-contacted-count').textContent = leadsData.filter(lead => lead.status === 'contacted').length;
  document.getElementById('lead-qualified-count').textContent = leadsData.filter(lead => lead.status === 'qualified').length;
  document.getElementById('lead-total-count').textContent = leadsData.length;

  const search = document.getElementById('lead-search').value.trim().toLowerCase();
  const status = document.getElementById('lead-filter').value;
  const filtered = leadsData.filter(lead => {
    const haystack = `${lead.name} ${lead.email || ''} ${lead.phone || ''} ${lead.message || ''}`.toLowerCase();
    return (!search || haystack.includes(search)) && (status === 'all' || lead.status === status);
  });

  const list = document.getElementById('lead-list');
  if (!filtered.length) {
    list.innerHTML = `<div class="empty-state"><span class="empty-icon"><i data-lucide="inbox" size="28"></i></span><h3>${leadsData.length ? 'No matching leads' : 'No leads yet'}</h3><p class="muted">${leadsData.length ? 'Try another search or status.' : 'Enable the inquiry form on a card and share it with customers.'}</p></div>`;
    if (window.lucide) lucide.createIcons();
    return;
  }

  list.innerHTML = filtered.map(lead => {
    const card = leadCards.find(item => item.id === lead.card_id);
    const contact = lead.email || lead.phone || 'No contact detail';
    return `<article class="lead-row" data-lead-id="${lead.id}">
      <div class="lead-avatar">${escapeHtml(initials(lead.name))}</div>
      <div class="lead-main"><strong>${escapeHtml(lead.name)}</strong><span>${escapeHtml(contact)}</span><small>${escapeHtml(card?.company_name || card?.full_name || 'Digital card')} · ${formatDate(lead.created_at)}</small></div>
      <p>${escapeHtml(lead.message || lead.service_interest || 'New inquiry')}</p>
      <select class="lead-status-select status-${lead.status}" data-lead-status="${lead.id}" aria-label="Lead status"><option value="new" ${lead.status === 'new' ? 'selected' : ''}>New</option><option value="contacted" ${lead.status === 'contacted' ? 'selected' : ''}>Contacted</option><option value="qualified" ${lead.status === 'qualified' ? 'selected' : ''}>Qualified</option><option value="closed" ${lead.status === 'closed' ? 'selected' : ''}>Closed</option><option value="spam" ${lead.status === 'spam' ? 'selected' : ''}>Spam</option></select>
      <button class="icon-btn" data-open-lead="${lead.id}" aria-label="Open lead"><i data-lucide="chevron-right"></i></button>
    </article>`;
  }).join('');
  list.querySelectorAll('[data-lead-status]').forEach(select => select.addEventListener('change', () => updateLeadStatus(select.dataset.leadStatus, select.value, select)));
  list.querySelectorAll('[data-open-lead]').forEach(button => button.addEventListener('click', () => openLead(button.dataset.openLead)));
  if (window.lucide) lucide.createIcons();
}

async function updateLeadStatus(id, status, select) {
  select.disabled = true;
  const { error } = await supabaseClient.from('leads').update({ status }).eq('id', id);
  select.disabled = false;
  if (error) return toast(error.message);
  const lead = leadsData.find(item => item.id === id);
  if (lead) lead.status = status;
  renderLeads();
  toast('Lead status updated');
}

function openLead(id) {
  const lead = leadsData.find(item => item.id === id);
  if (!lead) return;
  const card = leadCards.find(item => item.id === lead.card_id);
  document.getElementById('lead-dialog-name').textContent = lead.name;
  document.getElementById('lead-dialog-content').innerHTML = `<div class="lead-detail-grid">
    <a href="${lead.phone ? `tel:${escapeHtml(lead.phone)}` : '#'}" class="lead-detail-item ${lead.phone ? '' : 'disabled'}"><i data-lucide="phone"></i><div><span>Phone</span><strong>${escapeHtml(lead.phone || 'Not provided')}</strong></div></a>
    <a href="${lead.email ? `mailto:${escapeHtml(lead.email)}` : '#'}" class="lead-detail-item ${lead.email ? '' : 'disabled'}"><i data-lucide="mail"></i><div><span>Email</span><strong>${escapeHtml(lead.email || 'Not provided')}</strong></div></a>
    <div class="lead-detail-item"><i data-lucide="contact-round"></i><div><span>Card</span><strong>${escapeHtml(card?.company_name || card?.full_name || 'Digital card')}</strong></div></div>
    <div class="lead-detail-item"><i data-lucide="clock-3"></i><div><span>Received</span><strong>${escapeHtml(formatDate(lead.created_at, true))}</strong></div></div>
  </div>
  <div class="lead-message-box"><span>Message</span><p>${escapeHtml(lead.message || 'No message provided.')}</p>${lead.service_interest ? `<small>Interested in: ${escapeHtml(lead.service_interest)}</small>` : ''}</div>
  <div class="modal-actions"><a class="btn btn-primary" href="${lead.phone ? `tel:${escapeHtml(lead.phone)}` : `mailto:${escapeHtml(lead.email || '')}`}"><i data-lucide="phone-call" size="17"></i> Contact lead</a><button class="btn btn-light" type="button" data-delete-lead="${lead.id}"><i data-lucide="trash-2" size="17"></i> Delete</button></div>`;
  document.querySelector('[data-delete-lead]').addEventListener('click', () => deleteLead(lead.id));
  document.getElementById('lead-dialog').showModal();
  if (window.lucide) lucide.createIcons();
}

async function deleteLead(id) {
  if (!confirm('Delete this lead permanently?')) return;
  const { error } = await supabaseClient.from('leads').delete().eq('id', id);
  if (error) return toast(error.message);
  leadsData = leadsData.filter(item => item.id !== id);
  document.getElementById('lead-dialog').close();
  renderLeads();
  toast('Lead deleted');
}

function initials(name) { return String(name || 'L').split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase(); }
function formatDate(value, detailed = false) { return new Date(value).toLocaleString('en-US', detailed ? { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' } : { month: 'short', day: 'numeric' }); }
function titleCase(value) { return String(value || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, char => char.toUpperCase()); }
