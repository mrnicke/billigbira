import { useMemo, useState } from "react";
import type { BeerPrice, PriceStatus, PriceType } from "../data/beerPrices";
import { calculatePricePerLiter, formatPricePerLiter, formatSek } from "../lib/pricing";

type SortMode = "pricePerLiter" | "venue" | "lastChecked";

type Props = {
  prices: BeerPrice[];
};

const priceTypeLabels: Record<PriceType, string> = {
  normalpris: "Normalpris",
  "after work": "After work",
  "happy hour": "Happy hour",
  studentpris: "Studentpris",
};

const statusLabels: Record<PriceStatus, string> = {
  verifierat: "Verifierat",
  rapporterat: "Rapporterat",
  gammalt: "Gammalt",
  osakert: "Osäkert",
};

const statusClasses: Record<PriceStatus, string> = {
  verifierat: "bg-hop text-white",
  rapporterat: "bg-malt text-night",
  gammalt: "bg-copper text-white",
  osakert: "bg-white text-ink ring-1 ring-black/15",
};

function getPricePerLiter(price: BeerPrice) {
  return calculatePricePerLiter(price.priceSek, price.volumeCl);
}

export default function PriceList({ prices }: Props) {
  const [sortMode, setSortMode] = useState<SortMode>("pricePerLiter");

  const sortedPrices = useMemo(() => {
    return [...prices].sort((a, b) => {
      if (sortMode === "venue") {
        return a.venue.localeCompare(b.venue, "sv");
      }

      if (sortMode === "lastChecked") {
        return b.lastChecked.localeCompare(a.lastChecked, "sv");
      }

      return getPricePerLiter(a) - getPricePerLiter(b);
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
              Alla poster är mockdata i den här fasen. Literpris räknas automatiskt från pris och volym.
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
              <option value="lastChecked">Senast kontrollerat</option>
            </select>
          </label>
        </div>

        <div className="mt-8 grid gap-4 lg:hidden">
          {sortedPrices.map((price) => (
            <article key={price.id} className="rounded-lg border border-black/10 bg-foam p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-black text-ink">{price.venue}</h3>
                  <p className="mt-1 text-sm text-ink/65">{price.areaOrAddress}</p>
                </div>
                <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${statusClasses[price.status]}`}>
                  {statusLabels[price.status]}
                </span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="font-bold text-ink/55">Öl/prisnamn</p>
                  <p className="mt-1 font-semibold">{price.beerName}</p>
                </div>
                <div>
                  <p className="font-bold text-ink/55">Pristyp</p>
                  <p className="mt-1 font-semibold">{priceTypeLabels[price.priceType]}</p>
                </div>
                <div>
                  <p className="font-bold text-ink/55">Pris</p>
                  <p className="mt-1 text-2xl font-black">{formatSek(price.priceSek)}</p>
                </div>
                <div>
                  <p className="font-bold text-ink/55">Volym</p>
                  <p className="mt-1 text-2xl font-black">{price.volumeCl} cl</p>
                </div>
              </div>
              <div className="mt-5 rounded-md bg-white p-3">
                <p className="text-sm font-bold text-ink/55">Pris per liter</p>
                <p className="mt-1 text-2xl font-black text-hop">{formatPricePerLiter(getPricePerLiter(price))}</p>
              </div>
              <p className="mt-4 text-sm text-ink/60">Senast kontrollerat: {price.lastChecked}</p>
            </article>
          ))}
        </div>

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
                <th className="px-4 py-3">Senast kontrollerat</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10">
              {sortedPrices.map((price) => (
                <tr key={price.id} className="hover:bg-foam/70">
                  <td className="px-4 py-4 font-black">{price.venue}</td>
                  <td className="px-4 py-4 text-ink/70">{price.areaOrAddress}</td>
                  <td className="px-4 py-4 font-semibold">{price.beerName}</td>
                  <td className="px-4 py-4 font-black">{formatSek(price.priceSek)}</td>
                  <td className="px-4 py-4">{price.volumeCl} cl</td>
                  <td className="px-4 py-4 font-black text-hop">{formatPricePerLiter(getPricePerLiter(price))}</td>
                  <td className="px-4 py-4">{priceTypeLabels[price.priceType]}</td>
                  <td className="px-4 py-4 text-ink/60">{price.lastChecked}</td>
                  <td className="px-4 py-4">
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${statusClasses[price.status]}`}>
                      {statusLabels[price.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
