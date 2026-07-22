let publicCard = null;
let ownerPreview = false;
const publicCardLoadedAt = Date.now();

window.track = async function (type, targetId = null, metadata = {}) {
  if (!publicCard || ownerPreview) return;
  try {
    await supabaseClient.from('card_events').insert({
      card_id: publicCard.id,
      event_type: type,
      target_id: targetId,
      visitor_id: getVisitor(),
      device_type: /Mobi/.test(navigator.userAgent) ? 'mobile' : 'desktop',
      browser: navigator.userAgent.slice(0, 100),
      referrer: document.referrer || null,
      metadata
    });
  } catch (_) {}
};

(async function loadPublicCard() {
  const slug = new URLSearchParams(location.search).get('slug');
  const timeout = setTimeout(() => showUnavailable('Still loading', 'The card took too long to load. Refresh the page and try again.'), 12000);
  try {
    if (!slug) return showUnavailable('Card not found', 'The card address is incomplete.');

    const { data: authData } = await supabaseClient.auth.getUser();
    const signedInUser = authData?.user || null;
    const { data: card, error } = await supabaseClient.from('digital_cards').select('*').eq('slug', slug).maybeSingle();
    if (error || !card) return showUnavailable('Card unavailable', 'This card is private, unpublished, or no longer active.');

    ownerPreview = card.status !== 'published' && signedInUser?.id === card.user_id;
    if (card.status !== 'published' && !ownerPreview) return showUnavailable('Card not published', 'The owner is still working on this card.');
    publicCard = card;

    const [linksResult, servicesResult, productsResult] = await Promise.all([
      supabaseClient.from('social_links').select('*').eq('card_id', card.id).eq('is_enabled', true).order('sort_order'),
      supabaseClient.from('card_services').select('*').eq('card_id', card.id).eq('is_enabled', true).order('sort_order'),
      supabaseClient.from('card_products').select('*').eq('card_id', card.id).eq('is_enabled', true).order('sort_order')
    ]);

    renderCard(card, linksResult.data || [], servicesResult.data || [], productsResult.data || [], ownerPreview);
    if (!ownerPreview) await recordView(card.id);
  } catch (error) {
    console.error(error);
    showUnavailable('Unable to load card', 'Please refresh the page. If the problem continues, contact the card owner.');
  } finally {
    clearTimeout(timeout);
  }
})();

function renderCard(cardData, links, services, products, isPreview) {
  document.title = cardData.seo_title || `${cardData.full_name} | Digital Business Card`;
  const card = document.getElementById('card');
  const layout = safePublicLayout(cardData.card_layout || 'classic');
  const colorMode = cardData.color_mode === 'dark' ? 'dark' : 'light';
  const primary = cardData.primary_color || '#5b5cf0';
  const secondary = cardData.secondary_color || '#9b5de5';
  const buttonColor = cardData.button_color || primary;
  const buttonTextColor = cardData.button_text_color || '#ffffff';
  card.className = `public-card public-layout-${layout} public-mode-${colorMode}`;
  card.style.background = cardData.background_color || '#fff';
  card.style.color = cardData.text_color || '#111827';
  card.style.fontFamily = cardData.font_family || 'DM Sans';
  card.style.setProperty('--card-primary', primary);
  card.style.setProperty('--card-secondary', secondary);
  card.style.setProperty('--card-button', buttonColor);
  card.style.setProperty('--card-button-text', buttonTextColor);
  card.style.setProperty('--card-radius', `${cardData.border_radius || 16}px`);
  card.dataset.buttonStyle = cardData.button_style || 'filled';

  document.getElementById('public-cover').style.background = cardData.gradient_background || `linear-gradient(135deg, ${primary}, ${secondary})`;
  document.querySelector('meta[name="theme-color"]').content = primary;

  document.getElementById('name').textContent = cardData.full_name || '';
  document.getElementById('title').textContent = cardData.job_title || '';
  document.getElementById('company').textContent = cardData.company_name || '';
  document.getElementById('headline').textContent = cardData.headline || '';
  document.getElementById('bio').textContent = cardData.biography || '';

  const initials = (cardData.full_name || 'DC').split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase();
  const avatar = document.getElementById('avatar');
  avatar.style.borderRadius = cardData.profile_image_shape === 'square' ? '10px' : cardData.profile_image_shape === 'rounded' ? '27px' : '50%';
  avatar.innerHTML = cardData.profile_image_url
    ? `<img src="${escapeHtml(cardData.profile_image_url)}" alt="${escapeHtml(cardData.full_name || 'Profile photo')}">`
    : `<span>${escapeHtml(initials)}</span>`;

  renderActions(cardData, primary);
  renderBusinessActions(cardData, primary);
  renderSocials(links);
  renderServices(cardData.services_enabled ? services : []);
  renderProducts(cardData.products_enabled ? products : []);
  renderLeadCapture(cardData, services, isPreview);

  document.getElementById('branding').hidden = cardData.show_branding === false;
  document.getElementById('qr').src = `https://api.qrserver.com/v1/create-qr-code/?size=480x480&data=${encodeURIComponent(location.href)}`;
  document.getElementById('save').onclick = () => saveVcard(cardData);
  document.getElementById('sticky-save').onclick = () => saveVcard(cardData);
  document.getElementById('share-top').onclick = shareCard;
  document.getElementById('qr-top').onclick = () => {
    document.getElementById('qr-dialog').showModal();
    track('qr_scan');
  };
  document.getElementById('close-qr').onclick = () => document.getElementById('qr-dialog').close();
  document.getElementById('copy-link').onclick = copyLink;

  document.getElementById('preview-banner').hidden = !isPreview;
  document.getElementById('loading').hidden = true;
  card.hidden = false;
  document.getElementById('sticky-save').hidden = false;
  if (window.lucide) lucide.createIcons();
}

