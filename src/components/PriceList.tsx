import { useEffect, useMemo, useState } from "react";
import { getBeerPriceList, type BeerPriceListItem } from "../lib/data/prices";
import { PRICE_TYPE_LABELS, SOURCE_TYPE_LABELS, type BeerPriceType, type BeerPriceSourceType } from "../lib/types";
import { formatSek } from "../lib/pricing";

type SortMode = "price" | "venue" | "reportedAt";
type PriceTypeFilter = "all" | BeerPriceType;
type SourceTypeFilter = "all" | BeerPriceSourceType;

type Props = {
  prices: BeerPriceListItem[];
};

const priceTypeFilters: Array<{ value: PriceTypeFilter; label: string }> = [
  { value: "all", label: "Alla" },
  { value: "regular", label: "Öl" },
  { value: "after_work", label: "AW" },
  { value: "campaign", label: "Kampanj" },
];

const sourceTypeFilters: Array<{ value: SourceTypeFilter; label: string }> = [
  { value: "all", label: "Alla källor" },
  { value: "website", label: "Hemsida" },
  { value: "menu", label: "Meny" },
  { value: "reported", label: "Inrapporterat" },
];

const inputClass =
  "min-h-12 w-full rounded-2xl border border-white/10 bg-white/[0.08] px-4 text-base font-bold text-foam outline-none placeholder:text-foam/30 focus:border-malt focus:ring-2 focus:ring-malt/20";
const selectClass =
  "min-h-12 w-full rounded-2xl border border-white/10 bg-white/[0.08] px-4 text-base font-bold text-foam outline-none focus:border-malt focus:ring-2 focus:ring-malt/20";

function getVenueLocation(price: BeerPriceListItem) {
  return price.venue.district || price.venue.address || price.venue.city;
}

function getBeerDisplayName(price: BeerPriceListItem) {
  return price.beer?.name || price.beer_name || null;
}

function formatDate(value?: string | null) {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat("sv-SE", {
    day: "numeric",
    month: "short",
  }).format(new Date(`${value.slice(0, 10)}T12:00:00`));
}

export function getPriceLabel(price: Pick<BeerPriceListItem, "price_type" | "price_sek">) {
  const priceText = formatSek(price.price_sek);

  if (price.price_type === "after_work") {
    return `AW-öl från ${priceText}`;
  }

  if (price.price_type === "campaign") {
    return `Kampanjöl från ${priceText}`;
  }

  return `Öl från ${priceText}`;
}

function statusBadgeClass(isVerified: boolean) {
  return isVerified ? "bg-hop text-night" : "bg-white/10 text-foam/60 ring-1 ring-white/10";
}

function PriceCard({ price }: { price: BeerPriceListItem }) {
  const beerName = getBeerDisplayName(price);
  const dateLabel = formatDate(price.reported_at || price.approved_at || price.observed_at || price.created_at);

  return (
    <article className="rounded-[1.75rem] border border-white/10 bg-white/[0.06] p-4 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-malt px-3 py-1 text-xs font-black text-night">{PRICE_TYPE_LABELS[price.price_type]}</span>
            <span className={`rounded-full px-3 py-1 text-xs font-black ${statusBadgeClass(price.admin_verified)}`}>
              {price.admin_verified ? "Verifierad" : "Ej verifierad"}
            </span>
          </div>
          <h3 className="mt-3 truncate text-xl font-black text-foam">{price.venue.name}</h3>
          <p className="mt-1 truncate text-sm font-semibold text-foam/50">{getVenueLocation(price)}</p>
        </div>
        <p className="shrink-0 text-right text-3xl font-black leading-none text-lager">{formatSek(price.price_sek)}</p>
      </div>

      <div className="mt-4 rounded-3xl bg-night/50 p-3 ring-1 ring-white/[0.08]">
        <p className="text-base font-black text-foam">{getPriceLabel(price)}</p>
        <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold text-foam/55">
          {beerName && <span>{beerName}</span>}
          {price.volume_is_verified && price.volume_cl != null && <span>{price.volume_cl} cl</span>}
          <span>Källa: {SOURCE_TYPE_LABELS[price.source_type]}</span>
        </div>
        {dateLabel && <p className="mt-2 text-xs font-semibold text-foam/40">Uppdaterat {dateLabel}</p>}
      </div>
    </article>
  );
}

