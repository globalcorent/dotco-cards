import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};

Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 try{
  const auth=req.headers.get("Authorization")||"";
  const supabase=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:auth}}});
  const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error("Unauthorized");
  const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const {data:sub}=await admin.from("subscriptions").select("stripe_customer_id").eq("user_id",user.id).single();if(!sub?.stripe_customer_id)throw new Error("No Stripe customer found");
  const {returnUrl}=await req.json();const body=new URLSearchParams({customer:sub.stripe_customer_id,return_url:returnUrl});
  const sr=await fetch("https://api.stripe.com/v1/billing_portal/sessions",{method:"POST",headers:{"Authorization":`Bearer ${Deno.env.get("STRIPE_SECRET_KEY")}`,"Content-Type":"application/x-www-form-urlencoded"},body});
  const out=await sr.json();if(!sr.ok)throw new Error(out.error?.message||"Stripe error");
  return new Response(JSON.stringify({url:out.url}),{headers:{...cors,"Content-Type":"application/json"}});
 }catch(e){return new Response(JSON.stringify({error:e.message}),{status:400,headers:{...cors,"Content-Type":"application/json"}})}
});
