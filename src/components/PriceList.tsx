import { useEffect, useMemo, useState } from "react";
import { beerStyleLabels } from "../lib/data/beers";
import { getBeerPriceList, type BeerPriceListItem } from "../lib/data/prices";
import { formatPricePerLiter, formatSek } from "../lib/pricing";
import type { BeerStyle, PriceType, Venue } from "../lib/types";

type SortMode = "pricePerLiter" | "venue" | "observedAt";
type PriceTypeFilter = "all" | PriceType;
type BeerStyleFilter = "all" | BeerStyle;
type VolumeFilter = "all" | string;

type Props = {
  prices: BeerPriceListItem[];
};

type VenueSummary = {
  venue: Venue;
  bestPrice: BeerPriceListItem;
  priceCount: number;
  latestObserved: string;
};

const priceTypeLabels: Record<PriceType, string> = {
  normalpris: "Normalpris",
  after_work: "AW",
  happy_hour: "Happy hour",
  student: "Student",
  okänd: "Okänd",
};

const priceTypeFilters: Array<{ value: PriceTypeFilter; label: string }> = [
  { value: "all", label: "Alla" },
  { value: "normalpris", label: "Normalpris" },
  { value: "after_work", label: "AW" },
  { value: "happy_hour", label: "Happy hour" },
  { value: "student", label: "Student" },
];

const beerStyleFilters: Array<{ value: BeerStyleFilter; label: string }> = [
  { value: "all", label: "Alla öl" },
  { value: "lager", label: "Lager" },
  { value: "ipa", label: "IPA" },
  { value: "pilsner", label: "Pilsner" },
  { value: "annan", label: "Annan" },
];

const inputClass =
  "min-h-12 w-full rounded-2xl border border-white/10 bg-white/[0.08] px-4 text-base font-bold text-foam outline-none placeholder:text-foam/30 focus:border-malt focus:ring-2 focus:ring-malt/20";
const selectClass =
  "min-h-12 w-full rounded-2xl border border-white/10 bg-white/[0.08] px-4 text-base font-bold text-foam outline-none focus:border-malt focus:ring-2 focus:ring-malt/20";

function getVenueLocation(price: BeerPriceListItem) {
  return price.venue.district || price.venue.address || price.venue.city;
}

function getBeerDisplayName(price: BeerPriceListItem) {
  return price.beer?.name || price.beer_name;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    day: "numeric",
    month: "short",
  }).format(new Date(`${value}T12:00:00`));
}

function priceTypeBadgeClass(priceType: PriceType) {
  if (priceType === "happy_hour" || priceType === "after_work") {
    return "bg-malt text-night";
  }

  if (priceType === "student") {
    return "bg-hop/[0.18] text-hop ring-1 ring-hop/25";
  }

  return "bg-white/10 text-foam/70 ring-1 ring-white/10";
}

function rankLabel(index: number) {
  if (index === 0) {
    return "Topp 1";
  }

  return `#${index + 1}`;
}

function rankingClass(index: number) {
  if (index === 0) {
    return "border-malt/50 bg-gradient-to-br from-malt/[0.18] to-white/[0.08]";
  }

  if (index < 3) {
    return "border-white/[0.14] bg-white/[0.08]";
  }

  return "border-white/10 bg-white/[0.055]";
}

function VenueCard({ summary, isSelected, onSelect }: { summary: VenueSummary; isSelected: boolean; onSelect: () => void }) {
  return (
    <button
      className={`min-w-[78%] rounded-3xl border p-4 text-left shadow-soft sm:min-w-72 ${
        isSelected ? "border-malt bg-malt/[0.14]" : "border-white/10 bg-white/[0.06] hover:bg-white/[0.09]"
      }`}
      type="button"
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-foam">{summary.venue.name}</h3>
          <p className="mt-1 text-sm font-semibold text-foam/50">{summary.venue.district || summary.venue.city}</p>
        </div>
        <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-black text-foam/60">{summary.priceCount}</span>
      </div>
      <p className="mt-4 text-2xl font-black text-lager">{formatPricePerLiter(summary.bestPrice.price_per_liter_sek)}</p>
      <p className="mt-1 text-sm font-bold text-foam/60">Bäst här: {getBeerDisplayName(summary.bestPrice)}</p>
      <p className="mt-3 text-xs font-bold text-foam/40">Senast {formatDate(summary.latestObserved)}</p>
    </button>
  );
}

