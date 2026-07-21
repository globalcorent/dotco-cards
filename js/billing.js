async function checkout(plan,interval='month'){
  const {data:{session}}=await supabaseClient.auth.getSession();
  if(!session)return location.href=dotcoUrl('login.html');

  const res=await fetch(
    `${DOTCO_CONFIG.supabaseUrl}/functions/v1/create-checkout-session`,
    {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'Authorization':`Bearer ${session.access_token}`
      },
      body:JSON.stringify({
        plan,
        interval,
        successUrl:dotcoUrl('dashboard.html?billing=success'),
        cancelUrl:location.href
      })
    }
  );

  const data=await res.json();
  if(!res.ok)return toast(data.error||'Unable to open checkout');
  location.href=data.url;
}

async function openPortal(){
  const {data:{session}}=await supabaseClient.auth.getSession();
  if(!session)return location.href=dotcoUrl('login.html');

  const res=await fetch(
    `${DOTCO_CONFIG.supabaseUrl}/functions/v1/create-portal-session`,
    {
      method:'POST',
      headers:{
        'Authorization':`Bearer ${session.access_token}`,
        'Content-Type':'application/json'
      },
      body:JSON.stringify({returnUrl:dotcoUrl('dashboard.html')})
    }
  );

  const data=await res.json();
  if(!res.ok)return toast(data.error||'Unable to open billing portal');
  location.href=data.url;
}
