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
- `supabase/seed.sql` lägger in tydlig exempeldata för Norrköping.
- `supabase/admin-moderation.sql` lägger till adminmodell, reviewfält, admin-RLS och RPC-funktioner för godkänn/avvisa.

Kör filerna i Supabase SQL Editor i denna ordning:

1. `supabase/schema.sql`
2. `supabase/seed.sql`
3. `supabase/admin-moderation.sql`

`admin-moderation.sql` använder inte service role key i frontend. Adminrättighet ligger i databasen via `public.admin_users`, Supabase Auth och RLS.

## Adminflöde

Adminvyn finns på `/admin`. Den använder Supabase Auth med e-post och lösenord. En inloggad användare måste dessutom finnas i `public.admin_users`; enbart frontendkontroller räcker inte och ger inte adminåtkomst.

Admin kan:

- läsa pending reports i `price_reports`
- godkänna en rapport via `approve_price_report(report_id)`
- avvisa en rapport via `reject_price_report(report_id, review_reason)`

Godkännande skapar en verifierad rad i `beer_prices`, markerar rapporten som `approved`, sätter reviewfält och länkar rapporten till det skapade priset. Om rapporten saknar `venue_id` matchas först aktivt ställe på namn; annars skapas ett aktivt ställe med slug från rapportens ställenamn.

Avslag markerar rapporten som `rejected` och sparar reviewfält. Avvisade rapporter visas inte publikt.

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

1. Skicka en rapport publikt via formuläret.
2. Kontrollera i Supabase att rapporten finns i `price_reports` med `status = 'pending'`.
3. Logga in på `/admin` med Supabase Auth-kontot som finns i `admin_users`.
4. Godkänn rapporten.
5. Kontrollera att en verifierad rad skapats i `beer_prices` och att priset syns i publika listan.
6. Skicka en ny rapport och avvisa den.
7. Kontrollera att rapporten fått `status = 'rejected'` och inte syns publikt.

## Dataflöde

Appens kärntyper finns i `src/lib/types.ts`.

Publik data hämtas via `src/lib/data/prices.ts`:

- `getVenues()`
- `getBeerPrices()`
- `submitPriceReport()`

Adminlogik ligger separat i `src/lib/data/admin.ts`:

- `getCurrentUser()`
- `signInAdmin()`
- `signOutAdmin()`
- `getPendingReports()`
- `approveReport()`
- `rejectReport()`

När Supabase saknar konfiguration används fallback-data från `src/data/beerPrices.ts` för den publika listan. Adminflödet kräver Supabase-konfiguration.

Pris per liter beräknas konsekvent som:

```ts
price_sek / (volume_cl / 100)
```

## Säkerhet

- Ingen service role key används i frontend.
- Publika besökare kan läsa aktiva ställen och verifierade priser.
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

- Lägg till adminval för att koppla rapporter till befintliga ställen innan godkännande.
- Lägg till avvisningsorsak i UI om den ska användas operativt.
- Lägg till auditvy för redan hanterade rapporter.
