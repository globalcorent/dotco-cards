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

    const { returnUrl: rawReturnUrl } = await req.json();
    const returnUrl = validateReturnUrl(String(rawReturnUrl || ""));

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: subscription } = await admin
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!subscription?.stripe_customer_id) {
      throw new Error("Choose and complete a plan checkout before opening Manage Billing.");
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
    if (!stripeKey) throw new Error("Stripe secret key is not configured");

    const body = new URLSearchParams({
      customer: subscription.stripe_customer_id,
      return_url: returnUrl,
    });

    const stripeResponse = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    const result = await stripeResponse.json();
    if (!stripeResponse.ok) throw new Error(result.error?.message || "Unable to open billing portal");

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
