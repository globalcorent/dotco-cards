let currentId = null;
let user = null;
let saveTimer = null;
let saveChain = Promise.resolve();
let profileUrl = '';
let subscription = null;
let currentPlan = 'starter';
let templates = [];
let addonDefinitions = [];
let activeAddons = [];
let socialLinks = [];
let services = [];
let products = [];

const fieldNames = [
  'full_name', 'job_title', 'company_name', 'biography', 'phone', 'email', 'website', 'business_address', 'headline',
  'primary_color', 'secondary_color', 'background_color', 'text_color', 'font_family', 'button_style', 'profile_image_shape',
  'border_radius', 'slug', 'template_id', 'profile_image_url', 'booking_url', 'payment_url', 'services_enabled',
  'products_enabled', 'booking_enabled', 'lead_form_enabled'
];

(async function initEditor() {
  user = await requireUser();
  if (!user) return;

  const [subscriptionResult, templateResult, addonDefinitionResult, activeAddonResult] = await Promise.all([
    supabaseClient.from('subscriptions').select('plan_key,status,billing_interval').eq('user_id', user.id).maybeSingle(),
    supabaseClient.from('templates').select('*').eq('is_active', true).order('is_premium').order('name'),
    supabaseClient.from('addon_definitions').select('*').eq('is_active', true).order('sort_order'),
    supabaseClient.from('subscription_addons').select('*').eq('user_id', user.id)
  ]);

  subscription = subscriptionResult.data;
  currentPlan = subscription?.plan_key || 'starter';
  templates = templateResult.data || [];
  addonDefinitions = addonDefinitionResult.data || [];
  activeAddons = (activeAddonResult.data || []).filter(row => ['active', 'trialing', 'past_due'].includes(row.status));

  const params = new URLSearchParams(location.search);
  currentId = params.get('id');
  if (currentId) await loadCard();
  else initializeNewCard();

  applyEntitlements();
  renderTemplates();
  renderSocialRows();
  renderServiceRows();
  renderProductRows();
  wireEvents();
  render();
  updateCompletion();
  if (window.lucide) lucide.createIcons();
})();

function field(name) {
  return document.querySelector(`[name="${name}"]`);
}

function value(name) {
  const element = field(name);
  if (!element) return '';
  return element.type === 'checkbox' ? element.checked : element.value || '';
}

function initializeNewCard() {
  field('primary_color').value = '#5b5cf0';
  field('secondary_color').value = '#9b5de5';
  field('background_color').value = '#ffffff';
  field('text_color').value = '#111827';
  field('status').value = 'draft';
  field('services_enabled').checked = true;
  field('products_enabled').checked = false;
  field('booking_enabled').checked = false;
  field('lead_form_enabled').checked = false;
  socialLinks = [{ platform: 'instagram', url: '' }];
  services = [];
  products = [];
}

async function loadCard() {
  const { data, error } = await supabaseClient.from('digital_cards').select('*').eq('id', currentId).single();
  if (error) {
    toast(error.message);
    return;
  }

  fieldNames.forEach(name => {
    const element = field(name);
    if (!element || data[name] === null || data[name] === undefined) return;
    if (element.type === 'checkbox') element.checked = Boolean(data[name]);
    else element.value = data[name];
  });
  field('show_branding').checked = data.show_branding !== false;
  field('status').value = data.status;
  profileUrl = data.profile_image_url || '';
  updatePhoto();

  const [linksResult, servicesResult, productsResult] = await Promise.all([
    supabaseClient.from('social_links').select('*').eq('card_id', currentId).order('sort_order'),
    supabaseClient.from('card_services').select('*').eq('card_id', currentId).order('sort_order'),
    supabaseClient.from('card_products').select('*').eq('card_id', currentId).order('sort_order')
  ]);
  socialLinks = linksResult.data || [];
  services = servicesResult.data || [];
  products = productsResult.data || [];

  document.querySelectorAll('.template-card').forEach(item => item.classList.toggle('active', item.dataset.template === String(data.template_id || '')));
  updatePublicControls();
}

