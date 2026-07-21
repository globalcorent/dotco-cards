# DotCo Cards V3

A sellable SaaS platform for professional digital business cards, powered by static HTML/CSS/JavaScript, Supabase, and Stripe Billing.

## V3 customer experience

- Premium marketing website with plan comparison and optional add-ons
- Supabase email authentication and password recovery
- Guided dashboard with plan, renewal, card usage, engagement, leads, and active add-ons
- Multi-step card editor with live mobile preview
- Profile photo upload through Supabase Storage
- Industry templates and brand customization
- Reliable social-media icons rendered as self-contained SVGs
- Services, products, appointment booking, lead capture, and payment-link tools
- Public mobile card with sharing, QR code, vCard download, social links, products, services, and inquiry forms
- Analytics workspace with 7-, 30-, and 90-day engagement views
- Lead inbox with filtering, status management, contact actions, and notes
- Stripe Checkout subscriptions, Customer Portal, and recurring subscription add-ons
- Backend publishing, entitlement, RLS, and plan-limit enforcement

## Plans

- Starter: 1 published card
- Pro: 5 published cards, premium templates, advanced analytics, and removable DotCo branding
- Agency: 25 published cards plus appointment booking, lead capture, product showcase, team/white-label positioning, and custom-domain eligibility

## Recurring add-ons

Add-ons are Stripe subscription items attached to the customer's existing subscription. They never create a second subscription.

- Extra Card — $3/month or $30/year per card
- Advanced Analytics — $5/month or $50/year
- Remove Branding — $5/month or $50/year
- Premium Templates — $5/month or $50/year
- Appointment Booking — $7/month or $70/year
- Lead Capture — $7/month or $70/year
- Product Showcase — $9/month or $90/year
- Custom Domain — $10/month or $100/year; domain registration is not included

Features already included in a customer's plan are shown as included and cannot be charged twice.

## Live services

- Website: `https://globalcorent.github.io/dotco-cards/`
- Supabase project: `https://bmgmdgkviqqtaluvdprh.supabase.co`
- Stripe products and monthly/yearly plan and add-on prices are configured in Stripe test mode.

## Local development

```bash
python -m http.server 8080
```

Open `http://localhost:8080`.

## Supabase Edge Functions

- `create-checkout-session` — starts a base-plan Checkout session
- `create-portal-session` — opens Stripe Customer Portal
- `manage-addon` — safely adds, removes, or changes recurring add-on subscription items
- `stripe-webhook` — synchronizes plan and add-on entitlements into Supabase

## Security

Only the Supabase project URL and publishable browser key belong in frontend JavaScript. Never commit the Supabase service-role key, Stripe secret key, or Stripe webhook signing secret.

Required Supabase Edge Function secrets:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

Webhook endpoint:

`https://bmgmdgkviqqtaluvdprh.supabase.co/functions/v1/stripe-webhook`

Events:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

Authentication redirects:

- `https://globalcorent.github.io/dotco-cards/**`
- `http://localhost:8080/**`

## Deployment

GitHub Pages can deploy directly from the `main` branch root or through the included workflow. Upload all files at the repository root, preserve the `css`, `js`, `.github`, and `supabase` folders, and keep `.nojekyll` in place.

## Icon attribution

Social brand SVG paths are derived from Font Awesome Free 6.7.2 Brands, licensed under CC BY 4.0. No font files are distributed with this project.
