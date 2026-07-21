import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const allowedOrigins = new Set([
  "https://globalcorent.github.io",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
]);

function validateReturnUrl(raw: string): string {
  const url = new URL(raw);
  if (!allowedOrigins.has(url.origin)) throw new Error("Return URL is not allowed");
  if (url.origin === "https://globalcorent.github.io" && !url.pathname.startsWith("/dotco-cards/")) {
    throw new Error("Return URL path is not allowed");
  }
  return url.toString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const auth = req.headers.get("Authorization") || "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const body = await req.json();
    const plan = String(body.plan || "");
    const interval = String(body.interval || "month");
    if (!["starter", "pro", "agency"].includes(plan)) throw new Error("Invalid plan");
    if (!["month", "year"].includes(interval)) throw new Error("Invalid billing interval");

    const successUrl = validateReturnUrl(String(body.successUrl || ""));
    const cancelUrl = validateReturnUrl(String(body.cancelUrl || ""));

    const { data: planRow, error: planError } = await supabase
      .from("plan_definitions")
      .select("stripe_monthly_price_id,stripe_yearly_price_id")
      .eq("plan_key", plan)
      .single();
    if (planError) throw planError;

    const price = interval === "year"
      ? planRow.stripe_yearly_price_id
      : planRow.stripe_monthly_price_id;
    if (!price) throw new Error("Price unavailable");

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: existing } = await admin
      .from("subscriptions")
      .select("stripe_customer_id,stripe_subscription_id,status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing?.stripe_subscription_id && ["active", "trialing", "past_due"].includes(existing.status)) {
      throw new Error("You already have an active subscription. Use Manage Billing from your dashboard.");
    }

    const params = new URLSearchParams();
    params.set("mode", "subscription");
    params.set("success_url", successUrl);
    params.set("cancel_url", cancelUrl);
    params.set("line_items[0][price]", price);
    params.set("line_items[0][quantity]", "1");
    params.set("client_reference_id", user.id);
    params.set("metadata[user_id]", user.id);
    params.set("metadata[plan_key]", plan);
    params.set("subscription_data[metadata][user_id]", user.id);
    params.set("subscription_data[metadata][plan_key]", plan);
    params.set("allow_promotion_codes", "true");
    params.set("billing_address_collection", "auto");
    params.set("integration_identifier", "dotco_cards_qwertyui");

    if (existing?.stripe_customer_id) params.set("customer", existing.stripe_customer_id);
    else if (user.email) params.set("customer_email", user.email);

    const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("STRIPE_SECRET_KEY")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });

    const result = await stripeResponse.json();
    if (!stripeResponse.ok) throw new Error(result.error?.message || "Stripe error");

    return new Response(JSON.stringify({ url: result.url }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