function safePublicLayout(value) {
  const layout = String(value || 'classic').toLowerCase().replace(/[^a-z0-9-]/g, '');
  return ['classic', 'executive', 'minimal', 'spotlight', 'luxe', 'split', 'bold', 'soft', 'playful', 'editorial'].includes(layout) ? layout : 'classic';
}

function renderActions(cardData, primary) {
  const actions = [
    { label: 'Call', icon: 'phone', href: cardData.phone && `tel:${cardData.phone}`, event: 'phone_click' },
    { label: 'Text', icon: 'message-square-text', href: cardData.phone && `sms:${cardData.phone}`, event: 'text_click' },
    { label: 'Email', icon: 'mail', href: cardData.email && `mailto:${cardData.email}`, event: 'email_click' },
    { label: 'Website', icon: 'globe', href: normalizeUrl(cardData.website), event: 'website_click' },
    { label: 'Directions', icon: 'map-pin', href: cardData.business_address && `https://maps.google.com/?q=${encodeURIComponent(cardData.business_address)}`, event: 'location_click' }
  ].filter(action => action.href).slice(0, 4);

  const area = document.getElementById('actions');
  area.innerHTML = actions.map(action => `<a class="action-tile" href="${escapeHtml(action.href)}" target="${action.href.startsWith('http') ? '_blank' : '_self'}" rel="noopener" data-event="${action.event}" style="color:var(--card-primary);background:color-mix(in srgb,var(--card-primary) 9%,transparent)"><i data-lucide="${action.icon}" size="19"></i><span>${action.label}</span></a>`).join('');
  area.querySelectorAll('[data-event]').forEach(link => link.addEventListener('click', () => track(link.dataset.event)));
}

function renderBusinessActions(cardData, primary) {
  const actions = [];
  if (cardData.booking_enabled && cardData.booking_url) actions.push({ label: 'Book an appointment', icon: 'calendar-check-2', href: normalizeUrl(cardData.booking_url), event: 'booking_click' });
  if (cardData.payment_url) actions.push({ label: 'Make a payment', icon: 'badge-dollar-sign', href: normalizeUrl(cardData.payment_url), event: 'payment_click' });
  if (cardData.lead_form_enabled) actions.push({ label: 'Send an inquiry', icon: 'inbox', href: '#lead-section', event: 'lead_form_open' });
  const area = document.getElementById('business-actions');
  area.innerHTML = actions.map((action, index) => `<a class="business-action ${index === 0 ? 'primary' : ''}" href="${escapeHtml(action.href)}" ${action.href.startsWith('#') ? '' : 'target="_blank" rel="noopener"'} data-business-event="${action.event}" style="--action-color:${primary}"><i data-lucide="${action.icon}" size="19"></i><span>${action.label}</span><i data-lucide="arrow-up-right" size="17"></i></a>`).join('');
  area.querySelectorAll('[data-business-event]').forEach(link => link.addEventListener('click', () => track(link.dataset.businessEvent)));
}