function PriceRankCard({ price, index }: { price: BeerPriceListItem; index: number }) {
  return (
    <article className={`rounded-[1.75rem] border p-4 shadow-soft ${rankingClass(index)}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-black ${index === 0 ? "bg-malt text-night" : "bg-white/10 text-foam/65"}`}>
              {rankLabel(index)}
            </span>
            <span className={`rounded-full px-3 py-1 text-xs font-black ${priceTypeBadgeClass(price.price_type)}`}>{priceTypeLabels[price.price_type]}</span>
          </div>
          <h3 className="mt-3 truncate text-xl font-black text-foam">{price.venue.name}</h3>
          <p className="mt-1 truncate text-sm font-semibold text-foam/50">{getVenueLocation(price)}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-3xl font-black leading-none text-lager">{formatPricePerLiter(price.price_per_liter_sek).replace(" kr/liter", "")}</p>
          <p className="mt-1 text-xs font-black uppercase text-foam/40">kr/liter</p>
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between gap-3 rounded-3xl bg-night/50 p-3 ring-1 ring-white/[0.08]">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <p className="truncate text-sm font-black text-foam">{getBeerDisplayName(price)}</p>
            {price.beer && <span className="rounded-full bg-white/10 px-2 py-0.5 text-[0.68rem] font-black text-foam/55">{beerStyleLabels[price.beer.style]}</span>}
          </div>
          <p className="mt-1 text-xs font-semibold text-foam/50">Observerat {formatDate(price.observed_at)}</p>
        </div>
        <p className="shrink-0 text-right text-lg font-black text-foam">
          {formatSek(price.price_sek)}
          <span className="block text-xs font-bold text-foam/50">{price.volume_cl} cl</span>
        </p>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <span className={`rounded-full px-3 py-1 text-xs font-black ${price.is_verified ? "bg-hop text-night" : "bg-white/10 text-foam/60 ring-1 ring-white/10"}`}>
          {price.is_verified ? "Verifierad" : "Väntar på moderering"}
        </span>
      </div>
    </article>
  );
}

