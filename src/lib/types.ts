export type PriceType = "normalpris" | "after_work" | "happy_hour" | "student" | "okänd";

export type PriceSource = "manual" | "user_report" | "admin";

export type BeerStyle = "lager" | "pilsner" | "ipa" | "ale" | "stout" | "veteol" | "suröl" | "alkoholfri" | "annan";

export type BeerCatalogItem = {
  id: string;
  name: string;
  slug: string;
  style: BeerStyle;
  brand?: string | null;
  brewery?: string | null;
  is_generic: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
};

export type Venue = {
  id: string;
  name: string;
  slug: string;
  city: string;
  district?: string | null;
  address?: string | null;
  is_active: boolean;
  created_at: string;
};

export type BeerPrice = {
  id: string;
  venue_id: string;
  beer_id?: string | null;
  beer_name: string;
  volume_cl: number;
  price_sek: number;
  price_per_liter_sek?: number | null;
  price_type: PriceType;
  observed_at: string;
  source: PriceSource;
  is_verified: boolean;
  is_active?: boolean;
  created_at: string;
};

export type ReportStatus = "pending" | "approved" | "rejected";

export type PriceReport = {
  id: string;
  venue_id?: string | null;
  venue_name: string;
  beer_id?: string | null;
  beer_name: string;
  volume_cl: number;
  price_sek: number;
  price_type: PriceType;
  observed_at?: string | null;
  reporter_note?: string | null;
  status: ReportStatus;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  rejection_reason?: string | null;
  approved_price_id?: string | null;
  created_at: string;
};

export type NewPriceReport = Pick<
  PriceReport,
  "venue_id" | "venue_name" | "beer_id" | "beer_name" | "volume_cl" | "price_sek" | "price_type" | "observed_at" | "reporter_note"
>;

export type AdminUser = {
  user_id: string;
  created_at: string;
  created_by?: string | null;
};