function wireEvents() {
  document.querySelectorAll('.editor-tab').forEach(tab => tab.addEventListener('click', () => openTab(tab.dataset.tab)));
  document.querySelectorAll('input,textarea,select').forEach(element => {
    if (element.id === 'profile-file' || element.closest('.builder-list')) return;
    element.addEventListener('input', () => {
      enforceEntitlementToggle(element);
      render();
      updateCompletion();
      scheduleSave();
    });
    element.addEventListener('change', () => {
      enforceEntitlementToggle(element);
      render();
      scheduleSave();
    });
  });

  document.getElementById('bio').addEventListener('input', () => document.getElementById('bio-count').textContent = value('biography').length);
  document.getElementById('profile-file').addEventListener('change', uploadPhoto);
  document.getElementById('remove-photo').addEventListener('click', () => {
    profileUrl = '';
    field('profile_image_url').value = '';
    updatePhoto();
    render();
    scheduleSave();
  });
  document.getElementById('add-social').addEventListener('click', () => addSocialRow());
  document.getElementById('add-service').addEventListener('click', () => addServiceRow());
  document.getElementById('add-product').addEventListener('click', () => addProductRow());
  document.getElementById('publish-button').addEventListener('click', togglePublish);
  document.getElementById('panel-publish-button').addEventListener('click', togglePublish);
  document.getElementById('copy-card-link').addEventListener('click', copyCardLink);
  document.getElementById('download-qr').addEventListener('click', () => window.open(document.getElementById('editor-qr').src, '_blank'));
  document.getElementById('mobile-preview-button').addEventListener('click', async () => {
    await flushSave();
    if (!currentId) await save({ silent: true });
    if (currentId) window.open(cardUrl(), '_blank', 'noopener');
  });
  document.getElementById('slug').addEventListener('input', () => {
    field('slug').value = slugify(field('slug').value);
    render();
  });
  document.querySelectorAll('.color-preset').forEach(button => button.addEventListener('click', () => {
    const [primary, secondary, background, text] = button.dataset.colors.split(',');
    field('primary_color').value = primary;
    field('secondary_color').value = secondary;
    field('background_color').value = background;
    field('text_color').value = text;
    document.querySelectorAll('.color-preset').forEach(item => item.classList.remove('active'));
    button.classList.add('active');
    render();
    scheduleSave();
  }));
  document.querySelector('[data-close-dialog]').addEventListener('click', () => document.getElementById('upgrade-dialog').close());
}

function openTab(name) {
  document.querySelectorAll('.editor-tab').forEach(item => item.classList.toggle('active', item.dataset.tab === name));
  document.querySelectorAll('.editor-panel').forEach(item => item.classList.toggle('active', item.dataset.panel === name));
}

function render() {
  const fullName = value('full_name') || 'Your Name';
  const initials = fullName.split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase() || 'YN';
  document.getElementById('p-name').textContent = fullName;
  document.getElementById('p-title').textContent = value('job_title') || 'Your position';
  document.getElementById('p-company').textContent = value('company_name') || 'Your company';
  document.getElementById('p-headline').textContent = value('headline');
  document.getElementById('p-bio').textContent = value('biography') || 'A short introduction about your business will appear here.';
  const previewInitials = document.getElementById('preview-initials');
  if (previewInitials) previewInitials.textContent = initials;

  const primary = value('primary_color') || '#5b5cf0';
  const secondary = value('secondary_color') || '#9b5de5';
  const background = value('background_color') || '#ffffff';
  const text = value('text_color') || '#111827';
  document.getElementById('preview-cover').style.background = `linear-gradient(135deg,${primary},${secondary})`;
  const phone = document.getElementById('phone-preview');
  phone.style.background = background;
  phone.style.color = text;
  phone.style.fontFamily = value('font_family') || 'DM Sans';
  document.querySelectorAll('.preview-action').forEach(button => {
    button.style.borderRadius = `${value('border_radius') || 16}px`;
    if (value('button_style') === 'outline') {
      button.style.background = 'transparent';
      button.style.border = `1px solid ${primary}`;
      button.style.color = primary;
    } else if (value('button_style') === 'soft') {
      button.style.background = `${primary}20`;
      button.style.border = '0';
      button.style.color = primary;
    } else {
      button.style.background = primary;
      button.style.border = '0';
      button.style.color = '#fff';
    }
  });

  const avatar = document.getElementById('preview-avatar');
  avatar.style.borderRadius = value('profile_image_shape') === 'square' ? '8px' : value('profile_image_shape') === 'rounded' ? '25px' : '50%';
  document.getElementById('preview-branding').hidden = !field('show_branding').checked;
  const slug = value('slug') || slugify(fullName) || 'your-name';
  document.getElementById('slug-value').textContent = slug;
  document.getElementById('preview-status').textContent = value('status') === 'published' ? 'Published' : 'Draft';
  renderPreviewTools();
  renderPreviewSocials();
  updatePublicControls();
}

