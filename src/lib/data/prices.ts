import { fallbackBeerPrices, fallbackVenues } from "../../data/beerPrices";
import { calculatePricePerLiter } from "../pricing";
import { isSupabaseConfigured, supabase } from "../supabase";
import type { BeerPrice, NewPriceReport, Venue } from "../types";

export type BeerPriceListItem = BeerPrice & {
  venue: Venue;
  price_per_liter_sek: number;
};

export type PriceDataStatus = "supabase" | "fallback";

export type BeerPriceListResult = {
  prices: BeerPriceListItem[];
  status: PriceDataStatus;
};

type BeerPriceWithVenueRow = BeerPrice & {
  venues: Venue | Venue[] | null;
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

export async function getBeerPriceList(): Promise<BeerPriceListResult> {
  if (!isSupabaseConfigured || !supabase) {
    return {
      prices: fallbackListItems(),
      status: "fallback",
    };
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
      `,
    )
    .eq("is_verified", true)
    .eq("is_active", true)
    .order("price_per_liter_sek", { ascending: true });

  if (error || !data) {
    console.warn("Using fallback prices because Supabase prices could not be loaded.");
    return {
      prices: fallbackListItems(),
      status: "fallback",
    };
  }

  const prices = (data as unknown as BeerPriceWithVenueRow[])
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