function renderSocials(links) {
  const section = document.getElementById('social-section');
  if (!links.length) {
    section.hidden = true;
    return;
  }
  section.hidden = false;
  document.getElementById('socials').innerHTML = links.map(link => {
    const meta = socialMeta(link.platform);
    return `<a class="social-chip social-chip-${meta.key}" href="${escapeHtml(normalizeUrl(link.url))}" target="_blank" rel="noopener" data-id="${link.id}">${socialIconHtml(meta.key, { size: 17 })}<span>${escapeHtml(link.label || meta.label)}</span></a>`;
  }).join('');
  document.querySelectorAll('.social-chip').forEach(link => link.addEventListener('click', () => track('social_click', link.dataset.id)));
}

function renderServices(services) {
  const section = document.getElementById('services-section');
  if (!services.length) {
    section.hidden = true;
    return;
  }
  section.hidden = false;
  document.getElementById('services').innerHTML = services.map(service => {
    const url = service.booking_url || service.payment_url || '';
    return `<article class="public-service-card"><div class="service-card-main"><div><h3>${escapeHtml(service.name)}</h3>${service.description ? `<p>${escapeHtml(service.description)}</p>` : ''}</div>${service.price_cents != null ? `<strong>${formatMoney(service.price_cents)}</strong>` : ''}</div>${url ? `<a href="${escapeHtml(normalizeUrl(url))}" target="_blank" rel="noopener" data-service-id="${service.id}">${escapeHtml(service.cta_label || (service.booking_url ? 'Book now' : 'Pay now'))}<i data-lucide="arrow-right" size="16"></i></a>` : ''}</article>`;
  }).join('');
  document.querySelectorAll('[data-service-id]').forEach(link => link.addEventListener('click', () => track('service_click', link.dataset.serviceId)));
}