function renderPreviewTools() {
  const tools = [];
  if (value('booking_enabled') && value('booking_url')) tools.push('<span><i data-lucide="calendar-check-2" size="14"></i> Book</span>');
  if (value('payment_url')) tools.push('<span><i data-lucide="badge-dollar-sign" size="14"></i> Pay</span>');
  if (value('lead_form_enabled')) tools.push('<span><i data-lucide="inbox" size="14"></i> Inquire</span>');
  if (value('products_enabled') && products.length) tools.push(`<span><i data-lucide="shopping-bag" size="14"></i> ${products.length} product${products.length === 1 ? '' : 's'}</span>`);
  document.getElementById('preview-tools').innerHTML = tools.join('');
  if (window.lucide) lucide.createIcons();
}

function updatePhoto() {
  field('profile_image_url').value = profileUrl;
  const containers = [document.getElementById('photo-preview'), document.getElementById('preview-avatar')];
  containers.forEach((element, index) => {
    const initials = (value('full_name') || 'YN').split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase();
    element.innerHTML = profileUrl
      ? `<img src="${escapeHtml(profileUrl)}" alt="Profile preview">`
      : index ? `<span id="preview-initials">${initials}</span>` : '<i data-lucide="user-round" size="28"></i>';
  });
  if (window.lucide) lucide.createIcons();
}

async function uploadPhoto(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) return toast('Photo must be smaller than 5 MB');
  const safeName = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-');
  const path = `${user.id}/${Date.now()}-${safeName}`;
  setSaveState('saving', 'Uploading photo…');
  const { error } = await supabaseClient.storage.from('profile-images').upload(path, file, { cacheControl: '3600', upsert: false });
  if (error) {
    setSaveState('saved', 'Saved');
    return toast(error.message);
  }
  const { data } = supabaseClient.storage.from('profile-images').getPublicUrl(path);
  profileUrl = data.publicUrl;
  field('profile_image_url').value = profileUrl;
  updatePhoto();
  render();
  await save({ silent: true });
  toast('Photo uploaded');
}

function renderTemplates() {
  const allowed = hasEntitlement('premium_templates');
  const grid = document.getElementById('template-grid');
  grid.innerHTML = templates.map(template => `<button type="button" class="template-card ${String(value('template_id') || '') === String(template.id) ? 'active' : ''} ${template.is_premium && !allowed ? 'locked' : ''}" data-template="${template.id}" data-premium="${template.is_premium}"><div class="template-preview" style="background:${templateGradient(template.template_key)}"></div><strong>${escapeHtml(template.name)}</strong>${template.is_premium ? `<span class="template-lock"><i data-lucide="${allowed ? 'sparkles' : 'lock'}" size="14"></i></span>` : ''}</button>`).join('');
  grid.querySelectorAll('.template-card').forEach(button => button.addEventListener('click', () => {
    if (button.dataset.premium === 'true' && !allowed) {
      toast('Activate Premium Templates from Add-ons, or upgrade to Pro');
      return;
    }
    field('template_id').value = button.dataset.template;
    grid.querySelectorAll('.template-card').forEach(item => item.classList.remove('active'));
    button.classList.add('active');
    scheduleSave();
  }));
  if (window.lucide) lucide.createIcons();
}

