import { isSupabaseConfigured, supabase } from "../supabase";
import type { BeerCatalogItem, BeerPrice, NewPriceReport, Venue } from "../types";

export type BeerPriceListItem = BeerPrice & {
  venue: Venue;
  beer: BeerCatalogItem | null;
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

function normalizePrice(price: BeerPriceWithVenueRow): BeerPriceListItem | null {
  const { venues, beer_catalog, ...beerPrice } = price;
  const venue = normalizeJoinedVenue(venues);

  if (!venue?.is_active) {
    return null;
  }

  return {
    ...beerPrice,
    price_sek: Number(beerPrice.price_sek),
    volume_cl: beerPrice.volume_cl == null ? null : Number(beerPrice.volume_cl),
    volume_is_verified: beerPrice.volume_is_verified === true,
    admin_verified: beerPrice.admin_verified === true || beerPrice.is_verified === true,
    is_current_cheapest: beerPrice.is_current_cheapest === true,
    venue,
    beer: normalizeJoinedBeer(beer_catalog),
  };
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

  const { data, error } = await supabase
    .from("beer_prices")
    .select(
      `
        id,
        venue_id,
        price_sek,
        beer_id,
        beer_name,
        volume_cl,
        volume_is_verified,
        price_type,
        source_type,
        source_url,
        status,
        is_current_cheapest,
        admin_verified,
        admin_verified_at,
        admin_verified_by,
        approved_at,
        approved_by,
        reported_at,
        reporter_note,
        admin_note,
        observed_at,
        is_active,
        is_verified,
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
      `,
    )
    .eq("status", "approved")
    .eq("is_current_cheapest", true)
    .order("price_sek", { ascending: true });

  if (error || !data) {
    console.warn("Prices could not be loaded.");
    return {
      prices: [],
      status: "empty",
    };
  }

  const prices = (data as unknown as BeerPriceWithVenueRow[])
    .map(normalizePrice)
    .filter((price): price is BeerPriceListItem => price !== null)
    .sort((a, b) => a.price_sek - b.price_sek || a.venue.name.localeCompare(b.venue.name, "sv"));

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
    price_sek: Number(report.price_sek),
    beer_id: report.beer_id || null,
    beer_name: report.beer_name?.trim() || null,
    volume_cl: report.volume_cl == null ? null : Number(report.volume_cl),
    volume_is_verified: report.volume_is_verified === true,
    price_type: report.price_type,
    source_type: report.source_type,
    source_url: report.source_url?.trim() || null,
    observed_at: report.observed_at || null,
    reporter_note: report.reporter_note?.trim() || null,
  });

  return {
    ok: !error,
    persisted: !error,
  };
}
