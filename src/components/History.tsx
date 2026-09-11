import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useStore } from "../lib/store";
import { fmtDate, fmtNum, provenanceLabel, year } from "../lib/format";

// The audit trail: every source you've added, newest-first, with the exact
// records it produced — so any fact can be traced back to where it came from.
export default function History() {
  const { patientId, go, showEvidence } = useStore();
  const sources = useQuery(api.sources.listSources, patientId ? { patientId } : "skip");

  if (!sources) return <div className="mx-auto h-64 max-w-3xl animate-pulse rounded-lg bg-line-soft" />;

  const totalRecords = sources.reduce((n: number, s: any) => n + s.counts.total, 0);

  return (
    <div className="mx-auto max-w-3xl animate-fade-in">
      <h1 className="text-2xl font-semibold text-ink-900">History</h1>
      <p className="mt-1 text-sm text-ink-500">Every source that built your record — and exactly what each one added. Nothing appears without a trace.</p>

      {sources.length === 0 ? (
        <div className="mt-6 card p-6 text-center text-sm text-ink-500">
          Nothing added yet. <button className="font-medium text-accent" onClick={() => go("import")}>Add your first record →</button>
        </div>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-500">
            <span>{sources.length} source{sources.length === 1 ? "" : "s"}</span>
            <span className="text-ink-300">·</span>
            <span>{totalRecords} record{totalRecords === 1 ? "" : "s"} total</span>
          </div>

          <div className="mt-4 space-y-2.5">
            {sources.map((s: any) => (
              <SourceRow key={s.documentId} s={s} onSource={() => showEvidence({ documentId: s.documentId })} onTimeline={() => go("timeline")} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SourceRow({ s, onSource, onTimeline }: { s: any; onSource: () => void; onTimeline: () => void }) {
  const [open, setOpen] = useState(false);
  const via = viaLabel(s.receivedVia, s.kind);
  const chips: [string, number][] = [["labs", s.counts.observations], ["meds", s.counts.medications], ["conditions", s.counts.conditions], ["visits", s.counts.encounters], ["allergies", s.counts.allergies]];

  return (
    <div className="card overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 px-3.5 py-3 text-left hover:bg-line-soft">
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-md ${via.tint}`}>
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d={via.icon} /></svg>
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-ink-900">{s.filename}</span>
            <span className="tag shrink-0">{via.label}</span>
          </div>
          <div className="mt-0.5 truncate text-2xs text-ink-500">{s.org} · {fmtDate(s.receivedAt)} · {s.counts.total} record{s.counts.total === 1 ? "" : "s"}</div>
        </div>
        <svg viewBox="0 0 16 16" className={`h-4 w-4 shrink-0 text-ink-400 transition-transform ${open ? "rotate-90" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4l4 4-4 4" /></svg>
      </button>

      {open && (
        <div className="border-t border-line-soft bg-canvas px-3.5 py-3">
          {s.counts.total > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {chips.filter(([, n]) => n > 0).map(([label, n]) => (
                <span key={label} className="rounded-full border border-line bg-surface px-2 py-0.5 text-2xs font-medium text-ink-600">{n} {label}</span>
              ))}
            </div>
          )}
          <SourceDetail documentId={s.documentId} />
          <div className="mt-3 flex gap-2">
            <button className="btn-secondary px-3 py-1.5 text-xs" onClick={onTimeline}>View in timeline →</button>
            <button className="btn-ghost px-3 py-1.5 text-xs" onClick={onSource}>Open source</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Lazily loads the exact records for one source when its row is expanded.
function SourceDetail({ documentId }: { documentId: any }) {
  const data = useQuery(api.sources.sourceRecords, { documentId });
  if (!data) return <div className="h-12 animate-pulse rounded-md bg-line-soft" />;

  const groups: [string, any[], (r: any) => { text: string; sub?: string }][] = [
    ["Labs", data.labs, (r) => ({ text: `${r.label} ${fmtNum(r.value)}${r.unit ? " " + r.unit : ""}`, sub: fmtDate(r.date) })],
    ["Medications", data.medications, (r) => ({ text: `${r.name}${r.dose ? ` ${r.dose}${r.doseUnit ? " " + r.doseUnit : ""}` : ""}`, sub: r.status })],
    ["Conditions", data.conditions, (r) => ({ text: r.name, sub: r.date ? String(year(r.date)) : r.status })],
    ["Visits", data.encounters, (r) => ({ text: r.title, sub: fmtDate(r.date) })],
    ["Allergies", data.allergies, (r) => ({ text: r.reaction ? `${r.substance} — ${r.reaction}` : r.substance, sub: undefined })],
  ];
  const present = groups.filter(([, items]) => items.length > 0);
  if (present.length === 0) return <div className="text-2xs text-ink-400">This source produced no structured records.</div>;

  return (
    <div className="space-y-3">
      {present.map(([label, items, fmt]) => (
        <div key={label}>
          <div className="eyebrow mb-1">{label}</div>
          <div className="space-y-1">
            {items.map((r: any, i: number) => {
              const { text, sub } = fmt(r);
              const p = provenanceLabel(r.provenance);
              return (
                <div key={i} className="flex items-center gap-2.5 rounded-md border border-line bg-surface px-2.5 py-1.5">
                  <span className="min-w-0 flex-1 truncate text-sm text-ink-800">{text}</span>
                  {sub && <span className="mono shrink-0 text-2xs text-ink-400">{sub}</span>}
                  <span className="flex shrink-0 items-center gap-1 text-2xs text-ink-400" title={`Provenance: ${p.label}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${p.dot}`} />{p.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function viaLabel(receivedVia: string, kind: string): { label: string; tint: string; icon: string } {
  // How the source arrived → a friendly label, tint, and glyph.
  if (receivedVia === "import" || kind === "import" || kind === "fhir")
    return { label: "Imported", tint: "bg-line-soft text-ink-500", icon: "M8 10V2m0 0L5 5m3-3 3 3M3 11.5v1a1.5 1.5 0 0 0 1.5 1.5h7A1.5 1.5 0 0 0 13 12.5v-1" };
  if (receivedVia === "manual" || kind === "manual")
    return { label: "Manual", tint: "bg-good-soft text-good-ink", icon: "M11.5 2.5l2 2L6 12l-3 1 1-3zM10 4l2 2" };
  if (receivedVia === "sync")
    return { label: "Synced", tint: "bg-accent-soft text-accent", icon: "M13 7A5 5 0 0 0 4 4.5M3 9a5 5 0 0 0 9 2.5M12 2.5V5H9.5M4 13.5V11h2.5" };
  if (receivedVia === "demo")
    return { label: "Demo", tint: "bg-line-soft text-ink-500", icon: "M8 2l1.5 3.5L13 6l-2.5 2.5L11 12 8 10.5 5 12l.5-3.5L3 6l3.5-.5z" };
  // upload (AI-extracted PDF / photo / text)
  return { label: "AI extracted", tint: "bg-accent-soft text-accent", icon: "M8 2l1.1 3.1L12.2 6.2 9.1 7.3 8 10.4 6.9 7.3 3.8 6.2 6.9 5.1z" };
}
