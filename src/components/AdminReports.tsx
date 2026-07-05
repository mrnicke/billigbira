import { useEffect, useMemo, useState, type ComponentProps } from "react";
import { beerStyleLabels, getActiveBeers } from "../lib/data/beers";
import {
  approveReport,
  archiveBeerPrice,
  getAdminBeerPrices,
  getAdminVenues,
  getCurrentUser,
  getReportStatusCounts,
  getReportsByStatus,
  markBeerPriceVerified,
  onAdminAuthChange,
  rejectReport,
  signInAdmin,
  signOutAdmin,
  type AdminBeerPrice,
  type AdminPriceReport,
  type AdminReportStatusFilter,
} from "../lib/data/admin";
import { formatSek } from "../lib/pricing";
import {
  PRICE_TYPE_LABELS,
  SOURCE_TYPE_LABELS,
  type BeerCatalogItem,
  type BeerPriceSourceType,
  type BeerPriceType,
  type ReportStatus,
  type Venue,
} from "../lib/types";

type AuthState = "checking" | "signedOut" | "signedIn";
type Feedback = {
  tone: "success" | "error" | "info";
  text: string;
};
type FormSubmitEvent = Parameters<NonNullable<ComponentProps<"form">["onSubmit"]>>[0];
type VenueMode = "existing" | "new";

type ReportEditState = {
  venueMode: VenueMode;
  venueId: string;
  venueName: string;
  beerId: string;
  beerName: string;
  priceSek: string;
  volumeCl: string;
  volumeIsVerified: boolean;
  priceType: BeerPriceType;
  sourceType: BeerPriceSourceType;
  sourceUrl: string;
  observedAt: string;
  reporterNote: string;
  adminNote: string;
};

type RejectState = {
  reason: string;
  customReason: string;
};

const validPriceTypes: BeerPriceType[] = ["regular", "after_work", "campaign", "unknown"];
const validSourceTypes: BeerPriceSourceType[] = ["reported", "menu", "website"];

const statusLabels: Record<ReportStatus, string> = {
  pending: "Väntar",
  approved: "Godkänd",
  rejected: "Avvisad",
  archived: "Arkiverad",
};

const statusFilters: AdminReportStatusFilter[] = ["pending", "approved", "rejected", "archived", "all"];

const rejectionReasons = [
  { value: "fel pris", label: "Fel pris" },
  { value: "dublett", label: "Dublett" },
  { value: "oklart ställe", label: "Oklart ställe" },
  { value: "inte ölpris", label: "Inte ölpris" },
  { value: "annat", label: "Annat" },
];

const inputClass = "rounded-md border border-black/15 bg-white px-3 py-3 font-medium text-ink";
const labelClass = "grid gap-2 text-sm font-bold text-ink";

