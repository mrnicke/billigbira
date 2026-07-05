import { useMemo, useState } from "react";
import type { BeerPriceListItem } from "../lib/data/prices";
import { formatPricePerLiter, formatSek } from "../lib/pricing";
import type { PriceType } from "../lib/types";

type SortMode = "pricePerLiter" | "venue" | "observedAt";

type Props = {
  prices: BeerPriceListItem[];
};

const priceTypeLabels: Record<PriceType, string> = {
  normalpris: "Normalpris",
  after_work: "After work",
  happy_hour: "Happy hour",
  student: "Student",
  okänd: "Okänd",
};

function getVenueLocation(price: BeerPriceListItem) {
  return price.venue.district || price.venue.address || price.venue.city;
}

export default function PriceList({ prices }: Props) {
  const [sortMode, setSortMode] = useState<SortMode>("pricePerLiter");

  const sortedPrices = useMemo(() => {
    return [...prices].sort((a, b) => {
      if (sortMode === "venue") {
        return a.venue.name.localeCompare(b.venue.name, "sv");
      }

      if (sortMode === "observedAt") {
        return b.observed_at.localeCompare(a.observed_at, "sv");
      }

      return a.price_per_liter_sek - b.price_per_liter_sek;
    });
  }, [prices, sortMode]);

  return (
    <section id="priser" className="bg-white px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-normal text-copper">Prislistan</p>
            <h2 className="mt-2 text-3xl font-black text-ink sm:text-4xl">Billigast per liter först</h2>
            <p className="mt-3 max-w-2xl text-base leading-7 text-ink/70">
              Literpris räknas konsekvent från pris och volym. Om Supabase inte är konfigurerat visas lokal exempeldata.
            </p>
          </div>
          <label className="flex w-full max-w-xs flex-col gap-2 text-sm font-bold text-ink md:items-start">
            Sortera
            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
              className="w-full rounded-md border border-black/15 bg-foam px-3 py-3 text-base font-semibold text-ink shadow-sm focus:border-hop focus:outline-none focus:ring-2 focus:ring-hop/30"
            >
              <option value="pricePerLiter">Billigast per liter</option>
              <option value="venue">Serveringsställe A-Ö</option>
              <option value="observedAt">Senast observerat</option>
            </select>
          </label>
        </div>

        {sortedPrices.length === 0 && (
          <div className="mt-8 rounded-lg border border-black/10 bg-foam p-6 text-center">
            <h3 className="text-xl font-black text-ink">Inga priser att visa ännu</h3>
            <p className="mt-2 text-ink/70">Rapporterade och verifierade priser visas här när data finns tillgänglig.</p>
          </div>
        )}

        <div className="mt-8 grid gap-4 lg:hidden">
          {sortedPrices.map((price) => (
            <article key={price.id} className="rounded-lg border border-black/10 bg-foam p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-black text-ink">{price.venue.name}</h3>
                  <p className="mt-1 text-sm text-ink/65">{getVenueLocation(price)}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${
                    price.is_verified ? "bg-hop text-white" : "bg-white text-ink ring-1 ring-black/15"
                  }`}
                >
                  {price.is_verified ? "Verifierad" : "Ej verifierad"}
                </span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="font-bold text-ink/55">Öl/prisnamn</p>
                  <p className="mt-1 font-semibold">{price.beer_name}</p>
                </div>
                <div>
                  <p className="font-bold text-ink/55">Pristyp</p>
                  <p className="mt-1 font-semibold">{priceTypeLabels[price.price_type]}</p>
                </div>
                <div>
                  <p className="font-bold text-ink/55">Pris</p>
                  <p className="mt-1 text-2xl font-black">{formatSek(price.price_sek)}</p>
                </div>
                <div>
                  <p className="font-bold text-ink/55">Volym</p>
                  <p className="mt-1 text-2xl font-black">{price.volume_cl} cl</p>
                </div>
              </div>
              <div className="mt-5 rounded-md bg-white p-3">
                <p className="text-sm font-bold text-ink/55">Pris per liter</p>
                <p className="mt-1 text-2xl font-black text-hop">{formatPricePerLiter(price.price_per_liter_sek)}</p>
              </div>
              <p className="mt-4 text-sm text-ink/60">Observerat: {price.observed_at}</p>
            </article>
          ))}
        </div>

        {sortedPrices.length > 0 && (
          <div className="mt-8 hidden overflow-hidden rounded-lg border border-black/10 lg:block">
            <table className="w-full border-collapse bg-white text-left text-sm">
              <thead className="bg-foam text-xs uppercase tracking-normal text-ink/65">
                <tr>
                  <th className="px-4 py-3">Serveringsställe</th>
                  <th className="px-4 py-3">Område/adress</th>
                  <th className="px-4 py-3">Öl/prisnamn</th>
                  <th className="px-4 py-3">Pris</th>
                  <th className="px-4 py-3">Volym</th>
                  <th className="px-4 py-3">Kr/liter</th>
                  <th className="px-4 py-3">Typ</th>
                  <th className="px-4 py-3">Observerat</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10">
                {sortedPrices.map((price) => (
                  <tr key={price.id} className="hover:bg-foam/70">
                    <td className="px-4 py-4 font-black">{price.venue.name}</td>
                    <td className="px-4 py-4 text-ink/70">{getVenueLocation(price)}</td>
                    <td className="px-4 py-4 font-semibold">{price.beer_name}</td>
                    <td className="px-4 py-4 font-black">{formatSek(price.price_sek)}</td>
                    <td className="px-4 py-4">{price.volume_cl} cl</td>
                    <td className="px-4 py-4 font-black text-hop">{formatPricePerLiter(price.price_per_liter_sek)}</td>
                    <td className="px-4 py-4">{priceTypeLabels[price.price_type]}</td>
                    <td className="px-4 py-4 text-ink/60">{price.observed_at}</td>
                    <td className="px-4 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-black ${
                          price.is_verified ? "bg-hop text-white" : "bg-white text-ink ring-1 ring-black/15"
                        }`}
                      >
                        {price.is_verified ? "Verifierad" : "Ej verifierad"}
                      </span>
                    </td>
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
