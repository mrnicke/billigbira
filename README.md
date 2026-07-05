# Billig Bira

Billig Bira är en publik svensk webbapp för att snabbt hitta billig öl i Norrköping. Första versionen är en statisk frontend-MVP med fiktiv mockdata och är förberedd för Supabase i senare faser.

## Stack

- Astro
- React
- TypeScript
- Tailwind CSS
- Supabase-klient förberedd, men inte kopplad till riktig data
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

Kör Astro check:

```bash
npm run check
```

## Miljövariabler

Kopiera `.env.example` till `.env.local` vid lokal Supabase-testning:

```bash
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

`.env.local` är gitignore:ad. Lägg aldrig service role key, secret key, tokens, lösenord eller backend-nycklar i browserkod eller repo.

## Säkerhetsprinciper

- Endast Supabase publishable/public key får användas i frontend.
- Service role key och andra hemliga nycklar får aldrig användas i browserkod.
- Mockad frontend ska kunna byggas utan riktiga env-värden.
- Framtida auth, roller och moderering ska enforced server-side via Supabase RLS och säkra policies.

## Mockdata

Prislistan i första MVP:n använder fiktiva exempelposter för Norrköping. Den ska inte läsas som verifierad fakta om riktiga serveringsställen eller priser. Syftet är att testa layout, sortering och beräkning av pris per liter.

## GitHub Pages

Astro är konfigurerat för GitHub Pages project site med:

```js
base: "/billigbira"
```

Workflow finns i `.github/workflows/deploy.yml`.

Manuella GitHub-steg:

1. Gå till repository settings.
2. Öppna Pages.
3. Sätt Source till GitHub Actions.
4. Kör workflow från `main` eller pusha till `main`.

Om remote saknas kan du koppla repositoryt så här:

```bash
git remote add origin https://github.com/<ditt-anvandarnamn>/billigbira.git
git branch -M main
git push -u origin main
```

## Nästa steg

Se `docs/PROJECT_PLAN.md` för planerade MVP-faser.
