let selectedInterval = 'month';
let currentPricingSubscription = null;

const planRanks = { starter: 1, pro: 2, agency: 3 };

document.querySelectorAll('[data-interval]').forEach(button => button.addEventListener('click', () => {
  selectedInterval = button.dataset.interval;
  document.querySelectorAll('[data-interval]').forEach(item => item.classList.toggle('active', item === button));
  document.querySelectorAll('.price').forEach(price => {
    const amount = price.dataset[selectedInterval];
    price.innerHTML = amount === 'Free' ? 'Free <small>forever</small>' : `${amount} <small>/month</small>`;
  });
  document.querySelectorAll('.price-sub').forEach(copy => {
    copy.textContent = copy.dataset[`${selectedInterval}Copy`];
  });
  renderPricingButtons();
}));

document.querySelectorAll('[data-plan]').forEach(button => {
  button.addEventListener('click', () => checkout(button.dataset.plan, selectedInterval));
});

document.querySelectorAll('[data-offer]').forEach(button => {
  button.addEventListener('click', () => checkoutOneTime(button.dataset.offer, button));
});

(async function loadPricingState() {
  const { subscription } = await getCurrentSubscription();
  currentPricingSubscription = subscription;
  renderPricingButtons();
  if (window.lucide) lucide.createIcons();
})();

function renderPricingButtons() {
  const active = currentPricingSubscription && ['active', 'trialing', 'past_due'].includes(currentPricingSubscription.status);
  const paidSubscription = active && Boolean(currentPricingSubscription.stripe_subscription_id);
  const currentPlan = currentPricingSubscription?.plan_key || null;
  const currentRank = planRanks[currentPlan] || 0;

  document.querySelectorAll('[data-plan]').forEach(button => {
    const plan = button.dataset.plan;
    const targetRank = planRanks[plan] || 0;
    const exactCurrent = active && currentPlan === plan && (plan === 'starter' || currentPricingSubscription.billing_interval === selectedInterval);

    button.disabled = exactCurrent;
    button.classList.toggle('btn-current-plan', exactCurrent);

    if (!active) {
      button.textContent = plan === 'starter' ? 'Start free' : `Choose ${titleCase(plan)}`;
    } else if (exactCurrent) {
      button.innerHTML = '<i data-lucide="circle-check" size="17"></i> Current plan';
    } else if (plan === 'starter' && paidSubscription) {
      button.innerHTML = '<i data-lucide="calendar-clock" size="17"></i> Move to Free at renewal';
    } else if (targetRank > currentRank) {
      button.innerHTML = `<i data-lucide="arrow-up-right" size="17"></i> Upgrade to ${titleCase(plan)}`;
    } else if (targetRank < currentRank) {
      button.textContent = `Switch to ${titleCase(plan)}`;
    } else {
      button.textContent = `Switch to ${selectedInterval === 'year' ? 'yearly' : 'monthly'}`;
    }
    button.dataset.label = button.innerHTML;
  });

  if (window.lucide) lucide.createIcons();
}
