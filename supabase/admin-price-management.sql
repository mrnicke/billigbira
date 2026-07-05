alter table public.beer_prices
  add column if not exists is_active boolean not null default true;

create index if not exists beer_prices_active_verified_liter_idx
  on public.beer_prices (is_active, is_verified, price_per_liter_sek);

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

drop policy if exists "Admins can update beer prices" on public.beer_prices;
create policy "Admins can update beer prices"
  on public.beer_prices
  for update
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());