export default function PriceList({ prices }: Props) {
  const [sortMode, setSortMode] = useState<SortMode>("pricePerLiter");
  const [searchTerm, setSearchTerm] = useState("");
  const [priceTypeFilter, setPriceTypeFilter] = useState<PriceTypeFilter>("all");
  const [beerStyleFilter, setBeerStyleFilter] = useState<BeerStyleFilter>("all");
  const [volumeFilter, setVolumeFilter] = useState<VolumeFilter>("all");
  const [venueFilter, setVenueFilter] = useState("all");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [visiblePrices, setVisiblePrices] = useState(prices);

  useEffect(() => {
    let isMounted = true;

    setHasHydrated(true);

    getBeerPriceList()
      .then((result) => {
        if (!isMounted) {
          return;
        }

        setVisiblePrices(result.prices);
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        setVisiblePrices(prices);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const volumeOptions = useMemo(() => {
    return [...new Set(visiblePrices.map((price) => price.volume_cl))].sort((a, b) => a - b);
  }, [visiblePrices]);

  const venueSummaries = useMemo(() => {
    const summaries = new Map<string, VenueSummary>();

    for (const price of visiblePrices) {
      const existing = summaries.get(price.venue.id);

      if (!existing) {
        summaries.set(price.venue.id, {
          venue: price.venue,
          bestPrice: price,
          priceCount: 1,
          latestObserved: price.observed_at,
        });
        continue;
      }

      existing.priceCount += 1;

      if (price.price_per_liter_sek < existing.bestPrice.price_per_liter_sek) {
        existing.bestPrice = price;
      }

      if (price.observed_at.localeCompare(existing.latestObserved, "sv") > 0) {
        existing.latestObserved = price.observed_at;
      }
    }

    return [...summaries.values()].sort((a, b) => a.bestPrice.price_per_liter_sek - b.bestPrice.price_per_liter_sek);
  }, [visiblePrices]);

  const sortedPrices = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLocaleLowerCase("sv");

    return visiblePrices
      .filter((price) => {
        const matchesSearch =
          !normalizedSearch ||
          price.venue.name.toLocaleLowerCase("sv").includes(normalizedSearch) ||
          getVenueLocation(price).toLocaleLowerCase("sv").includes(normalizedSearch) ||
          getBeerDisplayName(price).toLocaleLowerCase("sv").includes(normalizedSearch) ||
          price.beer_name.toLocaleLowerCase("sv").includes(normalizedSearch);

        const matchesType = priceTypeFilter === "all" || price.price_type === priceTypeFilter;
        const matchesBeerStyle = beerStyleFilter === "all" || price.beer?.style === beerStyleFilter;
        const matchesVolume = volumeFilter === "all" || String(price.volume_cl) === volumeFilter;
        const matchesVenue = venueFilter === "all" || price.venue.id === venueFilter;
        const matchesVerified = !verifiedOnly || price.is_verified;

        return matchesSearch && matchesType && matchesBeerStyle && matchesVolume && matchesVenue && matchesVerified;
      })
      .sort((a, b) => {
        if (sortMode === "venue") {
          return a.venue.name.localeCompare(b.venue.name, "sv");
        }

        if (sortMode === "observedAt") {
          return b.observed_at.localeCompare(a.observed_at, "sv");
        }

        return a.price_per_liter_sek - b.price_per_liter_sek;
      });
  }, [visiblePrices, searchTerm, priceTypeFilter, beerStyleFilter, volumeFilter, venueFilter, verifiedOnly, sortMode]);

  const shouldShowLoading = !hasHydrated && prices.length === 0;
  const cheapestVisiblePrice = sortedPrices[0] ?? null;
  const hasActiveFilters = searchTerm || priceTypeFilter !== "all" || beerStyleFilter !== "all" || volumeFilter !== "all" || venueFilter !== "all" || verifiedOnly;
  const resultLabel = sortedPrices.length === 1 ? "1 pris" : `${sortedPrices.length} priser`;
  const selectedVenueName = venueSummaries.find((summary) => summary.venue.id === venueFilter)?.venue.name ?? null;

  function resetFilters() {
    setSearchTerm("");
    setPriceTypeFilter("all");
    setBeerStyleFilter("all");
    setVolumeFilter("all");
    setVenueFilter("all");
    setVerifiedOnly(false);
    setSortMode("pricePerLiter");
  }

  function selectVenue(venueId: string) {
    setVenueFilter(venueId);
    document.getElementById("priser")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <>
      <section id="stallen" className="mt-8 min-w-0 scroll-mt-24">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-sm font-black uppercase tracking-normal text-malt">Ställen</p>
            <h2 className="mt-1 text-3xl font-black text-foam">Bästa pris per ställe</h2>
          </div>
          {venueFilter !== "all" && (
            <button className="min-h-11 rounded-2xl bg-white/10 px-4 text-sm font-black text-foam hover:bg-white/[0.14]" type="button" onClick={() => setVenueFilter("all")}>
              Alla
            </button>
          )}
        </div>

        {venueSummaries.length > 0 ? (
          <div className="-mx-4 mt-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
            {venueSummaries.map((summary) => (
              <VenueCard
                key={summary.venue.id}
                summary={summary}
                isSelected={venueFilter === summary.venue.id}
                onSelect={() => selectVenue(summary.venue.id)}
              />
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-3xl border border-white/10 bg-white/[0.06] p-5 text-center">
            <h3 className="text-xl font-black text-foam">Inga ställen än</h3>
            <p className="mt-2 text-sm font-semibold text-foam/60">När priser finns visas ställen här.</p>
          </div>
        )}
      </section>

      <section id="priser" className="mt-8 min-w-0 scroll-mt-24">
        <div className="flex flex-col gap-3">
          <p className="text-sm font-black uppercase tracking-normal text-malt">Prislistan</p>
          <div className="flex min-w-0 items-end justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-3xl font-black text-foam">Billigast per liter</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-foam/60">
                {selectedVenueName ? `Filtrerat på ${selectedVenueName}.` : "Sorterat på lägst literpris."}
              </p>
            </div>
            <div className="max-w-[9.5rem] shrink-0 rounded-3xl bg-white/[0.08] px-4 py-3 text-right ring-1 ring-white/10">
              <p className="text-lg font-black text-foam">{resultLabel}</p>
              <p className="text-xs font-bold text-foam/50">{cheapestVisiblePrice ? `${formatPricePerLiter(cheapestVisiblePrice.price_per_liter_sek)} lägst` : "Tomt"}</p>
            </div>
          </div>
        </div>

        <div className="sticky top-[76px] z-30 -mx-4 mt-5 border-y border-white/10 bg-night/[0.86] px-4 py-3 backdrop-blur-xl md:top-[76px] md:mx-0 md:rounded-[1.75rem] md:border">
          <label className="block">
            <span className="sr-only">Sök</span>
            <input className={inputClass} value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Sök ställe, område eller öl" />
          </label>

          <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
            {priceTypeFilters.map((filter) => {
              const isActive = priceTypeFilter === filter.value;

              return (
                <button
                  key={filter.value}
                  className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-black ${
                    isActive ? "bg-malt text-night" : "bg-white/[0.09] text-foam/60 ring-1 ring-white/10 hover:bg-white/[0.14]"
                  }`}
                  type="button"
                  onClick={() => setPriceTypeFilter(filter.value)}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>

          <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1">
            {beerStyleFilters.map((filter) => {
              const isActive = beerStyleFilter === filter.value;

              return (
                <button
                  key={filter.value}
                  className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-black ${
                    isActive ? "bg-hop text-night" : "bg-white/[0.09] text-foam/60 ring-1 ring-white/10 hover:bg-white/[0.14]"
                  }`}
                  type="button"
                  onClick={() => setBeerStyleFilter(filter.value)}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <label>
              <span className="sr-only">Sortera</span>
              <select className={selectClass} value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
                <option value="pricePerLiter">Billigast/liter</option>
                <option value="venue">Ställe A-Ö</option>
                <option value="observedAt">Senast</option>
              </select>
            </label>
            <label>
              <span className="sr-only">Volym</span>
              <select className={selectClass} value={volumeFilter} onChange={(event) => setVolumeFilter(event.target.value)}>
                <option value="all">Alla volymer</option>
                {volumeOptions.map((volume) => (
                  <option key={volume} value={String(volume)}>
                    {volume} cl
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <label className="flex min-h-11 items-center gap-3 rounded-2xl bg-white/[0.06] px-3 text-sm font-bold text-foam/70">
              <input
                className="size-4 accent-malt"
                type="checkbox"
                checked={verifiedOnly}
                onChange={(event) => setVerifiedOnly(event.target.checked)}
              />
              Bara verifierade
            </label>
            {hasActiveFilters && (
              <button className="min-h-11 rounded-2xl px-3 text-sm font-black text-malt hover:bg-white/10" type="button" onClick={resetFilters}>
                Rensa filter
              </button>
            )}
          </div>
        </div>

        {shouldShowLoading && (
          <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.06] p-6 text-center">
            <h3 className="text-xl font-black text-foam">Laddar priser...</h3>
            <p className="mt-2 text-foam/60">Prislistan visas strax.</p>
          </div>
        )}

        {!shouldShowLoading && visiblePrices.length === 0 && (
          <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.06] p-6 text-center">
            <h3 className="text-xl font-black text-foam">Inga priser än</h3>
            <p className="mt-2 text-foam/60">Rapporterade priser visas här.</p>
          </div>
        )}

        {!shouldShowLoading && visiblePrices.length > 0 && sortedPrices.length === 0 && (
          <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.06] p-6 text-center">
            <h3 className="text-xl font-black text-foam">Inga priser matchar filtret</h3>
            <p className="mt-2 text-foam/60">Rensa filter eller sök bredare.</p>
            {hasActiveFilters && (
              <button className="mt-4 min-h-12 rounded-2xl bg-malt px-5 font-black text-night hover:bg-lager" type="button" onClick={resetFilters}>
                Rensa filter
              </button>
            )}
          </div>
        )}

        {!shouldShowLoading && sortedPrices.length > 0 && (
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {sortedPrices.map((price, index) => (
              <PriceRankCard key={price.id} price={price} index={index} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
