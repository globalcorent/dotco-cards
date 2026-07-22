let selectedInterval = 'month';
let currentPricingSubscription = null;

document.querySelectorAll('[data-interval]').forEach(button => button.addEventListener('click', () => {
  selectedInterval = button.dataset.interval;
  document.querySelectorAll('[data-interval]').forEach(item => item.classList.toggle('active', item === button));
  document.querySelectorAll('.price').forEach(price => {
    price.innerHTML = `${price.dataset[selectedInterval]} <small>/month</small>`;
  });
  document.querySelectorAll('.price-sub').forEach(copy => {
    copy.textContent = copy.dataset[`${selectedInterval}Copy`];
  });
  renderPricingButtons();
}));

document.querySelectorAll('[data-plan]').forEach(button => button.addEventListener('click', () => checkout(button.dataset.plan, selectedInterval)));

(async function loadPricingState() {
  const { subscription } = await getCurrentSubscription();
  currentPricingSubscription = subscription;
  renderPricingButtons();
  if (window.lucide) lucide.createIcons();
})();

function renderPricingButtons() {
  const active = currentPricingSubscription && ['active', 'trialing', 'past_due'].includes(currentPricingSubscription.status);
  const currentRank = { starter: 1, pro: 2, agency: 3 }[currentPricingSubscription?.plan_key] || 0;

  document.querySelectorAll('[data-plan]').forEach(button => {
    const plan = button.dataset.plan;
    const targetRank = { starter: 1, pro: 2, agency: 3 }[plan] || 0;
    const exactCurrent = active && currentPricingSubscription.plan_key === plan && currentPricingSubscription.billing_interval === selectedInterval;

    button.disabled = exactCurrent;
    button.classList.toggle('btn-current-plan', exactCurrent);
    if (!active) {
      button.textContent = `Choose ${titleCase(plan)}`;
    } else if (exactCurrent) {
      button.innerHTML = '<i data-lucide="circle-check" size="17"></i> Current plan';
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
