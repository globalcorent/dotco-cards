# DotCo Cards

A production-minded SaaS for professional digital business cards.

## Current experience

- Premium marketing website and pricing comparison
- Supabase email authentication and password recovery
- Guided dashboard with onboarding and plan usage
- Multi-step card editor with live mobile preview
- Profile photo upload through Supabase Storage
- Industry templates and brand customization
- Social-link management
- Public mobile business card with QR, sharing, contact download, and analytics
- Stripe Checkout subscriptions and Customer Portal
- Backend publishing and plan-limit enforcement

## Live services

- Website: `https://globalcorent.github.io/dotco-cards/`
- Supabase project: `https://bmgmdgkviqqtaluvdprh.supabase.co`
- Stripe products and monthly/yearly plan prices are configured in Stripe test mode.

## Local development

```bash
python -m http.server 8080
```

Open `http://localhost:8080`.

## Security

Only the Supabase project URL and publishable browser key belong in frontend JavaScript. Never commit the Supabase service-role key, Stripe secret key, or Stripe webhook secret.

## Supabase Edge Function secrets

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

## Stripe webhook endpoint

`https://bmgmdgkviqqtaluvdprh.supabase.co/functions/v1/stripe-webhook`

Events:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

## Authentication redirects

- `https://globalcorent.github.io/dotco-cards/**`
- `http://localhost:8080/**`
