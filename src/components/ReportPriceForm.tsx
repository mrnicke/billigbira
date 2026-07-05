import { useEffect, useMemo, useState } from "react";
import { getVenues, submitPriceReport } from "../lib/data/prices";
import { calculatePricePerLiter, formatPricePerLiter } from "../lib/pricing";
import type { PriceType, Venue } from "../lib/types";

type SubmitState = "idle" | "submitting" | "saved" | "preview" | "error";
type VenueMode = "existing" | "new";

const validPriceTypes: PriceType[] = ["normalpris", "after_work", "happy_hour", "student", "okänd"];

function parsePositiveDecimal(value: string): number | null {
  const parsed = Number(value.replace(",", "."));

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function isValidPriceType(value: string): value is PriceType {
  return validPriceTypes.includes(value as PriceType);
}

export default function ReportPriceForm() {
  const [priceSek, setPriceSek] = useState("");
  const [volumeCl, setVolumeCl] = useState("40");
  const [venueMode, setVenueMode] = useState<VenueMode>("existing");
  const [selectedVenueId, setSelectedVenueId] = useState("");
  const [venues, setVenues] = useState<Venue[]>([]);
  const [isLoadingVenues, setIsLoadingVenues] = useState(true);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    getVenues()
      .then((loadedVenues) => {
        if (!isMounted) {
          return;
        }

        setVenues(loadedVenues);
        setSelectedVenueId((currentVenueId) => currentVenueId || loadedVenues[0]?.id || "");

        if (loadedVenues.length === 0) {
          setVenueMode("new");
        }
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        setVenueMode("new");
        setMessage("Kunde inte hämta listan med ställen just nu. Ange stället manuellt.");
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingVenues(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const calculatedPrice = useMemo(() => {
    const price = parsePositiveDecimal(priceSek);
    const volume = parsePositiveDecimal(volumeCl);

    if (price == null || volume == null) {
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
            Välj ett befintligt serveringsställe eller lägg till ett nytt om det saknas i listan.
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
            setMessage("");

            const formData = new FormData(event.currentTarget);
            const newVenueName = String(formData.get("venueName") || "").trim();
            const beerName = String(formData.get("beerName") || "").trim();
            const priceTypeValue = String(formData.get("priceType") || "normalpris");
            const price = parsePositiveDecimal(priceSek);
            const volume = parsePositiveDecimal(volumeCl);
            const selectedVenue = venues.find((venue) => venue.id === selectedVenueId) ?? null;

            if (venueMode === "existing" && !selectedVenue) {
              setMessage("Välj ett serveringsställe eller lägg till ett nytt.");
              setSubmitState("error");
              return;
            }

            if (venueMode === "new" && !newVenueName) {
              setMessage("Ange namnet på serveringsstället.");
              setSubmitState("error");
              return;
            }

            if (!beerName) {
              setMessage("Ange öl eller prisnamn.");
              setSubmitState("error");
              return;
            }

            if (price == null) {
              setMessage("Ange ett pris som är större än 0.");
              setSubmitState("error");
              return;
            }

            if (volume == null) {
              setMessage("Ange en volym som är större än 0.");
              setSubmitState("error");
              return;
            }

            if (!isValidPriceType(priceTypeValue)) {
              setMessage("Välj en giltig pristyp.");
              setSubmitState("error");
              return;
            }

            try {
              const result = await submitPriceReport({
                venue_id: venueMode === "existing" ? selectedVenue?.id ?? null : null,
                venue_name: venueMode === "existing" ? selectedVenue?.name ?? "" : newVenueName,
                beer_name: beerName,
                volume_cl: volume,
                price_sek: price,
                price_type: priceTypeValue,
                observed_at: new Date().toISOString().slice(0, 10),
                reporter_note: String(formData.get("comment") || "").trim() || null,
              });

              setSubmitState(result.ok ? (result.persisted ? "saved" : "preview") : "error");
              setMessage(
                result.ok
                  ? result.persisted
                    ? "Tack. Rapporten är mottagen och väntar på moderering."
                    : "Tack. Rapporten är kontrollerad, men sparas först när databasen är ansluten."
                  : "Rapporten kunde inte tas emot just nu. Försök igen om en stund.",
              );
            } catch {
              setMessage("Rapporten kunde inte tas emot just nu. Försök igen om en stund.");
              setSubmitState("error");
            }
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <fieldset className="grid gap-3 sm:col-span-2">
              <legend className="text-sm font-bold text-ink">Serveringsställe</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-center gap-3 rounded-md border border-black/15 px-3 py-3 text-sm font-bold text-ink">
                  <input
                    type="radio"
                    name="venueMode"
                    value="existing"
                    checked={venueMode === "existing"}
                    onChange={() => setVenueMode("existing")}
                    disabled={venues.length === 0}
                  />
                  Välj befintligt ställe
                </label>
                <label className="flex items-center gap-3 rounded-md border border-black/15 px-3 py-3 text-sm font-bold text-ink">
                  <input
                    type="radio"
                    name="venueMode"
                    value="new"
                    checked={venueMode === "new"}
                    onChange={() => setVenueMode("new")}
                  />
                  Lägg till nytt ställe
                </label>
              </div>
            </fieldset>

            {venueMode === "existing" ? (
              <label className="grid gap-2 text-sm font-bold text-ink sm:col-span-2">
                Befintligt ställe
                <select
                  className="rounded-md border border-black/15 px-3 py-3 font-medium"
                  value={selectedVenueId}
                  onChange={(event) => setSelectedVenueId(event.target.value)}
                  disabled={isLoadingVenues || venues.length === 0}
                  required
                >
                  {isLoadingVenues && <option value="">Laddar ställen...</option>}
                  {!isLoadingVenues && venues.length === 0 && <option value="">Inga ställen hittades</option>}
                  {venues.map((venue) => (
                    <option key={venue.id} value={venue.id}>
                      {venue.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="grid gap-2 text-sm font-bold text-ink sm:col-span-2">
                Nytt ställe
                <input className="rounded-md border border-black/15 px-3 py-3 font-medium" name="venueName" placeholder="Exempelbaren" required />
              </label>
            )}

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
            <label className="grid gap-2 text-sm font-bold text-ink">
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
          {message && (
            <p className="mt-4 rounded-md bg-foam p-3 text-sm font-semibold text-ink">
              {message}
            </p>
          )}
        </form>
      </div>
    </section>
  );
}
