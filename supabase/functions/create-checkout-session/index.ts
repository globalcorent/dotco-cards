import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};

Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 try{
  const auth=req.headers.get("Authorization")||"";
  const supabase=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:auth}}});
  const {data:{user},error}=await supabase.auth.getUser();if(error||!user)throw new Error("Unauthorized");
  const {plan,interval="month",successUrl,cancelUrl}=await req.json();
  const {data:p,error:pe}=await supabase.from("plan_definitions").select("stripe_monthly_price_id,stripe_yearly_price_id").eq("plan_key",plan).single();if(pe)throw pe;
  const price=interval==="year"?p.stripe_yearly_price_id:p.stripe_monthly_price_id;if(!price)throw new Error("Price unavailable");
  const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const {data:sub}=await admin.from("subscriptions").select("stripe_customer_id").eq("user_id",user.id).single();
  const params=new URLSearchParams();params.set("mode","subscription");params.set("success_url",successUrl);params.set("cancel_url",cancelUrl);params.set("line_items[0][price]",price);params.set("line_items[0][quantity]","1");params.set("client_reference_id",user.id);params.set("metadata[user_id]",user.id);params.set("metadata[plan_key]",plan);params.set("integration_identifier","dotco_cards_qwertyui");
  if(sub?.stripe_customer_id)params.set("customer",sub.stripe_customer_id);else params.set("customer_email",user.email||"");
  const sr=await fetch("https://api.stripe.com/v1/checkout/sessions",{method:"POST",headers:{"Authorization":`Bearer ${Deno.env.get("STRIPE_SECRET_KEY")}`,"Content-Type":"application/x-www-form-urlencoded"},body:params});
  const out=await sr.json();if(!sr.ok)throw new Error(out.error?.message||"Stripe error");
  return new Response(JSON.stringify({url:out.url}),{headers:{...cors,"Content-Type":"application/json"}});
 }catch(e){return new Response(JSON.stringify({error:e.message}),{status:400,headers:{...cors,"Content-Type":"application/json"}})}
});
