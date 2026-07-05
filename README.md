# Billig Bira

Billig Bira är en publik svensk webbapp för att snabbt hitta billig öl i Norrköping. Appen är byggd som en statisk Astro/React-frontend för GitHub Pages och använder Supabase för publik prislista, rapportflöde och adminmoderering.

## MVP-regel

- Den publika prislistan visar en rad per ställe.
- Raden är ställets billigaste kända ölpris just nu.
- Ingen literprisvisning används i MVP.
- Volym visas bara när volymen är verifierad i källa.
- Källa visas som `hemsida`, `meny` eller `inrapporterat`.
- Ett pris kan vara publicerat utan att vara verifierat av admin.
- Ölkatalogen är frivillig intern metadata, inte ett krav för rapportering.

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

- `supabase/schema.sql` skapar grundtabellerna `venues`, `beer_prices` och `price_reports`.
- `supabase/seed.sql` lägger in utvecklingsseed för lokal och manuell testning.
- `supabase/admin-moderation.sql` lägger till adminmodell, reviewfält, admin-RLS och första RPC-funktioner.
- `supabase/admin-report-overrides.sql` är en äldre övergångsfil för adminjusteringar.
- `supabase/admin-price-management.sql` är en äldre övergångsfil för att dölja priser utan hårdradering.
- `supabase/beer-catalog.sql` skapar och seedar frivillig `beer_catalog`. Den krävs inte för att rapportera pris.
- `supabase/cheapest-price-mvp.sql` lägger till MVP-fälten för billigaste-prisflödet och ersätter admin-RPC:erna.
- `supabase/cleanup-demo-data.sql` är en valfri, försiktig cleanup som inaktiverar tydliga test-/demo-rader utan hårdradering.

Kör filerna i Supabase SQL Editor i denna ordning:

1. `supabase/schema.sql`
2. `supabase/seed.sql`
3. `supabase/admin-moderation.sql`
4. `supabase/admin-report-overrides.sql`
5. `supabase/admin-price-management.sql`
6. `supabase/beer-catalog.sql` om katalogmetadata önskas
7. `supabase/cheapest-price-mvp.sql`

`supabase/cleanup-demo-data.sql` körs bara manuellt efter granskning av berörda rader.

`admin-moderation.sql` och `cheapest-price-mvp.sql` använder inte service role key i frontend. Adminrättighet ligger i databasen via `public.admin_users`, Supabase Auth och RLS.

### Lägga till öl i katalogen

Katalogen är frivillig. Prisrapportering fungerar med `beer_id = null`.

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

- filtrera rapporter på `pending`, `approved`, `rejected`, `archived` eller `all`
- läsa pending reports och historik i `price_reports`
- justera serveringsställe, pris, pristyp, källa, länk, ölmetadata, volym, kommentar och adminnotering innan godkännande
- godkänna och visa en rapport utan adminverifiering
- godkänna en rapport som verifierad
- markera en redan godkänd prispost som verifierad
- avvisa en rapport
- arkivera en aktuell billigaste prispost så den döljs publikt utan hårdradering

Godkännande skapar en rad i `beer_prices` med `status = 'approved'` och `is_current_cheapest = true`. Samtidigt sätts tidigare aktuell billigaste post för samma `venue_id` till `is_current_cheapest = false`, så historiken finns kvar men bara en post per ställe visas publikt.

Skillnaden mellan publicerad och verifierad:

- Publicerad: `status = 'approved'` och kan visas publikt om `is_current_cheapest = true`.
- Verifierad av admin: `admin_verified = true`, med `admin_verified_at` och `admin_verified_by`.

Avslag markerar rapporten som `rejected`, sparar reviewfält och `rejection_reason`. Arkivering sätter prisposten till `status = 'archived'` och `is_current_cheapest = false`.

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

1. Skicka en rapport publikt med endast befintligt ställe och pris.
2. Kontrollera i Supabase att rapporten finns i `price_reports` med `status = 'pending'`.
3. Logga in på `/admin` med Supabase Auth-kontot som finns i `admin_users`.
4. Godkänn rapporten med `Godkänn och visa`.
5. Kontrollera att `beer_prices.status = 'approved'`, `is_current_cheapest = true` och `admin_verified = false`.
6. Kontrollera att priset visas publikt som en rad för stället.
7. Skicka en ny rapport på samma ställe med lägre pris och godkänn den.
8. Kontrollera att den tidigare posten har `is_current_cheapest = false`.
9. Markera en godkänd post som verifierad och kontrollera `admin_verified = true`.
10. Arkivera en aktuell post och kontrollera att den inte längre visas publikt.

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

Rapportformuläret kräver bara:

- ställe
- pris

Frivilligt:

- katalogöl eller fritt ölnamn
- volym
- om volymen är verifierad i källa
- källa: `website`, `menu`, `reported`
- pristyp: `regular`, `after_work`, `campaign`, `unknown`
- källänk
- kommentar

Prislistan hämtar bara `beer_prices` där:

```sql
status = 'approved'
and is_current_cheapest = true
```

När Supabase saknar konfiguration visar den publika prislistan ett tomläge. Formuläret kan fortfarande rendera med en lokal ölkatalog, men rapporter sparas först när Supabase är anslutet. Adminflödet kräver Supabase-konfiguration.

## Säkerhet

- Ingen service role key används i frontend.
- Publika besökare kan läsa aktiva ställen och godkända aktuella billigaste priser.
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

- Lägg till auditvy för redan hanterade prisposter.
- Lägg till operativ katalogadministration om katalogen börjar användas mer aktivt.