function renderProducts(products) {
  const section = document.getElementById('products-section');
  if (!products.length) {
    section.hidden = true;
    return;
  }
  section.hidden = false;
  document.getElementById('products').innerHTML = products.map(product => {
    const image = Array.isArray(product.image_urls) ? product.image_urls[0] : null;
    return `<article class="public-product-card">${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(product.name)}" loading="lazy">` : `<div class="product-placeholder"><i data-lucide="package" size="24"></i></div>`}<div class="public-product-copy"><h3>${escapeHtml(product.name)}</h3>${product.description ? `<p>${escapeHtml(product.description)}</p>` : ''}<div>${product.price_cents != null ? `<strong>${formatMoney(product.price_cents)}</strong>` : '<span></span>'}${product.purchase_url ? `<a href="${escapeHtml(normalizeUrl(product.purchase_url))}" target="_blank" rel="noopener" data-product-id="${product.id}">Buy <i data-lucide="arrow-up-right" size="15"></i></a>` : ''}</div></div></article>`;
  }).join('');
  document.querySelectorAll('[data-product-id]').forEach(link => link.addEventListener('click', () => track('product_click', link.dataset.productId)));
}

function renderLeadCapture(cardData, services, isPreview) {
  const section = document.getElementById('lead-section');
  section.hidden = !cardData.lead_form_enabled;
  if (!cardData.lead_form_enabled) return;
  const form = document.getElementById('lead-form');
  const serviceSelect = document.getElementById('lead-service');
  const serviceNames = (services || []).map(service => service.name).filter(Boolean);
  if (serviceNames.length) {
    serviceSelect.hidden = false;
    serviceSelect.innerHTML = '<option value="">What are you interested in?</option>' + serviceNames.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
  } else {
    serviceSelect.hidden = true;
  }
  if (isPreview) {
    form.querySelector('button[type="submit"]').disabled = true;
    form.querySelector('button[type="submit"]').innerHTML = '<i data-lucide="eye" size="17"></i> Disabled in draft preview';
    return;
  }
  form.addEventListener('submit', submitLead);
}

async function submitLead(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const original = button.innerHTML;
  button.disabled = true;
  button.innerHTML = '<span class="button-spinner"></span> Sending…';
  const data = new FormData(form);
  if (String(data.get('website_check') || '').trim()) {
    form.reset();
    button.disabled = false;
    button.innerHTML = original;
    return toast('Inquiry sent successfully');
  }
  if (Date.now() - publicCardLoadedAt < 900) {
    button.disabled = false;
    button.innerHTML = original;
    return toast('Please wait a moment and try again.');
  }
  const { error } = await supabaseClient.from('leads').insert({
    card_id: publicCard.id,
    owner_user_id: publicCard.user_id,
    name: String(data.get('name') || '').trim(),
    email: String(data.get('email') || '').trim() || null,
    phone: String(data.get('phone') || '').trim() || null,
    message: String(data.get('message') || '').trim(),
    service_interest: String(data.get('service_interest') || '').trim() || null
  });
  button.disabled = false;
  button.innerHTML = original;
  if (error) return toast('Unable to send. Please contact the business directly.');
  form.reset();
  track('lead_submit');
  toast('Inquiry sent successfully');
}

async function shareCard() {
  const data = { title: publicCard?.full_name || 'Digital business card', text: `Connect with ${publicCard?.full_name || 'me'}`, url: location.href };
  try {
    if (navigator.share) await navigator.share(data);
    else await navigator.clipboard.writeText(location.href);
    track('share_click');
    toast(navigator.share ? 'Share sheet opened' : 'Card link copied');
  } catch (_) {}
}

async function copyLink() {
  await navigator.clipboard.writeText(location.href);
  track('share_click');
  toast('Card link copied');
}

async function recordView(cardId) {
  try {
    await supabaseClient.from('card_views').insert({
      card_id: cardId,
      visitor_id: getVisitor(),
      device_type: /Mobi/.test(navigator.userAgent) ? 'mobile' : 'desktop',
      browser: navigator.userAgent.slice(0, 100),
      referrer: document.referrer || null
    });
  } catch (_) {}
}

function getVisitor() {
  let id = localStorage.dotcoVisitor;
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.dotcoVisitor = id;
  }
  return id;
}

function normalizeUrl(url) {
  if (!url) return '';
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function formatMoney(cents) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(cents || 0) / 100);
}

function vcardEscape(value = '') {
  return String(value).replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
}

function saveVcard(cardData) {
  const names = (cardData.full_name || '').trim().split(/\s+/);
  const last = names.length > 1 ? names.pop() : '';
  const first = names.join(' ');
  const vcard = `BEGIN:VCARD\r\nVERSION:3.0\r\nN:${vcardEscape(last)};${vcardEscape(first)};;;\r\nFN:${vcardEscape(cardData.full_name || '')}\r\nORG:${vcardEscape(cardData.company_name || '')}\r\nTITLE:${vcardEscape(cardData.job_title || '')}\r\nTEL;TYPE=CELL:${vcardEscape(cardData.phone || '')}\r\nEMAIL;TYPE=INTERNET:${vcardEscape(cardData.email || '')}\r\nURL:${vcardEscape(cardData.website || '')}\r\nADR;TYPE=WORK:;;${vcardEscape(cardData.business_address || '')};;;;\r\nNOTE:${vcardEscape(cardData.biography || '')}\r\nEND:VCARD\r\n`;
  const url = URL.createObjectURL(new Blob([vcard], { type: 'text/vcard;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${cardData.slug || 'contact'}.vcf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  track('contact_save');
  toast('Contact downloaded');
}

function showUnavailable(title, message) {
  const loading = document.getElementById('loading');
  document.getElementById('card').hidden = true;
  document.getElementById('sticky-save').hidden = true;
  loading.hidden = false;
  loading.innerHTML = `<span class="empty-icon"><i data-lucide="link-2-off" size="28"></i></span><h2>${escapeHtml(title)}</h2><p class="muted">${escapeHtml(message)}</p><a class="btn btn-light" href="index.html">Visit DotCo Cards</a>`;
  if (window.lucide) lucide.createIcons();
}
