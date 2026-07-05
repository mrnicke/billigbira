import { useEffect, useMemo, useState } from "react";
import { getBeerPriceList, type BeerPriceListItem, type PriceDataStatus } from "../lib/data/prices";
import { formatPricePerLiter, formatSek } from "../lib/pricing";
import type { PriceType } from "../lib/types";

type SortMode = "pricePerLiter" | "venue" | "observedAt";
type PriceTypeFilter = "all" | PriceType;
type VolumeFilter = "all" | string;

type Props = {
  prices: BeerPriceListItem[];
  dataStatus?: PriceDataStatus;
};

const priceTypeLabels: Record<PriceType, string> = {
  normalpris: "Normalpris",
  after_work: "After work",
  happy_hour: "Happy hour",
  student: "Student",
  okänd: "Okänd",
};

const priceTypeFilters: PriceTypeFilter[] = ["all", "normalpris", "after_work", "happy_hour", "student"];

const selectClass =
  "w-full rounded-md border border-line bg-paper px-3 py-3 text-base font-bold text-ink shadow-sm focus:border-hop focus:outline-none focus:ring-2 focus:ring-hop/25";
const inputClass =
  "w-full rounded-md border border-line bg-paper px-3 py-3 text-base font-bold text-ink shadow-sm placeholder:text-ink/35 focus:border-hop focus:outline-none focus:ring-2 focus:ring-hop/25";

