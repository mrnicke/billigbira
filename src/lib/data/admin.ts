import type { User } from "@supabase/supabase-js";
import { calculatePricePerLiter } from "../pricing";
import { isSupabaseConfigured, supabase } from "../supabase";
import type { BeerCatalogItem, BeerPrice, PriceReport, PriceType, ReportStatus, Venue } from "../types";

export type AdminPriceReport = PriceReport & {
  price_per_liter_sek: number;
  venue: { id: string; name: string } | null;
  beer: BeerCatalogItem | null;
};

export type AdminReportStatusFilter = ReportStatus | "all";

export type AdminReportOverrides = {
  venue_id: string | null;
  venue_name: string;
  beer_id: string | null;
  beer_name: string;
  volume_cl: number;
  price_sek: number;
  price_type: PriceType;
  observed_at: string | null;
  reporter_note: string | null;
};

export type AdminBeerPrice = BeerPrice & {
  venue: Venue;
  beer: BeerCatalogItem | null;
  price_per_liter_sek: number;
};

type AdminActionResult = {
  ok: boolean;
  message?: string;
};

type ReportsResult = {
  reports: AdminPriceReport[];
  ok: boolean;
  message?: string;
};

type ReportStatusCountsResult = {
  counts: Record<ReportStatus, number>;
  ok: boolean;
  message?: string;
};

type VenuesResult = {
  venues: Venue[];
  ok: boolean;
  message?: string;
};

type AdminBeerPricesResult = {
  prices: AdminBeerPrice[];
  ok: boolean;
  message?: string;
};

type PriceReportWithVenueRow = PriceReport & {
  venues: { id: string; name: string } | { id: string; name: string }[] | null;
  beer_catalog?: BeerCatalogItem | BeerCatalogItem[] | null;
};

type BeerPriceWithVenueRow = BeerPrice & {
  venues: Venue | Venue[] | null;
  beer_catalog?: BeerCatalogItem | BeerCatalogItem[] | null;
};

const emptyReportStatusCounts: Record<ReportStatus, number> = {
  pending: 0,
  approved: 0,
  rejected: 0,
};

function ensureSupabase() {
  if (!isSupabaseConfigured || !supabase) {
    return null;
  }

  return supabase;
}

function friendlyAdminError() {
  return "Adminflödet kunde inte nå databasen just nu.";
}

function logAdminError(action: string, error: { code?: string; message?: string; status?: number } | null) {
  if (!error) {
    return;
  }

  console.error("Admin request failed", {
    action,
    code: error.code,
    message: error.message,
    status: error.status,
  });
}

function normalizeJoinedVenue(venue: PriceReportWithVenueRow["venues"]): AdminPriceReport["venue"] {
  if (Array.isArray(venue)) {
    return venue[0] ?? null;
  }

  return venue;
}

function normalizeJoinedAdminVenue(venue: BeerPriceWithVenueRow["venues"]): Venue | null {
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

function normalizeReport(report: PriceReportWithVenueRow): AdminPriceReport {
  const priceSek = Number(report.price_sek);
  const volumeCl = Number(report.volume_cl);
  const { venues, beer_catalog, ...priceReport } = report;

  return {
    ...priceReport,
    price_sek: priceSek,
    volume_cl: volumeCl,
    price_per_liter_sek: calculatePricePerLiter(priceSek, volumeCl),
    venue: normalizeJoinedVenue(venues),
    beer: normalizeJoinedBeer(beer_catalog),
  };
}

function normalizeAdminBeerPrice(price: BeerPriceWithVenueRow): AdminBeerPrice | null {
  const priceSek = Number(price.price_sek);
  const volumeCl = Number(price.volume_cl);
  const storedPricePerLiter = price.price_per_liter_sek == null ? null : Number(price.price_per_liter_sek);
  const { venues, beer_catalog, ...beerPrice } = price;
  const venue = normalizeJoinedAdminVenue(venues);

  if (!venue) {
    return null;
  }

  return {
    ...beerPrice,
    price_sek: priceSek,
    volume_cl: volumeCl,
    price_per_liter_sek:
      storedPricePerLiter != null && Number.isFinite(storedPricePerLiter)
        ? storedPricePerLiter
        : calculatePricePerLiter(priceSek, volumeCl),
    is_active: beerPrice.is_active ?? true,
    venue,
    beer: normalizeJoinedBeer(beer_catalog),
  };
}

export async function getCurrentUser(): Promise<User | null> {
  const client = ensureSupabase();

  if (!client) {
    return null;
  }

  const { data, error } = await client.auth.getUser();

  if (error) {
    return null;
  }

  return data.user;
}

export function onAdminAuthChange(callback: (user: User | null) => void): { unsubscribe: () => void } | null {
  const client = ensureSupabase();

  if (!client) {
    return null;
  }

  const { data } = client.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });

  return {
    unsubscribe: () => data.subscription.unsubscribe(),
  };
}

