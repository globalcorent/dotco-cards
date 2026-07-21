let analyticsUser = null;
let analyticsCards = [];
let analyticsViews = [];
let analyticsEvents = [];
let analyticsDays = 30;
let analyticsAdvanced = false;

(async function initAnalytics() {
  analyticsUser = await requireUser();
  if (!analyticsUser) return;

  const [{ data: subscription }, { data: addons }, { data: cards, error: cardError }] = await Promise.all([
    supabaseClient.from('subscriptions').select('plan_key,status').eq('user_id', analyticsUser.id).maybeSingle(),
    supabaseClient.from('subscription_addons').select('addon_key,status').eq('user_id', analyticsUser.id),
    supabaseClient.from('digital_cards').select('id,full_name,company_name,slug,status').order('updated_at', { ascending: false })
  ]);
  if (cardError) toast(cardError.message);
  analyticsCards = cards || [];
  analyticsAdvanced = ['pro', 'agency'].includes(subscription?.plan_key) || (addons || []).some(row => row.addon_key === 'advanced_analytics' && ['active', 'trialing', 'past_due'].includes(row.status));

  document.getElementById('sidebar-plan').textContent = `${titleCase(subscription?.plan_key || 'starter')} plan`;
  document.getElementById('sidebar-plan-copy').textContent = analyticsAdvanced ? 'Advanced analytics enabled.' : 'Basic totals enabled.';
  document.getElementById('analytics-locked').hidden = analyticsAdvanced;
  document.getElementById('analytics-content').classList.toggle('analytics-blurred', !analyticsAdvanced);

  document.querySelectorAll('[data-days]').forEach(button => button.addEventListener('click', async () => {
    analyticsDays = Number(button.dataset.days);
    document.querySelectorAll('[data-days]').forEach(item => item.classList.toggle('active', item === button));
    await loadAnalytics();
  }));
  document.getElementById('sidebar-toggle')?.addEventListener('click', () => document.getElementById('sidebar')?.classList.toggle('open'));

  await loadAnalytics();
  if (window.lucide) lucide.createIcons();
})();

async function loadAnalytics() {
  if (!analyticsCards.length) {
    renderAnalytics();
    return;
  }
  const since = new Date(Date.now() - analyticsDays * 86400000).toISOString();
  const cardIds = analyticsCards.map(card => card.id);
  const [{ data: views, error: viewError }, { data: events, error: eventError }] = await Promise.all([
    supabaseClient.from('card_views').select('card_id,device_type,referrer,viewed_at').in('card_id', cardIds).gte('viewed_at', since).order('viewed_at'),
    supabaseClient.from('card_events').select('card_id,event_type,occurred_at').in('card_id', cardIds).gte('occurred_at', since).order('occurred_at')
  ]);
  if (viewError) toast(viewError.message);
  if (eventError) toast(eventError.message);
  analyticsViews = views || [];
  analyticsEvents = events || [];
  renderAnalytics();
}

function renderAnalytics() {
  const saves = analyticsEvents.filter(event => event.event_type === 'contact_save').length;
  const actions = analyticsEvents.length;
  const views = analyticsViews.length;
  document.getElementById('analytics-views').textContent = views.toLocaleString();
  document.getElementById('analytics-saves').textContent = saves.toLocaleString();
  document.getElementById('analytics-actions').textContent = actions.toLocaleString();
  document.getElementById('analytics-rate').textContent = views ? `${Math.round(saves / views * 100)}%` : '0%';
  document.getElementById('views-change').textContent = `Last ${analyticsDays} days`;

  renderTrend();
  renderActions();
  renderCardPerformance();
  renderDevices();
}

