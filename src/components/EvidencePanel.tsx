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
            <div className="text-md font-semibold text-ink-900">{doc.org}</div>
            <div className="mono mt-0.5 text-xs text-ink-400">{fmtDate(doc.receivedAt)}</div>

            <dl className="mt-4 grid grid-cols-3 gap-2">
              <Meta k="File" v={doc.filename} mono />
              <Meta k="Page" v={String(evidence.page ?? 1)} mono />
              <Meta k="Via" v={doc.receivedVia} />
            </dl>

            <div className="eyebrow mt-5">Original document</div>
            <div className="mt-2 overflow-hidden rounded-md border border-line">
              <div className="flex items-center gap-2 border-b border-line bg-canvas px-3 py-2 text-2xs text-ink-400">
                <span className="rounded-sm border border-line bg-surface px-1 py-px font-mono text-2xs text-ink-500">PDF</span>
                <span className="mono truncate">{doc.filename} · p.{evidence.page ?? 1}</span>
              </div>
              <pre className="whitespace-pre-wrap px-3 py-3 font-mono text-xs leading-relaxed text-ink-700">
                {doc.excerpt ?? "No extracted text available."}
              </pre>
            </div>

            {doc.url && (
              <a href={doc.url} target="_blank" rel="noreferrer" className="btn-secondary mt-3 w-full">
                Open original file
              </a>
            )}

            <p className="mt-5 text-xs leading-relaxed text-ink-400">
              Every value in TraceHealth points back to a source record — not to a model’s opinion.
            </p>
          </div>
        )}
      </aside>
    </>
  );
}

function Meta({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="rounded-md border border-line px-2.5 py-1.5">
      <dt className="text-2xs uppercase tracking-wide text-ink-400">{k}</dt>
      <dd className={`truncate text-xs text-ink-800 ${mono ? "mono" : ""}`}>{v}</dd>
    </div>
  );
}
