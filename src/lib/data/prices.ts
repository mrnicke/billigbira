import { calculatePricePerLiter } from "../pricing";
import { isSupabaseConfigured, supabase } from "../supabase";
import type { BeerCatalogItem, BeerPrice, NewPriceReport, Venue } from "../types";

export type BeerPriceListItem = BeerPrice & {
  venue: Venue;
  beer: BeerCatalogItem | null;
  price_per_liter_sek: number;
};

export type PriceDataStatus = "supabase" | "empty";

export type BeerPriceListResult = {
  prices: BeerPriceListItem[];
  status: PriceDataStatus;
};

type BeerPriceWithVenueRow = BeerPrice & {
  venues: Venue | Venue[] | null;
  beer_catalog?: BeerCatalogItem | BeerCatalogItem[] | null;
};

type SubmitPriceReportResult = {
  ok: boolean;
  persisted: boolean;
};

function withCalculatedPrice(price: BeerPrice): BeerPrice & { price_per_liter_sek: number } {
  const priceSek = Number(price.price_sek);
  const volumeCl = Number(price.volume_cl);
  const storedPricePerLiter = price.price_per_liter_sek == null ? null : Number(price.price_per_liter_sek);

  return {
    ...price,
    price_sek: priceSek,
    volume_cl: volumeCl,
    price_per_liter_sek:
      storedPricePerLiter != null && Number.isFinite(storedPricePerLiter)
        ? storedPricePerLiter
        : calculatePricePerLiter(priceSek, volumeCl),
  };
}

function normalizeJoinedVenue(venue: Venue | Venue[] | null): Venue | null {
  if (Array.isArray(venue)) {
    return venue[0] ?? null;
  }

  return venue;
}

function normalizeJoinedBeer(beer: BeerCatalogItem | BeerCatalogItem[] | null | undefined): BeerCatalogItem | null {
  if (Array.isArray(beer)) {
    return beer[0] ?? null;
  }

  return beer ?? null;
}

export async function getVenues(): Promise<Venue[]> {
  if (!isSupabaseConfigured || !supabase) {
    return [];
  }

  const { data, error } = await supabase.from("venues").select("*").eq("is_active", true).order("name");

  if (error || !data) {
    console.warn("Venues could not be loaded.");
    return [];
  }

  return data as Venue[];
}

export async function getBeerPriceList(): Promise<BeerPriceListResult> {
  if (!isSupabaseConfigured || !supabase) {
    if (import.meta.env.DEV) {
      console.info("Billig Bira: Supabase saknas, visar tom publik prislista.");
    }

    return {
      prices: [],
      status: "empty",
    };
  }

  const baseSelect = `
        id,
        venue_id,
        beer_name,
        volume_cl,
        price_sek,
        price_per_liter_sek,
        price_type,
        observed_at,
        source,
        is_verified,
        is_active,
        created_at,
        venues:venue_id (
          id,
          name,
          slug,
          city,
          district,
          address,
          is_active,
          created_at
        )
      `;
  const catalogSelect = `
        id,
        venue_id,
        beer_id,
        beer_name,
        volume_cl,
        price_sek,
        price_per_liter_sek,
        price_type,
        observed_at,
        source,
        is_verified,
        is_active,
        created_at,
        venues:venue_id (
          id,
          name,
          slug,
          city,
          district,
          address,
          is_active,
          created_at
        ),
        beer_catalog:beer_id (
          id,
          name,
          slug,
          style,
          brand,
          brewery,
          is_generic,
          is_active,
          sort_order,
          created_at
        )
      `;

  const catalogResult = await supabase
    .from("beer_prices")
    .select(catalogSelect)
    .eq("is_verified", true)
    .eq("is_active", true)
    .order("price_per_liter_sek", { ascending: true });
  let data: unknown[] | null = catalogResult.data;
  let error = catalogResult.error;

  if (error) {
    const legacyResult = await supabase
      .from("beer_prices")
      .select(baseSelect)
      .eq("is_verified", true)
      .eq("is_active", true)
      .order("price_per_liter_sek", { ascending: true });

    data = legacyResult.data;
    error = legacyResult.error;
  }

  if (error || !data) {
    console.warn("Prices could not be loaded.");
    return {
      prices: [],
      status: "empty",
    };
  }

  const prices = (data as unknown as BeerPriceWithVenueRow[])
    .map((price) => {
      const { venues, beer_catalog, ...beerPrice } = price;
      const venue = normalizeJoinedVenue(venues);
      const beer = normalizeJoinedBeer(beer_catalog);

      if (!venue?.is_active) {
        return null;
      }

      return {
        ...withCalculatedPrice(beerPrice),
        venue,
        beer,
      };
    })
    .filter((price): price is BeerPriceListItem => price !== null)
    .sort((a, b) => a.price_per_liter_sek - b.price_per_liter_sek);

  return {
    prices,
    status: "supabase",
  };
}

export async function getBeerPrices(): Promise<BeerPriceListItem[]> {
  const result = await getBeerPriceList();
  return result.prices;
}

export async function submitPriceReport(report: NewPriceReport): Promise<SubmitPriceReportResult> {
  if (!isSupabaseConfigured || !supabase) {
    return { ok: true, persisted: false };
  }

  const { error } = await supabase.from("price_reports").insert({
    venue_id: report.venue_id || null,
    venue_name: report.venue_name.trim(),
    beer_id: report.beer_id || null,
    beer_name: report.beer_name.trim(),
    volume_cl: Number(report.volume_cl),
    price_sek: Number(report.price_sek),
    price_type: report.price_type,
    observed_at: report.observed_at || null,
    reporter_note: report.reporter_note || null,
  });

  return {
    ok: !error,
    persisted: !error,
  };
}
