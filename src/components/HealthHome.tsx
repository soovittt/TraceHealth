import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useStore } from "../lib/store";
import { Sparkline } from "./charts";
import { fmtDate, fmtNum, year } from "../lib/format";
import SignalsPanel from "./SignalsPanel";

// An AI entry point that opens the assistant dock and sends the question.
function AskBar({ placeholder }: { placeholder?: string }) {
  const { askAI } = useStore();
  const [q, setQ] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim()) {
          askAI(q.trim());
          setQ("");
        }
      }}
      className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 shadow-xs focus-within:border-accent-line"
    >
      <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0 text-accent" fill="currentColor">
        <path d="M8 1.5l1.2 3.3 3.3 1.2-3.3 1.2L8 10.5 6.8 7.2 3.5 6l3.3-1.2z" />
      </svg>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder ?? "Ask AI about your health — trends, risks, what changed…"}
        className="flex-1 bg-transparent text-sm outline-none placeholder:text-ink-400"
      />
      <button type="submit" className="btn-primary px-3 py-1.5 text-xs" disabled={!q.trim()}>
        Ask
      </button>
    </form>
  );
}

export default function HealthHome() {
  const { patientId, openMetric, showEvidence, go } = useStore();
  const patient = useQuery(api.health.getPatient, patientId ? { patientId } : "skip");
  const metrics = useQuery(api.health.listMetrics, patientId ? { patientId } : "skip");
  const timeline = useQuery(api.health.getTimeline, patientId ? { patientId } : "skip");
  const conflicts = useQuery(api.health.listConflicts, patientId ? { patientId } : "skip");
  const meds = useQuery(api.health.listMedications, patientId ? { patientId } : "skip");
  const conds = useQuery(api.health.listConditions, patientId ? { patientId } : "skip");

  if (!patient || !metrics) return <Skeleton />;

  // Empty record (a freshly signed-up user) → onboarding, not a barren dashboard.
  if (metrics.length === 0 && (timeline ?? []).length === 0) {
    return <EmptyRecord name={patient.name} go={go} />;
  }

  const openConflicts = (conflicts ?? []).filter((c: any) => c.status === "open");
  const recent = (timeline ?? []).slice(0, 9); // getTimeline is newest-first
  const medSeen = new Set<string>();
  const activeMeds = (meds ?? [])
    .filter((m: any) => m.status === "active")
    .sort((a: any, b: any) => (b.startDate ?? 0) - (a.startDate ?? 0))
    .filter((m: any) => (medSeen.has(m.normalizedName) ? false : (medSeen.add(m.normalizedName), true)));
  const seen = new Set<string>();
  const activeConds = (conds ?? [])
    .filter((c: any) => c.status === "active")
    .sort((a: any, b: any) => (b.diagnosedDate ?? 0) - (a.diagnosedDate ?? 0))
    .filter((c: any) => (seen.has(c.normalizedName) ? false : (seen.add(c.normalizedName), true)));

  const topMetrics = (() => {
    const primary = metrics.filter((m: any) => m.primary);
    return (primary.length ? primary : metrics).slice(0, 5);
  })();

  return (
    <div className="flex h-full w-full flex-col animate-fade-in">
      {/* compact header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">{patient.name}</h1>
          <div className="mt-0.5 flex items-center gap-2 text-2xs text-ink-500">
            <span>{patient.age} yr</span><Sep /><span className="mono">{patient.recordsFrom}</span>
            {patient.orgCount ? <><Sep /><span>{patient.orgCount} {patient.orgCount === 1 ? "org" : "orgs"}</span></> : null}
          </div>
        </div>
        {openConflicts.length > 0 && (
          <button onClick={() => go("conflicts")} className="flex items-center gap-2 rounded-md border border-warn-line bg-warn-soft px-2.5 py-1.5 text-xs font-medium text-warn hover:brightness-[0.98]">
            <span className="h-1.5 w-1.5 rounded-full bg-warn" />
            {openConflicts.length} to review
          </button>
        )}
      </div>

      <div className="mt-3.5">
        <AskBar />
      </div>

      {/* two-column cockpit — summaries that link out to full pages */}
      <div className="mt-3.5 grid min-h-0 flex-1 gap-3.5 lg:grid-cols-[1.5fr_1fr]">
        {/* LEFT */}
        <div className="flex min-h-0 flex-col gap-3.5">
          <SignalsPanel limit={4} />

          <section className="flex min-h-0 flex-1 flex-col">
            <SectionHead title="Recent activity" action="Timeline →" onClick={() => go("timeline")} />
            <div className="card flex-1 overflow-auto">
              {recent.slice(0, 6).map((it: any, i: number) => (
                <button
                  key={it.id}
                  onClick={() => it.documentId && showEvidence({ documentId: it.documentId, page: it.page })}
                  className={`flex w-full items-center gap-3 px-3.5 py-2 text-left hover:bg-line-soft ${i > 0 ? "border-t border-line-soft" : ""}`}
                >
                  <span className="mono w-[64px] shrink-0 text-2xs text-ink-400">{fmtDate(it.date)}</span>
                  <TypeTag type={it.type} />
                  <span className="min-w-0 flex-1 truncate text-sm text-ink-800">{it.title}</span>
                </button>
              ))}
            </div>
          </section>
        </div>

        {/* RIGHT */}
        <div className="flex min-h-0 flex-col gap-3.5">
          <section>
            <SectionHead title="Key metrics" action="Trends →" onClick={() => go("metric")} />
            <div className="card">
              {topMetrics.map((m: any, i: number) => {
                const rising = m.last > m.first;
                const bad = (m.direction === "high_bad" && rising) || (m.direction === "low_bad" && !rising);
                return (
                  <button key={m.code} onClick={() => openMetric(m.code)} className={`flex w-full items-center gap-2 px-3.5 py-1.5 text-left hover:bg-line-soft ${i > 0 ? "border-t border-line-soft" : ""}`}>
                    <span className="min-w-0 flex-1 truncate text-sm text-ink-700">{m.label}</span>
                    <span className="hidden h-5 w-14 sm:block"><SparkFromMetric code={m.code} /></span>
                    <span className="mono w-16 shrink-0 text-right text-sm font-medium text-ink-900">{fmtNum(m.last)}<span className="ml-0.5 text-2xs font-normal text-ink-400">{m.unit}</span></span>
                    {m.direction !== "neutral" && (
                      <span className={`mono w-11 shrink-0 text-right text-2xs ${bad ? "text-bad" : "text-good"}`}>{rising ? "↑" : "↓"}{Math.abs(m.changePct)}%</span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="flex min-h-0 flex-1 flex-col">
            <SectionHead title="Active meds & conditions" action="Timeline →" onClick={() => go("timeline")} />
            <div className="card flex-1 overflow-auto">
              {activeMeds.slice(0, 4).map((m: any, i: number) => (
                <button key={m._id} onClick={() => showEvidence({ documentId: m.documentId, page: m.page })} className={`flex w-full items-center justify-between px-3.5 py-1.5 text-left hover:bg-line-soft ${i > 0 ? "border-t border-line-soft" : ""}`}>
                  <span className="flex items-center gap-2 text-sm text-ink-800"><span className="tag shrink-0">Rx</span>{m.name}</span>
                  <span className="mono text-2xs text-ink-500">{m.dose ? `${m.dose} ${m.doseUnit}` : ""}</span>
                </button>
              ))}
              {activeConds.slice(0, 4).map((c: any, i: number) => (
                <button key={c._id} onClick={() => showEvidence({ documentId: c.documentId, page: c.page })} className="flex w-full items-center justify-between border-t border-line-soft px-3.5 py-1.5 text-left hover:bg-line-soft">
                  <span className="flex items-center gap-2 text-sm text-ink-800"><span className="tag shrink-0">Dx</span>{c.name}</span>
                  <span className="mono text-2xs text-ink-400">{c.diagnosedDate ? year(c.diagnosedDate) : ""}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function SectionHead({ title, action, onClick }: { title: string; action: string; onClick: () => void }) {
  return (
    <div className="mb-1.5 flex items-center justify-between">
      <h2 className="eyebrow">{title}</h2>
      <button className="text-xs font-medium text-ink-500 hover:text-ink-900" onClick={onClick}>{action}</button>
    </div>
  );
}

function SparkFromMetric({ code }: { code: string }) {
  const { patientId } = useStore();
  const metric = useQuery(api.health.getMetric, patientId ? { patientId, code } : "skip");
  if (!metric) return <div className="h-[26px] w-full" />;
  return <Sparkline points={metric.series.map((s: any) => ({ value: s.value, date: s.date }))} />;
}

function TypeTag({ type }: { type: string }) {
  const map: Record<string, string> = { encounter: "Visit", medication: "Rx", condition: "Dx" };
  return <span className="tag shrink-0">{map[type] ?? "•"}</span>;
}

function Sep() {
  return <span className="h-3 w-px bg-line-strong" />;
}

function EmptyRecord({ name, go }: { name: string; go: (v: any) => void }) {
  const first = name.split(" ")[0] || "there";
  const cards = [
    { t: "Add a document", d: "Drop a PDF, photo, or FHIR/JSON file", to: "import" },
    { t: "Ask the AI", d: "It answers once your record has data", to: "ask" },
  ];

  return (
    <div className="mx-auto max-w-2xl animate-fade-in">
      <h1 className="text-2xl font-semibold text-ink-900">Welcome, {first}.</h1>
      <p className="mt-1 text-sm text-ink-500">
        Your record is empty. Connect a provider to bring your history in — everything normalizes into one
        source-traceable timeline you can explore and ask an AI about.
      </p>

      {/* one clear path: go connect a provider */}
      <button
        onClick={() => go("integrations")}
        className="mt-5 flex w-full items-center gap-3 rounded-xl border border-accent-line bg-accent-soft p-4 text-left transition-colors hover:brightness-[0.99]"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent text-white">
          <svg viewBox="0 0 16 16" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6.5 9.5 4.8 11.2a2.4 2.4 0 0 1-3.4-3.4l1.7-1.7M9.5 6.5l1.7-1.7a2.4 2.4 0 0 1 3.4 3.4l-1.7 1.7M6 10l4-4" /></svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-ink-900">Connect a provider</span>
          <span className="block text-xs text-ink-600">Log in and authorize over SMART on FHIR — your full record syncs in. The best way to start.</span>
        </span>
        <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4l4 4-4 4" /></svg>
      </button>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {cards.map((c) => (
          <button key={c.t} onClick={() => go(c.to)} className="card p-4 text-left transition-colors hover:border-accent-line hover:bg-line-soft">
            <div className="text-sm font-medium text-ink-900">{c.t}</div>
            <div className="mt-1 text-xs text-ink-500">{c.d}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="mx-auto max-w-5xl animate-pulse">
      <div className="h-7 w-48 rounded bg-line" />
      <div className="mt-6 h-24 rounded-lg bg-line-soft" />
      <div className="mt-6 h-64 rounded-lg bg-line-soft" />
    </div>
  );
}
