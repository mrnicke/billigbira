export type BeerPriceStatus = "pending" | "approved" | "rejected" | "archived";

export type BeerPriceSourceType = "website" | "menu" | "reported";

export type BeerPriceType = "regular" | "after_work" | "campaign" | "unknown";

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
  price_sek: number;
  beer_id?: string | null;
  beer_name?: string | null;
  volume_cl?: number | null;
  volume_is_verified: boolean;
  price_type: BeerPriceType;
  source_type: BeerPriceSourceType;
  source_url?: string | null;
  status: BeerPriceStatus;
  is_current_cheapest: boolean;
  admin_verified: boolean;
  admin_verified_at?: string | null;
  admin_verified_by?: string | null;
  approved_at?: string | null;
  approved_by?: string | null;
  reported_at?: string | null;
  reporter_note?: string | null;
  admin_note?: string | null;
  observed_at?: string | null;
  is_active?: boolean;
  is_verified?: boolean;
  price_per_liter_sek?: number | null;
  created_at: string;
};

export type ReportStatus = BeerPriceStatus;

export type PriceReport = {
  id: string;
  venue_id?: string | null;
  venue_name: string;
  price_sek: number;
  beer_id?: string | null;
  beer_name?: string | null;
  volume_cl?: number | null;
  volume_is_verified: boolean;
  price_type: BeerPriceType;
  source_type: BeerPriceSourceType;
  source_url?: string | null;
  observed_at?: string | null;
  reporter_note?: string | null;
  admin_note?: string | null;
  status: ReportStatus;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  rejection_reason?: string | null;
  approved_price_id?: string | null;
  approved_at?: string | null;
  approved_by?: string | null;
  created_at: string;
};

export type NewPriceReport = Pick<
  PriceReport,
  | "venue_id"
  | "venue_name"
  | "price_sek"
  | "beer_id"
  | "beer_name"
  | "volume_cl"
  | "volume_is_verified"
  | "price_type"
  | "source_type"
  | "source_url"
  | "observed_at"
  | "reporter_note"
>;

export type AdminUser = {
  user_id: string;
  created_at: string;
  created_by?: string | null;
};

export const SOURCE_TYPE_LABELS: Record<BeerPriceSourceType, string> = {
  website: "hemsida",
  menu: "meny",
  reported: "inrapporterat",
};

export const PRICE_TYPE_LABELS: Record<BeerPriceType, string> = {
  regular: "Öl",
  after_work: "AW",
  campaign: "Kampanj",
  unknown: "Öl",
};
