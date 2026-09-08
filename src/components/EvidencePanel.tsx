import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useStore } from "../lib/store";
import { fmtDate, fmtNum } from "../lib/format";

export default function EvidencePanel() {
  const { evidence, showEvidence, openMetric, askAI, patientId, shareToken } = useStore();
  const doc = useQuery(
    api.health.getDocument,
    evidence ? { documentId: evidence.documentId, shareToken: shareToken ?? undefined } : "skip",
  );
  const visitDate = evidence?.detail?.visitDate;
  const visit = useQuery(
    api.health.visitRecords,
    visitDate && patientId ? { patientId, date: visitDate, encounterId: (evidence?.detail?.encounterId as any) ?? undefined, shareToken: shareToken ?? undefined } : "skip",
  );
  const [showSource, setShowSource] = useState(false);

  const isImport = !!doc && ((doc as any).receivedVia === "fhir" || (doc as any).kind === "fhir" || (doc as any).kind === "import");
  const hasVisitContent = !!visit && (visit.labs.length + visit.meds.length + visit.conditions.length > 0);

  function explainVisit() {
    if (!evidence?.detail) return;
    const dateStr = evidence.detail.rows.find((r) => r.label === "Date")?.value ?? "";
    const labs = (visit?.labs ?? []).map((l: any) => `${l.label} ${l.value} ${l.unit}`.trim()).join(", ");
    const meds = (visit?.meds ?? []).map((m: any) => m.name).join(", ");
    const parts = [labs && `labs — ${labs}`, meds && `started ${meds}`].filter(Boolean).join("; ");
    askAI(`Explain my "${evidence.detail.title}" visit${dateStr ? ` on ${dateStr}` : ""}${parts ? `. Recorded that day: ${parts}` : ""}. In plain language: what do these results mean, is anything concerning, and what should I keep an eye on?`);
    showEvidence(null);
  }

  if (!evidence) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 animate-fade-in" onClick={() => showEvidence(null)} />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[420px] flex-col border-l border-line bg-surface shadow-pop animate-rise">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <span className="eyebrow">{visitDate ? "Visit detail" : "Source record"}</span>
          <button className="grid h-6 w-6 place-items-center rounded text-ink-400 hover:bg-line-soft" onClick={() => showEvidence(null)}>
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="m4 4 8 8M12 4l-8 8" /></svg>
          </button>
        </div>

        {doc === undefined ? (
          <div className="p-5 text-sm text-ink-400">Loading…</div>
        ) : doc === null ? (
          <div className="p-5 text-sm text-ink-400">Source not found.</div>
        ) : (
          <div className="flex-1 overflow-auto p-4">
            {/* the record you clicked */}
            {evidence.detail && (
              <div className="rounded-lg border border-line bg-canvas p-3">
                <div className="flex items-center gap-2">
                  <span className="tag">{evidence.detail.badge}</span>
                  <span className="text-sm font-semibold text-ink-900">{evidence.detail.title}</span>
                </div>
                <dl className="mt-2 divide-y divide-line-soft">
                  {evidence.detail.rows.map((r, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 py-1 text-xs">
                      <dt className="text-ink-400">{r.label}</dt>
                      <dd className="truncate text-right text-ink-800">{r.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {visitDate && (
              <button onClick={explainVisit} className="btn-secondary mt-3 w-full gap-1.5">
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-accent" fill="currentColor"><path d="M8 1.5l1.2 3.3 3.3 1.2-3.3 1.2L8 10.5 6.8 7.2 3.5 6l3.3-1.2z" /></svg>
                Explain this visit with AI
              </button>
            )}

            {/* what actually happened at this visit — the co-dated records */}
            {visitDate && (
              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <div className="eyebrow">Recorded at this visit</div>
                  {hasVisitContent && (
                    <span className={`text-2xs ${visit?.linkedBy === "encounter" ? "text-good-ink" : "text-ink-400"}`}>
                      {visit?.linkedBy === "encounter" ? "✓ linked in FHIR" : "same day"}
                    </span>
                  )}
                </div>
                {visit === undefined ? (
                  <div className="mt-2 h-16 animate-pulse rounded-md bg-line-soft" />
                ) : hasVisitContent ? (
                  <div className="mt-2 space-y-3">
                    {visit.labs.length > 0 && (
                      <div>
                        <div className="mb-1 text-2xs font-medium uppercase tracking-wide text-ink-400">Labs & vitals</div>
                        <div className="card divide-y divide-line-soft">
                          {visit.labs.map((l: any, i: number) => (
                            <button key={i} onClick={() => l.code && openMetric(l.code)} className="flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-line-soft">
                              <span className="text-sm text-ink-800">{l.label}</span>
                              <span className={`mono text-sm font-medium ${l.abnormal ? "text-bad" : "text-ink-900"}`}>{fmtNum(l.value)} <span className="text-2xs font-normal text-ink-400">{l.unit}</span></span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {visit.meds.length > 0 && (
                      <div>
                        <div className="mb-1 text-2xs font-medium uppercase tracking-wide text-ink-400">Medications started</div>
                        <div className="card divide-y divide-line-soft">
                          {visit.meds.map((m: any, i: number) => (
                            <div key={i} className="flex items-center justify-between px-3 py-1.5"><span className="text-sm text-ink-800">{m.name}</span>{m.dose && <span className="mono text-2xs text-ink-500">{m.dose}</span>}</div>
                          ))}
                        </div>
                      </div>
                    )}
                    {visit.conditions.length > 0 && (
                      <div>
                        <div className="mb-1 text-2xs font-medium uppercase tracking-wide text-ink-400">Diagnoses</div>
                        <div className="card divide-y divide-line-soft">
                          {visit.conditions.map((c: any, i: number) => (
                            <div key={i} className="px-3 py-1.5 text-sm text-ink-800">{c.name}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="mt-2 rounded-md border border-line bg-canvas px-3 py-2.5 text-xs text-ink-500">
                    No labs, medications, or diagnoses were recorded on this date — the source visit held only the summary above.
                  </p>
                )}
              </div>
            )}

            {/* provenance — compact, and the raw source tucked away */}
            <div className="mt-4 border-t border-line-soft pt-3">
              <button onClick={() => setShowSource((v) => !v)} className="flex w-full items-center justify-between text-left">
                <span className="flex items-center gap-2">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded border border-line bg-canvas text-[9px] font-semibold text-ink-500">{fileKind(doc)}</span>
                  <span className="text-2xs text-ink-500">{isImport ? "View import source" : "View source content"} · {doc.org} · {fmtDate(doc.receivedAt)}</span>
                </span>
                <svg viewBox="0 0 16 16" className={`h-3 w-3 text-ink-400 transition-transform ${showSource ? "rotate-90" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4l4 4-4 4" /></svg>
              </button>
              {showSource && (
                <div className="mt-2">
                  <div className="mono truncate rounded-md border border-line bg-canvas px-2.5 py-1.5 text-2xs text-ink-500" title={doc.filename}>{doc.filename}</div>
                  <div className="mt-1.5 max-h-[36vh] overflow-auto rounded-md border border-line bg-canvas p-3">
                    <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-ink-700">{doc.excerpt?.trim() || "No extracted text available."}</pre>
                  </div>
                  {doc.url && <a href={doc.url} target="_blank" rel="noreferrer" className="btn-secondary mt-2 w-full">Open original file ↗</a>}
                </div>
              )}
            </div>

            <p className="mt-4 text-2xs leading-relaxed text-ink-400">
              Every value in TraceHealth traces back to a source record — not a model’s opinion.
            </p>
          </div>
        )}
      </aside>
    </>
  );
}

// The real file type — never mislabel a FHIR/JSON record as "PDF".
function fileKind(doc: any): string {
  const f = (doc.filename ?? "").toLowerCase();
  if (doc.kind === "fhir" || doc.receivedVia === "fhir" || f.endsWith(".fhir") || (f.endsWith(".json") && f.includes("fhir"))) return "FHIR";
  if (f.endsWith(".pdf")) return "PDF";
  if (f.endsWith(".csv")) return "CSV";
  if (f.endsWith(".json")) return "JSON";
  if (f.endsWith(".xml")) return "XML";
  if (doc.kind === "manual") return "NOTE";
  return "TEXT";
}
