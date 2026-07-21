let publicCard = null;
let ownerPreview = false;

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
  const timeout = setTimeout(() => {
    showUnavailable('Still loading', 'The card took too long to load. Refresh the page and try again.');
  }, 12000);

  try {
    if (!slug) {
      showUnavailable('Card not found', 'The card address is incomplete.');
      return;
    }

    const { data: authData } = await supabaseClient.auth.getUser();
    const signedInUser = authData?.user || null;

    // RLS allows everyone to read published cards and lets owners read their own drafts.
    const { data: card, error } = await supabaseClient
      .from('digital_cards')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();

    if (error || !card) {
      showUnavailable('Card unavailable', 'This card is private, unpublished, or no longer active.');
      return;
    }

    ownerPreview = card.status !== 'published' && signedInUser?.id === card.user_id;
    if (card.status !== 'published' && !ownerPreview) {
      showUnavailable('Card not published', 'The owner is still working on this card.');
      return;
    }

    publicCard = card;

    const { data: links, error: linksError } = await supabaseClient
      .from('social_links')
      .select('*')
      .eq('card_id', card.id)
      .eq('is_enabled', true)
      .order('sort_order');

    if (linksError) console.warn('Unable to load social links:', linksError.message);

    renderCard(card, links || [], ownerPreview);
    if (!ownerPreview) await recordView(card.id);
  } catch (error) {
    console.error(error);
    showUnavailable('Unable to load card', 'Please refresh the page. If the problem continues, contact the card owner.');
  } finally {
    clearTimeout(timeout);
  }
})();

function renderCard(cardData, links, isPreview) {
  document.title = cardData.seo_title || `${cardData.full_name} | Digital Business Card`;

  const card = document.getElementById('card');
  card.style.background = cardData.background_color || '#fff';
  card.style.color = cardData.text_color || '#111827';
  card.style.fontFamily = cardData.font_family || 'DM Sans';

  const primary = cardData.primary_color || '#5b5cf0';
  const secondary = cardData.secondary_color || '#9b5de5';
  document.getElementById('public-cover').style.background =
    cardData.gradient_background || `linear-gradient(135deg, ${primary}, ${secondary})`;
  document.querySelector('meta[name="theme-color"]').content = primary;

  document.getElementById('name').textContent = cardData.full_name || '';
  document.getElementById('title').textContent = cardData.job_title || '';
  document.getElementById('company').textContent = cardData.company_name || '';
  document.getElementById('headline').textContent = cardData.headline || '';
  document.getElementById('bio').textContent = cardData.biography || '';

  const initials = (cardData.full_name || 'DC')
    .split(/\s+/)
    .map(part => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const avatar = document.getElementById('avatar');
  avatar.style.borderRadius =
    cardData.profile_image_shape === 'square'
      ? '10px'
      : cardData.profile_image_shape === 'rounded'
        ? '27px'
        : '50%';
  avatar.innerHTML = cardData.profile_image_url
    ? `<img src="${escapeHtml(cardData.profile_image_url)}" alt="${escapeHtml(cardData.full_name || 'Profile photo')}">`
    : `<span>${initials}</span>`;

  renderActions(cardData, primary);
  renderSocials(links);

  document.getElementById('branding').hidden = cardData.show_branding === false;
  document.getElementById('qr').src =
    `https://api.qrserver.com/v1/create-qr-code/?size=480x480&data=${encodeURIComponent(location.href)}`;

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

function renderActions(cardData, primary) {
  const actions = [
    { label: 'Call', icon: 'phone', href: cardData.phone && `tel:${cardData.phone}`, event: 'phone_click' },
    { label: 'Text', icon: 'message-square-text', href: cardData.phone && `sms:${cardData.phone}`, event: 'text_click' },
    { label: 'Email', icon: 'mail', href: cardData.email && `mailto:${cardData.email}`, event: 'email_click' },
    { label: 'Website', icon: 'globe', href: normalizeUrl(cardData.website), event: 'website_click' },
    {
      label: 'Directions', icon: 'map-pin',
      href: cardData.business_address && `https://maps.google.com/?q=${encodeURIComponent(cardData.business_address)}`,
      event: 'location_click'
    }
  ].filter(action => action.href).slice(0, 4);

  const area = document.getElementById('actions');
  area.innerHTML = actions.map(action => `
    <a class="action-tile" href="${escapeHtml(action.href)}"
       target="${action.href.startsWith('http') ? '_blank' : '_self'}"
       data-event="${action.event}"
       style="color:${primary};background:${primary}14">
      <i data-lucide="${action.icon}" size="19"></i><span>${action.label}</span>
    </a>`).join('');

  area.querySelectorAll('[data-event]').forEach(link =>
    link.addEventListener('click', () => track(link.dataset.event))
  );
}

function renderSocials(links) {
  if (!links.length) return;
  document.getElementById('social-section').hidden = false;
  document.getElementById('socials').innerHTML = links.map(link => `
    <a class="social-chip" href="${escapeHtml(normalizeUrl(link.url))}" target="_blank" data-id="${link.id}">
      <i data-lucide="${platformIcon(link.platform)}" size="16"></i>${escapeHtml(link.label || link.platform)}
    </a>`).join('');
  document.querySelectorAll('.social-chip').forEach(link =>
    link.addEventListener('click', () => track('social_click', link.dataset.id))
  );
}

function platformIcon(platform) {
  const key = String(platform).toLowerCase();
  return ({
    instagram: 'instagram', facebook: 'facebook', linkedin: 'linkedin', youtube: 'youtube',
    whatsapp: 'message-circle', website: 'globe', tiktok: 'music-2', x: 'at-sign', pinterest: 'pin'
  })[key] || 'link';
}

async function shareCard() {
  const data = {
    title: publicCard?.full_name || 'Digital business card',
    text: `Connect with ${publicCard?.full_name || 'me'}`,
    url: location.href
  };
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
  loading.innerHTML = `
    <span class="empty-icon"><i data-lucide="link-2-off" size="28"></i></span>
    <h2>${escapeHtml(title)}</h2>
    <p class="muted">${escapeHtml(message)}</p>
    <a class="btn btn-light" href="index.html">Visit DotCo Cards</a>`;
  if (window.lucide) lucide.createIcons();
}
