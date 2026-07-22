function friendlyBillingError(message = '') {
  const text = String(message);
  if (/similar object exists in test mode|No such price/i.test(text)) {
    return 'Billing mode mismatch: the site has test prices but Supabase is using a live Stripe key. Use the sk_test_ key while testing, or add live price IDs before launch.';
  }
  if (/No Stripe customer found/i.test(text)) {
    return 'Choose and complete a plan checkout before opening Manage Billing.';
  }
  if (/already have an active subscription/i.test(text)) {
    return 'Your plan is already active. Choose another plan to upgrade or use Manage Billing.';
  }
  if (/payment method/i.test(text) && /update/i.test(text)) {
    return 'Update your payment method in Manage Billing, then try the plan change again.';
  }
  return text || 'Billing is temporarily unavailable.';
}

async function getCurrentSubscription() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return { session: null, subscription: null };
  const { data: subscription } = await supabaseClient
    .from('subscriptions')
    .select('plan_key,status,billing_interval,stripe_subscription_id')
    .eq('user_id', session.user.id)
    .maybeSingle();
  return { session, subscription };
}

function setPlanButtonsBusy(plan, busy, label = 'Working…') {
  document.querySelectorAll(`[data-plan="${plan}"]`).forEach(button => {
    button.dataset.label = button.dataset.label || button.innerHTML;
    button.disabled = busy;
    button.innerHTML = busy ? `<span class="button-spinner"></span>${label}` : button.dataset.label;
  });
}

async function checkout(plan, interval = 'month') {
  const { session, subscription } = await getCurrentSubscription();
  if (!session) {
    sessionStorage.setItem('dotco_after_login', 'pricing');
    location.href = dotcoUrl('login.html');
    return;
  }

  const active = subscription && ['active', 'trialing', 'past_due'].includes(subscription.status) && subscription.stripe_subscription_id;
  if (active) return changePlan(plan, interval, session, subscription);

  setPlanButtonsBusy(plan, true, 'Opening checkout…');
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
    setPlanButtonsBusy(plan, false);
  }
}

async function changePlan(plan, interval, session = null, subscription = null) {
  if (!session || !subscription) {
    const current = await getCurrentSubscription();
    session = current.session;
    subscription = current.subscription;
  }
  if (!session) return location.href = dotcoUrl('login.html');

  if (subscription?.status === 'past_due') {
    toast('Update your payment method before changing plans.');
    setTimeout(openPortal, 700);
    return;
  }

  if (subscription?.plan_key === plan && subscription?.billing_interval === interval) {
    toast(`You are already on ${titleCase(plan)} ${interval === 'year' ? 'yearly' : 'monthly'}.`);
    return;
  }

  const currentRank = { starter: 1, pro: 2, agency: 3 }[subscription?.plan_key] || 0;
  const targetRank = { starter: 1, pro: 2, agency: 3 }[plan] || 0;
  const verb = targetRank > currentRank ? 'Upgrade' : targetRank < currentRank ? 'Switch' : 'Change billing';
  const accepted = window.confirm(`${verb} to ${titleCase(plan)} ${interval === 'year' ? 'yearly' : 'monthly'}? Stripe will calculate the prorated amount before the next renewal.`);
  if (!accepted) return;

  setPlanButtonsBusy(plan, true, targetRank > currentRank ? 'Upgrading…' : 'Changing plan…');
  try {
    const res = await fetch(`${DOTCO_CONFIG.supabaseUrl}/functions/v1/manage-plan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ plan, interval })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Unable to change plan');

    toast(data.message || `${titleCase(plan)} plan selected`);
    if (data.paymentUrl) {
      setTimeout(() => location.href = data.paymentUrl, 500);
      return;
    }
    setTimeout(() => location.href = dotcoUrl('dashboard.html?billing=plan-changed'), 850);
  } catch (error) {
    toast(friendlyBillingError(error.message));
    setPlanButtonsBusy(plan, false);
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
