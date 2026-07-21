import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2026-06-24.dahlia",
});

function normalizeStatus(status: string): string {
  if (["trialing", "active", "past_due", "canceled", "unpaid"].includes(status)) return status;
  return "inactive";
}

Deno.serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  const rawBody = await req.text();

  try {
    if (!signature) throw new Error("Missing Stripe signature");

    const event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      Deno.env.get("STRIPE_WEBHOOK_SECRET")!,
    );

    const db = createClient(
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
        const { data: bySubscription } = await db
          .from("subscriptions")
          .select("user_id")
          .eq("stripe_subscription_id", subscription.id)
          .maybeSingle();
        userId = bySubscription?.user_id || null;
      }

      if (!userId && subscription.customer) {
        const { data: byCustomer } = await db
          .from("subscriptions")
          .select("user_id")
          .eq("stripe_customer_id", String(subscription.customer))
          .maybeSingle();
        userId = byCustomer?.user_id || null;
      }

      if (!userId) throw new Error("Unable to match subscription to a user");

      const price = subscription.items.data[0]?.price;
      const planKey = subscription.metadata?.plan_key || price?.metadata?.plan_key || "starter";
      const status = normalizeStatus(subscription.status);
      const interval = price?.recurring?.interval === "year" ? "year" : "month";

      const { error: upsertError } = await db.from("subscriptions").upsert({
        user_id: userId,
        plan_key: ["starter", "pro", "agency"].includes(planKey) ? planKey : "starter",
        status,
        billing_interval: interval,
        stripe_customer_id: String(subscription.customer),
        stripe_subscription_id: subscription.id,
        stripe_price_id: price?.id || null,
        current_period_start: subscription.current_period_start
          ? new Date(subscription.current_period_start * 1000).toISOString()
          : null,
        current_period_end: subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null,
        cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
      }, { onConflict: "user_id" });

      if (upsertError) throw upsertError;

      if (["inactive", "canceled", "unpaid"].includes(status)) {
        const { error: cardError } = await db
          .from("digital_cards")
          .update({ status: "draft" })
          .eq("user_id", userId)
          .eq("status", "published");
        if (cardError) throw cardError;
      }
    }

    await db.from("billing_events").update({
      processed: true,
      processed_at: new Date().toISOString(),
      processing_error: null,
    }).eq("stripe_event_id", event.id);

    return new Response("ok", { status: 200 });
  } catch (error) {
    return new Response(`Webhook error: ${error.message}`, { status: 400 });
  }
});
