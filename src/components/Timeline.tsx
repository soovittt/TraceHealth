import { useEffect, useRef, useState } from "react";
import { usePaginatedQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
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
const FILTER_TYPE: Record<Filter, string | undefined> = {
  all: undefined,
  labs: "lab",
  visit: "encounter",
  medication: "medication",
  condition: "condition",
};

export default function Timeline() {
  const { patientId, showEvidence, openMetric } = useStore();
  const [filter, setFilter] = useState<Filter>("all");

  // Real Convex cursor pagination over the denormalized events feed.
  const { results, status, loadMore } = usePaginatedQuery(
    api.events.pagedTimeline,
    patientId ? { patientId, type: FILTER_TYPE[filter] } : "skip",
    { initialNumItems: 40 },
  );

  // Backfill the feed once for records that predate the events table.
  const ensure = useMutation(api.events.ensureEvents);
  useEffect(() => {
    if (patientId) ensure({ patientId }).catch(() => {});
  }, [patientId, ensure]);

  // Infinite scroll — load the next page when the sentinel enters view.
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && status === "CanLoadMore") loadMore(40);
    }, { rootMargin: "300px" });
    io.observe(el);
    return () => io.disconnect();
  }, [status, loadMore]);

  if (status === "LoadingFirstPage") {
    return <div className="max-w-4xl animate-pulse space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-14 rounded-lg bg-line-soft" />)}</div>;
  }

  // Group the loaded rows by month (already sorted newest-first by the query).
  const groups: { key: string; label: string; items: any[] }[] = [];
  for (const it of results) {
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
    <div className="max-w-4xl animate-fade-in">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Timeline</h1>
          <p className="mt-1 text-sm text-ink-500">
            {results.length}
            {status !== "Exhausted" ? "+" : ""} records, newest first — every source on one thread.
          </p>
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
                <Row key={it._id} it={it} onEvidence={showEvidence} onMetric={openMetric} />
              ))}
            </div>
          </section>
        ))}

        {results.length === 0 && <div className="card p-6 text-center text-sm text-ink-400">No {filter === "all" ? "" : filter} records yet.</div>}

        {/* infinite-scroll sentinel + status */}
        <div ref={sentinel} />
        {status === "LoadingMore" && <div className="py-3 text-center text-xs text-ink-400">Loading more…</div>}
        {status === "CanLoadMore" && (
          <button onClick={() => loadMore(40)} className="mx-auto block rounded-md border border-line px-3 py-1.5 text-xs text-ink-600 hover:bg-line-soft">Load more</button>
        )}
        {status === "Exhausted" && results.length > 0 && <div className="py-3 text-center text-2xs text-ink-400">End of record</div>}
      </div>
    </div>
  );
}

const BADGE: Record<string, string> = { encounter: "Visit", medication: "Medication", condition: "Diagnosis", allergy: "Allergy" };
const SUB_LABEL: Record<string, string> = { encounter: "Facility", medication: "Dose", condition: "Status", allergy: "Reaction" };

function Row({ it, onEvidence, onMetric }: { it: any; onEvidence: (e: any) => void; onMetric: (c: string) => void }) {
  const day = new Date(it.date).getUTCDate();
  const isLab = it.type === "lab";
  const title = it.type === "encounter" ? cleanTitle(it.title) : it.title;

  function openEvidence() {
    const rows: { label: string; value: string }[] = [{ label: "Date", value: new Date(it.date).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) }];
    if (it.subtitle) rows.push({ label: SUB_LABEL[it.type] ?? "Detail", value: it.subtitle });
    onEvidence({
      documentId: it.documentId,
      page: it.page,
      detail: { badge: BADGE[it.type] ?? "Record", title, rows, visitDate: it.type === "encounter" ? it.date : undefined, encounterId: it.type === "encounter" ? it.sourceId : undefined },
    });
  }

  return (
    <button
      onClick={() => (isLab && it.code ? onMetric(it.code) : it.documentId && openEvidence())}
      className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-line-soft"
    >
      <span className="mono w-6 shrink-0 text-right text-sm text-ink-400">{day}</span>
      <TypeBadge type={it.type} />
      <span className="min-w-0 flex-1 truncate text-sm text-ink-800">{title}</span>
      {isLab ? (
        <span className={`mono shrink-0 text-sm font-medium ${it.abnormal ? "text-bad" : "text-ink-900"}`}>
          {fmtNum(it.value)} <span className="text-2xs font-normal text-ink-400">{it.unit}</span>
        </span>
      ) : (
        it.subtitle && <span className="shrink-0 truncate text-2xs text-ink-400">{it.subtitle}</span>
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
    allergy: { t: "Alg", c: "border-bad/30 text-bad" },
  };
  const m = map[type] ?? { t: "•", c: "border-line text-ink-500" };
  return <span className={`tag shrink-0 ${m.c}`}>{m.t}</span>;
}

// Turn generic FHIR encounter titles into short human labels.
function cleanTitle(title: string): string {
  let t = title
    .replace(/\s*\((procedure|finding|disorder|situation|regime\/therapy)\)\s*/gi, "")
    .replace(/^encounter\s+for\s+/i, "")
    .replace(/\bencounter\b/gi, "visit")
    .trim();
  t = t.charAt(0).toUpperCase() + t.slice(1);
  const map: Record<string, string> = {
    "Check up": "Check-up",
    "Follow-up visit": "Follow-up",
    Symptom: "Symptom visit",
    Problem: "Problem visit",
    "General examination of patient": "General exam",
    "Well child visit": "Well-child visit",
    Prenatal: "Prenatal visit",
  };
  return map[t] ?? (t || "Visit");
}
