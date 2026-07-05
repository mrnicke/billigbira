create extension if not exists pgcrypto;

create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  city text not null default 'Norrköping',
  district text,
  address text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint venues_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create table if not exists public.beer_prices (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete restrict,
  beer_name text not null,
  volume_cl numeric(6, 2) not null,
  price_sek numeric(8, 2) not null,
  price_per_liter_sek numeric(10, 2) generated always as (round(price_sek / (volume_cl / 100), 2)) stored,
  price_type text not null default 'okänd',
  observed_at date not null default current_date,
  source text not null default 'manual',
  is_verified boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint beer_prices_volume_positive check (volume_cl > 0),
  constraint beer_prices_price_positive check (price_sek > 0),
  constraint beer_prices_price_type check (price_type in ('normalpris', 'after_work', 'happy_hour', 'student', 'okänd')),
  constraint beer_prices_source check (source in ('manual', 'user_report', 'admin'))
);

create table if not exists public.price_reports (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid references public.venues(id) on delete set null,
  venue_name text not null,
  beer_name text not null,
  volume_cl numeric(6, 2) not null,
  price_sek numeric(8, 2) not null,
  price_type text not null default 'okänd',
  observed_at date,
  reporter_note text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  constraint price_reports_volume_positive check (volume_cl > 0),
  constraint price_reports_price_positive check (price_sek > 0),
  constraint price_reports_price_type check (price_type in ('normalpris', 'after_work', 'happy_hour', 'student', 'okänd')),
  constraint price_reports_status check (status in ('pending', 'approved', 'rejected'))
);

create index if not exists venues_active_city_idx on public.venues (city, is_active);
create index if not exists beer_prices_verified_liter_idx on public.beer_prices (is_verified, price_per_liter_sek);
create index if not exists beer_prices_active_verified_liter_idx on public.beer_prices (is_active, is_verified, price_per_liter_sek);
create index if not exists beer_prices_venue_idx on public.beer_prices (venue_id);
create index if not exists price_reports_status_created_idx on public.price_reports (status, created_at desc);

alter table public.venues enable row level security;
alter table public.beer_prices enable row level security;
alter table public.price_reports enable row level security;

drop policy if exists "Public can read active venues" on public.venues;
create policy "Public can read active venues"
  on public.venues
  for select
  using (is_active = true);

drop policy if exists "Public can read verified active beer prices" on public.beer_prices;
create policy "Public can read verified active beer prices"
  on public.beer_prices
  for select
  using (
    is_verified = true
    and is_active = true
    and exists (
      select 1
      from public.venues
      where venues.id = beer_prices.venue_id
        and venues.is_active = true
    )
  );

drop policy if exists "Public can submit pending price reports" on public.price_reports;
create policy "Public can submit pending price reports"
  on public.price_reports
  for insert
  with check (status = 'pending');
