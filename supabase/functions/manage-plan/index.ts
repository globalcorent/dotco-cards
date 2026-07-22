import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2026-06-24.dahlia" });
const allowedOrigins = new Set(["https://globalcorent.github.io", "http://localhost:8080", "http://127.0.0.1:8080"]);

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://globalcorent.github.io",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const origin = req.headers.get("origin") || "";
    if (origin && !allowedOrigins.has(origin)) throw new Error("Origin is not allowed");

    const auth = req.headers.get("Authorization") || "";
    const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const body = await req.json();
    const targetPlan = String(body.plan || "").trim();
    const targetInterval = String(body.interval || "month").trim();
    if (!["starter", "pro", "agency"].includes(targetPlan)) throw new Error("Invalid plan");
    if (!["month", "year"].includes(targetInterval)) throw new Error("Invalid billing interval");

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const [{ data: subscriptionRow, error: subscriptionError }, { data: plans, error: planError }, { data: addons, error: addonError }] = await Promise.all([
      admin.from("subscriptions").select("plan_key,status,billing_interval,stripe_subscription_id,stripe_customer_id").eq("user_id", user.id).maybeSingle(),
      admin.from("plan_definitions").select("plan_key,name,stripe_monthly_price_id,stripe_yearly_price_id").eq("is_active", true),
      admin.from("addon_definitions").select("addon_key,name,included_plans,stripe_monthly_price_id,stripe_yearly_price_id").eq("is_active", true),
    ]);
    if (subscriptionError) throw subscriptionError;
    if (planError) throw planError;
    if (addonError) throw addonError;
    if (!subscriptionRow?.stripe_subscription_id || !["active", "trialing"].includes(subscriptionRow.status)) {
      throw new Error(subscriptionRow?.status === "past_due" ? "Update your payment method before changing plans" : "Complete your first plan checkout before changing plans");
    }

    const target: any = (plans || []).find((plan: any) => plan.plan_key === targetPlan);
    if (!target) throw new Error("Target plan is unavailable");
    const targetPriceId = targetInterval === "year" ? target.stripe_yearly_price_id : target.stripe_monthly_price_id;
    if (!targetPriceId) throw new Error("Target plan price is unavailable");

    const subscription: any = await stripe.subscriptions.retrieve(subscriptionRow.stripe_subscription_id, { expand: ["latest_invoice", "items.data.price.product"] });
    const planPriceIds = new Set<string>();
    for (const plan of plans || []) {
      if (plan.stripe_monthly_price_id) planPriceIds.add(plan.stripe_monthly_price_id);
      if (plan.stripe_yearly_price_id) planPriceIds.add(plan.stripe_yearly_price_id);
    }
    const baseItem: any = subscription.items.data.find((item: any) => planPriceIds.has(item.price?.id)) || subscription.items.data.find((item: any) => item.price?.metadata?.plan_key) || null;
    if (!baseItem) throw new Error("Unable to identify the current DotCo plan item");

    if (baseItem.price?.id === targetPriceId) {
      return new Response(JSON.stringify({ ok: true, unchanged: true, plan: targetPlan, interval: targetInterval, message: `You are already on the ${target.name} ${targetInterval === "year" ? "yearly" : "monthly"} plan.` }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    const addonByPrice = new Map<string, any>();
    for (const addon of addons || []) {
      if (addon.stripe_monthly_price_id) addonByPrice.set(addon.stripe_monthly_price_id, addon);
      if (addon.stripe_yearly_price_id) addonByPrice.set(addon.stripe_yearly_price_id, addon);
    }

    const items: any[] = [{ id: baseItem.id, price: targetPriceId, quantity: 1 }];
    const absorbedAddons: string[] = [];
    const convertedAddons: string[] = [];
    for (const item of subscription.items.data as any[]) {
      if (item.id === baseItem.id) continue;
      const addon = addonByPrice.get(item.price?.id) || null;
      if (!addon) continue;
      if ((addon.included_plans || []).includes(targetPlan)) {
        items.push({ id: item.id, deleted: true });
        absorbedAddons.push(addon.addon_key);
        continue;
      }
      const matchingPrice = targetInterval === "year" ? addon.stripe_yearly_price_id : addon.stripe_monthly_price_id;
      if (!matchingPrice) throw new Error(`${addon.name} is unavailable for ${targetInterval === "year" ? "yearly" : "monthly"} billing`);
      if (matchingPrice !== item.price?.id) {
        items.push({ id: item.id, price: matchingPrice, quantity: Math.max(1, Number(item.quantity || 1)) });
        convertedAddons.push(addon.addon_key);
      }
    }

    const updated: any = await stripe.subscriptions.update(subscription.id, {
      items,
      metadata: { ...subscription.metadata, user_id: user.id, plan_key: targetPlan },
      proration_behavior: "always_invoice",
      payment_behavior: "pending_if_incomplete",
      expand: ["latest_invoice", "items.data.price.product"],
    } as any);

    const appliedBase = updated.items.data.find((item: any) => item.id === baseItem.id);
    const invoice = typeof updated.latest_invoice === "object" ? updated.latest_invoice : null;
    const invoiceSettled = !invoice || invoice.status === "paid" || Number(invoice.amount_remaining || 0) === 0;
    const applied = appliedBase?.price?.id === targetPriceId && invoiceSettled;
    const paymentUrl = invoice?.status === "open" ? invoice.hosted_invoice_url || null : null;
    if (!applied) {
      return new Response(JSON.stringify({ ok: true, pending: true, plan: subscriptionRow.plan_key, interval: subscriptionRow.billing_interval, paymentUrl, message: paymentUrl ? `Complete the Stripe invoice to activate ${target.name}.` : `The ${target.name} change is awaiting payment confirmation.` }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    const { error: syncError } = await admin.from("subscriptions").update({ plan_key: targetPlan, billing_interval: targetInterval, stripe_price_id: targetPriceId, updated_at: new Date().toISOString() }).eq("user_id", user.id);
    if (syncError) throw syncError;
    if (absorbedAddons.length) {
      const { error: addonSyncError } = await admin.from("subscription_addons").update({ status: "canceled", stripe_subscription_item_id: null, updated_at: new Date().toISOString() }).eq("user_id", user.id).in("addon_key", absorbedAddons);
      if (addonSyncError) throw addonSyncError;
    }

    return new Response(JSON.stringify({ ok: true, plan: targetPlan, interval: targetInterval, absorbedAddons, convertedAddons, paymentUrl, message: `Your workspace is now on ${target.name}.` }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unable to change plan" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
