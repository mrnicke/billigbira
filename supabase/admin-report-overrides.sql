alter table public.beer_prices
  add column if not exists is_active boolean not null default true;

alter table public.price_reports
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists rejection_reason text,
  add column if not exists approved_price_id uuid references public.beer_prices(id) on delete set null;

create index if not exists beer_prices_active_verified_liter_idx
  on public.beer_prices (is_active, is_verified, price_per_liter_sek);

drop function if exists public.approve_price_report(uuid);

create or replace function public.approve_price_report(
  report_id uuid,
  override_venue_id uuid default null,
  override_venue_name text default null,
  override_beer_name text default null,
  override_volume_cl numeric default null,
  override_price_sek numeric default null,
  override_price_type text default null,
  override_observed_at date default null,
  override_reporter_note text default null
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
  effective_venue_name text;
  effective_beer_name text;
  effective_volume_cl numeric;
  effective_price_sek numeric;
  effective_price_type text;
  effective_observed_at date;
  effective_reporter_note text;
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
  effective_beer_name := nullif(trim(coalesce(override_beer_name, report.beer_name)), '');
  effective_volume_cl := coalesce(override_volume_cl, report.volume_cl);
  effective_price_sek := coalesce(override_price_sek, report.price_sek);
  effective_price_type := coalesce(nullif(trim(override_price_type), ''), report.price_type);
  effective_observed_at := coalesce(override_observed_at, report.observed_at, current_date);
  effective_reporter_note := nullif(trim(coalesce(override_reporter_note, report.reporter_note, '')), '');
  matched_venue_id := coalesce(override_venue_id, report.venue_id);

  if effective_venue_name is null then
    raise exception 'Venue name is required' using errcode = '23514';
  end if;

  if effective_beer_name is null then
    raise exception 'Beer name is required' using errcode = '23514';
  end if;

  if effective_volume_cl is null or effective_volume_cl <= 0 then
    raise exception 'Volume must be greater than 0' using errcode = '23514';
  end if;

  if effective_price_sek is null or effective_price_sek <= 0 then
    raise exception 'Price must be greater than 0' using errcode = '23514';
  end if;

  if effective_price_type not in ('normalpris', 'after_work', 'happy_hour', 'student', 'okänd') then
    raise exception 'Invalid price type' using errcode = '23514';
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

  insert into public.beer_prices (
    venue_id,
    beer_name,
    volume_cl,
    price_sek,
    price_type,
    observed_at,
    source,
    is_verified,
    is_active
  )
  values (
    matched_venue_id,
    effective_beer_name,
    effective_volume_cl,
    effective_price_sek,
    effective_price_type,
    effective_observed_at,
    'user_report',
    true,
    true
  )
  returning id into new_price_id;

  update public.price_reports
  set status = 'approved',
      reviewed_at = now(),
      reviewed_by = current_admin,
      approved_price_id = new_price_id,
      rejection_reason = null,
      venue_id = matched_venue_id,
      venue_name = effective_venue_name,
      beer_name = effective_beer_name,
      volume_cl = effective_volume_cl,
      price_sek = effective_price_sek,
      price_type = effective_price_type,
      observed_at = effective_observed_at,
      reporter_note = effective_reporter_note
  where id = report_id;

  return new_price_id;
end;
$$;

revoke all on function public.approve_price_report(uuid, uuid, text, text, numeric, numeric, text, date, text) from public;
grant execute on function public.approve_price_report(uuid, uuid, text, text, numeric, numeric, text, date, text) to authenticated;
