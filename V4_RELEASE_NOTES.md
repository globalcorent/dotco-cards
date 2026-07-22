# DotCo Cards V4 Repair Release

## Fixed

- Templates now apply complete layouts, colors, typography, button styling, avatar placement, dark/light mode, and public-card presentation.
- Added four stronger designs: Midnight Pro, Warm Neutral, Neon Tech, and Editorial Ink.
- Existing templates were rebuilt as Executive Navy, Clean Slate, Electric Studio, Noir & Gold, Property Pro, Rose Atelier, Clinical Trust, Ember Table, Built Tough, Apex Motion, Happy Day, and Financial Rise.
- Existing subscribers can upgrade or downgrade without creating a duplicate Stripe subscription.
- Upgrading to Agency removes paid add-on line items that Agency already includes, preventing double billing.
- Monthly/yearly plan changes also convert remaining add-ons to the matching billing interval.
- Active add-ons now update visually without requiring a stale-page reload.
- Purchased tools now show Configure buttons and deep-link into the correct editor section.
- Lead Capture and Product Showcase can be enabled directly from their add-on links.
- Cache version updated so browsers load the repaired editor and billing scripts.

## Backend already deployed

- Supabase `manage-plan` Edge Function
- Professional template configuration data
- Current card entitlement/design synchronization

No additional secret keys are required.
