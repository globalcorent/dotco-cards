function toast(message) {
  const element = document.getElementById('toast');
  if (!element) return;
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => element.classList.remove('show'), 3000);
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[character]);
}

function titleCase(value = '') {
  return String(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, character => character.toUpperCase());
}

async function requireUser() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) {
    location.href = dotcoUrl('login.html');
    return null;
  }
  return user;
}

async function logout() {
  await supabaseClient.auth.signOut();
  location.href = dotcoUrl('login.html');
}
