insert into public.venues (id, name, slug, city, district, address, is_active)
values
  ('11111111-1111-4111-8111-111111111111', 'Strömmen Pub', 'strommen-pub', 'Norrköping', 'Centrum', null, true),
  ('22222222-2222-4222-8222-222222222222', 'Industribaren', 'industribaren', 'Norrköping', 'Industrilandskapet', null, true),
  ('33333333-3333-4333-8333-333333333333', 'Campuskranen', 'campuskranen', 'Norrköping', 'Campus Norrköping', null, true),
  ('44444444-4444-4444-8444-444444444444', 'Kvartersolen', 'kvartersolen', 'Norrköping', 'Knäppingsborg', null, true)
on conflict (id) do nothing;

insert into public.beer_prices (
  id,
  venue_id,
  beer_name,
  volume_cl,
  price_sek,
  price_type,
  observed_at,
  source,
  is_verified
)
values
  ('aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '11111111-1111-4111-8111-111111111111', 'Husets lager', 40, 59, 'after_work', '2026-07-05', 'manual', true),
  ('aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaa2', '22222222-2222-4222-8222-222222222222', 'Pilsner på fat', 50, 74, 'normalpris', '2026-07-05', 'manual', true),
  ('aaaaaaa3-aaaa-4aaa-8aaa-aaaaaaaaaaa3', '33333333-3333-4333-8333-333333333333', 'Ljus lager', 40, 52, 'student', '2026-07-05', 'manual', true),
  ('aaaaaaa4-aaaa-4aaa-8aaa-aaaaaaaaaaa4', '44444444-4444-4444-8444-444444444444', 'Session IPA', 33, 68, 'happy_hour', '2026-07-05', 'manual', false)
on conflict (id) do nothing;
