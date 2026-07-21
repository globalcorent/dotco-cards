import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2026-06-24.dahlia",
});

const allowedOrigins = new Set([
  "https://globalcorent.github.io",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
]);

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://globalcorent.github.io",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function normalizeStatus(status: string) {
  if (["trialing", "active", "past_due", "canceled", "unpaid"].includes(status)) return status;
  return "inactive";
}

function itemPeriodEnd(item: any, subscription: any): string | null {
  const unix = item?.current_period_end || subscription?.current_period_end || null;
  return unix ? new Date(unix * 1000).toISOString() : null;
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const origin = req.headers.get("origin") || "";
    if (origin && !allowedOrigins.has(origin)) throw new Error("Origin is not allowed");

    const auth = req.headers.get("Authorization") || "";
    const client = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const body = await req.json();
    const addonKey = String(body.addonKey || "").trim();
    const action = String(body.action || "add");
    if (!["add", "remove", "set_quantity"].includes(action)) throw new Error("Invalid add-on action");

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const [{ data: subscriptionRow, error: subscriptionError }, { data: addon, error: addonError }] = await Promise.all([
      admin.from("subscriptions")
        .select("plan_key,status,billing_interval,stripe_subscription_id,stripe_customer_id")
        .eq("user_id", user.id)
        .maybeSingle(),
      admin.from("addon_definitions")
        .select("*")
        .eq("addon_key", addonKey)
        .eq("is_active", true)
        .maybeSingle(),
    ]);

    if (subscriptionError) throw subscriptionError;
    if (addonError) throw addonError;
    if (!subscriptionRow?.stripe_subscription_id || !["active", "trialing"].includes(subscriptionRow.status)) {
      throw new Error(subscriptionRow?.status === "past_due"
        ? "Update your payment method before changing add-ons"
        : "Activate a DotCo plan before adding recurring add-ons");
    }
    if (!addon) throw new Error("Add-on not found");

    if ((addon.included_plans || []).includes(subscriptionRow.plan_key)) {
      return new Response(JSON.stringify({ ok: true, included: true, message: `${addon.name} is already included with your plan.` }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const interval = subscriptionRow.billing_interval === "year" ? "year" : "month";
    const priceId = interval === "year" ? addon.stripe_yearly_price_id : addon.stripe_monthly_price_id;
    if (!priceId) throw new Error("This add-on is not configured for your billing interval");

    const current = await stripe.subscriptions.retrieve(subscriptionRow.stripe_subscription_id, {
      expand: ["latest_invoice"],
    });

    const existingItem = current.items.data.find((item: any) =>
      item.price?.id === addon.stripe_monthly_price_id ||
      item.price?.id === addon.stripe_yearly_price_id ||
      item.price?.metadata?.addon_key === addonKey
    );

    let quantity = Number(body.quantity || 1);
    quantity = Number.isFinite(quantity) ? Math.floor(quantity) : 1;
    quantity = Math.max(1, Math.min(quantity, Number(addon.max_quantity || 1)));
    if (!addon.is_quantity) quantity = 1;
    const existingQuantity = Math.max(0, Number(existingItem?.quantity || 0));

    if (action !== "remove" && existingItem && existingQuantity === quantity) {
      return new Response(JSON.stringify({ ok: true, active: true, quantity, message: `${addon.name} is already set to ${quantity}.` }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    let updated: any;
    if (action === "remove") {
      if (!existingItem) {
        return new Response(JSON.stringify({ ok: true, active: false, message: `${addon.name} is already inactive.` }), {
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      updated = await stripe.subscriptions.update(current.id, {
        items: [{ id: existingItem.id, deleted: true }],
        proration_behavior: "create_prorations",
        expand: ["latest_invoice"],
      } as any);
    } else if (existingItem && quantity < existingQuantity) {
      updated = await stripe.subscriptions.update(current.id, {
        items: [{ id: existingItem.id, quantity }],
        proration_behavior: "create_prorations",
        expand: ["latest_invoice"],
      } as any);
    } else {
      const items = existingItem
        ? [{ id: existingItem.id, quantity }]
        : [{ price: priceId, quantity }];
      updated = await stripe.subscriptions.update(current.id, {
        items,
        proration_behavior: "always_invoice",
        payment_behavior: "pending_if_incomplete",
        expand: ["latest_invoice"],
      } as any);
    }

    const updatedItem = updated.items.data.find((item: any) =>
      item.price?.id === addon.stripe_monthly_price_id ||
      item.price?.id === addon.stripe_yearly_price_id ||
      item.price?.metadata?.addon_key === addonKey
    );
    const invoice = typeof updated.latest_invoice === "object" ? updated.latest_invoice : null;
    const paymentUrl = invoice?.status === "open" ? invoice.hosted_invoice_url || null : null;
    const applied = action === "remove" || (updatedItem && Number(updatedItem.quantity || 1) === quantity);

    if (!applied) {
      if (!paymentUrl) throw new Error("Stripe could not complete this add-on change. Open Manage Billing and update your payment method.");
      return new Response(JSON.stringify({
        ok: true,
        pending: true,
        active: Boolean(existingItem),
        quantity: existingQuantity,
        paymentUrl,
        message: `Complete the Stripe invoice to activate ${addon.name}.`,
      }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    const status = action === "remove" ? "canceled" : normalizeStatus(updated.status);
    const addonRow: Record<string, unknown> = {
      user_id: user.id,
      addon_key: addonKey,
      status,
      quantity: action === "remove" ? Math.max(1, existingQuantity) : Number(updatedItem?.quantity || quantity),
      stripe_subscription_item_id: action === "remove" ? null : updatedItem?.id || null,
      stripe_price_id: action === "remove" ? priceId : updatedItem?.price?.id || priceId,
      current_period_end: itemPeriodEnd(updatedItem, updated),
      updated_at: new Date().toISOString(),
    };
    const { error: syncError } = await admin.from("subscription_addons").upsert(addonRow, {
      onConflict: "user_id,addon_key",
    });
    if (syncError) throw syncError;

    return new Response(JSON.stringify({
      ok: true,
      addonKey,
      active: action !== "remove",
      quantity: action === "remove" ? 0 : Number(updatedItem?.quantity || quantity),
      subscriptionStatus: updated.status,
      paymentUrl,
      message: action === "remove"
        ? `${addon.name} was removed. Any prorated credit will appear on the Stripe account.`
        : `${addon.name} is now active.`,
    }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unable to update add-on" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
