-- DotCo Cards V3 add-on marketplace and entitlement catalog.
-- Assumes the core DotCo schema, is_admin(), has_active_addon(), effective_plan(),
-- set_updated_at(), subscriptions, subscription_addons, plan_definitions, and domain_requests already exist.

create table if not exists public.addon_definitions (
  addon_key text primary key,
  name text not null,
  short_description text not null,
  long_description text,
  category text not null default 'growth',
  icon text not null default 'sparkles',
  monthly_price_cents integer not null check (monthly_price_cents >= 0),
  yearly_price_cents integer not null check (yearly_price_cents >= 0),
  stripe_monthly_price_id text,
  stripe_yearly_price_id text,
  included_plans text[] not null default '{}',
  max_quantity integer not null default 1 check (max_quantity > 0),
  is_quantity boolean not null default false,
  entitlement_key text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.addon_definitions is
  'Sellable recurring add-ons and Stripe price mappings for DotCo Cards.';

alter table public.addon_definitions enable row level security;
alter table public.addon_definitions force row level security;

drop policy if exists addon_definitions_select on public.addon_definitions;
create policy addon_definitions_select on public.addon_definitions
for select using (is_active or public.is_admin());

drop policy if exists addon_definitions_admin_insert on public.addon_definitions;
create policy addon_definitions_admin_insert on public.addon_definitions
for insert with check (public.is_admin());

drop policy if exists addon_definitions_admin_update on public.addon_definitions;
create policy addon_definitions_admin_update on public.addon_definitions
for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists addon_definitions_admin_delete on public.addon_definitions;
create policy addon_definitions_admin_delete on public.addon_definitions
for delete using (public.is_admin());

insert into public.addon_definitions (
  addon_key, name, short_description, long_description, category, icon,
  monthly_price_cents, yearly_price_cents,
  stripe_monthly_price_id, stripe_yearly_price_id,
  included_plans, max_quantity, is_quantity, entitlement_key, sort_order, is_active
) values
('extra_card','Extra Card','Add another published card to your workspace.','Perfect for another employee, business, role, location, or campaign. Increase the quantity whenever you need more cards.','capacity','contact-round-plus',300,3000,'price_1TvkksDk0TpSs9s8tm5309bW','price_1Tvkl1Dk0TpSs9s8Ow269glI','{}',20,true,'extra_card',10,true),
('advanced_analytics','Advanced Analytics','See deeper engagement and conversion insights.','Unlock action breakdowns, referrers, device trends, card comparisons, and performance over time.','growth','chart-no-axes-combined',500,5000,'price_1Tvkl7Dk0TpSs9s8yiAci9UY','price_1TvklGDk0TpSs9s818K0laTu','{pro,agency}',1,false,'advanced_analytics',20,true),
('remove_branding','Remove Branding','Present a clean, white-label card experience.','Removes the Powered by DotCo Cards footer from published cards.','brand','badge-x',500,5000,'price_1TvklPDk0TpSs9s8BjgXxpEZ','price_1TvklXDk0TpSs9s8P6Bwr9nj','{pro,agency}',1,false,'remove_branding',30,true),
('premium_templates','Premium Templates','Unlock the full premium template library.','Use elevated industry designs for real estate, beauty, healthcare, restaurants, contractors, automotive, daycare, credit repair, and more.','design','panels-top-left',500,5000,'price_1TvkleDk0TpSs9s8ZhyXmU09','price_1TvklnDk0TpSs9s8mQ8beZxC','{pro,agency}',1,false,'premium_templates',40,true),
('appointment_booking','Appointment Booking','Let customers book directly from your card.','Adds a dedicated booking button and booking link to every enabled card.','conversion','calendar-check-2',700,7000,'price_1TvkluDk0TpSs9s8XL037jBK','price_1Tvkm7Dk0TpSs9s8Um2DCufa','{agency}',1,false,'appointment_booking',50,true),
('lead_capture','Lead Capture','Collect customer inquiries inside DotCo.','Adds a mobile-friendly inquiry form to your public card and stores leads in your dashboard.','conversion','inbox',700,7000,'price_1TvkmIDk0TpSs9s8angow6xL','price_1TvkmUDk0TpSs9s8caHxBugM','{agency}',1,false,'lead_capture',60,true),
('product_showcase','Product Showcase','Display products with prices and purchase links.','Adds a visual product section with photos, descriptions, pricing, and Buy buttons.','commerce','shopping-bag',900,9000,'price_1TvkmaDk0TpSs9s8SboFwr7l','price_1TvkmiDk0TpSs9s8g0m6drla','{agency}',1,false,'product_showcase',70,true),
('custom_domain','Custom Domain','Use your own branded web address.','Includes domain request tracking, DNS guidance, SSL setup, and routing for one card. Domain registration is not included.','brand','globe-2',1000,10000,'price_1TvkmsDk0TpSs9s85HP7dtMx','price_1Tvkn1Dk0TpSs9s8gbf7uvOP','{}',1,false,'custom_domain',80,true)
on conflict (addon_key) do update set
  name = excluded.name,
  short_description = excluded.short_description,
  long_description = excluded.long_description,
  category = excluded.category,
  icon = excluded.icon,
  monthly_price_cents = excluded.monthly_price_cents,
  yearly_price_cents = excluded.yearly_price_cents,
  stripe_monthly_price_id = excluded.stripe_monthly_price_id,
  stripe_yearly_price_id = excluded.stripe_yearly_price_id,
  included_plans = excluded.included_plans,
  max_quantity = excluded.max_quantity,
  is_quantity = excluded.is_quantity,
  entitlement_key = excluded.entitlement_key,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = now();

create or replace function public.user_has_entitlement(
  p_user_id uuid,
  p_entitlement_key text
)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.addon_definitions d
    where d.entitlement_key = p_entitlement_key
      and d.is_active
      and (
        public.effective_plan(p_user_id) = any(d.included_plans)
        or public.has_active_addon(p_user_id, d.addon_key)
      )
  )
$$;

comment on function public.user_has_entitlement(uuid,text) is
  'Returns true when the user plan includes an entitlement or an active add-on grants it.';

drop trigger if exists set_addon_definitions_updated_at on public.addon_definitions;
create trigger set_addon_definitions_updated_at
before update on public.addon_definitions
for each row execute function public.set_updated_at();

create index if not exists addon_definitions_active_sort_idx
  on public.addon_definitions(is_active, sort_order);
create unique index if not exists addon_definitions_monthly_price_uidx
  on public.addon_definitions(stripe_monthly_price_id)
  where stripe_monthly_price_id is not null;
create unique index if not exists addon_definitions_yearly_price_uidx
  on public.addon_definitions(stripe_yearly_price_id)
  where stripe_yearly_price_id is not null;
create index if not exists subscription_addons_user_status_idx
  on public.subscription_addons(user_id, status, addon_key);

grant select on public.addon_definitions to anon, authenticated;
grant select on public.subscription_addons to authenticated;
grant select on public.subscriptions to authenticated;
grant execute on function public.user_has_entitlement(uuid,text) to authenticated;

-- A custom-domain request requires the paid custom-domain add-on.
drop policy if exists domain_requests_own_insert on public.domain_requests;
create policy domain_requests_own_insert on public.domain_requests
for insert with check (
  ((select auth.uid()) = user_id or public.is_admin())
  and (
    public.is_admin()
    or public.has_active_addon(user_id, 'custom_domain')
  )
);
