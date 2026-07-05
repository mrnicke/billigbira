import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY?.trim();

function createSupabaseBrowserClient(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  try {
    new URL(supabaseUrl);
    return createClient(supabaseUrl, supabaseAnonKey);
  } catch {
    console.warn("Supabase public configuration is invalid. Falling back to local data.");
    return null;
  }
}

export const supabase: SupabaseClient | null = createSupabaseBrowserClient();
export const isSupabaseConfigured = supabase !== null;
