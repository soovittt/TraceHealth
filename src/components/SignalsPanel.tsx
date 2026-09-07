import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useStore } from "../lib/store";

const TONE: Record<string, { dot: string; text: string }> = {
  high: { dot: "bg-bad", text: "text-bad" },
  moderate: { dot: "bg-warn", text: "text-warn" },
  info: { dot: "bg-ink-400", text: "text-ink-500" },
};

// #1 Needs Attention Feed + #63 completeness — the app reads the whole record
// and hands you the short list that matters. Deterministic, grounded, cited.
export default function SignalsPanel({ limit }: { limit?: number }) {
  const { patientId, openMetric, showEvidence, go } = useStore();
  const signals = useQuery(api.signals.getSignals, patientId ? { patientId } : "skip");
  const health = useQuery(api.signals.dataHealth, patientId ? { patientId } : "skip");
  if (signals === undefined) return null;

  const shown = limit ? signals.slice(0, limit) : signals;
  const moreCount = signals.length - shown.length;

  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-line-soft px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="grid h-4 w-4 place-items-center rounded bg-accent-soft">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          </span>
          <h2 className="text-sm font-semibold text-ink-900">Needs your attention</h2>
          {signals.length > 0 && <span className="mono text-2xs text-ink-400">{signals.length}</span>}
        </div>
        <div className="flex items-center gap-3">
          {health && (
            <span className="hidden items-center gap-1.5 text-2xs text-ink-400 sm:flex" title={health.gaps.join(" · ") || "Looks complete"}>
              <span className={`h-1.5 w-1.5 rounded-full ${health.score >= 75 ? "bg-good" : health.score >= 50 ? "bg-warn" : "bg-bad"}`} />
              Record {health.score}% complete
            </span>
          )}
          {signals.length > 0 && (
            <button className="text-xs font-medium text-ink-500 hover:text-ink-900" onClick={() => go("signals")}>See all →</button>
          )}
        </div>
      </div>

      {signals.length === 0 ? (
        <div className="px-4 py-4 text-sm text-ink-500">
          Nothing flagged — your tracked metrics are in range and up to date.
          {health && health.gaps.length > 0 && (
            <span className="mt-1 block text-2xs text-ink-400">To complete your record: {health.gaps.join(" · ")}.</span>
          )}
        </div>
      ) : (
        <div className="divide-y divide-line-soft">
          {shown.map((s: any) => {
            const tone = TONE[s.severity] ?? TONE.info;
            const act = () => (s.code ? openMetric(s.code) : s.documentId ? showEvidence({ documentId: s.documentId, page: s.page }) : undefined);
            return (
              <button key={s.id} onClick={act} className="flex w-full items-start gap-3 px-4 py-2 text-left transition-colors hover:bg-canvas">
                <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${tone.dot}`} />
                <span className="min-w-0 flex-1">
                  <span className="text-sm font-medium text-ink-900">{s.title}</span>
                  <span className="mt-0.5 block truncate text-xs text-ink-500">{s.detail}</span>
                </span>
                {s.documentId && (
                  <svg viewBox="0 0 12 12" className="mt-1 h-3 w-3 shrink-0 text-ink-300" fill="none" stroke="currentColor" strokeWidth="1.2">
                    <path d="M3 2h4l2 2v6H3zM7 2v2h2" />
                  </svg>
                )}
              </button>
            );
          })}
          {moreCount > 0 && (
            <button
              onClick={() => go("signals")}
              className="flex w-full items-center justify-center gap-1 px-4 py-2 text-xs font-medium text-accent hover:bg-canvas"
            >
              +{moreCount} more · see all action items →
            </button>
          )}
        </div>
      )}
    </section>
  );
}
