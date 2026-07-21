const resetForm=document.getElementById('reset-form');
const resetMessage=document.getElementById('message');

function showReset(msg,type='error'){
  resetMessage.className='alert '+type;
  resetMessage.textContent=msg;
}

resetForm.addEventListener('submit',async(event)=>{
  event.preventDefault();
  const password=new FormData(resetForm).get('password');

  try{
    const {error}=await supabaseClient.auth.updateUser({password});
    if(error)throw error;
    showReset('Password updated. Redirecting to your dashboard…','success');
    setTimeout(()=>location.href=dotcoUrl('dashboard.html'),1200);
  }catch(error){
    showReset(error.message);
  }
});
