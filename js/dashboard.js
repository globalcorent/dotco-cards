(async()=>{
 const user=await requireUser();if(!user)return;
 document.getElementById('user-email').textContent=user.email;
 const [{data:sub},{data:cards},{data:views},{data:saves}] = await Promise.all([
  supabaseClient.from('subscriptions').select('plan_key,status').single(),
  supabaseClient.from('digital_cards').select('*').order('created_at',{ascending:false}),
  supabaseClient.from('card_views').select('id',{count:'exact',head:true}),
  supabaseClient.from('card_events').select('id',{count:'exact',head:true}).eq('event_type','contact_save')
 ]);
 document.getElementById('plan').textContent=(sub?.plan_key||'starter').toUpperCase();
 document.getElementById('card-count').textContent=cards?.length||0;
 document.getElementById('views').textContent=views?.length||0;
 document.getElementById('saves').textContent=saves?.length||0;
 const list=document.getElementById('card-list');
 if(!cards?.length){list.innerHTML='<div class="card"><h3>No cards yet</h3><p class="muted">Create your first digital business card.</p><a class="btn btn-primary" href="editor.html">Create Card</a></div>';return}
 list.innerHTML=cards.map(c=>`<article class="card card-item"><div class="thumb">${escapeHtml((c.full_name||'DC').slice(0,2).toUpperCase())}</div><h3>${escapeHtml(c.full_name||'Untitled Card')}</h3><p class="muted">${escapeHtml(c.job_title||'')}</p><span>${c.status}</span><div class="card-actions"><a class="btn btn-light" href="editor.html?id=${c.id}">Edit</a><a class="btn btn-light" href="card.html?slug=${encodeURIComponent(c.slug)}" target="_blank">View</a><button class="btn btn-light" onclick="navigator.clipboard.writeText(location.origin+'/card.html?slug=${encodeURIComponent(c.slug)}');toast('Link copied')">Copy</button></div></article>`).join('');
})();