function parsePositiveDecimal(value: string): number | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed.replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function formatDate(value?: string | null) {
  if (!value) {
    return "Ej angivet";
  }

  return new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function dateInputValue(value?: string | null) {
  return value ? value.slice(0, 10) : "";
}

function decimalValue(value?: number | null) {
  return value == null ? "" : Number(value).toString();
}

function feedbackClass(tone: Feedback["tone"]) {
  if (tone === "success") {
    return "bg-hop/10 text-hop ring-hop/20";
  }

  if (tone === "error") {
    return "bg-copper/10 text-copper ring-copper/20";
  }

  return "bg-white text-ink/70 ring-black/10";
}

function statusBadgeClass(status: ReportStatus) {
  if (status === "approved") {
    return "bg-hop text-white";
  }

  if (status === "rejected" || status === "archived") {
    return "bg-copper text-white";
  }

  return "bg-white text-ink ring-1 ring-black/15";
}

function getVenueDisplayName(report: AdminPriceReport) {
  return report.venue?.name || report.venue_name;
}

function getBeerDisplayName(item: Pick<AdminPriceReport | AdminBeerPrice, "beer" | "beer_name">) {
  return item.beer?.name || item.beer_name || "Ej angivet";
}

function makeInitialEditState(report: AdminPriceReport): ReportEditState {
  return {
    venueMode: report.venue_id ? "existing" : "new",
    venueId: report.venue_id ?? "",
    venueName: report.venue?.name || report.venue_name,
    beerId: report.beer_id ?? "",
    beerName: report.beer_name ?? "",
    priceSek: decimalValue(report.price_sek),
    volumeCl: decimalValue(report.volume_cl),
    volumeIsVerified: report.volume_is_verified,
    priceType: report.price_type,
    sourceType: report.source_type,
    sourceUrl: report.source_url ?? "",
    observedAt: dateInputValue(report.observed_at),
    reporterNote: report.reporter_note ?? "",
    adminNote: report.admin_note ?? "",
  };
}

function makeInitialRejectState(): RejectState {
  return {
    reason: rejectionReasons[0].value,
    customReason: "",
  };
}

function changedText(current: string | number | null | undefined, original: string | number | null | undefined) {
  return String(current ?? "").trim() !== String(original ?? "").trim();
}

function OriginalValue({ show, value }: { show: boolean; value: string }) {
  if (!show) {
    return null;
  }

  return <span className="text-xs font-semibold text-copper">Rapporterat: {value}</span>;
}

export default function AdminReports() {
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [reports, setReports] = useState<AdminPriceReport[]>([]);
  const [reportStatusFilter, setReportStatusFilter] = useState<AdminReportStatusFilter>("pending");
  const [reportCounts, setReportCounts] = useState<Record<ReportStatus, number>>({
    pending: 0,
    approved: 0,
    rejected: 0,
    archived: 0,
  });
  const [venues, setVenues] = useState<Venue[]>([]);
  const [beers, setBeers] = useState<BeerCatalogItem[]>([]);
  const [adminPrices, setAdminPrices] = useState<AdminBeerPrice[]>([]);
  const [editStates, setEditStates] = useState<Record<string, ReportEditState>>({});
  const [rejectStates, setRejectStates] = useState<Record<string, RejectState>>({});
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [actionReportId, setActionReportId] = useState<string | null>(null);
  const [actionPriceId, setActionPriceId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const reportCountLabel = useMemo(() => {
    if (reports.length === 1) {
      return "1 rapport";
    }

    return `${reports.length} rapporter`;
  }, [reports.length]);

  async function loadAdminData(status = reportStatusFilter) {
    setIsLoadingReports(true);
    setFeedback(null);

    const [reportsResult, countsResult, venuesResult, pricesResult, beersResult] = await Promise.all([
      getReportsByStatus(status),
      getReportStatusCounts(),
      getAdminVenues(),
      getAdminBeerPrices(),
      getActiveBeers(),
    ]);

    setReports(reportsResult.reports);
    setReportCounts(countsResult.counts);
    setVenues(venuesResult.venues);
    setAdminPrices(pricesResult.prices);
    setBeers(beersResult);
    setEditStates((current) => {
      const next = { ...current };

      for (const report of reportsResult.reports) {
        next[report.id] ??= makeInitialEditState(report);
      }

      return next;
    });
    setRejectStates((current) => {
      const next = { ...current };

      for (const report of reportsResult.reports) {
        next[report.id] ??= makeInitialRejectState();
      }

      return next;
    });
    setIsLoadingReports(false);

    const failedResult = [reportsResult, countsResult, venuesResult, pricesResult].find((result) => !result.ok);
    if (failedResult?.message) {
      setFeedback({ tone: "error", text: failedResult.message });
    }
  }

  useEffect(() => {
    let isMounted = true;

    getCurrentUser().then((user) => {
      if (isMounted) {
        setAuthState(user ? "signedIn" : "signedOut");
      }
    });

    const subscription = onAdminAuthChange((user) => {
      setAuthState(user ? "signedIn" : "signedOut");

      if (!user) {
        setReports([]);
        setAdminPrices([]);
      }
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (authState === "signedIn") {
      void loadAdminData(reportStatusFilter);
    }
  }, [authState, reportStatusFilter]);

  function updateEditState(reportId: string, patch: Partial<ReportEditState>) {
    setEditStates((current) => ({
      ...current,
      [reportId]: {
        ...(current[reportId] ?? makeInitialEditState(reports.find((report) => report.id === reportId)!)),
        ...patch,
      },
    }));
  }

  function updateRejectState(reportId: string, patch: Partial<RejectState>) {
    setRejectStates((current) => ({
      ...current,
      [reportId]: {
        ...(current[reportId] ?? makeInitialRejectState()),
        ...patch,
      },
    }));
  }

  async function handleSignIn(event: FormSubmitEvent) {
    event.preventDefault();
    setFeedback(null);

    const result = await signInAdmin(email, password);

    if (!result.ok) {
      setFeedback({ tone: "error", text: result.message ?? "Inloggningen misslyckades." });
      return;
    }

    setPassword("");
    setAuthState("signedIn");
  }

  async function handleSignOut() {
    await signOutAdmin();
    setReports([]);
    setAdminPrices([]);
    setAuthState("signedOut");
    setFeedback({ tone: "info", text: "Du är utloggad." });
  }

  function validateReportEdit(report: AdminPriceReport, edit: ReportEditState) {
    const selectedVenue = edit.venueMode === "existing" ? venues.find((venue) => venue.id === edit.venueId) : null;
    const selectedBeer = edit.beerId ? beers.find((beer) => beer.id === edit.beerId) : null;
    const venueName = edit.venueMode === "existing" ? selectedVenue?.name ?? "" : edit.venueName.trim();
    const price = parsePositiveDecimal(edit.priceSek);
    const volume = parsePositiveDecimal(edit.volumeCl);

    if (!venueName) {
      return { ok: false as const, message: "Serveringsställe krävs." };
    }

    if (price == null) {
      return { ok: false as const, message: "Pris måste vara större än 0." };
    }

    if (edit.volumeCl.trim() && volume == null) {
      return { ok: false as const, message: "Volym måste vara större än 0 om den anges." };
    }

    if (!validPriceTypes.includes(edit.priceType)) {
      return { ok: false as const, message: "Pristypen är inte giltig." };
    }

    if (!validSourceTypes.includes(edit.sourceType)) {
      return { ok: false as const, message: "Källan är inte giltig." };
    }

    return {
      ok: true as const,
      overrides: {
        venue_id: selectedVenue?.id ?? null,
        venue_name: venueName,
        price_sek: price,
        beer_id: selectedBeer?.id ?? null,
        beer_name: selectedBeer?.name || edit.beerName.trim() || null,
        volume_cl: volume,
        volume_is_verified: volume != null && edit.volumeIsVerified,
        price_type: edit.priceType,
        source_type: edit.sourceType,
        source_url: edit.sourceUrl.trim() || null,
        observed_at: edit.observedAt || report.observed_at || null,
        reporter_note: edit.reporterNote.trim() || null,
        admin_note: edit.adminNote.trim() || null,
      },
    };
  }

  async function handleApprove(report: AdminPriceReport, verifyAdmin: boolean) {
    const edit = editStates[report.id] ?? makeInitialEditState(report);
    const validation = validateReportEdit(report, edit);

    if (!validation.ok) {
      setFeedback({ tone: "error", text: validation.message });
      return;
    }

    setActionReportId(report.id);
    setFeedback(null);

    const result = await approveReport(report.id, validation.overrides, verifyAdmin);

    setActionReportId(null);

    if (!result.ok) {
      setFeedback({ tone: "error", text: result.message ?? "Rapporten kunde inte godkännas." });
      return;
    }

    setFeedback({ tone: "success", text: verifyAdmin ? "Rapporten publicerades som verifierad." : "Rapporten publicerades utan adminverifiering." });
    await loadAdminData(reportStatusFilter);
  }

  async function handleReject(reportId: string) {
    const rejectState = rejectStates[reportId] ?? makeInitialRejectState();
    const reason = rejectState.reason === "annat" ? rejectState.customReason.trim() : rejectState.reason;

    if (!reason) {
      setFeedback({ tone: "error", text: "Ange en avvisningsorsak." });
      return;
    }

    setActionReportId(reportId);
    setFeedback(null);

    const result = await rejectReport(reportId, reason);

    setActionReportId(null);

    if (!result.ok) {
      setFeedback({ tone: "error", text: result.message ?? "Rapporten kunde inte avvisas." });
      return;
    }

    setFeedback({ tone: "success", text: "Rapporten avvisades." });
    await loadAdminData(reportStatusFilter);
  }

  async function handleMarkVerified(priceId: string) {
    setActionPriceId(priceId);
    setFeedback(null);

    const result = await markBeerPriceVerified(priceId);

    setActionPriceId(null);

    if (!result.ok) {
      setFeedback({ tone: "error", text: result.message ?? "Priset kunde inte verifieras." });
      return;
    }

    setFeedback({ tone: "success", text: "Priset markerades som verifierat." });
    await loadAdminData(reportStatusFilter);
  }

  async function handleArchive(priceId: string) {
    setActionPriceId(priceId);
    setFeedback(null);

    const result = await archiveBeerPrice(priceId);

    setActionPriceId(null);

    if (!result.ok) {
      setFeedback({ tone: "error", text: result.message ?? "Priset kunde inte arkiveras." });
      return;
    }

    setFeedback({ tone: "success", text: "Priset arkiverades och döljs publikt." });
    await loadAdminData(reportStatusFilter);
  }

  if (authState === "checking") {
    return (
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="rounded-lg border border-black/10 bg-white p-6 shadow-sm">
          <p className="text-sm font-bold uppercase tracking-normal text-copper">Admin</p>
          <h1 className="mt-3 text-3xl font-black text-ink">Kontrollerar session...</h1>
        </div>
      </section>
    );
  }

  if (authState === "signedOut") {
    return (
      <section className="mx-auto max-w-xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="rounded-lg border border-black/10 bg-white p-5 shadow-soft sm:p-6">
          <p className="text-sm font-bold uppercase tracking-normal text-copper">Admin</p>
          <h1 className="mt-3 text-3xl font-black text-ink">Logga in för moderering</h1>
          <form className="mt-6 grid gap-4" onSubmit={handleSignIn}>
            <label className={labelClass}>
              E-post
              <input className={inputClass} type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </label>
            <label className={labelClass}>
              Lösenord
              <input
                className={inputClass}
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            <button className="rounded-md bg-hop px-4 py-3 font-black text-white hover:bg-ink" type="submit">
              Logga in
            </button>
          </form>
          {feedback && <p className={`mt-4 rounded-md px-4 py-3 text-sm font-semibold ring-1 ${feedbackClass(feedback.tone)}`}>{feedback.text}</p>}
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-normal text-copper">Admin</p>
          <h1 className="mt-3 text-4xl font-black text-ink sm:text-5xl">Moderera priser</h1>
          <p className="mt-3 text-base leading-7 text-ink/70">
            Publicera billigaste kända pris per ställe, verifiera separat och arkivera historik utan hårdradering.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            className="rounded-md border border-black/15 bg-white px-4 py-3 font-black text-ink hover:border-hop hover:text-hop"
            type="button"
            onClick={() => loadAdminData(reportStatusFilter)}
            disabled={isLoadingReports}
          >
            {isLoadingReports ? "Uppdaterar..." : "Uppdatera"}
          </button>
          <button className="rounded-md bg-ink px-4 py-3 font-black text-white hover:bg-hop" type="button" onClick={handleSignOut}>
            Logga ut
          </button>
        </div>
      </div>

      {feedback && <p className={`mt-6 rounded-md px-4 py-3 text-sm font-semibold ring-1 ${feedbackClass(feedback.tone)}`}>{feedback.text}</p>}

      <div className="mt-8 rounded-lg border border-black/10 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-black text-ink">Rapporter</h2>
            <p className="mt-1 text-sm font-bold text-ink/60">{isLoadingReports ? "Laddar..." : reportCountLabel}</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-5">
            {statusFilters.map((filter) => {
              const count = filter === "all" ? Object.values(reportCounts).reduce((sum, value) => sum + value, 0) : reportCounts[filter];
              const isSelected = reportStatusFilter === filter;

              return (
                <button
                  key={filter}
                  className={`rounded-md px-3 py-2 text-sm font-black ${
                    isSelected ? "bg-ink text-white" : "border border-black/15 bg-white text-ink hover:border-hop hover:text-hop"
                  }`}
                  type="button"
                  onClick={() => setReportStatusFilter(filter)}
                >
                  {filter === "all" ? "Alla" : statusLabels[filter]} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {!isLoadingReports && reports.length === 0 && (
          <div className="mt-5 rounded-lg bg-foam p-6 text-center">
            <h3 className="text-xl font-black text-ink">Inga rapporter i filtret</h3>
            <p className="mt-2 text-ink/70">Byt filter för att se historik eller vänta på nya publika rapporter.</p>
          </div>
        )}

        {reports.length > 0 && (
          <div className="mt-5 grid gap-4">
            {reports.map((report) =>
              report.status === "pending" ? (
                <PendingReportCard
                  key={report.id}
                  report={report}
                  venues={venues}
                  beers={beers}
                  edit={editStates[report.id] ?? makeInitialEditState(report)}
                  rejectState={rejectStates[report.id] ?? makeInitialRejectState()}
                  isBusy={actionReportId === report.id}
                  onEdit={(patch) => updateEditState(report.id, patch)}
                  onRejectEdit={(patch) => updateRejectState(report.id, patch)}
                  onApprove={() => handleApprove(report, false)}
                  onApproveVerified={() => handleApprove(report, true)}
                  onReject={() => handleReject(report.id)}
                />
              ) : (
                <HistoryReportCard key={report.id} report={report} />
              ),
            )}
          </div>
        )}
      </div>

      <div className="mt-8 rounded-lg border border-black/10 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-black text-ink">Prisposter</h2>
            <p className="mt-1 text-sm font-semibold text-ink/60">Senaste 100 posterna. Bara godkända aktuella poster visas publikt.</p>
          </div>
          <span className="w-fit rounded-full bg-foam px-3 py-1 text-xs font-black text-ink ring-1 ring-black/10">{adminPrices.length} poster</span>
        </div>

        {adminPrices.length === 0 && !isLoadingReports && (
          <div className="mt-5 rounded-lg bg-foam p-6 text-center">
            <h3 className="text-xl font-black text-ink">Inga priser att visa</h3>
            <p className="mt-2 text-ink/70">När godkända priser finns i databasen visas de här.</p>
          </div>
        )}

        {adminPrices.length > 0 && (
          <div className="mt-5 grid gap-3">
            {adminPrices.map((price) => (
              <article key={price.id} className="rounded-lg border border-black/10 bg-foam p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="grid gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xl font-black text-ink">{price.venue.name}</h3>
                      <span className={`rounded-full px-3 py-1 text-xs font-black ${statusBadgeClass(price.status)}`}>{statusLabels[price.status]}</span>
                      <span className={`rounded-full px-3 py-1 text-xs font-black ${price.is_current_cheapest ? "bg-hop text-white" : "bg-white text-ink ring-1 ring-black/15"}`}>
                        {price.is_current_cheapest ? "Aktuell billigast" : "Historik"}
                      </span>
                      <span className={`rounded-full px-3 py-1 text-xs font-black ${price.admin_verified ? "bg-hop text-white" : "bg-white text-ink ring-1 ring-black/15"}`}>
                        {price.admin_verified ? "Verifierad" : "Ej verifierad"}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-ink/70">
                      {formatSek(price.price_sek)} · {PRICE_TYPE_LABELS[price.price_type]} · Källa: {SOURCE_TYPE_LABELS[price.source_type]} · {getBeerDisplayName(price)}
                      {price.volume_is_verified && price.volume_cl != null ? ` · ${price.volume_cl} cl` : ""}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    {!price.admin_verified && price.status === "approved" && (
                      <button
                        className="rounded-md bg-hop px-4 py-3 font-black text-white hover:bg-ink disabled:cursor-not-allowed disabled:bg-ink/40"
                        type="button"
                        onClick={() => handleMarkVerified(price.id)}
                        disabled={actionPriceId === price.id}
                      >
                        Markera verifierad
                      </button>
                    )}
                    {price.status === "approved" && price.is_current_cheapest && (
                      <button
                        className="rounded-md border border-copper bg-white px-4 py-3 font-black text-copper hover:bg-copper hover:text-white disabled:cursor-not-allowed disabled:border-ink/30 disabled:text-ink/40"
                        type="button"
                        onClick={() => handleArchive(price.id)}
                        disabled={actionPriceId === price.id}
                      >
                        Arkivera
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function PendingReportCard({
  report,
  venues,
  beers,
  edit,
  rejectState,
  isBusy,
  onEdit,
  onRejectEdit,
  onApprove,
  onApproveVerified,
  onReject,
}: {
  report: AdminPriceReport;
  venues: Venue[];
  beers: BeerCatalogItem[];
  edit: ReportEditState;
  rejectState: RejectState;
  isBusy: boolean;
  onEdit: (patch: Partial<ReportEditState>) => void;
  onRejectEdit: (patch: Partial<RejectState>) => void;
  onApprove: () => void;
  onApproveVerified: () => void;
  onReject: () => void;
}) {
  const selectedVenue = venues.find((venue) => venue.id === edit.venueId) ?? null;
  const selectedBeer = beers.find((beer) => beer.id === edit.beerId) ?? null;

  return (
    <article className="rounded-lg border border-black/10 bg-foam p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-2xl font-black text-ink">{getVenueDisplayName(report)}</h3>
            <span className={`rounded-full px-3 py-1 text-xs font-black ${statusBadgeClass(report.status)}`}>{statusLabels[report.status]}</span>
          </div>
          <p className="mt-1 text-sm font-semibold text-ink/60">Rapporterad {formatDate(report.created_at)}</p>
          <p className="mt-1 text-sm font-semibold text-ink/60">
            {formatSek(report.price_sek)} · {PRICE_TYPE_LABELS[report.price_type]} · Källa: {SOURCE_TYPE_LABELS[report.source_type]}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <fieldset className="grid gap-3 rounded-md bg-white p-3 lg:col-span-2">
          <legend className="px-1 text-sm font-black text-ink">Serveringsställe</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-3 rounded-md border border-black/15 px-3 py-3 text-sm font-bold text-ink">
              <input type="radio" checked={edit.venueMode === "existing"} onChange={() => onEdit({ venueMode: "existing" })} disabled={venues.length === 0} />
              Koppla till befintligt ställe
            </label>
            <label className="flex items-center gap-3 rounded-md border border-black/15 px-3 py-3 text-sm font-bold text-ink">
              <input type="radio" checked={edit.venueMode === "new"} onChange={() => onEdit({ venueMode: "new", venueId: "" })} />
              Använd nytt ställe
            </label>
          </div>
          {edit.venueMode === "existing" ? (
            <label className={labelClass}>
              Befintligt ställe
              <select className={inputClass} value={edit.venueId} onChange={(event) => onEdit({ venueId: event.target.value })}>
                <option value="">Välj ställe</option>
                {venues.map((venue) => (
                  <option key={venue.id} value={venue.id}>
                    {venue.name}
                  </option>
                ))}
              </select>
              <OriginalValue show={changedText(selectedVenue?.name, getVenueDisplayName(report))} value={getVenueDisplayName(report)} />
            </label>
          ) : (
            <label className={labelClass}>
              Nytt ställe
              <input className={inputClass} value={edit.venueName} onChange={(event) => onEdit({ venueName: event.target.value })} />
              <OriginalValue show={changedText(edit.venueName, getVenueDisplayName(report))} value={getVenueDisplayName(report)} />
            </label>
          )}
        </fieldset>

        <label className={labelClass}>
          Pris i kronor
          <input className={inputClass} inputMode="decimal" value={edit.priceSek} onChange={(event) => onEdit({ priceSek: event.target.value })} />
          <OriginalValue show={changedText(edit.priceSek, decimalValue(report.price_sek))} value={formatSek(report.price_sek)} />
        </label>
        <label className={labelClass}>
          Pristyp
          <select className={inputClass} value={edit.priceType} onChange={(event) => onEdit({ priceType: event.target.value as BeerPriceType })}>
            {validPriceTypes.map((priceType) => (
              <option key={priceType} value={priceType}>
                {PRICE_TYPE_LABELS[priceType]}
              </option>
            ))}
          </select>
          <OriginalValue show={edit.priceType !== report.price_type} value={PRICE_TYPE_LABELS[report.price_type]} />
        </label>
        <label className={labelClass}>
          Källa
          <select className={inputClass} value={edit.sourceType} onChange={(event) => onEdit({ sourceType: event.target.value as BeerPriceSourceType })}>
            {validSourceTypes.map((sourceType) => (
              <option key={sourceType} value={sourceType}>
                {SOURCE_TYPE_LABELS[sourceType]}
              </option>
            ))}
          </select>
          <OriginalValue show={edit.sourceType !== report.source_type} value={SOURCE_TYPE_LABELS[report.source_type]} />
        </label>
        <label className={labelClass}>
          Källänk
          <input className={inputClass} inputMode="url" value={edit.sourceUrl} onChange={(event) => onEdit({ sourceUrl: event.target.value })} />
          <OriginalValue show={changedText(edit.sourceUrl, report.source_url)} value={report.source_url || "Ingen länk"} />
        </label>
        <label className={labelClass}>
          Katalogöl
          <select
            className={inputClass}
            value={edit.beerId}
            onChange={(event) => {
              const beer = beers.find((item) => item.id === event.target.value);
              onEdit({ beerId: event.target.value, beerName: beer?.name ?? edit.beerName });
            }}
          >
            <option value="">Ingen katalogkoppling</option>
            {beers.map((beer) => (
              <option key={beer.id} value={beer.id}>
                {beer.name} · {beerStyleLabels[beer.style]}
              </option>
            ))}
          </select>
          <OriginalValue show={changedText(selectedBeer?.name, report.beer?.name || report.beer_name)} value={report.beer?.name || report.beer_name || "Ingen öl"} />
        </label>
        {!selectedBeer && (
          <label className={labelClass}>
            Öltyp eller namn
            <input className={inputClass} value={edit.beerName} onChange={(event) => onEdit({ beerName: event.target.value })} />
            <OriginalValue show={changedText(edit.beerName, report.beer_name)} value={report.beer_name || "Ingen öl"} />
          </label>
        )}
        <label className={labelClass}>
          Volym i cl
          <input className={inputClass} inputMode="decimal" value={edit.volumeCl} onChange={(event) => onEdit({ volumeCl: event.target.value })} />
          <OriginalValue show={changedText(edit.volumeCl, decimalValue(report.volume_cl))} value={report.volume_cl == null ? "Ingen volym" : `${report.volume_cl} cl`} />
        </label>
        <label className="flex min-h-[3.25rem] items-center gap-3 self-end rounded-md border border-black/15 bg-white px-3 text-sm font-bold text-ink">
          <input className="size-4 accent-hop" type="checkbox" checked={edit.volumeIsVerified} onChange={(event) => onEdit({ volumeIsVerified: event.target.checked })} />
          Volym verifierad
        </label>
        <label className={labelClass}>
          Observerat datum
          <input className={inputClass} type="date" value={edit.observedAt} onChange={(event) => onEdit({ observedAt: event.target.value })} />
          <OriginalValue show={changedText(edit.observedAt, dateInputValue(report.observed_at))} value={formatDate(report.observed_at)} />
        </label>
        <label className={`${labelClass} lg:col-span-2`}>
          Kommentar
          <textarea className={`${inputClass} min-h-24`} value={edit.reporterNote} onChange={(event) => onEdit({ reporterNote: event.target.value })} />
          <OriginalValue show={changedText(edit.reporterNote, report.reporter_note)} value={report.reporter_note || "Ingen kommentar"} />
        </label>
        <label className={`${labelClass} lg:col-span-2`}>
          Adminnotering
          <textarea className={`${inputClass} min-h-24`} value={edit.adminNote} onChange={(event) => onEdit({ adminNote: event.target.value })} />
        </label>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto_auto_auto] lg:items-end">
        <label className={labelClass}>
          Avvisningsorsak
          <select className={inputClass} value={rejectState.reason} onChange={(event) => onRejectEdit({ reason: event.target.value })}>
            {rejectionReasons.map((reason) => (
              <option key={reason.value} value={reason.value}>
                {reason.label}
              </option>
            ))}
          </select>
        </label>
        {rejectState.reason === "annat" && (
          <label className={labelClass}>
            Annan orsak
            <input className={inputClass} value={rejectState.customReason} onChange={(event) => onRejectEdit({ customReason: event.target.value })} />
          </label>
        )}
        <button
          className="rounded-md bg-hop px-4 py-3 font-black text-white hover:bg-ink disabled:cursor-not-allowed disabled:bg-ink/40"
          type="button"
          onClick={onApprove}
          disabled={isBusy}
        >
          Godkänn och visa
        </button>
        <button
          className="rounded-md bg-ink px-4 py-3 font-black text-white hover:bg-hop disabled:cursor-not-allowed disabled:bg-ink/40"
          type="button"
          onClick={onApproveVerified}
          disabled={isBusy}
        >
          Godkänn som verifierad
        </button>
        <button
          className="rounded-md border border-copper bg-white px-4 py-3 font-black text-copper hover:bg-copper hover:text-white disabled:cursor-not-allowed disabled:border-ink/30 disabled:text-ink/40"
          type="button"
          onClick={onReject}
          disabled={isBusy}
        >
          Avvisa
        </button>
      </div>
    </article>
  );
}

function HistoryReportCard({ report }: { report: AdminPriceReport }) {
  return (
    <article className="rounded-lg border border-black/10 bg-foam p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-black text-ink">{getVenueDisplayName(report)}</h3>
            <span className={`rounded-full px-3 py-1 text-xs font-black ${statusBadgeClass(report.status)}`}>{statusLabels[report.status]}</span>
          </div>
          <p className="mt-2 text-sm font-semibold text-ink/70">
            {formatSek(report.price_sek)} · {PRICE_TYPE_LABELS[report.price_type]} · Källa: {SOURCE_TYPE_LABELS[report.source_type]} · {getBeerDisplayName(report)}
            {report.volume_is_verified && report.volume_cl != null ? ` · ${report.volume_cl} cl` : ""}
          </p>
          <p className="mt-1 text-sm text-ink/60">
            Granskad {formatDate(report.reviewed_at)} {report.rejection_reason ? `· Orsak: ${report.rejection_reason}` : ""}
          </p>
        </div>
      </div>
    </article>
  );
}
