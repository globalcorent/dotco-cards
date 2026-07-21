const form=document.querySelector('form[data-auth]');
const message=document.getElementById('message');
function show(msg,type='error'){message.className='alert '+type;message.textContent=msg}
if(form)form.addEventListener('submit',async e=>{
 e.preventDefault();const mode=form.dataset.auth;const fd=new FormData(form);const email=fd.get('email');const password=fd.get('password');
 try{
  if(mode==='register'){
   const full_name=fd.get('full_name');
   const {error}=await supabaseClient.auth.signUp({email,password,options:{data:{full_name},emailRedirectTo:location.origin+'/dashboard.html'}});
   if(error)throw error;show('Account created. Check your email to verify your account.','success');
  }else if(mode==='login'){
   const {error}=await supabaseClient.auth.signInWithPassword({email,password});if(error)throw error;location.href='dashboard.html';
  }else if(mode==='forgot'){
   const {error}=await supabaseClient.auth.resetPasswordForEmail(email,{redirectTo:location.origin+'/reset-password.html'});if(error)throw error;show('Password reset email sent.','success');
  }
 }catch(err){show(err.message)}
});
