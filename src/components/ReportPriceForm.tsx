import { useEffect, useMemo, useState } from "react";
import { getVenues, submitPriceReport } from "../lib/data/prices";
import { calculatePricePerLiter, formatPricePerLiter } from "../lib/pricing";
import type { PriceType, Venue } from "../lib/types";

type SubmitState = "idle" | "submitting" | "saved" | "preview" | "error";
type VenueMode = "existing" | "new";

const validPriceTypes: PriceType[] = ["normalpris", "after_work", "happy_hour", "student", "okänd"];

const priceTypeLabels: Record<PriceType, string> = {
  normalpris: "Normalpris",
  after_work: "AW",
  happy_hour: "Happy hour",
  student: "Student",
  okänd: "Okänd",
};

const inputClass =
  "min-h-[3.25rem] w-full min-w-0 rounded-2xl border border-white/10 bg-white/[0.08] px-4 py-3 font-bold text-foam outline-none placeholder:text-foam/30 focus:border-malt focus:ring-2 focus:ring-malt/20";
const labelClass = "grid min-w-0 gap-2 text-sm font-black text-foam";

function parsePositiveDecimal(value: string): number | null {
  const parsed = Number(value.replace(",", "."));

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function isValidPriceType(value: string): value is PriceType {
  return validPriceTypes.includes(value as PriceType);
}

function messageClass(state: SubmitState) {
  if (state === "saved" || state === "preview") {
    return "border-hop/30 bg-hop/[0.14] text-foam";
  }

  if (state === "error") {
    return "border-copper/40 bg-copper/[0.14] text-foam";
  }

  return "border-white/10 bg-white/[0.06] text-foam";
}

function StepLabel({ number, title }: { number: string; title: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="grid size-8 place-items-center rounded-full bg-malt text-sm font-black text-night">{number}</span>
      <h3 className="min-w-0 text-lg font-black text-foam">{title}</h3>
    </div>
  );
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
        setMessage("Kunde inte hämta ställen. Skriv in stället själv.");
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
  const canShowSuccess = submitState === "saved" || submitState === "preview";

  return (
    <section id="rapportera" className="mt-10 min-w-0 scroll-mt-24">
      <div className="min-w-0 rounded-[2rem] border border-white/10 bg-white/[0.06] p-4 shadow-app backdrop-blur-xl sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-black uppercase tracking-normal text-malt">Rapportera pris</p>
            <h2 className="mt-1 text-3xl font-black text-foam">Ser du ett bättre pris?</h2>
            <p className="mt-2 max-w-sm text-sm font-semibold leading-6 text-foam/60">Skicka in det på 20 sekunder. Admin granskar innan det syns.</p>
          </div>
          <div className="hidden rounded-3xl bg-night/50 px-4 py-3 text-right ring-1 ring-white/10 sm:block">
            <p className="text-xs font-black uppercase text-foam/40">Preview</p>
            <p className="mt-1 text-xl font-black text-lager">{calculatedPrice ?? "Fyll i"}</p>
          </div>
        </div>

        <form
          className="mt-5 grid min-w-0 gap-5"
          onSubmit={async (event) => {
            event.preventDefault();
            setSubmitState("submitting");
            setMessage("");

            const price = parsePositiveDecimal(priceSek);
            const volume = parsePositiveDecimal(volumeCl);
            const venueName = newVenueName.trim();

            if (venueMode === "existing" && !selectedVenue) {
              setMessage("Välj ställe eller lägg till ett nytt.");
              setSubmitState("error");
              return;
            }

            if (venueMode === "new" && !venueName) {
              setMessage("Skriv namnet på stället.");
              setSubmitState("error");
              return;
            }

            if (!beerName.trim()) {
              setMessage("Skriv öl eller prisnamn.");
              setSubmitState("error");
              return;
            }

            if (price == null) {
              setMessage("Priset måste vara större än 0.");
              setSubmitState("error");
              return;
            }

            if (volume == null) {
              setMessage("Volymen måste vara större än 0.");
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
                    ? "Tack, priset är inskickat."
                    : "Tack, priset är kontrollerat. Databasen sparar när den är ansluten."
                  : "Rapporten kunde inte skickas. Försök igen.",
              );

              if (result.ok) {
                setBeerName("");
                setPriceSek("");
                setComment("");
                setNewVenueName("");
              }
            } catch {
              setMessage("Rapporten kunde inte skickas. Försök igen.");
              setSubmitState("error");
            }
          }}
        >
          <div className="min-w-0 rounded-3xl bg-night/45 p-4 ring-1 ring-white/10">
            <StepLabel number="1" title="Var såg du priset?" />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                className={`min-h-12 rounded-2xl px-3 text-sm font-black ${
                  venueMode === "existing" ? "bg-malt text-night" : "bg-white/[0.08] text-foam/70 ring-1 ring-white/10"
                }`}
                type="button"
                onClick={() => setVenueMode("existing")}
                disabled={venues.length === 0}
              >
                Befintligt
              </button>
              <button
                className={`min-h-12 rounded-2xl px-3 text-sm font-black ${
                  venueMode === "new" ? "bg-malt text-night" : "bg-white/[0.08] text-foam/70 ring-1 ring-white/10"
                }`}
                type="button"
                onClick={() => setVenueMode("new")}
              >
                Nytt ställe
              </button>
            </div>

            <div className="mt-3">
              {venueMode === "existing" ? (
                <label className={labelClass}>
                  Ställe
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
                </label>
              ) : (
                <label className={labelClass}>
                  Nytt ställe
                  <input className={inputClass} value={newVenueName} onChange={(event) => setNewVenueName(event.target.value)} placeholder="Exempelbaren" required />
                </label>
              )}
            </div>
          </div>

          <div className="min-w-0 rounded-3xl bg-night/45 p-4 ring-1 ring-white/10">
            <StepLabel number="2" title="Vad kostade det?" />
            <div className="mt-4 grid min-w-0 grid-cols-2 gap-3">
              <label className={labelClass}>
                Pris
                <input className={inputClass} inputMode="decimal" value={priceSek} onChange={(event) => setPriceSek(event.target.value)} placeholder="69" required />
              </label>
              <label className={labelClass}>
                Volym
                <input className={inputClass} inputMode="decimal" value={volumeCl} onChange={(event) => setVolumeCl(event.target.value)} placeholder="40" required />
              </label>
            </div>
            <div className="mt-3 min-w-0 rounded-2xl bg-white/[0.08] px-4 py-3 ring-1 ring-white/10">
              <p className="text-xs font-black uppercase text-foam/40">Kr/liter</p>
              <p className="mt-1 text-2xl font-black text-lager">{calculatedPrice ?? "Fyll i pris och volym"}</p>
            </div>
          </div>

          <div className="min-w-0 rounded-3xl bg-night/45 p-4 ring-1 ring-white/10">
            <StepLabel number="3" title="Vilken bira?" />
            <div className="mt-4 grid gap-3">
              <label className={labelClass}>
                Öl eller prisnamn
                <input className={inputClass} value={beerName} onChange={(event) => setBeerName(event.target.value)} placeholder="Stor stark" required />
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
              <label className={labelClass}>
                Kommentar
                <textarea
                  className={`${inputClass} min-h-24`}
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder="Till exempel tid, dag eller villkor."
                />
              </label>
            </div>
          </div>

          <button
            className="min-h-14 rounded-2xl bg-malt px-5 text-base font-black text-night shadow-soft hover:bg-lager disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-foam/40"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Skickar..." : "Skicka in pris"}
          </button>

          {message && (
            <div className={`rounded-3xl border px-4 py-4 text-sm font-bold ${messageClass(submitState)}`}>
              <p className="text-base font-black">{canShowSuccess ? "Klart" : submitState === "error" ? "Något saknas" : "Status"}</p>
              <p className="mt-1 text-foam/70">{message}</p>
            </div>
          )}
        </form>
      </div>
    </section>
  );
}