export async function signInAdmin(email: string, password: string): Promise<AdminActionResult> {
  const client = ensureSupabase();

  if (!client) {
    return { ok: false, message: "Supabase är inte konfigurerat för den här builden." };
  }

  const { error } = await client.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) {
    return { ok: false, message: "Inloggningen misslyckades. Kontrollera e-post och lösenord." };
  }

  return { ok: true };
}

export async function signOutAdmin(): Promise<void> {
  const client = ensureSupabase();

  if (!client) {
    return;
  }

  await client.auth.signOut();
}

export async function getCurrentAdminAccess(): Promise<boolean> {
  const client = ensureSupabase();

  if (!client) {
    return false;
  }

  const { data, error } = await client.rpc("is_current_user_admin");

  if (error) {
    logAdminError("is_current_user_admin", error);
    return false;
  }

  return data === true;
}

export async function getAdminVenues(): Promise<VenuesResult> {
  const client = ensureSupabase();

  if (!client) {
    return {
      ok: false,
      venues: [],
      message: "Supabase är inte konfigurerat för den här builden.",
    };
  }

  const isAdmin = await getCurrentAdminAccess();

  if (!isAdmin) {
    return {
      ok: false,
      venues: [],
      message: "Ditt konto saknar adminbehörighet.",
    };
  }

  const { data, error } = await client
    .from("venues")
    .select("id, name, slug, city, district, address, is_active, created_at")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error || !data) {
    logAdminError("get_admin_venues", error);

    return {
      ok: false,
      venues: [],
      message: friendlyAdminError(),
    };
  }

  return {
    ok: true,
    venues: data as Venue[],
  };
}

export async function getReportStatusCounts(): Promise<ReportStatusCountsResult> {
  const client = ensureSupabase();

  if (!client) {
    return {
      ok: false,
      counts: { ...emptyReportStatusCounts },
      message: "Supabase är inte konfigurerat för den här builden.",
    };
  }

  const isAdmin = await getCurrentAdminAccess();

  if (!isAdmin) {
    return {
      ok: false,
      counts: { ...emptyReportStatusCounts },
      message: "Ditt konto saknar adminbehörighet.",
    };
  }

  const { data, error } = await client.from("price_reports").select("status");

  if (error || !data) {
    logAdminError("get_report_status_counts", error);

    return {
      ok: false,
      counts: { ...emptyReportStatusCounts },
      message: friendlyAdminError(),
    };
  }

  const counts = { ...emptyReportStatusCounts };

  for (const report of data as Pick<PriceReport, "status">[]) {
    counts[report.status] += 1;
  }

  return {
    ok: true,
    counts,
  };
}

