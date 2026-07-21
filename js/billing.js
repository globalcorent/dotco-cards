function friendlyBillingError(message = '') {
  const text = String(message);
  if (/similar object exists in test mode|No such price/i.test(text)) {
    return 'Billing mode mismatch: the site has test prices but Supabase is using a live Stripe key. Use the sk_test_ key while testing, or add live price IDs before launch.';
  }
  if (/No Stripe customer found/i.test(text)) {
    return 'Choose and complete a plan checkout before opening Manage Billing.';
  }
  if (/already have an active subscription/i.test(text)) {
    return 'You already have an active plan. Use Manage Billing from your dashboard.';
  }
  return text || 'Billing is temporarily unavailable.';
}

async function checkout(plan, interval = 'month') {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    sessionStorage.setItem('dotco_after_login', 'pricing');
    location.href = dotcoUrl('login.html');
    return;
  }

  const buttons = document.querySelectorAll(`[data-plan="${plan}"]`);
  buttons.forEach(button => {
    button.disabled = true;
    button.dataset.label = button.dataset.label || button.innerHTML;
    button.textContent = 'Opening checkout…';
  });

  try {
    const res = await fetch(`${DOTCO_CONFIG.supabaseUrl}/functions/v1/create-checkout-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        plan,
        interval,
        successUrl: dotcoUrl('dashboard.html?billing=success'),
        cancelUrl: location.href
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Unable to open checkout');
    location.href = data.url;
  } catch (error) {
    toast(friendlyBillingError(error.message));
    buttons.forEach(button => {
      button.disabled = false;
      button.innerHTML = button.dataset.label;
    });
  }
}

async function openPortal() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    location.href = dotcoUrl('login.html');
    return;
  }

  try {
    const res = await fetch(`${DOTCO_CONFIG.supabaseUrl}/functions/v1/create-portal-session`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ returnUrl: dotcoUrl('dashboard.html') })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Unable to open billing portal');
    location.href = data.url;
  } catch (error) {
    toast(friendlyBillingError(error.message));
  }
}
