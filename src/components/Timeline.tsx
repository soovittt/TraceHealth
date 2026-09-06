import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { METRIC_META } from "../../convex/metrics";
import { useStore } from "../lib/store";
import { fmtMonthYear, fmtNum } from "../lib/format";

type Filter = "all" | "labs" | "visit" | "medication" | "condition";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "labs", label: "Labs" },
  { key: "visit", label: "Visits" },
  { key: "medication", label: "Medications" },
  { key: "condition", label: "Conditions" },
];

type Item = {
  id: string;
  type: "lab" | "encounter" | "medication" | "condition";
  date: number;
  title: string;
  detail?: string;
  value?: number;
  unit?: string;
  code?: string;
  abnormal?: boolean;
  documentId?: any;
  page?: number;
};

export default function Timeline() {
  const { patientId, showEvidence, openMetric } = useStore();
  const events = useQuery(api.health.getTimeline, patientId ? { patientId } : "skip");
  const obs = useQuery(api.health.listObservations, patientId ? { patientId } : "skip");
  const [filter, setFilter] = useState<Filter>("all");

  if (!events || !obs)
    return <div className="mx-auto max-w-3xl animate-pulse space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-14 rounded-lg bg-line-soft" />)}</div>;

  // One unified, dated feed from every record type.
  const items: Item[] = [];
  for (const e of events) {
    items.push({
      id: e.id,
      type: e.type as Item["type"],
      date: e.date,
      title: cleanTitle(e.type, e.title),
      detail: e.subtitle,
      documentId: e.documentId,
      page: e.page,
    });
  }
  for (const o of obs) {
    const meta = METRIC_META[o.code];
    const abnormal =
      (meta?.refHigh != null && o.value > meta.refHigh) || (meta?.refLow != null && o.value < meta.refLow);
    items.push({
      id: o._id,
      type: "lab",
      date: o.date,
      title: o.label,
      value: o.value,
      unit: o.unit,
      code: o.code,
      abnormal,
      documentId: o.documentId,
      page: o.page,
    });
  }

  const typeForFilter: Record<Filter, Item["type"] | null> = {
    all: null,
    labs: "lab",
    visit: "encounter",
    medication: "medication",
    condition: "condition",
  };
  const want = typeForFilter[filter];
  const shown = items.filter((it) => !want || it.type === want).sort((a, b) => b.date - a.date);

  // Group by month, newest first.
  const groups: { key: string; label: string; items: Item[] }[] = [];
  for (const it of shown) {
    const d = new Date(it.date);
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) {
      g = { key, label: fmtMonthYear(it.date), items: [] };
      groups.push(g);
    }
    g.items.push(it);
  }

  return (
    <div className="mx-auto max-w-3xl animate-fade-in">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Timeline</h1>
          <p className="mt-1 text-sm text-ink-500">{shown.length} records, newest first — every source on one thread.</p>
        </div>
        <div className="flex gap-1 rounded-md border border-line bg-surface p-0.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded px-2 py-1 text-xs transition-colors ${filter === f.key ? "bg-line-soft font-medium text-ink-900" : "text-ink-500 hover:text-ink-800"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 space-y-6">
        {groups.map((g) => (
          <section key={g.key}>
            <div className="sticky top-14 z-[1] mb-1.5 bg-canvas/90 py-1 backdrop-blur">
              <span className="text-xs font-semibold text-ink-500">{g.label}</span>
              <span className="ml-2 text-2xs text-ink-400">{g.items.length}</span>
            </div>
            <div className="card divide-y divide-line-soft">
              {g.items.map((it) => (
                <Row key={it.id} it={it} onEvidence={showEvidence} onMetric={openMetric} />
              ))}
            </div>
          </section>
        ))}
        {shown.length === 0 && <div className="card p-6 text-center text-sm text-ink-400">No {filter} records.</div>}
      </div>
    </div>
  );
}

function Row({ it, onEvidence, onMetric }: { it: Item; onEvidence: (e: any) => void; onMetric: (c: string) => void }) {
  const day = new Date(it.date).getUTCDate();
  const isLab = it.type === "lab";
  return (
    <button
      onClick={() => (isLab && it.code ? onMetric(it.code) : it.documentId && onEvidence({ documentId: it.documentId, page: it.page }))}
      className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-canvas"
    >
      <span className="mono w-6 shrink-0 text-right text-sm text-ink-400">{day}</span>
      <TypeBadge type={it.type} />
      <span className="min-w-0 flex-1 truncate text-sm text-ink-800">{it.title}</span>
      {isLab ? (
        <span className={`mono shrink-0 text-sm font-medium ${it.abnormal ? "text-bad" : "text-ink-900"}`}>
          {fmtNum(it.value!)} <span className="text-2xs font-normal text-ink-400">{it.unit}</span>
        </span>
      ) : (
        it.detail && <span className="shrink-0 truncate text-2xs text-ink-400">{it.detail}</span>
      )}
    </button>
  );
}

function TypeBadge({ type }: { type: string }) {
  const map: Record<string, { t: string; c: string }> = {
    lab: { t: "Lab", c: "border-accent-line text-accent" },
    encounter: { t: "Visit", c: "border-line text-ink-500" },
    medication: { t: "Rx", c: "border-good/30 text-good-ink" },
    condition: { t: "Dx", c: "border-warn-line text-warn" },
  };
  const m = map[type] ?? { t: "•", c: "border-line text-ink-500" };
  return <span className={`tag shrink-0 ${m.c}`}>{m.t}</span>;
}

// Turn generic FHIR encounter titles into short human labels.
function cleanTitle(type: string, title: string): string {
  if (type !== "encounter") return title;
  let t = title
    .replace(/\s*\((procedure|finding|disorder|situation|regime\/therapy)\)\s*/gi, "")
    .replace(/^encounter\s+for\s+/i, "")
    .replace(/\bencounter\b/gi, "visit")
    .trim();
  t = t.charAt(0).toUpperCase() + t.slice(1);
  const map: Record<string, string> = {
    "Check up": "Check-up",
    "Check up (procedure)": "Check-up",
    "Follow-up visit": "Follow-up",
    Symptom: "Symptom visit",
    Problem: "Problem visit",
    "General examination of patient": "General exam",
    "Well child visit": "Well-child visit",
    Prenatal: "Prenatal visit",
  };
  return map[t] ?? (t || "Visit");
}
