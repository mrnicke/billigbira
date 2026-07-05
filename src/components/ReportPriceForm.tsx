import { useMemo, useState } from "react";
import { submitPriceReport } from "../lib/data/prices";
import { calculatePricePerLiter, formatPricePerLiter } from "../lib/pricing";
import type { PriceType } from "../lib/types";

type SubmitState = "idle" | "submitting" | "saved" | "preview" | "error";

export default function ReportPriceForm() {
  const [priceSek, setPriceSek] = useState("");
  const [volumeCl, setVolumeCl] = useState("40");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");

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
            Formuläret kan skicka rapporter till Supabase när miljön är konfigurerad. Utan Supabase visas flödet lokalt utan att något sparas.
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
          onSubmit={async (event) => {
            event.preventDefault();
            setSubmitState("submitting");

            const formData = new FormData(event.currentTarget);
            const price = Number(priceSek.replace(",", "."));
            const volume = Number(volumeCl.replace(",", "."));

            if (!price || !volume) {
              setSubmitState("error");
              return;
            }

            const result = await submitPriceReport({
              venue_id: null,
              venue_name: String(formData.get("venue") || "").trim(),
              beer_name: String(formData.get("beerName") || "").trim(),
              volume_cl: volume,
              price_sek: price,
              price_type: String(formData.get("priceType") || "normalpris") as PriceType,
              observed_at: new Date().toISOString().slice(0, 10),
              reporter_note: String(formData.get("comment") || "").trim() || null,
            });

            setSubmitState(result.ok ? (result.persisted ? "saved" : "preview") : "error");
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold text-ink">
              Serveringsställe
              <input className="rounded-md border border-black/15 px-3 py-3 font-medium" name="venue" placeholder="Exempelbaren" required />
            </label>
            <label className="grid gap-2 text-sm font-bold text-ink">
              Öl/prisnamn
              <input className="rounded-md border border-black/15 px-3 py-3 font-medium" name="beerName" placeholder="Stor stark" required />
            </label>
            <label className="grid gap-2 text-sm font-bold text-ink">
              Pris i kronor
              <input
                className="rounded-md border border-black/15 px-3 py-3 font-medium"
                inputMode="decimal"
                name="priceSek"
                placeholder="69"
                required
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
                required
                value={volumeCl}
                onChange={(event) => setVolumeCl(event.target.value)}
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-ink sm:col-span-2">
              Pristyp
              <select className="rounded-md border border-black/15 px-3 py-3 font-medium" name="priceType" defaultValue="normalpris">
                <option value="normalpris">Normalpris</option>
                <option value="after_work">After work</option>
                <option value="happy_hour">Happy hour</option>
                <option value="student">Student</option>
                <option value="okänd">Okänd</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-bold text-ink sm:col-span-2">
              Kommentar
              <textarea className="min-h-28 rounded-md border border-black/15 px-3 py-3 font-medium" name="comment" placeholder="Till exempel tid, dag eller villkor." />
            </label>
          </div>
          <button className="mt-5 w-full rounded-md bg-hop px-4 py-3 font-black text-white hover:bg-ink disabled:cursor-not-allowed disabled:bg-ink/40" type="submit" disabled={submitState === "submitting"}>
            {submitState === "submitting" ? "Skickar..." : "Skicka rapport"}
          </button>
          {submitState === "saved" && (
            <p className="mt-4 rounded-md bg-foam p-3 text-sm font-semibold text-ink">
              Tack. Rapporten är mottagen och väntar på moderering.
            </p>
          )}
          {submitState === "preview" && (
            <p className="mt-4 rounded-md bg-foam p-3 text-sm font-semibold text-ink">
              Tack. Supabase är inte konfigurerat lokalt, så rapporten sparades inte.
            </p>
          )}
          {submitState === "error" && (
            <p className="mt-4 rounded-md bg-foam p-3 text-sm font-semibold text-ink">
              Rapporten kunde inte tas emot just nu. Kontrollera pris och volym och försök igen.
            </p>
          )}
        </form>
      </div>
    </section>
  );
}
