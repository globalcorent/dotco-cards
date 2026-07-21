function toast(message){const t=document.getElementById('toast');if(!t)return;t.textContent=message;t.classList.add('show');clearTimeout(window.__toastTimer);window.__toastTimer=setTimeout(()=>t.classList.remove('show'),3000)}
function escapeHtml(v=''){return String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
async function requireUser(){const {data:{user}}=await supabaseClient.auth.getUser();if(!user){location.href=dotcoUrl('login.html');return null}return user}
async function logout(){await supabaseClient.auth.signOut();location.href=dotcoUrl('login.html')}
