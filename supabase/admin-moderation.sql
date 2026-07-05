create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

alter table public.admin_users enable row level security;

alter table public.price_reports
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists rejection_reason text,
  add column if not exists approved_price_id uuid references public.beer_prices(id) on delete set null;

create index if not exists price_reports_reviewed_by_idx on public.price_reports (reviewed_by);
create index if not exists price_reports_approved_price_idx on public.price_reports (approved_price_id);

create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where admin_users.user_id = auth.uid()
  );
$$;

create or replace function public.slugify_venue_name(input text)
returns text
language sql
immutable
set search_path = public
as $$
  select coalesce(
    nullif(
      trim(both '-' from regexp_replace(translate(lower(input), 'åäö', 'aao'), '[^a-z0-9]+', '-', 'g')),
      ''
    ),
    'stalle'
  );
$$;

create or replace function public.approve_price_report(report_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_admin uuid := auth.uid();
  report public.price_reports%rowtype;
  matched_venue_id uuid;
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

  matched_venue_id := report.venue_id;

  if matched_venue_id is null then
    select id
    into matched_venue_id
    from public.venues
    where lower(name) = lower(report.venue_name)
      and is_active = true
    order by created_at desc
    limit 1;
  end if;

  if matched_venue_id is null then
    base_slug := public.slugify_venue_name(report.venue_name);
    candidate_slug := base_slug;

    while exists (select 1 from public.venues where slug = candidate_slug) loop
      candidate_slug := base_slug || '-' || slug_suffix::text;
      slug_suffix := slug_suffix + 1;
    end loop;

    insert into public.venues (name, slug)
    values (report.venue_name, candidate_slug)
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
    is_verified
  )
  values (
    matched_venue_id,
    report.beer_name,
    report.volume_cl,
    report.price_sek,
    report.price_type,
    coalesce(report.observed_at, current_date),
    'user_report',
    true
  )
  returning id into new_price_id;

  update public.price_reports
  set status = 'approved',
      reviewed_at = now(),
      reviewed_by = current_admin,
      approved_price_id = new_price_id,
      rejection_reason = null,
      venue_id = matched_venue_id
  where id = report_id;

  return new_price_id;
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

drop policy if exists "Admins can read admin users" on public.admin_users;
create policy "Admins can read admin users"
  on public.admin_users
  for select
  using (public.is_current_user_admin());

drop policy if exists "Admins can read price reports" on public.price_reports;
create policy "Admins can read price reports"
  on public.price_reports
  for select
  using (public.is_current_user_admin());

drop policy if exists "Admins can update price reports" on public.price_reports;
create policy "Admins can update price reports"
  on public.price_reports
  for update
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

drop policy if exists "Admins can read all beer prices" on public.beer_prices;
create policy "Admins can read all beer prices"
  on public.beer_prices
  for select
  using (public.is_current_user_admin());

drop policy if exists "Admins can insert beer prices" on public.beer_prices;
create policy "Admins can insert beer prices"
  on public.beer_prices
  for insert
  with check (public.is_current_user_admin());

drop policy if exists "Admins can update beer prices" on public.beer_prices;
create policy "Admins can update beer prices"
  on public.beer_prices
  for update
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

drop policy if exists "Admins can read all venues" on public.venues;
create policy "Admins can read all venues"
  on public.venues
  for select
  using (public.is_current_user_admin());

drop policy if exists "Admins can insert venues" on public.venues;
create policy "Admins can insert venues"
  on public.venues
  for insert
  with check (public.is_current_user_admin());

drop policy if exists "Admins can update venues" on public.venues;
create policy "Admins can update venues"
  on public.venues
  for update
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

revoke all on function public.is_current_user_admin() from public;
revoke all on function public.slugify_venue_name(text) from public;
revoke all on function public.approve_price_report(uuid) from public;
revoke all on function public.reject_price_report(uuid, text) from public;

grant execute on function public.is_current_user_admin() to anon, authenticated;
grant execute on function public.approve_price_report(uuid) to authenticated;
grant execute on function public.reject_price_report(uuid, text) to authenticated;
