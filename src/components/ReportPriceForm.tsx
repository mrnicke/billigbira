import { useMemo, useState } from "react";
import { calculatePricePerLiter, formatPricePerLiter } from "../lib/pricing";

export default function ReportPriceForm() {
  const [priceSek, setPriceSek] = useState("");
  const [volumeCl, setVolumeCl] = useState("40");
  const [submitted, setSubmitted] = useState(false);

  const calculatedPrice = useMemo(() => {
    const price = Number(priceSek.replace(",", "."));
    const volume = Number(volumeCl.replace(",", "."));

    if (!price || !volume) {
      return null;
    }

    return formatPricePerLiter(calculatePricePerLiter(price, volume));
  }, [priceSek, volumeCl]);

  return (
    <section id="rapportera" className="bg-foam px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
        <div>
          <p className="text-sm font-bold uppercase tracking-normal text-copper">Rapportera pris</p>
          <h2 className="mt-2 text-3xl font-black text-ink sm:text-4xl">Har du sett billig bira?</h2>
          <p className="mt-4 text-base leading-7 text-ink/70">
            I den här bootstrap-versionen sparas inget. Formuläret visar bara hur rapportflödet ska fungera innan Supabase kopplas in i nästa fas.
          </p>
          {calculatedPrice && (
            <div className="mt-6 rounded-lg bg-white p-4 shadow-sm">
              <p className="text-sm font-bold text-ink/55">Beräknat literpris</p>
              <p className="mt-1 text-2xl font-black text-hop">{calculatedPrice}</p>
            </div>
          )}
        </div>

        <form
          className="rounded-lg border border-black/10 bg-white p-4 shadow-soft sm:p-6"
          onSubmit={(event) => {
            event.preventDefault();
            setSubmitted(true);
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold text-ink">
              Serveringsställe
              <input className="rounded-md border border-black/15 px-3 py-3 font-medium" name="venue" placeholder="Exempelbaren" />
            </label>
            <label className="grid gap-2 text-sm font-bold text-ink">
              Öl/prisnamn
              <input className="rounded-md border border-black/15 px-3 py-3 font-medium" name="beerName" placeholder="Stor stark" />
            </label>
            <label className="grid gap-2 text-sm font-bold text-ink">
              Pris i kronor
              <input
                className="rounded-md border border-black/15 px-3 py-3 font-medium"
                inputMode="decimal"
                name="priceSek"
                placeholder="69"
                value={priceSek}
                onChange={(event) => setPriceSek(event.target.value)}
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-ink">
              Volym i cl
              <input
                className="rounded-md border border-black/15 px-3 py-3 font-medium"
                inputMode="decimal"
                name="volumeCl"
                placeholder="40"
                value={volumeCl}
                onChange={(event) => setVolumeCl(event.target.value)}
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-ink sm:col-span-2">
              Pristyp
              <select className="rounded-md border border-black/15 px-3 py-3 font-medium" name="priceType" defaultValue="normalpris">
                <option value="normalpris">Normalpris</option>
                <option value="after work">After work</option>
                <option value="happy hour">Happy hour</option>
                <option value="studentpris">Studentpris</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-bold text-ink sm:col-span-2">
              Kommentar
              <textarea className="min-h-28 rounded-md border border-black/15 px-3 py-3 font-medium" name="comment" placeholder="Till exempel tid, dag eller villkor." />
            </label>
          </div>
          <button className="mt-5 w-full rounded-md bg-hop px-4 py-3 font-black text-white hover:bg-ink" type="submit">
            Förhandsgranska rapport
          </button>
          {submitted && (
            <p className="mt-4 rounded-md bg-foam p-3 text-sm font-semibold text-ink">
              Tack. I nästa fas kopplas rapporter till Supabase och kan modereras av admin.
            </p>
          )}
        </form>
      </div>
    </section>
  );
}
