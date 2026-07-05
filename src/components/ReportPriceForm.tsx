import { useEffect, useMemo, useState } from "react";
import { getVenues, submitPriceReport } from "../lib/data/prices";
import { calculatePricePerLiter, formatPricePerLiter } from "../lib/pricing";
import type { PriceType, Venue } from "../lib/types";

type SubmitState = "idle" | "submitting" | "saved" | "preview" | "error";
type VenueMode = "existing" | "new";

const validPriceTypes: PriceType[] = ["normalpris", "after_work", "happy_hour", "student", "okänd"];

const priceTypeLabels: Record<PriceType, string> = {
  normalpris: "Normalpris",
  after_work: "After work",
  happy_hour: "Happy hour",
  student: "Student",
  okänd: "Okänd",
};

const inputClass =
  "rounded-md border border-line bg-paper px-3 py-3 font-semibold text-ink placeholder:text-ink/35 focus:border-hop focus:outline-none focus:ring-2 focus:ring-hop/25";
const labelClass = "grid gap-2 text-sm font-black text-ink";

function parsePositiveDecimal(value: string): number | null {
  const parsed = Number(value.replace(",", "."));

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function isValidPriceType(value: string): value is PriceType {
  return validPriceTypes.includes(value as PriceType);
}

function messageClass(state: SubmitState) {
  if (state === "saved" || state === "preview") {
    return "border-hop/30 bg-hop/10 text-hop";
  }

  if (state === "error") {
    return "border-copper/40 bg-copper/10 text-copper";
  }

  return "border-line bg-foam text-ink";
}

export default function ReportPriceForm() {
  const [priceSek, setPriceSek] = useState("");
  const [volumeCl, setVolumeCl] = useState("40");
  const [beerName, setBeerName] = useState("");
  const [priceType, setPriceType] = useState<PriceType>("normalpris");
  const [comment, setComment] = useState("");
  const [newVenueName, setNewVenueName] = useState("");
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
        setSubmitState("error");
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

  const selectedVenue = venues.find((venue) => venue.id === selectedVenueId) ?? null;
  const isSubmitting = submitState === "submitting";

  return (
    <section id="rapportera" className="border-t border-line bg-foam px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
        <div>
          <p className="text-sm font-black uppercase tracking-normal text-copper">Rapportera pris</p>
          <h2 className="mt-2 text-3xl font-black text-ink sm:text-5xl">Har du hittat en bättre bira?</h2>
          <p className="mt-4 text-base leading-7 text-ink/70">
            Skicka in priset medan du minns detaljerna. Rapporten hamnar i moderering innan den blir publik.
          </p>

          <div className="mt-6 rounded-lg border border-line bg-paper p-4">
            <p className="text-xs font-black uppercase text-copper">Förhandsvisning</p>
            <p className="mt-1 text-3xl font-black text-ink">{calculatedPrice ?? "Fyll i pris och volym"}</p>
            <p className="mt-2 text-sm font-semibold text-ink/60">
              {venueMode === "existing" ? selectedVenue?.name ?? "Välj serveringsställe" : newVenueName || "Nytt serveringsställe"}
            </p>
          </div>
        </div>

        <form
          className="rounded-lg border border-line bg-white p-4 shadow-soft sm:p-6"
          onSubmit={async (event) => {
            event.preventDefault();
            setSubmitState("submitting");
            setMessage("");

            const price = parsePositiveDecimal(priceSek);
            const volume = parsePositiveDecimal(volumeCl);
            const venueName = newVenueName.trim();

            if (venueMode === "existing" && !selectedVenue) {
              setMessage("Välj ett serveringsställe eller lägg till ett nytt.");
              setSubmitState("error");
              return;
            }

            if (venueMode === "new" && !venueName) {
              setMessage("Ange namnet på serveringsstället.");
              setSubmitState("error");
              return;
            }

            if (!beerName.trim()) {
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

            if (!isValidPriceType(priceType)) {
              setMessage("Välj en giltig pristyp.");
              setSubmitState("error");
              return;
            }

            try {
              const result = await submitPriceReport({
                venue_id: venueMode === "existing" ? selectedVenue?.id ?? null : null,
                venue_name: venueMode === "existing" ? selectedVenue?.name ?? "" : venueName,
                beer_name: beerName.trim(),
                volume_cl: volume,
                price_sek: price,
                price_type: priceType,
                observed_at: new Date().toISOString().slice(0, 10),
                reporter_note: comment.trim() || null,
              });

              setSubmitState(result.ok ? (result.persisted ? "saved" : "preview") : "error");
              setMessage(
                result.ok
                  ? result.persisted
                    ? "Tack. Rapporten är mottagen och väntar på moderering."
                    : "Tack. Rapporten är kontrollerad, men sparas först när databasen är ansluten."
                  : "Rapporten kunde inte tas emot just nu. Försök igen om en stund.",
              );

              if (result.ok) {
                setBeerName("");
                setPriceSek("");
                setComment("");
                setNewVenueName("");
              }
            } catch {
              setMessage("Rapporten kunde inte tas emot just nu. Försök igen om en stund.");
              setSubmitState("error");
            }
          }}
        >
          <fieldset className="grid gap-3">
            <legend className="text-sm font-black text-ink">Serveringsställe</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={`flex items-center gap-3 rounded-md border px-3 py-3 text-sm font-black ${venueMode === "existing" ? "border-hop bg-moss text-hop" : "border-line bg-paper text-ink"}`}>
                <input
                  className="accent-hop"
                  type="radio"
                  name="venueMode"
                  value="existing"
                  checked={venueMode === "existing"}
                  onChange={() => setVenueMode("existing")}
                  disabled={venues.length === 0}
                />
                Välj befintligt ställe
              </label>
              <label className={`flex items-center gap-3 rounded-md border px-3 py-3 text-sm font-black ${venueMode === "new" ? "border-hop bg-moss text-hop" : "border-line bg-paper text-ink"}`}>
                <input className="accent-hop" type="radio" name="venueMode" value="new" checked={venueMode === "new"} onChange={() => setVenueMode("new")} />
                Lägg till nytt ställe
              </label>
            </div>
          </fieldset>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {venueMode === "existing" ? (
              <label className={`${labelClass} sm:col-span-2`}>
                Befintligt ställe
                <select
                  className={inputClass}
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
                <span className="text-xs font-semibold text-ink/55">Saknas stället? Välj nytt ställe i rutan ovan.</span>
              </label>
            ) : (
              <label className={`${labelClass} sm:col-span-2`}>
                Nytt ställe
                <input className={inputClass} value={newVenueName} onChange={(event) => setNewVenueName(event.target.value)} placeholder="Exempelbaren" required />
                <span className="text-xs font-semibold text-ink/55">Admin matchar mot befintliga ställen innan något nytt skapas.</span>
              </label>
            )}

            <label className={labelClass}>
              Öl/prisnamn
              <input className={inputClass} value={beerName} onChange={(event) => setBeerName(event.target.value)} placeholder="Stor stark" required />
            </label>
            <label className={labelClass}>
              Pris i kronor
              <input
                className={inputClass}
                inputMode="decimal"
                value={priceSek}
                onChange={(event) => setPriceSek(event.target.value)}
                placeholder="69"
                required
              />
            </label>
            <label className={labelClass}>
              Volym i cl
              <input
                className={inputClass}
                inputMode="decimal"
                value={volumeCl}
                onChange={(event) => setVolumeCl(event.target.value)}
                placeholder="40"
                required
              />
            </label>
            <label className={labelClass}>
              Pristyp
              <select className={inputClass} value={priceType} onChange={(event) => setPriceType(event.target.value as PriceType)}>
                {validPriceTypes.map((type) => (
                  <option key={type} value={type}>
                    {priceTypeLabels[type]}
                  </option>
                ))}
              </select>
            </label>
            <label className={`${labelClass} sm:col-span-2`}>
              Kommentar
              <textarea
                className={`${inputClass} min-h-28`}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="Till exempel tid, dag, happy hour-villkor eller om priset bara gäller med studentkort."
              />
            </label>
          </div>

          <button
            className="mt-5 w-full rounded-md bg-hop px-4 py-3 font-black text-white hover:bg-ink disabled:cursor-not-allowed disabled:bg-ink/40"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Skickar rapport..." : "Skicka till moderering"}
          </button>
          {message && <p className={`mt-4 rounded-md border px-4 py-3 text-sm font-bold ${messageClass(submitState)}`}>{message}</p>}
        </form>
      </div>
    </section>
  );
}
