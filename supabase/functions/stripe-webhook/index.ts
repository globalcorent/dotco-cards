import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2026-06-24.dahlia",
});

function normalizeStatus(status: string): string {
  if (["trialing", "active", "past_due", "canceled", "unpaid"].includes(status)) return status;
  return "inactive";
}

function isoFromUnix(value: number | null | undefined): string | null {
  return value ? new Date(value * 1000).toISOString() : null;
}

Deno.serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  const rawBody = await req.text();
  let db: any = null;
  let event: Stripe.Event | null = null;

  try {
    if (!signature) throw new Error("Missing Stripe signature");
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      Deno.env.get("STRIPE_WEBHOOK_SECRET")!,
    );

    db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    await db.from("billing_events").upsert({
      stripe_event_id: event.id,
      event_type: event.type,
      payload: event,
      processed: false,
      processing_error: null,
    }, { onConflict: "stripe_event_id" });

    if ([
      "checkout.session.completed",
      "customer.subscription.created",
      "customer.subscription.updated",
      "customer.subscription.deleted",
    ].includes(event.type)) {
      let subscription: Stripe.Subscription;
      let fallbackUserId: string | null = null;

      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        fallbackUserId = session.metadata?.user_id || session.client_reference_id || null;
        if (!session.subscription) throw new Error("Checkout session has no subscription");
        subscription = await stripe.subscriptions.retrieve(String(session.subscription));
      } else {
        subscription = event.data.object as Stripe.Subscription;
      }

      let userId = fallbackUserId || subscription.metadata?.user_id || null;
      if (!userId) {
        const { data } = await db.from("subscriptions").select("user_id")
          .eq("stripe_subscription_id", subscription.id).maybeSingle();
        userId = data?.user_id || null;
      }
      if (!userId && subscription.customer) {
        const { data } = await db.from("subscriptions").select("user_id")
          .eq("stripe_customer_id", String(subscription.customer)).maybeSingle();
        userId = data?.user_id || null;
      }
      if (!userId) throw new Error("Unable to match subscription to a user");

      const [{ data: plans, error: planError }, { data: addons, error: addonError }] = await Promise.all([
        db.from("plan_definitions").select("plan_key,stripe_monthly_price_id,stripe_yearly_price_id"),
        db.from("addon_definitions").select("addon_key,stripe_monthly_price_id,stripe_yearly_price_id").eq("is_active", true),
      ]);
      if (planError) throw planError;
      if (addonError) throw addonError;

      const planByPrice = new Map<string, any>();
      for (const plan of plans || []) {
        if (plan.stripe_monthly_price_id) planByPrice.set(plan.stripe_monthly_price_id, { plan_key: plan.plan_key, interval: "month" });
        if (plan.stripe_yearly_price_id) planByPrice.set(plan.stripe_yearly_price_id, { plan_key: plan.plan_key, interval: "year" });
      }
      const addonByPrice = new Map<string, any>();
      for (const addon of addons || []) {
        if (addon.stripe_monthly_price_id) addonByPrice.set(addon.stripe_monthly_price_id, { addon_key: addon.addon_key, interval: "month" });
        if (addon.stripe_yearly_price_id) addonByPrice.set(addon.stripe_yearly_price_id, { addon_key: addon.addon_key, interval: "year" });
      }

      const items: any[] = subscription.items?.data || [];
      let baseItem: any = null;
      let baseMatch: any = null;
      for (const item of items) {
        const match = planByPrice.get(item.price?.id);
        if (match) {
          baseItem = item;
          baseMatch = match;
          break;
        }
      }
      if (!baseItem) {
        baseItem = items.find(item => item.price?.metadata?.plan_key) ||
          items.find(item => !addonByPrice.has(item.price?.id)) || items[0] || null;
      }

      const metadataPlan = subscription.metadata?.plan_key || baseItem?.price?.metadata?.plan_key || "starter";
      const planKey = baseMatch?.plan_key || (["starter", "pro", "agency"].includes(metadataPlan) ? metadataPlan : "starter");
      const interval = baseMatch?.interval || (baseItem?.price?.recurring?.interval === "year" ? "year" : "month");
      const status = normalizeStatus(subscription.status);
      const periodStart = baseItem?.current_period_start || (subscription as any).current_period_start || null;
      const periodEnd = baseItem?.current_period_end || (subscription as any).current_period_end || null;

      const { error: subscriptionError } = await db.from("subscriptions").upsert({
        user_id: userId,
        plan_key: planKey,
        status,
        billing_interval: interval,
        stripe_customer_id: String(subscription.customer),
        stripe_subscription_id: subscription.id,
        stripe_price_id: baseItem?.price?.id || null,
        current_period_start: isoFromUnix(periodStart),
        current_period_end: isoFromUnix(periodEnd),
        cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      if (subscriptionError) throw subscriptionError;

      const presentAddonKeys = new Set<string>();
      for (const item of items) {
        const match = addonByPrice.get(item.price?.id) ||
          (item.price?.metadata?.addon_key ? { addon_key: item.price.metadata.addon_key } : null);
        if (!match) continue;
        presentAddonKeys.add(match.addon_key);
        const { error } = await db.from("subscription_addons").upsert({
          user_id: userId,
          addon_key: match.addon_key,
          status,
          quantity: Math.max(1, Number(item.quantity || 1)),
          stripe_subscription_item_id: item.id,
          stripe_price_id: item.price?.id || null,
          current_period_end: isoFromUnix(item.current_period_end || periodEnd),
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id,addon_key" });
        if (error) throw error;
      }

      const { data: existingAddons, error: existingError } = await db.from("subscription_addons")
        .select("addon_key,quantity").eq("user_id", userId);
      if (existingError) throw existingError;
      for (const existing of existingAddons || []) {
        if (!presentAddonKeys.has(existing.addon_key)) {
          const { error } = await db.from("subscription_addons").upsert({
            user_id: userId,
            addon_key: existing.addon_key,
            status: "canceled",
            quantity: Math.max(1, Number(existing.quantity || 1)),
            stripe_subscription_item_id: null,
            current_period_end: isoFromUnix(periodEnd),
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id,addon_key" });
          if (error) throw error;
        }
      }

      if (["inactive", "canceled", "unpaid"].includes(status)) {
        const { error } = await db.from("digital_cards").update({ status: "draft" })
          .eq("user_id", userId).eq("status", "published");
        if (error) throw error;
      }
      await db.from("billing_events").update({ user_id: userId }).eq("stripe_event_id", event.id);
    } else if (event.type.startsWith("invoice.")) {
      const invoice = event.data.object as Stripe.Invoice;
      if (invoice.customer) {
        const { data } = await db.from("subscriptions").select("user_id")
          .eq("stripe_customer_id", String(invoice.customer)).maybeSingle();
        if (data?.user_id) await db.from("billing_events").update({ user_id: data.user_id }).eq("stripe_event_id", event.id);
      }
    }

    await db.from("billing_events").update({
      processed: true,
      processed_at: new Date().toISOString(),
      processing_error: null,
    }).eq("stripe_event_id", event.id);

    return new Response("ok", { status: 200 });
  } catch (error) {
    if (db && event) {
      await db.from("billing_events").update({
        processed: false,
        processing_error: error instanceof Error ? error.message : "Unknown webhook error",
      }).eq("stripe_event_id", event.id);
    }
    return new Response(`Webhook error: ${error instanceof Error ? error.message : "Unknown error"}`, { status: 400 });
  }
});
