import type { User } from "@supabase/supabase-js";
import { calculatePricePerLiter } from "../pricing";
import { isSupabaseConfigured, supabase } from "../supabase";
import type { PriceReport } from "../types";

export type AdminPriceReport = PriceReport & {
  price_per_liter_sek: number;
};

type AdminActionResult = {
  ok: boolean;
  message?: string;
};

type PendingReportsResult = {
  reports: AdminPriceReport[];
  ok: boolean;
  message?: string;
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

function normalizeReport(report: PriceReport): AdminPriceReport {
  const priceSek = Number(report.price_sek);
  const volumeCl = Number(report.volume_cl);

  return {
    ...report,
    price_sek: priceSek,
    volume_cl: volumeCl,
    price_per_liter_sek: calculatePricePerLiter(priceSek, volumeCl),
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
    return false;
  }

  return data === true;
}

export async function getPendingReports(): Promise<PendingReportsResult> {
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

  const { data, error } = await client
    .from("price_reports")
    .select(
      `
        id,
        venue_id,
        venue_name,
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
        created_at
      `,
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error || !data) {
    return {
      ok: false,
      reports: [],
      message: friendlyAdminError(),
    };
  }

  return {
    ok: true,
    reports: (data as PriceReport[]).map(normalizeReport),
  };
}

export async function approveReport(reportId: string): Promise<AdminActionResult> {
  const client = ensureSupabase();

  if (!client) {
    return { ok: false, message: "Supabase är inte konfigurerat för den här builden." };
  }

  const { error } = await client.rpc("approve_price_report", { report_id: reportId });

  if (error) {
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
    return {
      ok: false,
      message: "Rapporten kunde inte avvisas. Kontrollera att SQL-filen är körd och att kontot är admin.",
    };
  }

  return { ok: true };
}