export default function PriceList({ prices }: Props) {
  const [sortMode, setSortMode] = useState<SortMode>("price");
  const [searchTerm, setSearchTerm] = useState("");
  const [priceTypeFilter, setPriceTypeFilter] = useState<PriceTypeFilter>("all");
  const [sourceTypeFilter, setSourceTypeFilter] = useState<SourceTypeFilter>("all");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [visiblePrices, setVisiblePrices] = useState(prices);

  useEffect(() => {
    let isMounted = true;

    setHasHydrated(true);

    getBeerPriceList()
      .then((result) => {
        if (isMounted) {
          setVisiblePrices(result.prices);
        }
      })
      .catch(() => {
        if (isMounted) {
          setVisiblePrices(prices);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const sortedPrices = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLocaleLowerCase("sv");

    return visiblePrices
      .filter((price) => {
        const beerName = getBeerDisplayName(price) ?? "";
        const matchesSearch =
          !normalizedSearch ||
          price.venue.name.toLocaleLowerCase("sv").includes(normalizedSearch) ||
          getVenueLocation(price).toLocaleLowerCase("sv").includes(normalizedSearch) ||
          beerName.toLocaleLowerCase("sv").includes(normalizedSearch);

        const matchesType = priceTypeFilter === "all" || price.price_type === priceTypeFilter;
        const matchesSource = sourceTypeFilter === "all" || price.source_type === sourceTypeFilter;
        const matchesVerified = !verifiedOnly || price.admin_verified;

        return matchesSearch && matchesType && matchesSource && matchesVerified;
      })
      .sort((a, b) => {
        if (sortMode === "venue") {
          return a.venue.name.localeCompare(b.venue.name, "sv");
        }

        if (sortMode === "reportedAt") {
          return (b.reported_at || b.created_at).localeCompare(a.reported_at || a.created_at, "sv");
        }

        return a.price_sek - b.price_sek || a.venue.name.localeCompare(b.venue.name, "sv");
      });
  }, [visiblePrices, searchTerm, priceTypeFilter, sourceTypeFilter, verifiedOnly, sortMode]);

  const shouldShowLoading = !hasHydrated && prices.length === 0;
  const cheapestVisiblePrice = sortedPrices[0] ?? null;
  const hasActiveFilters = searchTerm || priceTypeFilter !== "all" || sourceTypeFilter !== "all" || verifiedOnly;
  const resultLabel = sortedPrices.length === 1 ? "1 ställe" : `${sortedPrices.length} ställen`;

  function resetFilters() {
    setSearchTerm("");
    setPriceTypeFilter("all");
    setSourceTypeFilter("all");
    setVerifiedOnly(false);
    setSortMode("price");
  }

  return (
    <section id="priser" className="mt-8 min-w-0 scroll-mt-24">
      <div className="flex flex-col gap-3">
        <p className="text-sm font-black uppercase tracking-normal text-malt">Prislistan</p>
        <div className="flex min-w-0 items-end justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-3xl font-black text-foam">Billigast per ställe</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-foam/60">
              En aktuell prisrad per ställe, sorterad på lägsta kända pris.
            </p>
          </div>
          <div className="max-w-[9.5rem] shrink-0 rounded-3xl bg-white/[0.08] px-4 py-3 text-right ring-1 ring-white/10">
            <p className="text-lg font-black text-foam">{resultLabel}</p>
            <p className="text-xs font-bold text-foam/50">{cheapestVisiblePrice ? `${formatSek(cheapestVisiblePrice.price_sek)} lägst` : "Tomt"}</p>
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
          {sourceTypeFilters.map((filter) => {
            const isActive = sourceTypeFilter === filter.value;

            return (
              <button
                key={filter.value}
                className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-black ${
                  isActive ? "bg-hop text-night" : "bg-white/[0.09] text-foam/60 ring-1 ring-white/10 hover:bg-white/[0.14]"
                }`}
                type="button"
                onClick={() => setSourceTypeFilter(filter.value)}
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
              <option value="price">Lägst pris</option>
              <option value="venue">Ställe A-Ö</option>
              <option value="reportedAt">Senast</option>
            </select>
          </label>
          <label className="flex min-h-12 items-center gap-3 rounded-2xl bg-white/[0.06] px-3 text-sm font-bold text-foam/70">
            <input
              className="size-4 accent-malt"
              type="checkbox"
              checked={verifiedOnly}
              onChange={(event) => setVerifiedOnly(event.target.checked)}
            />
            Verifierade
          </label>
        </div>

        {hasActiveFilters && (
          <button className="mt-3 min-h-11 rounded-2xl px-3 text-sm font-black text-malt hover:bg-white/10" type="button" onClick={resetFilters}>
            Rensa filter
          </button>
        )}
      </div>

      {shouldShowLoading && (
        <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.06] p-6 text-center">
          <h3 className="text-xl font-black text-foam">Laddar priser...</h3>
          <p className="mt-2 text-foam/60">Prislistan visas strax.</p>
        </div>
      )}

      {!shouldShowLoading && visiblePrices.length === 0 && (
        <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.06] p-6 text-center">
          <h3 className="text-xl font-black text-foam">Inga priser hittades</h3>
          <p className="mt-2 text-foam/60">Rapporterade och godkända priser visas här.</p>
        </div>
      )}

      {!shouldShowLoading && visiblePrices.length > 0 && sortedPrices.length === 0 && (
        <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.06] p-6 text-center">
          <h3 className="text-xl font-black text-foam">Inga priser matchar filtret</h3>
          <p className="mt-2 text-foam/60">Rensa filter eller sök bredare.</p>
          <button className="mt-4 min-h-12 rounded-2xl bg-malt px-5 font-black text-night hover:bg-lager" type="button" onClick={resetFilters}>
            Rensa filter
          </button>
        </div>
      )}

      {!shouldShowLoading && sortedPrices.length > 0 && (
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {sortedPrices.map((price) => (
            <PriceCard key={price.id} price={price} />
          ))}
        </div>
      )}
    </section>
  );
}
