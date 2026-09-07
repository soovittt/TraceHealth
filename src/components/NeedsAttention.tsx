import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useStore } from "../lib/store";

const GROUPS: { key: string; label: string; dot: string; ring: string }[] = [
  { key: "high", label: "Needs attention soon", dot: "bg-bad", ring: "border-bad/30 bg-bad-soft" },
  { key: "moderate", label: "Worth reviewing", dot: "bg-warn", ring: "border-warn-line bg-warn-soft" },
  { key: "info", label: "Good to know", dot: "bg-ink-400", ring: "border-line bg-canvas" },
];

const KIND_LABEL: Record<string, string> = {
  abnormal: "Out of range",
  worsening: "Trending",
  overdue: "Overdue recheck",
  allergy_med: "Safety",
};

// Full "action items" view — every flagged signal, grouped by urgency, each
// cited and clickable. Reached from the dashboard's "See all →".
export default function NeedsAttention() {
  const { patientId, openMetric, showEvidence, askAI, go } = useStore();
  const signals = useQuery(api.signals.getSignals, patientId ? { patientId } : "skip");
  const health = useQuery(api.signals.dataHealth, patientId ? { patientId } : "skip");
  if (signals === undefined) return <div className="mx-auto h-64 max-w-3xl animate-pulse rounded-lg bg-line-soft" />;

  const byGroup = (k: string) => signals.filter((s: any) => s.severity === k);

  return (
    <div className="mx-auto max-w-3xl animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">Needs your attention</h1>
          <p className="mt-1 text-sm text-ink-500">
            {signals.length} item{signals.length === 1 ? "" : "s"} the app flagged across your whole record — grounded and cited. Not medical advice.
          </p>
        </div>
        {signals.length > 0 && (
          <button
            className="btn-primary shrink-0 gap-1.5"
            onClick={() => askAI("Walk me through everything I should be paying attention to across my record — explain what each one means for me and what I might ask my doctor, most important first.")}
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor"><path d="M8 1.5l1.2 3.3 3.3 1.2-3.3 1.2L8 10.5 6.8 7.2 3.5 6l3.3-1.2z" /></svg>
            Explain these with AI
          </button>
        )}
      </div>

      {health && (
        <div className="mt-4 flex items-center gap-2 rounded-md border border-line bg-canvas px-3.5 py-2.5 text-sm">
          <span className={`h-1.5 w-1.5 rounded-full ${health.score >= 75 ? "bg-good" : health.score >= 50 ? "bg-warn" : "bg-bad"}`} />
          <span className="text-ink-700">Record {health.score}% complete</span>
          {health.gaps.length > 0 && <span className="text-ink-400">· {health.gaps.join(" · ")}</span>}
          <button className="ml-auto text-xs font-medium text-accent hover:underline" onClick={() => go("integrations")}>Add a source →</button>
        </div>
      )}

      {signals.length === 0 ? (
        <div className="mt-6 rounded-lg border border-good-line bg-good-soft px-4 py-6 text-center text-sm text-good-ink">
          Nothing flagged right now — your tracked metrics are in range and up to date.
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {GROUPS.map((g) => {
            const items = byGroup(g.key);
            if (!items.length) return null;
            return (
              <section key={g.key}>
                <div className="mb-2 flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 rounded-full ${g.dot}`} />
                  <h2 className="eyebrow">{g.label}</h2>
                  <span className="mono text-2xs text-ink-400">{items.length}</span>
                </div>
                <div className="space-y-2">
                  {items.map((s: any) => (
                    <button
                      key={s.id}
                      onClick={() => (s.code ? openMetric(s.code) : s.documentId ? showEvidence({ documentId: s.documentId, page: s.page }) : undefined)}
                      className={`flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left transition-colors hover:brightness-[0.99] ${g.ring}`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="text-sm font-medium text-ink-900">{s.title}</span>
                          <span className="rounded bg-surface/60 px-1.5 py-0.5 text-2xs text-ink-500">{KIND_LABEL[s.kind] ?? "Flag"}</span>
                        </span>
                        <span className="mt-1 block text-sm text-ink-600">{s.detail}</span>
                      </span>
                      <span className="mt-0.5 shrink-0 text-2xs font-medium text-accent">{s.code ? "View trend →" : s.documentId ? "View source →" : ""}</span>
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
