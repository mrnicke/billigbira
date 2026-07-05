-- MVP pricing model:
-- one public current cheapest beer price per venue, without liter-price ranking.

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
  created_at timestamptz not null default now()
);

alter table public.beer_prices
  add column if not exists beer_id uuid references public.beer_catalog(id) on delete set null,
  add column if not exists volume_is_verified boolean not null default false,
  add column if not exists source_type text not null default 'reported',
  add column if not exists source_url text,
  add column if not exists status text not null default 'approved',
  add column if not exists is_current_cheapest boolean not null default false,
  add column if not exists admin_verified boolean not null default false,
  add column if not exists admin_verified_at timestamptz,
  add column if not exists admin_verified_by uuid references auth.users(id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references auth.users(id) on delete set null,
  add column if not exists reported_at timestamptz,
  add column if not exists reporter_note text,
  add column if not exists admin_note text;

alter table public.price_reports
  add column if not exists beer_id uuid references public.beer_catalog(id) on delete set null,
  add column if not exists volume_is_verified boolean not null default false,
  add column if not exists source_type text not null default 'reported',
  add column if not exists source_url text,
  add column if not exists admin_note text,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references auth.users(id) on delete set null;

alter table public.beer_prices
  alter column beer_name drop not null,
  alter column volume_cl drop not null;

alter table public.price_reports
  alter column beer_name drop not null,
  alter column volume_cl drop not null;

alter table public.beer_prices
  drop constraint if exists beer_prices_price_type,
  drop constraint if exists beer_prices_source_type,
  drop constraint if exists beer_prices_status;

alter table public.price_reports
  drop constraint if exists price_reports_price_type,
  drop constraint if exists price_reports_source_type,
  drop constraint if exists price_reports_status;

update public.beer_prices
set price_type = case price_type
  when 'normalpris' then 'regular'
  when 'after_work' then 'after_work'
  when 'happy_hour' then 'campaign'
  else 'unknown'
end
where price_type in ('normalpris', 'happy_hour', 'student', 'okänd');

update public.price_reports
set price_type = case price_type
  when 'normalpris' then 'regular'
  when 'after_work' then 'after_work'
  when 'happy_hour' then 'campaign'
  else 'unknown'
end
where price_type in ('normalpris', 'happy_hour', 'student', 'okänd');

update public.beer_prices
set status = 'approved'
where status is null;

update public.price_reports
set status = 'pending'
where status is null;

alter table public.beer_prices
  add constraint beer_prices_price_type check (price_type in ('regular', 'after_work', 'campaign', 'unknown')),
  add constraint beer_prices_source_type check (source_type in ('website', 'menu', 'reported')),
  add constraint beer_prices_status check (status in ('pending', 'approved', 'rejected', 'archived'));

alter table public.price_reports
  add constraint price_reports_price_type check (price_type in ('regular', 'after_work', 'campaign', 'unknown')),
  add constraint price_reports_source_type check (source_type in ('website', 'menu', 'reported')),
  add constraint price_reports_status check (status in ('pending', 'approved', 'rejected', 'archived'));

create index if not exists beer_prices_current_cheapest_idx
  on public.beer_prices (status, is_current_cheapest, price_sek);

create index if not exists beer_prices_current_venue_idx
  on public.beer_prices (venue_id)
  where status = 'approved' and is_current_cheapest = true;

create index if not exists beer_prices_admin_verified_idx
  on public.beer_prices (admin_verified, admin_verified_at);

create index if not exists price_reports_status_created_idx
  on public.price_reports (status, created_at desc);

drop policy if exists "Public can read verified active beer prices" on public.beer_prices;
drop policy if exists "Public can read approved current cheapest beer prices" on public.beer_prices;
create policy "Public can read approved current cheapest beer prices"
  on public.beer_prices
  for select
  using (
    status = 'approved'
    and is_current_cheapest = true
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

drop function if exists public.approve_price_report(uuid, uuid, text, text, numeric, numeric, text, date, text);
drop function if exists public.approve_price_report(uuid, uuid, text, text, numeric, numeric, text, date, text, uuid);
drop function if exists public.approve_price_report(uuid, uuid, text, numeric, text, text, text, uuid, text, numeric, boolean, date, text, text, boolean);

create or replace function public.approve_price_report(
  report_id uuid,
  override_venue_id uuid default null,
  override_venue_name text default null,
  override_price_sek numeric default null,
  override_price_type text default null,
  override_source_type text default null,
  override_source_url text default null,
  override_beer_id uuid default null,
  override_beer_name text default null,
  override_volume_cl numeric default null,
  override_volume_is_verified boolean default false,
  override_observed_at date default null,
  override_reporter_note text default null,
  override_admin_note text default null,
  verify_admin boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_admin uuid := auth.uid();
  report public.price_reports%rowtype;
  matched_venue_id uuid;
  matched_beer public.beer_catalog%rowtype;
  effective_venue_name text;
  effective_price_sek numeric;
  effective_price_type text;
  effective_source_type text;
  effective_source_url text;
  effective_beer_id uuid;
  effective_beer_name text;
  effective_volume_cl numeric;
  effective_volume_is_verified boolean;
  effective_observed_at date;
  effective_reporter_note text;
  effective_admin_note text;
  base_slug text;
  candidate_slug text;
  slug_suffix integer := 2;
  new_price_id uuid;
begin
  if current_admin is null or not public.is_current_user_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select *
  into report
  from public.price_reports
  where id = report_id
    and status = 'pending'
  for update;

  if not found then
    raise exception 'Pending report not found' using errcode = 'P0002';
  end if;

  effective_venue_name := nullif(trim(coalesce(override_venue_name, report.venue_name)), '');
  effective_price_sek := coalesce(override_price_sek, report.price_sek);
  effective_price_type := coalesce(nullif(trim(override_price_type), ''), report.price_type, 'unknown');
  effective_source_type := coalesce(nullif(trim(override_source_type), ''), report.source_type, 'reported');
  effective_source_url := nullif(trim(coalesce(override_source_url, report.source_url, '')), '');
  effective_beer_id := coalesce(override_beer_id, report.beer_id);
  effective_beer_name := nullif(trim(coalesce(override_beer_name, report.beer_name, '')), '');
  effective_volume_cl := coalesce(override_volume_cl, report.volume_cl);
  effective_volume_is_verified := coalesce(override_volume_is_verified, report.volume_is_verified, false);
  effective_observed_at := coalesce(override_observed_at, report.observed_at, current_date);
  effective_reporter_note := nullif(trim(coalesce(override_reporter_note, report.reporter_note, '')), '');
  effective_admin_note := nullif(trim(coalesce(override_admin_note, report.admin_note, '')), '');
  matched_venue_id := coalesce(override_venue_id, report.venue_id);

  if effective_beer_id is not null then
    select *
    into matched_beer
    from public.beer_catalog
    where id = effective_beer_id
      and is_active = true;

    if not found then
      raise exception 'Active beer not found' using errcode = 'P0002';
    end if;

    effective_beer_name := matched_beer.name;
  end if;

  if effective_venue_name is null then
    raise exception 'Venue name is required' using errcode = '23514';
  end if;

  if effective_price_sek is null or effective_price_sek <= 0 then
    raise exception 'Price must be greater than 0' using errcode = '23514';
  end if;

  if effective_volume_cl is not null and effective_volume_cl <= 0 then
    raise exception 'Volume must be greater than 0' using errcode = '23514';
  end if;

  if effective_price_type not in ('regular', 'after_work', 'campaign', 'unknown') then
    raise exception 'Invalid price type' using errcode = '23514';
  end if;

  if effective_source_type not in ('website', 'menu', 'reported') then
    raise exception 'Invalid source type' using errcode = '23514';
  end if;

  if matched_venue_id is not null and not exists (
    select 1 from public.venues where id = matched_venue_id and is_active = true
  ) then
    raise exception 'Active venue not found' using errcode = 'P0002';
  end if;

  if matched_venue_id is null then
    select id
    into matched_venue_id
    from public.venues
    where lower(name) = lower(effective_venue_name)
      and is_active = true
    order by created_at desc
    limit 1;
  end if;

  if matched_venue_id is null then
    base_slug := public.slugify_venue_name(effective_venue_name);
    candidate_slug := base_slug;

    while exists (select 1 from public.venues where slug = candidate_slug) loop
      candidate_slug := base_slug || '-' || slug_suffix::text;
      slug_suffix := slug_suffix + 1;
    end loop;

    insert into public.venues (name, slug)
    values (effective_venue_name, candidate_slug)
    returning id into matched_venue_id;
  end if;

  update public.beer_prices
  set is_current_cheapest = false
  where venue_id = matched_venue_id
    and is_current_cheapest = true;

  insert into public.beer_prices (
    venue_id,
    price_sek,
    beer_id,
    beer_name,
    volume_cl,
    volume_is_verified,
    price_type,
    source_type,
    source_url,
    status,
    is_current_cheapest,
    admin_verified,
    admin_verified_at,
    admin_verified_by,
    approved_at,
    approved_by,
    reported_at,
    reporter_note,
    admin_note,
    observed_at,
    source,
    is_verified,
    is_active
  )
  values (
    matched_venue_id,
    effective_price_sek,
    effective_beer_id,
    effective_beer_name,
    effective_volume_cl,
    effective_volume_is_verified,
    effective_price_type,
    effective_source_type,
    effective_source_url,
    'approved',
    true,
    verify_admin,
    case when verify_admin then now() else null end,
    case when verify_admin then current_admin else null end,
    now(),
    current_admin,
    report.created_at,
    effective_reporter_note,
    effective_admin_note,
    effective_observed_at,
    'user_report',
    verify_admin,
    true
  )
  returning id into new_price_id;

  update public.price_reports
  set status = 'approved',
      reviewed_at = now(),
      reviewed_by = current_admin,
      approved_at = now(),
      approved_by = current_admin,
      approved_price_id = new_price_id,
      rejection_reason = null,
      venue_id = matched_venue_id,
      venue_name = effective_venue_name,
      price_sek = effective_price_sek,
      beer_id = effective_beer_id,
      beer_name = effective_beer_name,
      volume_cl = effective_volume_cl,
      volume_is_verified = effective_volume_is_verified,
      price_type = effective_price_type,
      source_type = effective_source_type,
      source_url = effective_source_url,
      observed_at = effective_observed_at,
      reporter_note = effective_reporter_note,
      admin_note = effective_admin_note
  where id = report_id;

  return new_price_id;
end;
$$;

create or replace function public.mark_beer_price_admin_verified(price_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_admin uuid := auth.uid();
begin
  if current_admin is null or not public.is_current_user_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  update public.beer_prices
  set admin_verified = true,
      admin_verified_at = coalesce(admin_verified_at, now()),
      admin_verified_by = coalesce(admin_verified_by, current_admin),
      is_verified = true
  where id = price_id
    and status = 'approved';

  if not found then
    raise exception 'Approved price not found' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.archive_beer_price(price_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_admin uuid := auth.uid();
begin
  if current_admin is null or not public.is_current_user_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  update public.beer_prices
  set status = 'archived',
      is_current_cheapest = false,
      is_active = false
  where id = price_id;

  if not found then
    raise exception 'Price not found' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.reject_price_report(report_id uuid, review_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_admin uuid := auth.uid();
begin
  if current_admin is null or not public.is_current_user_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  update public.price_reports
  set status = 'rejected',
      reviewed_at = now(),
      reviewed_by = current_admin,
      rejection_reason = nullif(trim(review_reason), '')
  where id = report_id
    and status = 'pending';

  if not found then
    raise exception 'Pending report not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.approve_price_report(uuid, uuid, text, numeric, text, text, text, uuid, text, numeric, boolean, date, text, text, boolean) from public;
revoke all on function public.mark_beer_price_admin_verified(uuid) from public;
revoke all on function public.archive_beer_price(uuid) from public;
revoke all on function public.reject_price_report(uuid, text) from public;

grant execute on function public.approve_price_report(uuid, uuid, text, numeric, text, text, text, uuid, text, numeric, boolean, date, text, text, boolean) to authenticated;
grant execute on function public.mark_beer_price_admin_verified(uuid) to authenticated;
grant execute on function public.archive_beer_price(uuid) to authenticated;
grant execute on function public.reject_price_report(uuid, text) to authenticated;
