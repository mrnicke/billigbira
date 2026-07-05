create table if not exists public.beer_catalog (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  style text not null default 'annan',
  brand text,
  brewery text,
  is_generic boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 1000,
  created_at timestamptz not null default now(),
  constraint beer_catalog_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint beer_catalog_style check (style in ('lager', 'pilsner', 'ipa', 'ale', 'stout', 'veteol', 'suröl', 'alkoholfri', 'annan'))
);

alter table public.beer_prices
  add column if not exists beer_id uuid references public.beer_catalog(id) on delete set null;

alter table public.price_reports
  add column if not exists beer_id uuid references public.beer_catalog(id) on delete set null;

create index if not exists beer_catalog_active_sort_idx on public.beer_catalog (is_active, sort_order, name);
create index if not exists beer_prices_beer_idx on public.beer_prices (beer_id);
create index if not exists price_reports_beer_idx on public.price_reports (beer_id);

alter table public.beer_catalog enable row level security;

drop policy if exists "Public can read active beer catalog" on public.beer_catalog;
create policy "Public can read active beer catalog"
  on public.beer_catalog
  for select
  using (is_active = true);

drop policy if exists "Admins can read all beer catalog" on public.beer_catalog;
create policy "Admins can read all beer catalog"
  on public.beer_catalog
  for select
  using (public.is_current_user_admin());

drop policy if exists "Admins can insert beer catalog" on public.beer_catalog;
create policy "Admins can insert beer catalog"
  on public.beer_catalog
  for insert
  with check (public.is_current_user_admin());

drop policy if exists "Admins can update beer catalog" on public.beer_catalog;
create policy "Admins can update beer catalog"
  on public.beer_catalog
  for update
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

grant select on public.beer_catalog to anon, authenticated;
grant insert, update on public.beer_catalog to authenticated;

insert into public.beer_catalog (id, name, slug, style, brand, brewery, is_generic, is_active, sort_order)
values
  ('10000000-0000-4000-8000-000000000001', 'Stor stark', 'stor-stark', 'lager', null, null, true, true, 10),
  ('10000000-0000-4000-8000-000000000002', 'Husets lager', 'husets-lager', 'lager', null, null, true, true, 20),
  ('10000000-0000-4000-8000-000000000003', 'Fatöl', 'fatol', 'annan', null, null, true, true, 30),
  ('10000000-0000-4000-8000-000000000004', 'Flasköl', 'flaskol', 'annan', null, null, true, true, 40),
  ('10000000-0000-4000-8000-000000000005', 'Alkoholfri öl', 'alkoholfri-ol', 'alkoholfri', null, null, true, true, 50),
  ('10000000-0000-4000-8000-000000000101', 'Norrlands Guld', 'norrlands-guld', 'lager', 'Norrlands Guld', 'Spendrups', false, true, 110),
  ('10000000-0000-4000-8000-000000000102', 'Mariestads', 'mariestads', 'lager', 'Mariestads', 'Spendrups', false, true, 120),
  ('10000000-0000-4000-8000-000000000103', 'Falcon', 'falcon', 'lager', 'Falcon', 'Carlsberg Sverige', false, true, 130),
  ('10000000-0000-4000-8000-000000000104', 'Pripps Blå', 'pripps-bla', 'lager', 'Pripps Blå', 'Carlsberg Sverige', false, true, 140),
  ('10000000-0000-4000-8000-000000000105', 'Spendrups', 'spendrups', 'lager', 'Spendrups', 'Spendrups', false, true, 150),
  ('10000000-0000-4000-8000-000000000106', 'Heineken', 'heineken', 'lager', 'Heineken', 'Heineken', false, true, 160),
  ('10000000-0000-4000-8000-000000000107', 'Carlsberg', 'carlsberg', 'lager', 'Carlsberg', 'Carlsberg', false, true, 170)
on conflict (id) do update
set name = excluded.name,
    slug = excluded.slug,
    style = excluded.style,
    brand = excluded.brand,
    brewery = excluded.brewery,
    is_generic = excluded.is_generic,
    is_active = excluded.is_active,
    sort_order = excluded.sort_order;