function templateGradient(key) {
  const map = {
    corporate: 'linear-gradient(135deg,#172554,#3b82f6)', minimal: 'linear-gradient(135deg,#f8fafc,#dbeafe)', creative: 'linear-gradient(135deg,#7c3aed,#ec4899)', luxury: 'linear-gradient(135deg,#111827,#b7791f)',
    'real-estate': 'linear-gradient(135deg,#0f766e,#2dd4bf)', beauty: 'linear-gradient(135deg,#be185d,#f9a8d4)', healthcare: 'linear-gradient(135deg,#0369a1,#38bdf8)', restaurant: 'linear-gradient(135deg,#7f1d1d,#f59e0b)',
    contractor: 'linear-gradient(135deg,#292524,#f97316)', automotive: 'linear-gradient(135deg,#111827,#ef4444)', daycare: 'linear-gradient(135deg,#0ea5e9,#f9a8d4)', 'credit-repair': 'linear-gradient(135deg,#166534,#22c55e)'
  };
  return map[key] || 'linear-gradient(135deg,#5b5cf0,#9b5de5)';
}

function addSocialRow(link = { platform: 'instagram', url: '' }) {
  if (socialLinks.length >= 12) return toast('You can add up to 12 social links');
  socialLinks.push(link);
  renderSocialRows();
}

function renderSocialRows() {
  const list = document.getElementById('social-list');
  if (!socialLinks.length) socialLinks = [{ platform: 'instagram', url: '' }];
  const platformOptions = (window.DOTCO_SOCIALS || []).map(item => `<option value="${item.key}">${item.label}</option>`).join('');
  list.innerHTML = socialLinks.map((link, index) => {
    const meta = socialMeta(link.platform);
    return `<div class="social-row" data-social-index="${index}"><div class="social-row-icon">${socialIconHtml(meta.key, { size: 18 })}</div><select class="input" aria-label="Social platform">${platformOptions}</select><input class="input" type="url" placeholder="${escapeHtml(meta.placeholder)}" value="${escapeHtml(link.url || '')}"><button type="button" class="icon-btn" aria-label="Remove link"><i data-lucide="trash-2" size="17"></i></button></div>`;
  }).join('');
  list.querySelectorAll('.social-row').forEach(row => {
    const index = Number(row.dataset.socialIndex);
    const select = row.querySelector('select');
    const input = row.querySelector('input');
    const button = row.querySelector('button');
    select.value = socialKey(socialLinks[index].platform);
    select.addEventListener('change', () => {
      socialLinks[index].platform = select.value;
      const meta = socialMeta(select.value);
      input.placeholder = meta.placeholder;
      row.querySelector('.social-row-icon').innerHTML = socialIconHtml(select.value, { size: 18 });
      render();
      scheduleSave();
    });
    input.addEventListener('input', () => {
      socialLinks[index].url = input.value;
      render();
      scheduleSave();
    });
    button.addEventListener('click', () => {
      socialLinks.splice(index, 1);
      renderSocialRows();
      render();
      scheduleSave();
    });
  });
  if (window.lucide) lucide.createIcons();
}

function renderPreviewSocials() {
  const visible = socialLinks.filter(link => link.url).slice(0, 6);
  document.getElementById('preview-socials').innerHTML = visible.map(link => socialIconHtml(link.platform, { size: 15 })).join('');
}

function addServiceRow(service = { name: '', description: '', price_cents: null, booking_url: '', payment_url: '', cta_label: 'Learn more', image_url: '' }) {
  if (services.length >= 8) return toast('You can add up to 8 services');
  services.push(service);
  renderServiceRows();
  render();
  scheduleSave();
}

