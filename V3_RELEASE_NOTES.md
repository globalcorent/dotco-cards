# DotCo Cards V3 Release Notes

## New customer-facing features

- Recurring add-ons marketplace with monthly/yearly pricing
- Secure add-on changes on the existing Stripe subscription
- Quantity controls for extra cards
- Plan-included entitlement detection to prevent duplicate charges
- Self-contained SVG social-media icons
- Analytics workspace
- Lead inbox
- Services, appointment booking, lead forms, product showcases, and payment links
- Custom-domain request workspace
- Expanded dashboard and public card
- Stronger mobile layouts and cache-busted assets

## Backend already deployed

- Add-on catalog and entitlement tables/functions
- Stripe add-on test products and prices
- `manage-addon` Edge Function v2
- `stripe-webhook` Edge Function v11
- RLS protection for add-on catalog and custom-domain requests

## Validation

- JavaScript syntax checks passed
- TypeScript Edge Function parse checks passed
- HTML parsing passed for 12 pages
- No duplicate HTML IDs
- All local HTML/CSS/JS references exist
- All frontend assets use release cache version `20260722-1`
- Supabase security advisor found no database RLS/schema vulnerability; it only reports that leaked-password protection is disabled in Auth settings
- Supabase performance advisor reports only informational unused-index notices, expected for a new low-traffic project

A browser automation pass could not be completed in the tool environment because local navigation is blocked. Perform the final visual smoke test on GitHub Pages after upload.
