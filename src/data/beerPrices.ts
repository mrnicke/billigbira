export type PriceType = "normalpris" | "after work" | "happy hour" | "studentpris";
export type PriceStatus = "verifierat" | "rapporterat" | "gammalt" | "osakert";

export type BeerPrice = {
  id: string;
  venue: string;
  areaOrAddress: string;
  beerName: string;
  priceSek: number;
  volumeCl: number;
  priceType: PriceType;
  lastChecked: string;
  status: PriceStatus;
};

export const beerPrices: BeerPrice[] = [
  {
    id: "strommen-lager-40",
    venue: "Strömmen Pub",
    areaOrAddress: "Centrum",
    beerName: "Husets lager",
    priceSek: 59,
    volumeCl: 40,
    priceType: "after work",
    lastChecked: "Mockdata 2026-07-05",
    status: "rapporterat",
  },
  {
    id: "industribaren-pilsner-50",
    venue: "Industribaren",
    areaOrAddress: "Industrilandskapet",
    beerName: "Pilsner pa fat",
    priceSek: 74,
    volumeCl: 50,
    priceType: "normalpris",
    lastChecked: "Mockdata 2026-07-05",
    status: "osakert",
  },
  {
    id: "campuskranen-ljus-40",
    venue: "Campuskranen",
    areaOrAddress: "Campus Norrköping",
    beerName: "Ljus lager",
    priceSek: 52,
    volumeCl: 40,
    priceType: "studentpris",
    lastChecked: "Mockdata 2026-07-05",
    status: "rapporterat",
  },
  {
    id: "kvartersolen-ipa-33",
    venue: "Kvartersolen",
    areaOrAddress: "Knäppingsborg",
    beerName: "Session IPA",
    priceSek: 68,
    volumeCl: 33,
    priceType: "happy hour",
    lastChecked: "Mockdata 2026-07-05",
    status: "gammalt",
  },
  {
    id: "hamnbaren-lager-50",
    venue: "Hamnbaren",
    areaOrAddress: "Inre hamnen",
    beerName: "Stor stark",
    priceSek: 79,
    volumeCl: 50,
    priceType: "normalpris",
    lastChecked: "Mockdata 2026-07-05",
    status: "osakert",
  },
  {
    id: "brygghaket-mellan-40",
    venue: "Brygghaket",
    areaOrAddress: "Södra promenaden",
    beerName: "Mellanlager",
    priceSek: 49,
    volumeCl: 40,
    priceType: "happy hour",
    lastChecked: "Mockdata 2026-07-05",
    status: "rapporterat",
  },
];