function renderServiceRows() {
  const list = document.getElementById('service-list');
  if (!services.length) {
    list.innerHTML = '<div class="builder-empty"><i data-lucide="list-plus" size="20"></i><span>Add services customers can browse from your card.</span></div>';
    if (window.lucide) lucide.createIcons();
    return;
  }
  list.innerHTML = services.map((service, index) => `<div class="builder-row" data-service-index="${index}"><div class="builder-row-head"><strong>Service ${index + 1}</strong><button class="icon-btn" type="button" data-remove-service="${index}"><i data-lucide="trash-2" size="16"></i></button></div><div class="form-row"><input class="input" data-service-field="name" placeholder="Service name" value="${escapeHtml(service.name || '')}"><input class="input" data-service-field="price" inputmode="decimal" placeholder="Price, e.g. 49.00" value="${service.price_cents == null ? '' : (service.price_cents / 100).toFixed(2)}"></div><textarea class="input" data-service-field="description" placeholder="Short service description">${escapeHtml(service.description || '')}</textarea><div class="form-row"><input class="input" data-service-field="booking_url" type="url" placeholder="Booking link (optional)" value="${escapeHtml(service.booking_url || '')}"><input class="input" data-service-field="payment_url" type="url" placeholder="Payment link (optional)" value="${escapeHtml(service.payment_url || '')}"></div></div>`).join('');
  list.querySelectorAll('[data-service-index]').forEach(row => {
    const index = Number(row.dataset.serviceIndex);
    row.querySelectorAll('[data-service-field]').forEach(input => input.addEventListener('input', () => {
      const key = input.dataset.serviceField;
      if (key === 'price') services[index].price_cents = priceToCents(input.value);
      else services[index][key] = input.value;
      render();
      scheduleSave();
    }));
    row.querySelector('[data-remove-service]').addEventListener('click', () => {
      services.splice(index, 1);
      renderServiceRows();
      render();
      scheduleSave();
    });
  });
  if (window.lucide) lucide.createIcons();
}

function addProductRow(product = { name: '', description: '', price_cents: null, image_urls: [], purchase_url: '' }) {
  if (!hasEntitlement('product_showcase')) return toast('Activate Product Showcase from Add-ons');
  if (products.length >= 8) return toast('You can add up to 8 products');
  products.push(product);
  renderProductRows();
  render();
  scheduleSave();
}

function renderProductRows() {
  const list = document.getElementById('product-list');
  if (!products.length) {
    list.innerHTML = '<div class="builder-empty"><i data-lucide="package-plus" size="20"></i><span>Add products, photos, prices, and purchase links.</span></div>';
    if (window.lucide) lucide.createIcons();
    return;
  }
  list.innerHTML = products.map((product, index) => `<div class="builder-row" data-product-index="${index}"><div class="builder-row-head"><strong>Product ${index + 1}</strong><button class="icon-btn" type="button" data-remove-product="${index}"><i data-lucide="trash-2" size="16"></i></button></div><div class="form-row"><input class="input" data-product-field="name" placeholder="Product name" value="${escapeHtml(product.name || '')}"><input class="input" data-product-field="price" inputmode="decimal" placeholder="Price, e.g. 29.99" value="${product.price_cents == null ? '' : (product.price_cents / 100).toFixed(2)}"></div><textarea class="input" data-product-field="description" placeholder="Short product description">${escapeHtml(product.description || '')}</textarea><div class="form-row"><input class="input" data-product-field="image_url" type="url" placeholder="Image URL" value="${escapeHtml(product.image_urls?.[0] || '')}"><input class="input" data-product-field="purchase_url" type="url" placeholder="Buy link" value="${escapeHtml(product.purchase_url || '')}"></div></div>`).join('');
  list.querySelectorAll('[data-product-index]').forEach(row => {
    const index = Number(row.dataset.productIndex);
    row.querySelectorAll('[data-product-field]').forEach(input => input.addEventListener('input', () => {
      const key = input.dataset.productField;
      if (key === 'price') products[index].price_cents = priceToCents(input.value);
      else if (key === 'image_url') products[index].image_urls = input.value ? [input.value] : [];
      else products[index][key] = input.value;
      render();
      scheduleSave();
    }));
    row.querySelector('[data-remove-product]').addEventListener('click', () => {
      products.splice(index, 1);
      renderProductRows();
      render();
      scheduleSave();
    });
  });
  if (window.lucide) lucide.createIcons();
}

