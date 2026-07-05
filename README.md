# Billig Bira

Billig Bira är en publik svensk webbapp för att snabbt hitta billig öl i Norrköping. Appen är byggd som en statisk Astro/React-frontend för GitHub Pages och använder Supabase för publik prislista, rapportflöde och adminmoderering.

## Stack

- Astro
- React
- TypeScript
- Tailwind CSS
- Supabase JS-klient
- Statisk build för GitHub Pages

## Lokal utveckling

Installera beroenden:

```bash
pnpm install
```

Starta utvecklingsserver:

```bash
pnpm run dev
```

Bygg statiskt:

```bash
pnpm run build
```

Kör Astro/TypeScript-kontroll:

```bash
pnpm run check
```

På Windows/PowerShell kan `pnpm.cmd` användas:

```powershell
pnpm.cmd run build
```

## Miljövariabler

Kopiera `.env.example` till `.env.local` vid lokal Supabase-testning:

```env
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_ANON_KEY=
```

Frontendklienten ska bara använda `PUBLIC_SUPABASE_URL` och `PUBLIC_SUPABASE_ANON_KEY`. Lägg aldrig `service_role`, secret keys, tokens, lösenord eller backend-nycklar i frontendkod, `.env.example`, commits eller testoutput.

## Supabase

SQL-filer finns i `supabase/`:

- `supabase/schema.sql` skapar tabellerna `venues`, `beer_prices` och `price_reports`, constraints, index och grundläggande RLS-policies.
- `supabase/seed.sql` lägger in utvecklingsseed för lokal och manuell testning.
- `supabase/admin-moderation.sql` lägger till adminmodell, reviewfält, admin-RLS och RPC-funktioner för godkänn/avvisa.
- `supabase/admin-report-overrides.sql` uppdaterar approve-RPC:n så admin kan justera rapportdata innan godkännande.
- `supabase/admin-price-management.sql` lägger till `beer_prices.is_active`, publik filtrering och admin-update för att dölja felaktiga priser utan hårdradering.
- `supabase/beer-catalog.sql` skapar `beer_catalog`, lägger till nullable `beer_id` på priser/rapporter och uppdaterar approve-RPC:n för katalogkoppling.
- `supabase/cleanup-demo-data.sql` är en valfri, försiktig cleanup som inaktiverar tydliga test-/demo-rader utan hårdradering.

Kör filerna i Supabase SQL Editor i denna ordning:

1. `supabase/schema.sql`
2. `supabase/seed.sql`
3. `supabase/admin-moderation.sql`
4. `supabase/admin-report-overrides.sql`
5. `supabase/admin-price-management.sql`
6. `supabase/beer-catalog.sql`

`supabase/cleanup-demo-data.sql` körs bara manuellt efter granskning av berörda rader.

`admin-moderation.sql` använder inte service role key i frontend. Adminrättighet ligger i databasen via `public.admin_users`, Supabase Auth och RLS.

### Lägga till öl i katalogen

Lägg till fler öl via Supabase SQL Editor:

```sql
insert into public.beer_catalog (name, slug, style, brand, brewery, is_generic, is_active, sort_order)
values ('Oppigårds New Sweden IPA', 'oppigards-new-sweden-ipa', 'ipa', 'Oppigårds New Sweden IPA', 'Oppigårds', false, true, 300)
on conflict (slug) do update
set name = excluded.name,
    style = excluded.style,
    brand = excluded.brand,
    brewery = excluded.brewery,
    is_active = excluded.is_active,
    sort_order = excluded.sort_order;
```

Tillåtna stilar är `lager`, `pilsner`, `ipa`, `ale`, `stout`, `veteol`, `suröl`, `alkoholfri` och `annan`.

## Adminflöde

Adminvyn finns på `/admin`. Den använder Supabase Auth med e-post och lösenord. En inloggad användare måste dessutom finnas i `public.admin_users`; enbart frontendkontroller räcker inte och ger inte adminåtkomst.

Admin kan:

- filtrera rapporter på `pending`, `approved`, `rejected` eller `all`
- läsa pending reports och historik i `price_reports`
- justera serveringsställe, öl/prisnamn, pris, volym, pristyp, observerat datum och kommentar innan godkännande
- koppla rapporten till ett befintligt serveringsställe eller låta godkännandet skapa nytt ställe från rapporten
- koppla en rapport till befintlig katalogöl eller behålla den som okopplad öl med varning
- godkänna en rapport via `approve_price_report(report_id, override_venue_id, override_venue_name, override_beer_name, override_volume_cl, override_price_sek, override_price_type, override_observed_at, override_reporter_note, override_beer_id)`
- avvisa en rapport via `reject_price_report(report_id, review_reason)`
- avaktivera eller återaktivera publika priser via `beer_prices.is_active`

Godkännande validerar adminjusterade värden server-side, skapar en verifierad och aktiv rad i `beer_prices`, markerar rapporten som `approved`, sparar de granskade värdena på rapporten, sätter reviewfält och länkar rapporten till det skapade priset. Om admin väljer katalogöl sätts `beer_id` och `beer_name` hämtas från katalogen. Om admin behåller okopplad öl sparas `beer_id = null` och `beer_name` används för bakåtkompatibel visning. Om admin väljer ett befintligt `venue_id` används det stället. Om rapporten ska använda nytt ställe matchas först aktivt ställe på namn; annars skapas ett aktivt ställe med slug från rapportens ställenamn. Den publika prislistan hämtar bara `is_verified = true` och `is_active = true` från Supabase i klienten så att godkända priser syns efter refresh utan ny GitHub Pages-build.

