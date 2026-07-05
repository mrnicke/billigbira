import { fallbackBeerPrices, fallbackVenues } from "../../data/beerPrices";
import { calculatePricePerLiter } from "../pricing";
import { isSupabaseConfigured, supabase } from "../supabase";
import type { BeerPrice, NewPriceReport, Venue } from "../types";

export type BeerPriceListItem = BeerPrice & {
  venue: Venue;
  price_per_liter_sek: number;
};

type BeerPriceWithVenueRow = BeerPrice & {
  venues: Venue | Venue[] | null;
};

type SubmitPriceReportResult = {
  ok: boolean;
  persisted: boolean;
};

function withCalculatedPrice(price: BeerPrice): BeerPrice & { price_per_liter_sek: number } {
  return {
    ...price,
    price_per_liter_sek: price.price_per_liter_sek ?? calculatePricePerLiter(price.price_sek, price.volume_cl),
  };
}

function fallbackListItems(): BeerPriceListItem[] {
  const venuesById = new Map(fallbackVenues.map((venue) => [venue.id, venue]));

  return fallbackBeerPrices
    .map((price) => {
      const venue = venuesById.get(price.venue_id);

      if (!venue) {
        return null;
      }

      return {
        ...withCalculatedPrice(price),
        venue,
      };
    })
    .filter((price): price is BeerPriceListItem => price !== null)
    .sort((a, b) => a.price_per_liter_sek - b.price_per_liter_sek);
}

function normalizeJoinedVenue(venue: Venue | Venue[] | null): Venue | null {
  if (Array.isArray(venue)) {
    return venue[0] ?? null;
  }

  return venue;
}

export async function getVenues(): Promise<Venue[]> {
  if (!isSupabaseConfigured || !supabase) {
    return fallbackVenues;
  }

  const { data, error } = await supabase.from("venues").select("*").eq("is_active", true).order("name");

  if (error || !data) {
    console.warn("Using fallback venues because Supabase venues could not be loaded.");
    return fallbackVenues;
  }

  return data as Venue[];
}

export async function getBeerPrices(): Promise<BeerPriceListItem[]> {
  if (!isSupabaseConfigured || !supabase) {
    return fallbackListItems();
  }

  const { data, error } = await supabase
    .from("beer_prices")
    .select(
      `
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
      `,
    )
    .eq("is_verified", true)
    .order("price_per_liter_sek", { ascending: true });

  if (error || !data) {
    console.warn("Using fallback prices because Supabase prices could not be loaded.");
    return fallbackListItems();
  }

  return (data as unknown as BeerPriceWithVenueRow[])
    .map((price) => {
      const { venues, ...beerPrice } = price;
      const venue = normalizeJoinedVenue(venues);

      if (!venue?.is_active) {
        return null;
      }

      return {
        ...withCalculatedPrice(beerPrice),
        venue,
      };
    })
    .filter((price): price is BeerPriceListItem => price !== null)
    .sort((a, b) => a.price_per_liter_sek - b.price_per_liter_sek);
}

export async function submitPriceReport(report: NewPriceReport): Promise<SubmitPriceReportResult> {
  if (!isSupabaseConfigured || !supabase) {
    return { ok: true, persisted: false };
  }

  const { error } = await supabase.from("price_reports").insert({
    venue_id: report.venue_id || null,
    venue_name: report.venue_name,
    beer_name: report.beer_name,
    volume_cl: report.volume_cl,
    price_sek: report.price_sek,
    price_type: report.price_type,
    observed_at: report.observed_at || null,
    reporter_note: report.reporter_note || null,
  });

  return {
    ok: !error,
    persisted: !error,
  };
}