function applyEntitlements() {
  const canRemoveBranding = hasEntitlement('remove_branding');
  field('show_branding').disabled = !canRemoveBranding;
  if (!canRemoveBranding) field('show_branding').checked = true;

  ['appointment_booking', 'lead_capture', 'product_showcase'].forEach(key => {
    const enabled = hasEntitlement(key);
    const card = document.querySelector(`[data-entitlement-card="${key}"]`);
    const badge = document.querySelector(`[data-entitlement-badge="${key}"]`);
    if (card) card.classList.toggle('locked', !enabled);
    if (badge) {
      badge.className = `entitlement-badge ${enabled ? 'included' : 'locked'}`;
      badge.innerHTML = enabled ? '<i data-lucide="circle-check" size="14"></i> Enabled' : '<i data-lucide="lock" size="14"></i> Add-on required';
    }
    const fieldName = key === 'appointment_booking' ? 'booking_enabled' : key === 'lead_capture' ? 'lead_form_enabled' : 'products_enabled';
    const toggle = field(fieldName);
    if (toggle) {
      toggle.disabled = !enabled;
      if (!enabled) toggle.checked = false;
    }
  });
  document.getElementById('add-product').disabled = !hasEntitlement('product_showcase');
  if (window.lucide) lucide.createIcons();
}

function enforceEntitlementToggle(element) {
  const mapping = { booking_enabled: 'appointment_booking', lead_form_enabled: 'lead_capture', products_enabled: 'product_showcase' };
  const entitlement = mapping[element.name];
  if (entitlement && element.checked && !hasEntitlement(entitlement)) {
    element.checked = false;
    toast('Activate this feature from the Add-ons marketplace');
  }
}

function hasEntitlement(key) {
  const definition = addonDefinitions.find(item => item.entitlement_key === key || item.addon_key === key);
  if (!definition) return false;
  return definition.included_plans?.includes(currentPlan) || activeAddons.some(row => row.addon_key === definition.addon_key);
}

function setSaveState(state, text) {
  const element = document.getElementById('save-state');
  element.className = `save-state ${state}`;
  element.innerHTML = `<i data-lucide="${state === 'saving' ? 'loader-circle' : state === 'error' ? 'circle-alert' : 'check-circle-2'}" size="16"></i> ${text}`;
  if (window.lucide) lucide.createIcons();
}

function scheduleSave() {
  clearTimeout(saveTimer);
  setSaveState('saving', 'Unsaved changes');
  saveTimer = setTimeout(() => {
    saveTimer = null;
    save({ silent: true });
  }, 700);
}

function save(options = {}) {
  saveChain = saveChain.then(() => performSave(options));
  return saveChain;
}

async function performSave({ silent = false } = {}) {
  setSaveState('saving', 'Saving…');
  try {
    const payload = { user_id: user.id, show_branding: field('show_branding').checked, status: value('status') || 'draft' };
    fieldNames.forEach(name => {
      const raw = value(name);
      if (typeof raw === 'boolean') payload[name] = raw;
      else payload[name] = raw === '' ? null : raw;
    });
    payload.profile_image_url = profileUrl || null;
    if (!payload.slug) payload.slug = `${slugify(payload.full_name || 'card')}-${Math.random().toString(36).slice(2, 6)}`;

    const result = currentId
      ? await supabaseClient.from('digital_cards').update(payload).eq('id', currentId).select().single()
      : await supabaseClient.from('digital_cards').insert(payload).select().single();
    if (result.error) throw result.error;

    currentId = result.data.id;
    history.replaceState({}, '', `editor.html?id=${currentId}`);
    field('slug').value = result.data.slug;
    field('status').value = result.data.status;
    await Promise.all([saveSocialLinks(), saveServices(), saveProducts()]);
    setSaveState('saved', 'Saved');
    updatePublicControls();
    if (!silent) toast('Card saved');
  } catch (error) {
    setSaveState('error', 'Could not save');
    toast(error.message || 'Unable to save card');
    throw error;
  }
}

async function saveSocialLinks() {
  if (!currentId) return;
  const clean = socialLinks.filter(link => link.url?.trim()).map((link, index) => {
    const meta = socialMeta(link.platform);
    return { card_id: currentId, platform: meta.key, label: meta.label, url: link.url.trim(), is_enabled: true, sort_order: index };
  });
  const { error: deleteError } = await supabaseClient.from('social_links').delete().eq('card_id', currentId);
  if (deleteError) throw deleteError;
  if (clean.length) {
    const { error } = await supabaseClient.from('social_links').insert(clean);
    if (error) throw error;
  }
}