export async function getReportsByStatus(status: AdminReportStatusFilter = "pending"): Promise<ReportsResult> {
  const client = ensureSupabase();

  if (!client) {
    return {
      ok: false,
      reports: [],
      message: "Supabase är inte konfigurerat för den här builden.",
    };
  }

  const isAdmin = await getCurrentAdminAccess();

  if (!isAdmin) {
    return {
      ok: false,
      reports: [],
      message: "Ditt konto saknar adminbehörighet.",
    };
  }

  let query = client
    .from("price_reports")
    .select(
      `
        id,
        venue_id,
        venue_name,
        beer_id,
        beer_name,
        volume_cl,
        price_sek,
        price_type,
        observed_at,
        reporter_note,
        status,
        reviewed_at,
        reviewed_by,
        rejection_reason,
        approved_price_id,
        created_at,
        venues:venue_id (
          id,
          name
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
    .order("created_at", { ascending: status === "pending" });

  if (status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error || !data) {
    logAdminError("get_reports_by_status", error);

    return {
      ok: false,
      reports: [],
      message: friendlyAdminError(),
    };
  }

  return {
    ok: true,
    reports: (data as unknown as PriceReportWithVenueRow[]).map(normalizeReport),
  };
}

export async function getPendingReports(): Promise<ReportsResult> {
  return getReportsByStatus("pending");
}

export async function approveReport(reportId: string, overrides: AdminReportOverrides): Promise<AdminActionResult> {
  const client = ensureSupabase();

  if (!client) {
    return { ok: false, message: "Supabase är inte konfigurerat för den här builden." };
  }

  const { error } = await client.rpc("approve_price_report", {
    report_id: reportId,
    override_venue_id: overrides.venue_id,
    override_venue_name: overrides.venue_name.trim(),
    override_beer_name: overrides.beer_name.trim(),
    override_beer_id: overrides.beer_id,
    override_volume_cl: Number(overrides.volume_cl),
    override_price_sek: Number(overrides.price_sek),
    override_price_type: overrides.price_type,
    override_observed_at: overrides.observed_at || null,
    override_reporter_note: overrides.reporter_note?.trim() ?? "",
  });

  if (error) {
    logAdminError("approve_price_report", error);

    return {
      ok: false,
      message: "Rapporten kunde inte godkännas. Kontrollera att SQL-filen är körd och att kontot är admin.",
    };
  }

  return { ok: true };
}

export async function rejectReport(reportId: string, reason?: string): Promise<AdminActionResult> {
  const client = ensureSupabase();

  if (!client) {
    return { ok: false, message: "Supabase är inte konfigurerat för den här builden." };
  }

  const { error } = await client.rpc("reject_price_report", {
    report_id: reportId,
    review_reason: reason?.trim() || null,
  });

  if (error) {
    logAdminError("reject_price_report", error);

    return {
      ok: false,
      message: "Rapporten kunde inte avvisas. Kontrollera att SQL-filen är körd och att kontot är admin.",
    };
  }

  return { ok: true };
}

export async function getAdminBeerPrices(): Promise<AdminBeerPricesResult> {
  const client = ensureSupabase();

  if (!client) {
    return {
      ok: false,
      prices: [],
      message: "Supabase är inte konfigurerat för den här builden.",
    };
  }

  const isAdmin = await getCurrentAdminAccess();

  if (!isAdmin) {
    return {
      ok: false,
      prices: [],
      message: "Ditt konto saknar adminbehörighet.",
    };
  }

  const { data, error } = await client
    .from("beer_prices")
    .select(
      `
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
      `,
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (error || !data) {
    logAdminError("get_admin_beer_prices", error);

    return {
      ok: false,
      prices: [],
      message: friendlyAdminError(),
    };
  }

  return {
    ok: true,
    prices: (data as unknown as BeerPriceWithVenueRow[])
      .map(normalizeAdminBeerPrice)
      .filter((price): price is AdminBeerPrice => price !== null),
  };
}

async function setBeerPriceActive(priceId: string, isActive: boolean): Promise<AdminActionResult> {
  const client = ensureSupabase();

  if (!client) {
    return { ok: false, message: "Supabase är inte konfigurerat för den här builden." };
  }

  const { error } = await client.from("beer_prices").update({ is_active: isActive }).eq("id", priceId);

  if (error) {
    logAdminError(isActive ? "reactivate_beer_price" : "deactivate_beer_price", error);

    return {
      ok: false,
      message: "Priset kunde inte uppdateras. Kontrollera att SQL-filen är körd och att kontot är admin.",
    };
  }

  return { ok: true };
}

export async function deactivateBeerPrice(priceId: string): Promise<AdminActionResult> {
  return setBeerPriceActive(priceId, false);
}

export async function reactivateBeerPrice(priceId: string): Promise<AdminActionResult> {
  return setBeerPriceActive(priceId, true);
}
