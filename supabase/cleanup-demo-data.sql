-- Optional production cleanup helper.
-- Review the affected rows first. This file only deactivates obvious development data.

begin;

update public.beer_prices
set is_active = false
where is_active = true
  and (
    beer_name ilike 'Test%'
    or beer_name ilike 'Demo%'
    or beer_name ilike 'Exempel%'
    or beer_name ilike '%testdata%'
  );

update public.venues
set is_active = false
where is_active = true
  and (
    name ilike 'Test%'
    or name ilike 'Demo%'
    or name ilike 'Exempel%'
    or name ilike '%testdata%'
  )
  and not exists (
    select 1
    from public.beer_prices
    where beer_prices.venue_id = venues.id
      and beer_prices.is_active = true
  );

commit;