Avslag markerar rapporten som `rejected`, sparar reviewfält och `rejection_reason`. Avvisade rapporter visas inte publikt. Felaktiga priser ska normalt döljas med `is_active = false`, inte hårdraderas.

### Skapa adminanvändare

1. Skapa en användare i Supabase Dashboard under Authentication.
2. Kopiera användarens `id`.
3. Kör detta i Supabase SQL Editor:

```sql
insert into public.admin_users (user_id)
values ('AUTH_USER_ID_HERE')
on conflict (user_id) do nothing;
```

Användarens e-post behöver inte hårdkodas i schema eller frontend.

## Testa adminmoderering

1. Skicka en rapport publikt mot ett befintligt serveringsställe och en katalogöl via formuläret.
2. Kontrollera i Supabase att rapporten finns i `price_reports` med `status = 'pending'`, att `venue_id` är satt och att `beer_id` är satt.
3. Logga in på `/admin` med Supabase Auth-kontot som finns i `admin_users`.
4. Ändra pris eller volym i admin och godkänn rapporten.
5. Kontrollera att en verifierad och aktiv rad skapats i `beer_prices`, att `beer_prices.venue_id` och `beer_prices.beer_id` pekar rätt och att justerat pris syns i publika listan efter refresh.
6. Skicka en rapport publikt med "Lägg till nytt ställe".
7. Kontrollera att `price_reports.venue_id` är tomt och att `venue_name` innehåller det nya stället.
8. Avvisa rapporten med en orsak, till exempel `fel pris`.
9. Kontrollera att rapporten fått `status = 'rejected'`, att `rejection_reason` är satt och att rapporten inte syns publikt.
10. Skicka en ny rapport på nytt ställe, godkänn den och kontrollera att ett aktivt ställe skapats i `venues`, att `price_reports.approved_price_id` är satt och att priset syns publikt.
11. Avaktivera ett publikt pris i admin.
12. Kontrollera att `beer_prices.is_active = false` och att priset inte längre syns publikt efter refresh.
13. Återaktivera priset om det var testdata som ska återställas.

## Dataflöde

Appens kärntyper finns i `src/lib/types.ts`.

Publik data hämtas via `src/lib/data/prices.ts`:

- `getVenues()`
- `getBeerPrices()`
- `submitPriceReport()`

Ölkatalogen hämtas via `src/lib/data/beers.ts`:

- `getBeerCatalog()`
- `getActiveBeers()`
- `getBeerById()`
- `suggestBeerName()`

Rapportformuläret hämtar aktiva `venues` via `getVenues()` och aktiva katalogöl via `getActiveBeers()`. Om besökaren väljer ett befintligt ställe skickas `venue_id` tillsammans med ställets namn till `price_reports`. Om besökaren lägger till ett nytt ställe skickas `venue_name` och adminflödet skapar ett aktivt `venues`-record först vid godkännande.

För öl skickar formuläret:

- katalogöl: `beer_id` och katalogens `beer_name`
- annan öl: `beer_id = null` och besökarens `beer_name`

Prislistan visar katalogens namn och stil när `beer_id` finns. Äldre rader utan `beer_id` visas med sparat `beer_name`.

Adminlogik ligger separat i `src/lib/data/admin.ts`:

- `getCurrentUser()`
- `signInAdmin()`
- `signOutAdmin()`
- `getAdminVenues()`
- `getReportStatusCounts()`
- `getReportsByStatus()`
- `getPendingReports()` som kompatibel wrapper
- `approveReport()`
- `rejectReport()`
- `getAdminBeerPrices()`
- `deactivateBeerPrice()`
- `reactivateBeerPrice()`

När Supabase saknar konfiguration visar den publika prislistan ett tomläge. Formuläret kan fortfarande rendera med en lokal ölkatalog, men rapporter sparas först när Supabase är anslutet. Adminflödet kräver Supabase-konfiguration.

Pris per liter beräknas konsekvent som:

```ts
price_sek / (volume_cl / 100)
```

## Säkerhet

- Ingen service role key används i frontend.
- Publika besökare kan läsa aktiva ställen och verifierade priser.
- Publika besökare kan bara läsa priser som både är verifierade och aktiva.
- Publika besökare kan skapa pending reports.
- Publika besökare kan inte läsa alla pending reports.
- Publika besökare kan inte skriva direkt till `beer_prices`.
- Admin skyddas med Supabase Auth, `admin_users`, RLS och server-side SQL-funktioner.
- Frontendkontroller är bara UX och ska inte betraktas som säkerhet.

## GitHub Pages

Astro är konfigurerat för GitHub Pages project site med:

```js
site: "https://mrnicke.github.io",
base: "/billigbira",
output: "static",
```

Workflow finns i `.github/workflows/deploy.yml`. Deploy sker via GitHub Actions när ändringar pushas till `main`, förutsatt att repository settings använder GitHub Actions som Pages-källa.

## Nästa steg

- Lägg till avvisningsorsak i UI om den ska användas operativt.
- Lägg till auditvy för redan hanterade rapporter.