function renderTrend() {
  const chart = document.getElementById('trend-chart');
  const bucketCount = analyticsDays <= 7 ? analyticsDays : analyticsDays <= 30 ? 15 : 18;
  const bucketSize = analyticsDays / bucketCount;
  const buckets = Array.from({ length: bucketCount }, (_, index) => ({
    start: new Date(Date.now() - (analyticsDays - index * bucketSize) * 86400000),
    views: 0
  }));
  analyticsViews.forEach(view => {
    const ageDays = (Date.now() - new Date(view.viewed_at).getTime()) / 86400000;
    const index = Math.min(bucketCount - 1, Math.max(0, Math.floor((analyticsDays - ageDays) / bucketSize)));
    buckets[index].views += 1;
  });
  const max = Math.max(1, ...buckets.map(bucket => bucket.views));
  chart.innerHTML = buckets.map((bucket, index) => `<div class="trend-column" title="${bucket.views} view${bucket.views === 1 ? '' : 's'}">
    <span class="trend-value">${bucket.views || ''}</span>
    <div class="trend-bar" style="height:${Math.max(5, bucket.views / max * 100)}%"></div>
    ${index % Math.ceil(bucketCount / 6) === 0 ? `<small>${bucket.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</small>` : '<small></small>'}
  </div>`).join('');
}

function renderActions() {
  const labels = {
    phone_click: ['Phone calls', 'phone'], text_click: ['Text messages', 'message-square-text'], email_click: ['Emails', 'mail'],
    website_click: ['Website visits', 'globe'], location_click: ['Directions', 'map-pin'], social_click: ['Social clicks', 'share-2'],
    contact_save: ['Contact saves', 'user-round-plus'], share_click: ['Card shares', 'send'], qr_scan: ['QR opens', 'qr-code']
  };
  const counts = {};
  analyticsEvents.forEach(event => counts[event.event_type] = (counts[event.event_type] || 0) + 1);
  const rows = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...rows.map(([, count]) => count));
  document.getElementById('action-breakdown').innerHTML = rows.length ? rows.map(([key, count]) => {
    const [label, icon] = labels[key] || [titleCase(key), 'mouse-pointer-click'];
    return `<div class="metric-row"><span class="metric-icon"><i data-lucide="${icon}" size="16"></i></span><div><strong>${escapeHtml(label)}</strong><span class="metric-progress"><i style="width:${count / max * 100}%"></i></span></div><b>${count}</b></div>`;
  }).join('') : emptyMetric('No actions yet', 'Share a published card to begin collecting engagement.');
  if (window.lucide) lucide.createIcons();
}

function renderCardPerformance() {
  const rows = analyticsCards.map(card => {
    const views = analyticsViews.filter(view => view.card_id === card.id).length;
    const actions = analyticsEvents.filter(event => event.card_id === card.id).length;
    return { card, views, actions };
  }).sort((a, b) => b.views - a.views);
  document.getElementById('card-performance').innerHTML = rows.length ? `<div class="performance-head"><span>Card</span><span>Views</span><span>Actions</span></div>${rows.map(row => `<div class="performance-row"><div><strong>${escapeHtml(row.card.company_name || row.card.full_name || 'Untitled')}</strong><small>${escapeHtml(row.card.status)}</small></div><b>${row.views}</b><b>${row.actions}</b></div>`).join('')}` : emptyMetric('No cards yet', 'Create a card to begin tracking performance.');
}

function renderDevices() {
  const mobile = analyticsViews.filter(view => view.device_type === 'mobile').length;
  const desktop = analyticsViews.length - mobile;
  const total = Math.max(1, analyticsViews.length);
  const mobilePercent = Math.round(mobile / total * 100);
  document.getElementById('device-breakdown').innerHTML = `<div class="donut" style="--value:${mobilePercent}"><div><strong>${mobilePercent}%</strong><span>mobile</span></div></div><div class="device-legend"><span><i class="mobile"></i>Mobile <b>${mobile}</b></span><span><i class="desktop"></i>Desktop <b>${desktop}</b></span></div>`;

  const referrers = {};
  analyticsViews.forEach(view => {
    let label = 'Direct / QR';
    if (view.referrer) {
      try { label = new URL(view.referrer).hostname.replace(/^www\./, ''); } catch (_) { label = 'Other'; }
    }
    referrers[label] = (referrers[label] || 0) + 1;
  });
  const top = Object.entries(referrers).sort((a, b) => b[1] - a[1]).slice(0, 4);
  document.getElementById('referrer-list').innerHTML = top.length ? `<h3 class="mini-heading">Top sources</h3>${top.map(([label, count]) => `<div class="metric-row simple"><span>${escapeHtml(label)}</span><b>${count}</b></div>`).join('')}` : '';
}

function emptyMetric(title, copy) {
  return `<div class="mini-empty"><i data-lucide="activity" size="22"></i><strong>${escapeHtml(title)}</strong><span>${escapeHtml(copy)}</span></div>`;
}

function titleCase(value) {
  return String(value || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}
