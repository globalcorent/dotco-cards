create or replace function public.has_paid_access(p_user_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.subscriptions s
    where s.user_id = p_user_id
      and s.status in ('active','trialing','past_due')
      and (s.current_period_end is null or s.current_period_end > now())
  )
$$;

grant execute on function public.has_paid_access(uuid) to authenticated;

-- The live project also replaces enforce_card_entitlements() so:
-- 1. only active subscribers may publish,
-- 2. service-role webhook updates may safely unpublish expired cards,
-- 3. all existing plan, template, QR, branding, booking, lead, and product rules remain enforced.
