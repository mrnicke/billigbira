# Billig Bira

Billig Bira är en publik svensk webbapp för att snabbt hitta billig öl i Norrköping. Appen är byggd som en statisk Astro/React-frontend för GitHub Pages och är förberedd för Supabase som databas, rapportflöde och framtida moderering.

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
npm install
```

Starta utvecklingsserver:

```bash
npm run dev
```

Bygg statiskt:

```bash
npm run build
```

Kör Astro/TypeScript-kontroll:

```bash
npm run check
```

På Windows/PowerShell kan `npm.cmd` användas om script-exekvering blockerar `npm`:

```powershell
npm.cmd run build
```

## Miljövariabler

Kopiera `.env.example` till `.env.local` vid lokal Supabase-testning:

```env
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_ANON_KEY=
```

Om variablerna saknas bygger och fungerar appen fortsatt med lokal fallback-data. Lägg aldrig `service_role`, secret keys, tokens, lösenord eller backend-nycklar i frontendkod, `.env.example`, commits eller testoutput.

## Supabase

SQL-filer finns i `supabase/`:

- `supabase/schema.sql` skapar tabellerna `venues`, `beer_prices` och `price_reports`, constraints, index och RLS-policies.
- `supabase/seed.sql` lägger in tydlig exempeldata för Norrköping.

Kör filerna i Supabase SQL Editor i denna ordning:

1. `supabase/schema.sql`
2. `supabase/seed.sql`

Den publika frontendklienten ska bara använda `PUBLIC_SUPABASE_URL` och `PUBLIC_SUPABASE_ANON_KEY`. Läsning styrs av RLS: publika besökare kan läsa aktiva ställen och verifierade priser. Rapporter kan skickas in som `pending`, men det finns ingen publik policy för att läsa eller moderera rapporter.

## Dataflöde

Appens kärntyper finns i `src/lib/types.ts`.

Data hämtas via `src/lib/data/prices.ts`:

- `getVenues()`
- `getBeerPrices()`
- `submitPriceReport()`

När Supabase saknar konfiguration används fallback-data från `src/data/beerPrices.ts`. Pris per liter beräknas konsekvent som:

```ts
price_sek / (volume_cl / 100)
```

## GitHub Pages

Astro är konfigurerat för GitHub Pages project site med:

```js
site: "https://mrnicke.github.io",
base: "/billigbira",
output: "static",
```

Workflow finns i `.github/workflows/deploy.yml`. Deploy sker via GitHub Actions när ändringar pushas till `main`, förutsatt att repository settings använder GitHub Actions som Pages-källa.

## Nästa steg

- Skapa riktigt Supabase-projekt.
- Kör schema och seed i Supabase.
- Lägg in public URL och anon key som GitHub Pages/Actions-miljövariabler om build ska läsa Supabase-data.
- Bygg admin-auth och moderering server-side med RLS och tydliga roller innan någon adminfunktion exponeras.
