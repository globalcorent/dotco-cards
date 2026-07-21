(async()=>{
 const slug=new URLSearchParams(location.search).get('slug');if(!slug)return document.getElementById('card').innerHTML='<h2>Card not found</h2>';
 const {data:c,error}=await supabaseClient.from('digital_cards').select('*').eq('slug',slug).eq('status','published').single();
 if(error||!c)return document.getElementById('card').innerHTML='<h2>Card unavailable</h2><p>This card may be private or unpublished.</p>';
 document.title=c.seo_title||`${c.full_name} | DotCo Card`;
 const card=document.getElementById('card');card.style.background=c.background_color;card.style.color=c.text_color;
 document.getElementById('name').textContent=c.full_name;document.getElementById('title').textContent=c.job_title||'';document.getElementById('company').textContent=c.company_name||'';document.getElementById('bio').textContent=c.biography||'';
 if(c.profile_image_url){const img=document.getElementById('avatar');img.src=c.profile_image_url}
 const actions=document.getElementById('actions');
 const defs=[['Call',c.phone&&`tel:${c.phone}`,'phone_click'],['Email',c.email&&`mailto:${c.email}`,'email_click'],['Website',c.website,'website_click'],['Directions',c.business_address&&`https://maps.google.com/?q=${encodeURIComponent(c.business_address)}`,'location_click']];
 actions.innerHTML=defs.filter(x=>x[1]).map(x=>`<a class="btn btn-primary" href="${escapeHtml(x[1])}" target="_blank" onclick="track('${x[2]}')">${x[0]}</a>`).join('');
 document.getElementById('save').onclick=()=>saveVcard(c);
 document.getElementById('share').onclick=async()=>{const data={title:c.full_name,url:location.href};navigator.share?await navigator.share(data):await navigator.clipboard.writeText(location.href);track('share_click');toast('Shared')};
 document.getElementById('qr').src=`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(location.href)}`;
 await supabaseClient.from('card_views').insert({card_id:c.id,visitor_id:getVisitor(),device_type:/Mobi/.test(navigator.userAgent)?'mobile':'desktop',browser:navigator.userAgent.slice(0,100),referrer:document.referrer||null});
 window.track=async(type)=>supabaseClient.from('card_events').insert({card_id:c.id,event_type:type,visitor_id:getVisitor(),device_type:/Mobi/.test(navigator.userAgent)?'mobile':'desktop'});
 window.cardData=c;
})();
function getVisitor(){let id=localStorage.dotcoVisitor;if(!id){id=crypto.randomUUID();localStorage.dotcoVisitor=id}return id}
function saveVcard(c){const v=`BEGIN:VCARD\nVERSION:3.0\nFN:${c.full_name}\nORG:${c.company_name||''}\nTITLE:${c.job_title||''}\nTEL:${c.phone||''}\nEMAIL:${c.email||''}\nURL:${c.website||''}\nADR:;;${c.business_address||''}\nEND:VCARD`;const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([v],{type:'text/vcard'}));a.download=`${c.slug}.vcf`;a.click();track('contact_save')}