async function saveServices() {
  if (!currentId) return;
  const clean = services.filter(service => service.name?.trim()).map((service, index) => ({
    card_id: currentId,
    name: service.name.trim(),
    description: service.description?.trim() || null,
    price_cents: service.price_cents == null ? null : Number(service.price_cents),
    currency: 'usd',
    image_url: service.image_url?.trim() || null,
    booking_url: service.booking_url?.trim() || null,
    payment_url: service.payment_url?.trim() || null,
    cta_label: service.cta_label?.trim() || 'Learn more',
    is_enabled: true,
    sort_order: index
  }));
  const { error: deleteError } = await supabaseClient.from('card_services').delete().eq('card_id', currentId);
  if (deleteError) throw deleteError;
  if (clean.length) {
    const { error } = await supabaseClient.from('card_services').insert(clean);
    if (error) throw error;
  }
}

async function saveProducts() {
  if (!currentId) return;
  const clean = products.filter(product => product.name?.trim()).map((product, index) => ({
    card_id: currentId,
    name: product.name.trim(),
    description: product.description?.trim() || null,
    price_cents: product.price_cents == null ? null : Number(product.price_cents),
    currency: 'usd',
    image_urls: Array.isArray(product.image_urls) ? product.image_urls.filter(Boolean) : [],
    purchase_url: product.purchase_url?.trim() || null,
    is_enabled: true,
    sort_order: index
  }));
  const { error: deleteError } = await supabaseClient.from('card_products').delete().eq('card_id', currentId);
  if (deleteError) throw deleteError;
  if (clean.length) {
    const { error } = await supabaseClient.from('card_products').insert(clean);
    if (error) throw error;
  }
}

async function flushSave() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
    await save({ silent: true });
  } else {
    await saveChain;
  }
}

async function togglePublish() {
  await flushSave();
  if (!currentId) await save({ silent: true });
  if (!currentId) return;
  const active = ['active', 'trialing', 'past_due'].includes(subscription?.status);
  if (!active) {
    document.getElementById('upgrade-dialog').showModal();
    return;
  }
  const next = value('status') === 'published' ? 'draft' : 'published';
  field('status').value = next;
  await save({ silent: true });
  render();
  toast(next === 'published' ? 'Your card is live' : 'Card returned to draft');
}

function updatePublicControls() {
  const published = value('status') === 'published';
  const url = cardUrl();
  document.getElementById('publish-button').innerHTML = published ? '<i data-lucide="pause-circle" size="17"></i> Unpublish' : '<i data-lucide="rocket" size="17"></i> Publish';
  document.getElementById('panel-publish-button').textContent = published ? 'Unpublish card' : 'Publish card';
  document.getElementById('publish-title').textContent = published ? 'Your card is live' : 'Your card is a draft';
  document.getElementById('publish-copy').textContent = published ? 'Customers with your link can view it now.' : 'Only you can preview it until it is published.';
  document.getElementById('share-tools').hidden = !published;
  const preview = document.getElementById('preview-link');
  preview.hidden = !currentId;
  preview.href = url;
  if (published) {
    document.getElementById('editor-qr').src = `https://api.qrserver.com/v1/create-qr-code/?size=420x420&data=${encodeURIComponent(url)}`;
  }
  if (window.lucide) lucide.createIcons();
}

function cardUrl() {
  return dotcoUrl(`card.html?slug=${encodeURIComponent(value('slug') || '')}`);
}

async function copyCardLink() {
  await flushSave();
  if (!currentId) await save({ silent: true });
  if (!currentId) return;
  await navigator.clipboard.writeText(cardUrl());
  toast('Card link copied');
}

function updateCompletion() {
  const required = ['full_name', 'job_title', 'company_name', 'phone', 'email', 'biography'];
  const filled = required.filter(name => value(name)).length;
  const percent = Math.round(filled / required.length * 100);
  document.getElementById('completion-label').textContent = `${percent}% complete`;
  document.getElementById('bio-count').textContent = value('biography').length;
}

function slugify(text) {
  return String(text || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

function priceToCents(value) {
  const amount = Number(String(value || '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : null;
}
