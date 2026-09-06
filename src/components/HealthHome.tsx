import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useStore } from "../lib/store";
import { Sparkline } from "./charts";
import { fmtDate, fmtNum, year } from "../lib/format";

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
  const activeMeds = (meds ?? []).filter((m: any) => m.status === "active");
  const seen = new Set<string>();
  const activeConds = (conds ?? [])
    .filter((c: any) => c.status === "active")
    .sort((a: any, b: any) => (b.diagnosedDate ?? 0) - (a.diagnosedDate ?? 0))
    .filter((c: any) => (seen.has(c.normalizedName) ? false : (seen.add(c.normalizedName), true)));

  return (
    <div className="mx-auto max-w-5xl animate-fade-in">
      {/* header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">{patient.name}</h1>
          <div className="mt-1 flex items-center gap-2 text-xs text-ink-500">
            <span>{patient.age} yr</span>
            <Sep />
            <span className="mono">{patient.recordsFrom}</span>
            <Sep />
            <span>{patient.orgCount} organizations</span>
          </div>
        </div>
        {openConflicts.length > 0 && (
          <button onClick={() => go("conflicts")} className="flex items-center gap-2 rounded-md border border-warn-line bg-warn-soft px-2.5 py-1.5 text-xs font-medium text-warn hover:brightness-[0.98]">
            <span className="h-1.5 w-1.5 rounded-full bg-warn" />
            {openConflicts.length} records to review
          </button>
        )}
      </div>

      <div className="mt-5">
        <AskBar />
      </div>

      {/* metric strip */}
      <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-4">
        {(() => {
          const primary = metrics.filter((m: any) => m.primary);
          return (primary.length ? primary : metrics).slice(0, 8);
        })().map((m: any) => {
          const rising = m.last > m.first;
          const bad = (m.direction === "high_bad" && rising) || (m.direction === "low_bad" && !rising);
          return (
            <button key={m.code} onClick={() => openMetric(m.code)} className="group bg-surface p-3.5 text-left transition-colors hover:bg-canvas">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-ink-600">{m.label}</span>
                {m.direction !== "neutral" && (
                  <span className={`mono text-2xs ${bad ? "text-bad" : "text-good"}`}>
                    {rising ? "↑" : "↓"}{Math.abs(m.changePct)}%
                  </span>
                )}
              </div>
              <div className="mt-2 mono text-2xl font-semibold text-ink-900">
                {fmtNum(m.last)}
                <span className="ml-1 text-2xs font-normal text-ink-400">{m.unit}</span>
              </div>
              <div className="mt-2">
                <SparkFromMetric code={m.code} />
              </div>
              <div className="mt-1.5 mono text-2xs text-ink-400">
                {fmtNum(m.first)}→{fmtNum(m.last)} · {year(m.firstDate)}–{year(m.lastDate)}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        {/* recent activity table */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="eyebrow">Recent activity</h2>
            <button className="text-xs font-medium text-ink-500 hover:text-ink-900" onClick={() => go("timeline")}>
              View timeline →
            </button>
          </div>
          <div className="card overflow-hidden">
            {recent.map((it: any, i: number) => (
              <button
                key={it.id}
                onClick={() => it.documentId && showEvidence({ documentId: it.documentId, page: it.page })}
                className={`flex w-full items-center gap-3 px-3.5 py-2.5 text-left hover:bg-canvas ${i > 0 ? "border-t border-line-soft" : ""}`}
              >
                <span className="mono w-[68px] shrink-0 text-2xs text-ink-400">{fmtDate(it.date)}</span>
                <TypeTag type={it.type} />
                <span className="min-w-0 flex-1 truncate text-sm text-ink-800">{it.title}</span>
                {it.subtitle && <span className="hidden truncate text-xs text-ink-400 sm:block">{it.subtitle}</span>}
              </button>
            ))}
          </div>
        </section>

        {/* meds + conditions */}
        <div className="space-y-5">
          <section>
            <h2 className="eyebrow mb-2">Active medications</h2>
            <div className="card">
              {activeMeds.map((m: any, i: number) => (
                <button key={m._id} onClick={() => showEvidence({ documentId: m.documentId, page: m.page })} className={`flex w-full items-center justify-between px-3.5 py-2 text-left hover:bg-canvas ${i > 0 ? "border-t border-line-soft" : ""}`}>
                  <span className="text-sm text-ink-800">{m.name}</span>
                  <span className="mono text-xs text-ink-500">{m.dose ? `${m.dose} ${m.doseUnit}` : "—"}</span>
                </button>
              ))}
            </div>
          </section>
          <section>
            <h2 className="eyebrow mb-2">Active conditions</h2>
            <div className="card">
              {activeConds.map((c: any, i: number) => (
                <button key={c._id} onClick={() => showEvidence({ documentId: c.documentId, page: c.page })} className={`flex w-full items-center justify-between px-3.5 py-2 text-left hover:bg-canvas ${i > 0 ? "border-t border-line-soft" : ""}`}>
                  <span className="text-sm text-ink-800">{c.name}</span>
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
    { t: "Connect a provider", d: "Pull records over FHIR", tag: "Recommended", to: "integrations" },
    { t: "Import a document", d: "PDF, CSV, JSON or paste", tag: "", to: "import" },
    { t: "Forward by email", d: "Send a lab to your inbox", tag: "", to: "integrations" },
  ];
  return (
    <div className="mx-auto max-w-2xl animate-fade-in">
      <h1 className="text-2xl font-semibold text-ink-900">Welcome, {first}.</h1>
      <p className="mt-1 text-sm text-ink-500">
        Your record is empty. Bring your health history in — everything normalizes into one
        source-traceable timeline you can explore and ask an AI about.
      </p>
      <div className="mt-5">
        <AskBar placeholder="Ask the AI anything — it'll answer from your records once you add some…" />
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {cards.map((c) => (
          <button key={c.t} onClick={() => go(c.to)} className="card p-4 text-left transition-colors hover:border-accent-line hover:bg-canvas">
            {c.tag && <span className="tag mb-2 border-accent-line text-accent">{c.tag}</span>}
            <div className="text-sm font-medium text-ink-900">{c.t}</div>
            <div className="mt-1 text-xs text-ink-500">{c.d}</div>
          </button>
        ))}
      </div>
      <div className="mt-4 rounded-md border border-line bg-canvas px-3.5 py-3 text-sm text-ink-500">
        Just exploring? <button className="font-medium text-accent" onClick={() => go("integrations")}>Connect your first source →</button>
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
