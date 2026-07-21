# DotCo Cards Repair Notes

## Fixed

- Authenticated owners can preview draft cards.
- Visitors receive a clear unpublished/unavailable message instead of an endless skeleton.
- Local CSS and JavaScript URLs are versioned to prevent stale GitHub Pages cache mixtures.
- The editor Preview button now saves and opens the real card preview.
- Publish, preview, and copy-link actions wait for active autosaves to finish.
- Dashboard draft cards are labeled Preview instead of View.
- Stripe test/live price mismatch errors are translated into a clear setup message.
- Manage Billing explains that a completed checkout is required before a Stripe customer exists.

## Stripe testing requirement

The current plan price IDs are test-mode Stripe prices. Supabase must use an `sk_test_` key while testing. Before accepting real payments, create live-mode products/prices and replace the Stripe price IDs stored in `plan_definitions`.
