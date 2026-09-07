import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useStore } from "../lib/store";
import { fmtDate } from "../lib/format";

export default function EvidencePanel() {
  const { evidence, showEvidence, shareToken } = useStore();
  const doc = useQuery(
    api.health.getDocument,
    evidence ? { documentId: evidence.documentId, shareToken: shareToken ?? undefined } : "skip",
  );

  if (!evidence) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 animate-fade-in" onClick={() => showEvidence(null)} />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[420px] flex-col border-l border-line bg-surface shadow-pop animate-rise">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <span className="eyebrow">Source record</span>
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
            {/* source header — real file type, org, date, page */}
            <div className="flex items-start gap-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-line bg-canvas text-2xs font-semibold text-ink-500">
                {fileKind(doc)}
              </span>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-ink-900">{doc.org}</div>
                <div className="mono mt-0.5 text-2xs text-ink-400">
                  {fmtDate(doc.receivedAt)} · page {evidence.page ?? 1} · via {doc.receivedVia}
                </div>
              </div>
            </div>

            <div className="mono mt-2.5 truncate rounded-md border border-line bg-canvas px-2.5 py-1.5 text-2xs text-ink-500" title={doc.filename}>
              {doc.filename}
            </div>

            <div className="eyebrow mt-4">Source content</div>
            <div className="mt-1.5 max-h-[52vh] overflow-auto rounded-md border border-line bg-canvas p-3">
              <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-ink-700">
                {doc.excerpt?.trim() || "No extracted text available for this record."}
              </pre>
            </div>

            {doc.url && (
              <a href={doc.url} target="_blank" rel="noreferrer" className="btn-secondary mt-3 w-full">
                Open original file ↗
              </a>
            )}

            <p className="mt-4 text-2xs leading-relaxed text-ink-400">
              Every value in TraceHealth traces back to a source record like this — not a model’s opinion.
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
