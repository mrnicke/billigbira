import { useEffect, useMemo, useState, type ComponentProps } from "react";
import {
  approveReport,
  getCurrentUser,
  getPendingReports,
  onAdminAuthChange,
  rejectReport,
  signInAdmin,
  signOutAdmin,
  type AdminPriceReport,
} from "../lib/data/admin";
import { formatPricePerLiter, formatSek } from "../lib/pricing";
import type { PriceType } from "../lib/types";

type AuthState = "checking" | "signedOut" | "signedIn";
type Feedback = {
  tone: "success" | "error" | "info";
  text: string;
};
type FormSubmitEvent = Parameters<NonNullable<ComponentProps<"form">["onSubmit"]>>[0];

const priceTypeLabels: Record<PriceType, string> = {
  normalpris: "Normalpris",
  after_work: "After work",
  happy_hour: "Happy hour",
  student: "Student",
  okänd: "Okänd",
};

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

function feedbackClass(tone: Feedback["tone"]) {
  if (tone === "success") {
    return "bg-hop/10 text-hop ring-hop/20";
  }

  if (tone === "error") {
    return "bg-copper/10 text-copper ring-copper/20";
  }

  return "bg-white text-ink/70 ring-black/10";
}

export default function AdminReports() {
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [reports, setReports] = useState<AdminPriceReport[]>([]);
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [actionReportId, setActionReportId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const reportCountLabel = useMemo(() => {
    if (reports.length === 1) {
      return "1 rapport väntar";
    }

    return `${reports.length} rapporter väntar`;
  }, [reports.length]);

  async function loadReports() {
    setIsLoadingReports(true);
    setFeedback(null);

    const result = await getPendingReports();

    setReports(result.reports);
    setIsLoadingReports(false);

    if (!result.ok && result.message) {
      setFeedback({ tone: "error", text: result.message });
    }
  }

  useEffect(() => {
    let isMounted = true;

    getCurrentUser().then((user) => {
      if (!isMounted) {
        return;
      }

      setAuthState(user ? "signedIn" : "signedOut");

      if (user) {
        void loadReports();
      }
    });

    const subscription = onAdminAuthChange((user) => {
      setAuthState(user ? "signedIn" : "signedOut");

      if (user) {
        void loadReports();
      } else {
        setReports([]);
      }
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

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
    await loadReports();
  }

  async function handleSignOut() {
    await signOutAdmin();
    setReports([]);
    setAuthState("signedOut");
    setFeedback({ tone: "info", text: "Du är utloggad." });
  }

  async function handleApprove(reportId: string) {
    setActionReportId(reportId);
    setFeedback(null);

    const result = await approveReport(reportId);

    setActionReportId(null);

    if (!result.ok) {
      setFeedback({ tone: "error", text: result.message ?? "Rapporten kunde inte godkännas." });
      return;
    }

    setFeedback({ tone: "success", text: "Rapporten godkändes och priset är verifierat." });
    await loadReports();
  }

  async function handleReject(reportId: string) {
    setActionReportId(reportId);
    setFeedback(null);

    const result = await rejectReport(reportId);

    setActionReportId(null);

    if (!result.ok) {
      setFeedback({ tone: "error", text: result.message ?? "Rapporten kunde inte avvisas." });
      return;
    }

    setFeedback({ tone: "success", text: "Rapporten avvisades." });
    await loadReports();
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
            <label className="grid gap-2 text-sm font-bold text-ink">
              E-post
              <input
                className="rounded-md border border-black/15 px-3 py-3 font-medium"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-ink">
              Lösenord
              <input
                className="rounded-md border border-black/15 px-3 py-3 font-medium"
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
          {feedback && (
            <p className={`mt-4 rounded-md px-4 py-3 text-sm font-semibold ring-1 ${feedbackClass(feedback.tone)}`}>
              {feedback.text}
            </p>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-normal text-copper">Admin</p>
          <h1 className="mt-3 text-4xl font-black text-ink sm:text-5xl">Moderera rapporter</h1>
          <p className="mt-3 text-base leading-7 text-ink/70">
            Godkända rapporter blir verifierade priser. Avvisade rapporter visas inte publikt.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            className="rounded-md border border-black/15 bg-white px-4 py-3 font-black text-ink hover:border-hop hover:text-hop"
            type="button"
            onClick={loadReports}
            disabled={isLoadingReports}
          >
            {isLoadingReports ? "Uppdaterar..." : "Uppdatera"}
          </button>
          <button className="rounded-md bg-ink px-4 py-3 font-black text-white hover:bg-hop" type="button" onClick={handleSignOut}>
            Logga ut
          </button>
        </div>
      </div>

      {feedback && (
        <p className={`mt-6 rounded-md px-4 py-3 text-sm font-semibold ring-1 ${feedbackClass(feedback.tone)}`}>
          {feedback.text}
        </p>
      )}

      <div className="mt-8 rounded-lg border border-black/10 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-2xl font-black text-ink">Väntande rapporter</h2>
          <p className="text-sm font-bold text-ink/60">{isLoadingReports ? "Laddar..." : reportCountLabel}</p>
        </div>

        {!isLoadingReports && reports.length === 0 && (
          <div className="mt-5 rounded-lg bg-foam p-6 text-center">
            <h3 className="text-xl font-black text-ink">Inga rapporter väntar</h3>
            <p className="mt-2 text-ink/70">När publika rapporter skickas in visas de här för granskning.</p>
          </div>
        )}

        {reports.length > 0 && (
          <div className="mt-5 grid gap-4">
            {reports.map((report) => (
              <article key={report.id} className="rounded-lg border border-black/10 bg-foam p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h3 className="text-2xl font-black text-ink">{report.venue_name}</h3>
                    <p className="mt-1 text-sm font-semibold text-ink/60">Rapporterad {formatDate(report.created_at)}</p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      className="rounded-md bg-hop px-4 py-3 font-black text-white hover:bg-ink disabled:cursor-not-allowed disabled:bg-ink/40"
                      type="button"
                      onClick={() => handleApprove(report.id)}
                      disabled={actionReportId === report.id}
                    >
                      {actionReportId === report.id ? "Hanterar..." : "Godkänn"}
                    </button>
                    <button
                      className="rounded-md border border-copper bg-white px-4 py-3 font-black text-copper hover:bg-copper hover:text-white disabled:cursor-not-allowed disabled:border-ink/30 disabled:text-ink/40"
                      type="button"
                      onClick={() => handleReject(report.id)}
                      disabled={actionReportId === report.id}
                    >
                      Avvisa
                    </button>
                  </div>
                </div>

                <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-md bg-white p-3">
                    <dt className="text-xs font-bold uppercase tracking-normal text-ink/50">Öl/prisnamn</dt>
                    <dd className="mt-1 font-black text-ink">{report.beer_name}</dd>
                  </div>
                  <div className="rounded-md bg-white p-3">
                    <dt className="text-xs font-bold uppercase tracking-normal text-ink/50">Pris</dt>
                    <dd className="mt-1 font-black text-ink">{formatSek(report.price_sek)}</dd>
                  </div>
                  <div className="rounded-md bg-white p-3">
                    <dt className="text-xs font-bold uppercase tracking-normal text-ink/50">Volym</dt>
                    <dd className="mt-1 font-black text-ink">{report.volume_cl} cl</dd>
                  </div>
                  <div className="rounded-md bg-white p-3">
                    <dt className="text-xs font-bold uppercase tracking-normal text-ink/50">Kr/liter</dt>
                    <dd className="mt-1 font-black text-hop">{formatPricePerLiter(report.price_per_liter_sek)}</dd>
                  </div>
                  <div className="rounded-md bg-white p-3">
                    <dt className="text-xs font-bold uppercase tracking-normal text-ink/50">Pristyp</dt>
                    <dd className="mt-1 font-black text-ink">{priceTypeLabels[report.price_type]}</dd>
                  </div>
                  <div className="rounded-md bg-white p-3">
                    <dt className="text-xs font-bold uppercase tracking-normal text-ink/50">Observerat</dt>
                    <dd className="mt-1 font-black text-ink">{formatDate(report.observed_at)}</dd>
                  </div>
                  <div className="rounded-md bg-white p-3 sm:col-span-2">
                    <dt className="text-xs font-bold uppercase tracking-normal text-ink/50">Kommentar</dt>
                    <dd className="mt-1 font-semibold text-ink/75">{report.reporter_note || "Ingen kommentar"}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