function getVenueLocation(price: BeerPriceListItem) {
  return price.venue.district || price.venue.address || price.venue.city;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function priceTypeBadgeClass(priceType: PriceType) {
  if (priceType === "happy_hour" || priceType === "after_work") {
    return "bg-malt text-night";
  }

  if (priceType === "student") {
    return "bg-moss text-hop";
  }

  return "bg-white text-ink ring-1 ring-line";
}

function rankLabel(index: number) {
  if (index === 0) {
    return "Billigast";
  }

  return `#${index + 1}`;
}

export default function PriceList({ prices, dataStatus = "supabase" }: Props) {
  const [sortMode, setSortMode] = useState<SortMode>("pricePerLiter");
  const [searchTerm, setSearchTerm] = useState("");
  const [priceTypeFilter, setPriceTypeFilter] = useState<PriceTypeFilter>("all");
  const [volumeFilter, setVolumeFilter] = useState<VolumeFilter>("all");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [visiblePrices, setVisiblePrices] = useState(prices);
  const [visibleDataStatus, setVisibleDataStatus] = useState<PriceDataStatus>(dataStatus);

  useEffect(() => {
    let isMounted = true;

    setHasHydrated(true);

    getBeerPriceList()
      .then((result) => {
        if (!isMounted) {
          return;
        }

        setVisiblePrices(result.prices);
        setVisibleDataStatus(result.status);
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        setVisiblePrices(prices);
        setVisibleDataStatus(dataStatus);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const volumeOptions = useMemo(() => {
    return [...new Set(visiblePrices.map((price) => price.volume_cl))].sort((a, b) => a - b);
  }, [visiblePrices]);

  const sortedPrices = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLocaleLowerCase("sv");

    return visiblePrices
      .filter((price) => {
        const matchesSearch =
          !normalizedSearch ||
          price.venue.name.toLocaleLowerCase("sv").includes(normalizedSearch) ||
          getVenueLocation(price).toLocaleLowerCase("sv").includes(normalizedSearch) ||
          price.beer_name.toLocaleLowerCase("sv").includes(normalizedSearch);

        const matchesType = priceTypeFilter === "all" || price.price_type === priceTypeFilter;
        const matchesVolume = volumeFilter === "all" || String(price.volume_cl) === volumeFilter;
        const matchesVerified = !verifiedOnly || price.is_verified;

        return matchesSearch && matchesType && matchesVolume && matchesVerified;
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
  }, [visiblePrices, searchTerm, priceTypeFilter, volumeFilter, verifiedOnly, sortMode]);

  const shouldShowLoading = !hasHydrated && prices.length === 0;
  const cheapestVisiblePrice = sortedPrices[0] ?? null;
  const hasActiveFilters = searchTerm || priceTypeFilter !== "all" || volumeFilter !== "all" || verifiedOnly;
  const resultLabel = sortedPrices.length === 1 ? "1 pris" : `${sortedPrices.length} priser`;

  function resetFilters() {
    setSearchTerm("");
    setPriceTypeFilter("all");
    setVolumeFilter("all");
    setVerifiedOnly(false);
    setSortMode("pricePerLiter");
  }

  return (
    <section id="priser" className="bg-paper px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-normal text-copper">Prislistan</p>
            <h2 className="mt-2 text-3xl font-black text-ink sm:text-5xl">Billigast per liter först</h2>
            <p className="mt-3 max-w-2xl text-base leading-7 text-ink/70">
              Jämför ställen på samma villkor. Priset räknas om till kr/liter så att 33, 40 och 50 cl går att skanna snabbt.
            </p>
          </div>
          <div className="rounded-md border border-line bg-foam p-4 md:min-w-64">
            <p className="text-xs font-black uppercase text-copper">Aktuell vy</p>
            <p className="mt-1 text-2xl font-black text-ink">{resultLabel}</p>
            <p className="mt-1 text-sm font-semibold text-ink/60">
              {cheapestVisiblePrice ? `${formatPricePerLiter(cheapestVisiblePrice.price_per_liter_sek)} lägst` : "Inget matchar filtren"}
            </p>
          </div>
        </div>

        <div className="sticky top-[57px] z-30 mt-8 rounded-lg border border-line bg-white/95 p-3 shadow-sm backdrop-blur">
          <div className="grid gap-3 lg:grid-cols-[1.2fr_0.9fr_0.8fr_0.8fr]">
            <label className="grid gap-2 text-sm font-black text-ink">
              Sök
              <input className={inputClass} value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Ställe, område eller öl" />
            </label>
            <label className="grid gap-2 text-sm font-black text-ink">
              Sortera
              <select className={selectClass} value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
                <option value="pricePerLiter">Billigast per liter</option>
                <option value="venue">Serveringsställe A-Ö</option>
                <option value="observedAt">Senast observerat</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-black text-ink">
              Pristyp
              <select className={selectClass} value={priceTypeFilter} onChange={(event) => setPriceTypeFilter(event.target.value as PriceTypeFilter)}>
                {priceTypeFilters.map((priceType) => (
                  <option key={priceType} value={priceType}>
                    {priceType === "all" ? "Alla typer" : priceTypeLabels[priceType]}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-black text-ink">
              Volym
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
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-center gap-3 text-sm font-bold text-ink">
              <input
                className="size-4 accent-hop"
                type="checkbox"
                checked={verifiedOnly}
                onChange={(event) => setVerifiedOnly(event.target.checked)}
              />
              Visa bara verifierade priser
            </label>
            <button className="w-fit rounded-md border border-line bg-paper px-3 py-2 text-sm font-black text-ink hover:border-hop hover:text-hop" type="button" onClick={resetFilters}>
              Rensa filter
            </button>
          </div>
        </div>

        {visibleDataStatus === "fallback" && sortedPrices.length > 0 && (
          <p className="mt-5 rounded-md border border-malt/50 bg-malt/10 px-4 py-3 text-sm font-bold text-ink/75">
            Visar exempeldata tills aktuella verifierade priser finns tillgängliga.
          </p>
        )}

        {shouldShowLoading && (
          <div className="mt-8 rounded-lg border border-line bg-foam p-6 text-center">
            <h3 className="text-xl font-black text-ink">Laddar priser...</h3>
            <p className="mt-2 text-ink/70">Prislistan visas strax.</p>
          </div>
        )}

        {!shouldShowLoading && visiblePrices.length === 0 && (
          <div className="mt-8 rounded-lg border border-line bg-foam p-6 text-center">
            <h3 className="text-xl font-black text-ink">Inga priser att visa ännu</h3>
            <p className="mt-2 text-ink/70">Rapporterade och verifierade priser visas här när data finns tillgänglig.</p>
          </div>
        )}

        {!shouldShowLoading && visiblePrices.length > 0 && sortedPrices.length === 0 && (
          <div className="mt-8 rounded-lg border border-line bg-foam p-6 text-center">
            <h3 className="text-xl font-black text-ink">Inget matchar filtren</h3>
            <p className="mt-2 text-ink/70">Prova att bredda sökningen eller rensa filtren.</p>
            {hasActiveFilters && (
              <button className="mt-4 rounded-md bg-hop px-4 py-3 font-black text-white hover:bg-ink" type="button" onClick={resetFilters}>
                Rensa filter
              </button>
            )}
          </div>
        )}

        {!shouldShowLoading && sortedPrices.length > 0 && (
          <div className="mt-8 grid gap-4 lg:hidden">
            {sortedPrices.map((price, index) => (
              <article key={price.id} className={`rounded-lg border p-4 shadow-sm ${index === 0 ? "border-malt bg-foam" : "border-line bg-white"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${index === 0 ? "bg-night text-malt" : "bg-foam text-ink"}`}>
                      {rankLabel(index)}
                    </span>
                    <h3 className="mt-3 text-xl font-black text-ink">{price.venue.name}</h3>
                    <p className="mt-1 text-sm font-semibold text-ink/60">{getVenueLocation(price)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-black text-hop">{formatSek(price.price_sek)}</p>
                    <p className="text-sm font-bold text-ink/55">{price.volume_cl} cl</p>
                  </div>
                </div>

                <div className="mt-5 rounded-md bg-paper p-3">
                  <p className="text-sm font-black uppercase text-copper">Kr/liter</p>
                  <p className="mt-1 text-3xl font-black text-ink">{formatPricePerLiter(price.price_per_liter_sek)}</p>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-black ${priceTypeBadgeClass(price.price_type)}`}>{priceTypeLabels[price.price_type]}</span>
                  <span className={`rounded-full px-3 py-1 text-xs font-black ${price.is_verified ? "bg-hop text-white" : "bg-white text-ink ring-1 ring-line"}`}>
                    {price.is_verified ? "Verifierad" : "Väntar på verifiering"}
                  </span>
                </div>
                <p className="mt-4 text-sm font-semibold text-ink/70">{price.beer_name}</p>
                <p className="mt-1 text-sm text-ink/55">Observerat {formatDate(price.observed_at)}</p>
              </article>
            ))}
          </div>
        )}

        {!shouldShowLoading && sortedPrices.length > 0 && (
          <div className="mt-8 hidden overflow-hidden rounded-lg border border-line bg-white lg:block">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-foam text-xs uppercase tracking-normal text-ink/65">
                <tr>
                  <th className="px-4 py-3">Rank</th>
                  <th className="px-4 py-3">Serveringsställe</th>
                  <th className="px-4 py-3">Öl/prisnamn</th>
                  <th className="px-4 py-3">Pris</th>
                  <th className="px-4 py-3">Volym</th>
                  <th className="px-4 py-3">Kr/liter</th>
                  <th className="px-4 py-3">Typ</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Observerat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {sortedPrices.map((price, index) => (
                  <tr key={price.id} className={index === 0 ? "bg-malt/10" : "hover:bg-foam/70"}>
                    <td className="px-4 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-black ${index === 0 ? "bg-night text-malt" : "bg-foam text-ink"}`}>{rankLabel(index)}</span>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-black text-ink">{price.venue.name}</p>
                      <p className="mt-1 text-xs font-semibold text-ink/55">{getVenueLocation(price)}</p>
                    </td>
                    <td className="px-4 py-4 font-semibold">{price.beer_name}</td>
                    <td className="px-4 py-4 text-lg font-black">{formatSek(price.price_sek)}</td>
                    <td className="px-4 py-4 font-bold">{price.volume_cl} cl</td>
                    <td className="px-4 py-4 text-lg font-black text-hop">{formatPricePerLiter(price.price_per_liter_sek)}</td>
                    <td className="px-4 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-black ${priceTypeBadgeClass(price.price_type)}`}>{priceTypeLabels[price.price_type]}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-black ${price.is_verified ? "bg-hop text-white" : "bg-white text-ink ring-1 ring-line"}`}>
                        {price.is_verified ? "Verifierad" : "Ej verifierad"}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-ink/60">{formatDate(price.observed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
