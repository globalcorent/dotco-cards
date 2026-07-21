import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18?target=deno";
const stripe=new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!,{apiVersion:"2026-06-24.dahlia"});
Deno.serve(async(req)=>{
 const sig=req.headers.get("stripe-signature");const raw=await req.text();
 try{
  const event=await stripe.webhooks.constructEventAsync(raw,sig!,Deno.env.get("STRIPE_WEBHOOK_SECRET")!);
  const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  await db.from("billing_events").upsert({stripe_event_id:event.id,event_type:event.type,payload:event,processed:false},{onConflict:"stripe_event_id"});
  if(["checkout.session.completed","customer.subscription.created","customer.subscription.updated","customer.subscription.deleted"].includes(event.type)){
   let subscription:any=event.data.object;
   let userId=subscription.metadata?.user_id||subscription.client_reference_id;
   if(event.type==="checkout.session.completed"&&subscription.subscription)subscription=await stripe.subscriptions.retrieve(subscription.subscription);
   userId=userId||subscription.metadata?.user_id;
   if(userId){
    const price=subscription.items?.data?.[0]?.price;
    const plan=subscription.metadata?.plan_key||price?.metadata?.plan_key||"starter";
    await db.from("subscriptions").upsert({user_id:userId,plan_key:plan,status:subscription.status||"active",stripe_customer_id:String(subscription.customer),stripe_subscription_id:subscription.id,stripe_price_id:price?.id,current_period_start:subscription.current_period_start?new Date(subscription.current_period_start*1000).toISOString():null,current_period_end:subscription.current_period_end?new Date(subscription.current_period_end*1000).toISOString():null,cancel_at_period_end:subscription.cancel_at_period_end||false},{onConflict:"user_id"});
   }
  }
  await db.from("billing_events").update({processed:true,processed_at:new Date().toISOString()}).eq("stripe_event_id",event.id);
  return new Response("ok");
 }catch(e){return new Response(`Webhook error: ${e.message}`,{status:400})}
});
