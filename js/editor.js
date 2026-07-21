let currentId=null;let saveTimer=null;
const fields=['full_name','job_title','company_name','biography','phone','email','website','business_address','headline','primary_color','background_color','text_color','button_color','slug'];
(async()=>{
 const user=await requireUser();if(!user)return;
 const params=new URLSearchParams(location.search);currentId=params.get('id');
 if(currentId){const {data,error}=await supabaseClient.from('digital_cards').select('*').eq('id',currentId).single();if(error)return toast(error.message);fields.forEach(k=>{const el=document.querySelector(`[name="${k}"]`);if(el&&data[k]!=null)el.value=data[k]});document.querySelector('[name="status"]').value=data.status;render()}
 document.querySelectorAll('input,textarea,select').forEach(el=>el.addEventListener('input',()=>{render();clearTimeout(saveTimer);saveTimer=setTimeout(save,700)}));
})();
function render(){
 const val=n=>document.querySelector(`[name="${n}"]`)?.value||'';
 document.getElementById('p-name').textContent=val('full_name')||'Your Name';
 document.getElementById('p-title').textContent=val('job_title')||'Your Position';
 document.getElementById('p-company').textContent=val('company_name');
 document.getElementById('p-bio').textContent=val('biography');
 const phone=document.querySelector('.phone');phone.style.background=val('background_color')||'#fff';phone.style.color=val('text_color')||'#111827';
 document.querySelectorAll('.action').forEach(x=>x.style.background=val('button_color')||'#635bff');
}
async function save(){
 const user=await requireUser();if(!user)return;
 const payload={user_id:user.id};fields.forEach(k=>payload[k]=document.querySelector(`[name="${k}"]`)?.value||null);payload.status=document.querySelector('[name="status"]').value;
 if(!payload.slug)payload.slug=(payload.full_name||'card').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')+'-'+Math.random().toString(36).slice(2,6);
 let result;
 if(currentId)result=await supabaseClient.from('digital_cards').update(payload).eq('id',currentId).select().single();
 else result=await supabaseClient.from('digital_cards').insert(payload).select().single();
 if(result.error)return toast(result.error.message);
 currentId=result.data.id;history.replaceState({},'',`editor.html?id=${currentId}`);document.querySelector('[name="slug"]').value=result.data.slug;toast('Saved');
}
