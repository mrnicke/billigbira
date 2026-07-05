# Projektplan för Billig Bira

## 1. Bootstrap frontend

- Astro, React, TypeScript och Tailwind CSS.
- Statisk GitHub Pages-build.
- Mockdata för prislista i Norrköping.
- Sortering efter pris per liter.
- Rapportformulär utan datalagring.
- Admin-placeholder utan auth.

## 2. Supabase schema + RLS

- Modellera venues, prices, reports, profiles och adminroller.
- Skapa migrationsflöde.
- Lägg till Row Level Security.
- Säkerställ publik läsning utan att öppna skrivning.
- Dokumentera backup- och rollback-flöde innan schemaändringar.

## 3. Publik läsning från Supabase

- Hämta godkända priser från Supabase.
- Behåll mockdata som fallback i lokal utveckling.
- Visa laddning, tomt läge och felmeddelanden på svenska.

## 4. Rapportera pris till Supabase

- Spara publika prisrapporter som pending.
- Validera server-side där det behövs.
- Skydda mot skräpdata och överexponering av interna fält.

## 5. Admin auth

- Lägg till admininloggning.
- Använd Supabase auth och server-side/RLS-baserad åtkomst.
- Undvik UI-only-skydd för behörigheter.

## 6. Admin moderering

- Lista inkomna rapporter.
- Godkänn eller avvisa rapporter.
- Logga beslut utan att exponera känslig data.

## 7. Filter, polish och release

- Filter för område, pristyp, status och volym.
- Förbättra tillgänglighet och visuell QA.
- Lägg till releasechecklista och enklare smoke-test.
