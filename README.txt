DOTCO CARD DELETE HOTFIX
=========================

Upload these two files to the root of the globalcorent/dotco-cards repository:

1. dashboard.html
2. js/dashboard.js

Replace the existing files and commit with:
Add safe permanent card deletion

After GitHub Pages redeploys, hard-refresh with Ctrl + Shift + R.

Behavior:
- Adds Delete to each card in the dashboard.
- Names the selected card in a confirmation dialog.
- Requires typing DELETE before the permanent action is enabled.
- Removes the card through Supabase RLS, so users can delete only their own cards.
- Related social links, services, products, leads, views, events, card links, and domain requests are removed automatically by database cascades.
