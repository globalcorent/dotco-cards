# DotCo Cards

Production-minded SaaS MVP for digital business cards.

## Live services

- Supabase project: `https://bmgmdgkviqqtaluvdprh.supabase.co`
- Stripe products and six monthly/yearly plan prices are already created in Stripe test mode.
- Database schema, RLS, storage buckets, plan limits, and templates are already applied.

## Run locally

Serve the folder with any static server:

```bash
python -m http.server 8080
```

Open `http://localhost:8080`.

## Supabase configuration

The publishable browser key is already in `js/config.js`. This is safe to expose. Never place the service-role key in browser code.

Add these Edge Function secrets in Supabase:

```bash
supabase secrets set STRIPE_SECRET_KEY=...
supabase secrets set STRIPE_WEBHOOK_SECRET=...
```

Then deploy:

```bash
supabase functions deploy create-checkout-session
supabase functions deploy create-portal-session
supabase functions deploy stripe-webhook --no-verify-jwt
```

Create a Stripe webhook endpoint:

`https://bmgmdgkviqqtaluvdprh.supabase.co/functions/v1/stripe-webhook`

Listen for:

- checkout.session.completed
- customer.subscription.created
- customer.subscription.updated
- customer.subscription.deleted
- invoice.paid
- invoice.payment_failed

## Authentication URLs

In Supabase Authentication URL Configuration, add your production domain and local development redirect URLs.

## Current MVP features

- Sign up, sign in, forgot password
- Protected dashboard
- Create and edit digital cards
- Publish/unpublish cards
- Public shareable card
- vCard contact download
- QR code
- Analytics event capture
- Stripe Checkout and Customer Portal Edge Functions
- Responsive mobile design
- GitHub Pages workflow

## Production follow-up

Add image upload/cropping, social-link editor, service/product CRUD, lead inbox, analytics charts, admin UI, add-on Stripe products, custom domains, and stronger abuse prevention for public analytics endpoints.
