import { isSupabaseConfigured, supabase } from "../supabase";
import type { BeerCatalogItem, BeerStyle } from "../types";

const localBeerCatalog: BeerCatalogItem[] = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    name: "Stor stark",
    slug: "stor-stark",
    style: "lager",
    brand: null,
    brewery: null,
    is_generic: true,
    is_active: true,
    sort_order: 10,
    created_at: "2026-07-05T00:00:00.000Z",
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    name: "Husets lager",
    slug: "husets-lager",
    style: "lager",
    brand: null,
    brewery: null,
    is_generic: true,
    is_active: true,
    sort_order: 20,
    created_at: "2026-07-05T00:00:00.000Z",
  },
  {
    id: "10000000-0000-4000-8000-000000000003",
    name: "Fatöl",
    slug: "fatol",
    style: "annan",
    brand: null,
    brewery: null,
    is_generic: true,
    is_active: true,
    sort_order: 30,
    created_at: "2026-07-05T00:00:00.000Z",
  },
  {
    id: "10000000-0000-4000-8000-000000000004",
    name: "Alkoholfri öl",
    slug: "alkoholfri-ol",
    style: "alkoholfri",
    brand: null,
    brewery: null,
    is_generic: true,
    is_active: true,
    sort_order: 40,
    created_at: "2026-07-05T00:00:00.000Z",
  },
  {
    id: "10000000-0000-4000-8000-000000000101",
    name: "Norrlands Guld",
    slug: "norrlands-guld",
    style: "lager",
    brand: "Norrlands Guld",
    brewery: "Spendrups",
    is_generic: false,
    is_active: true,
    sort_order: 110,
    created_at: "2026-07-05T00:00:00.000Z",
  },
  {
    id: "10000000-0000-4000-8000-000000000102",
    name: "Mariestads",
    slug: "mariestads",
    style: "lager",
    brand: "Mariestads",
    brewery: "Spendrups",
    is_generic: false,
    is_active: true,
    sort_order: 120,
    created_at: "2026-07-05T00:00:00.000Z",
  },
  {
    id: "10000000-0000-4000-8000-000000000103",
    name: "Falcon",
    slug: "falcon",
    style: "lager",
    brand: "Falcon",
    brewery: "Carlsberg Sverige",
    is_generic: false,
    is_active: true,
    sort_order: 130,
    created_at: "2026-07-05T00:00:00.000Z",
  },
  {
    id: "10000000-0000-4000-8000-000000000104",
    name: "Pripps Blå",
    slug: "pripps-bla",
    style: "lager",
    brand: "Pripps Blå",
    brewery: "Carlsberg Sverige",
    is_generic: false,
    is_active: true,
    sort_order: 140,
    created_at: "2026-07-05T00:00:00.000Z",
  },
  {
    id: "10000000-0000-4000-8000-000000000105",
    name: "Heineken",
    slug: "heineken",
    style: "lager",
    brand: "Heineken",
    brewery: "Heineken",
    is_generic: false,
    is_active: true,
    sort_order: 150,
    created_at: "2026-07-05T00:00:00.000Z",
  },
  {
    id: "10000000-0000-4000-8000-000000000106",
    name: "Carlsberg",
    slug: "carlsberg",
    style: "lager",
    brand: "Carlsberg",
    brewery: "Carlsberg",
    is_generic: false,
    is_active: true,
    sort_order: 160,
    created_at: "2026-07-05T00:00:00.000Z",
  },
];

function sortBeerCatalog(beers: BeerCatalogItem[]) {
  return [...beers].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "sv"));
}

export function getLocalBeerCatalog(): BeerCatalogItem[] {
  return sortBeerCatalog(localBeerCatalog);
}

export async function getBeerCatalog(): Promise<BeerCatalogItem[]> {
  if (!isSupabaseConfigured || !supabase) {
    if (import.meta.env.DEV) {
      console.info("Billig Bira: Supabase saknas, använder lokal ölkatalog för formuläret.");
    }

    return getLocalBeerCatalog();
  }

  const { data, error } = await supabase
    .from("beer_catalog")
    .select("id, name, slug, style, brand, brewery, is_generic, is_active, sort_order, created_at")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error || !data) {
    console.warn("Beer catalog could not be loaded.");
    return getLocalBeerCatalog();
  }

  return sortBeerCatalog(data as BeerCatalogItem[]);
}

export async function getActiveBeers(): Promise<BeerCatalogItem[]> {
  const beers = await getBeerCatalog();
  return beers.filter((beer) => beer.is_active);
}

export async function getBeerById(beerId: string): Promise<BeerCatalogItem | null> {
  const beers = await getBeerCatalog();
  return beers.find((beer) => beer.id === beerId) ?? null;
}

export function suggestBeerName(beerName: string, beers: BeerCatalogItem[]): BeerCatalogItem | null {
  const normalizedName = beerName.trim().toLocaleLowerCase("sv");

  if (!normalizedName) {
    return null;
  }

  return beers.find((beer) => beer.name.toLocaleLowerCase("sv") === normalizedName || beer.slug === normalizedName.replaceAll(" ", "-")) ?? null;
}

export const beerStyleLabels: Record<BeerStyle, string> = {
  lager: "Lager",
  pilsner: "Pilsner",
  ipa: "IPA",
  ale: "Ale",
  stout: "Stout",
  veteol: "Veteöl",
  suröl: "Suröl",
  alkoholfri: "Alkoholfri",
  annan: "Annan",
};
