import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Sparkline } from "./charts";

// Configure what a generated summary contains — which prose sections, and which
// trend graphs to embed (rendered live from the record, printable to PDF).
type SectionKey = "overview" | "problems" | "medications" | "allergies" | "trends" | "summary";

const SECTIONS: { key: SectionKey; label: string; hint: string }[] = [
  { key: "overview", label: "Patient overview", hint: "Name, age, record span" },
  { key: "problems", label: "Active problems", hint: "Ongoing conditions" },
  { key: "medications", label: "Medications", hint: "Current meds & doses" },
  { key: "allergies", label: "Allergies", hint: "Known allergies" },
  { key: "trends", label: "Key trends", hint: "Labs with values & reference status" },
  { key: "summary", label: "Summary", hint: "A short narrative wrap-up" },
];

export default function SummaryDialog({
  patientId,
  onClose,
  onRequested,
}: {
  patientId: string;
  onClose: () => void;
  onRequested: () => void;
}) {
  const metrics = useQuery(api.health.listMetrics, { patientId: patientId as any });
  const request = useMutation(api.reports.requestSummaryReport);

  const chartable = (metrics ?? []).filter((m: any) => m.count >= 2);

  const [sections, setSections] = useState<Set<SectionKey>>(new Set(SECTIONS.map((s) => s.key)));
  // Default the graphs to the primary charted metrics (up to 4).
  const [charts, setCharts] = useState<Set<string>>(
    () => new Set(chartable.filter((m: any) => m.primary).slice(0, 4).map((m: any) => m.code)),
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [primed, setPrimed] = useState(false);

  // Once metrics load, seed the default graph selection (runs once).
  if (!primed && metrics !== undefined) {
    setPrimed(true);
    if (charts.size === 0 && chartable.length) {
      const seed = chartable.filter((m: any) => m.primary).slice(0, 4).map((m: any) => m.code);
      setCharts(new Set(seed.length ? seed : chartable.slice(0, 3).map((m: any) => m.code)));
    }
  }

  const toggleSection = (k: SectionKey) =>
    setSections((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const toggleChart = (c: string) =>
    setCharts((s) => { const n = new Set(s); n.has(c) ? n.delete(c) : n.add(c); return n; });

  async function run() {
    if (!sections.size && !charts.size) { setErr("Pick at least one section or graph."); return; }
    setBusy(true);
    setErr(null);
    try {
      await request({
        patientId: patientId as any,
        sections: [...sections],
        charts: [...charts],
      });
      onRequested();
    } catch (e: any) {
      setErr(e?.message ?? "Could not start generation.");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-pop" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <div>
            <div className="text-sm font-semibold text-ink-900">Configure summary</div>
            <div className="text-2xs text-ink-500">Choose the sections and trend graphs to include — then export it to PDF.</div>
          </div>
          <button className="grid h-7 w-7 place-items-center rounded-md text-ink-400 hover:bg-line-soft hover:text-ink-700" onClick={onClose}>✕</button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-y-auto sm:grid-cols-2">
          {/* sections */}
          <div className="border-b border-line-soft p-4 sm:border-b-0 sm:border-r">
            <div className="mb-2 flex items-center justify-between">
              <span className="eyebrow">Sections</span>
              <button className="text-2xs text-accent hover:underline" onClick={() => setSections(sections.size === SECTIONS.length ? new Set() : new Set(SECTIONS.map((s) => s.key)))}>
                {sections.size === SECTIONS.length ? "None" : "All"}
              </button>
            </div>
            <div className="space-y-0.5">
              {SECTIONS.map((s) => (
                <label key={s.key} className="flex cursor-pointer items-start gap-2.5 rounded-md px-1.5 py-1.5 hover:bg-line-soft">
                  <input type="checkbox" checked={sections.has(s.key)} onChange={() => toggleSection(s.key)} className="mt-0.5 h-3.5 w-3.5 accent-accent" />
                  <span className="flex-1">
                    <span className="block text-sm text-ink-800">{s.label}</span>
                    <span className="block text-2xs text-ink-400">{s.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* graphs */}
          <div className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="eyebrow">Trend graphs</span>
              {chartable.length > 0 && (
                <button className="text-2xs text-accent hover:underline" onClick={() => setCharts(charts.size === chartable.length ? new Set() : new Set(chartable.map((m: any) => m.code)))}>
                  {charts.size === chartable.length ? "None" : "All"}
                </button>
              )}
            </div>
            {metrics === undefined ? (
              <div className="py-6 text-center text-2xs text-ink-400">Loading metrics…</div>
            ) : chartable.length === 0 ? (
              <div className="rounded-md border border-line-soft bg-canvas px-3 py-6 text-center text-2xs text-ink-400">
                No metrics with enough data points to chart yet.
              </div>
            ) : (
              <div className="max-h-[46vh] space-y-0.5 overflow-y-auto pr-1">
                {chartable.map((m: any) => (
                  <label key={m.code} className="flex cursor-pointer items-center gap-2.5 rounded-md px-1.5 py-1.5 hover:bg-line-soft">
                    <input type="checkbox" checked={charts.has(m.code)} onChange={() => toggleChart(m.code)} className="h-3.5 w-3.5 accent-accent" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink-800">{m.label}</span>
                      <span className="mono text-2xs text-ink-400">{m.count} readings</span>
                    </span>
                    <span className="h-6 w-16 shrink-0 text-ink-400"><MiniSpark patientId={patientId} code={m.code} /></span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
          <span className="text-2xs text-ink-400">
            {sections.size} section{sections.size === 1 ? "" : "s"} · {charts.size} graph{charts.size === 1 ? "" : "s"}
          </span>
          <div className="flex items-center gap-2">
            {err && <span className="text-2xs text-bad-ink">{err}</span>}
            <button className="btn-ghost px-3 py-1.5 text-sm" onClick={onClose} disabled={busy}>Cancel</button>
            <button className="btn-primary px-4 py-1.5 text-sm" onClick={run} disabled={busy}>
              {busy ? "Starting…" : "Generate"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// A tiny inline sparkline preview for the graph picker.
function MiniSpark({ patientId, code }: { patientId: string; code: string }) {
  const metric = useQuery(api.health.getMetric, { patientId: patientId as any, code });
  if (!metric || metric.series.length < 2) return null;
  return <Sparkline points={metric.series.map((s: any) => ({ value: s.value, date: s.date }))} height={22} />;
}
