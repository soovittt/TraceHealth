import { useState, useEffect } from "react";
import { useQuery, useConvex, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useStore } from "../lib/store";
import { TrendChart } from "./charts";
import { Markdown } from "./markdown";
import { fmtMonthYear, fmtNum } from "../lib/format";
import { downloadText } from "../lib/download";

export default function MetricGraph() {
  const { patientId, metricCode, openMetric, showEvidence } = useStore();
  const convex = useConvex();
  const explainMetric = useAction(api.insights.explainMetric);
  const code = metricCode ?? "LDL";

  const [exp, setExp] = useState<{ explanation: string; questions: string[]; documentId?: string | null } | null>(null);
  const [expLoading, setExpLoading] = useState(false);
  useEffect(() => { setExp(null); }, [code]);

  async function exportCsv() {
    if (!patientId) return;
    const res = await convex.query(api.export.exportMetricCsv, { patientId, code });
    if (res) downloadText(res.filename, res.mime, res.content);
  }

  async function runExplain() {
    if (!patientId) return;
    setExpLoading(true);
    setExp(null);
    try {
      const r = await explainMetric({ patientId, code });
      if (r) setExp(r);
    } finally {
      setExpLoading(false);
    }
  }
  const metric = useQuery(api.health.getMetric, patientId ? { patientId, code } : "skip");
  const metrics = useQuery(api.health.listMetrics, patientId ? { patientId } : "skip");

  if (!metric) return <div className="mx-auto h-96 max-w-5xl animate-pulse rounded-lg bg-line-soft" />;

  const markers = metric.relatedMeds
    .filter((m: any) => m.startDate && m.startDate >= metric.series[0].date)
    .map((m: any) => ({ date: m.startDate, label: m.name, kind: "medication" }));

  return (
    <div className="mx-auto max-w-5xl animate-fade-in">
      {/* metric tabs */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-line pb-0">
        {(metrics ?? [])
          .filter((m: any) => m.primary || m.code === code)
          .map((m: any) => (
          <button
            key={m.code}
            onClick={() => openMetric(m.code)}
            className={`-mb-px border-b-2 px-2.5 py-2 text-sm transition-colors ${
              m.code === code
                ? "border-ink-900 font-medium text-ink-900"
                : "border-transparent text-ink-500 hover:text-ink-800"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* readout */}
      <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-ink-900">{metric.label}</h1>
          <div className="mt-1.5 flex items-baseline gap-2 mono text-xl">
            <span className="text-ink-400">{fmtNum(metric.first)}</span>
            <span className="text-ink-300">→</span>
            <span className="text-bad">{fmtNum(metric.peak)}</span>
            <span className="text-ink-300">→</span>
            <span className="text-good">{fmtNum(metric.last)}</span>
            <span className="text-xs text-ink-400">{metric.unit}</span>
          </div>
        </div>
        <div className="flex items-end gap-6 text-right">
          <Stat label="Readings" value={String(metric.series.length)} />
          <Stat label="Peak" value={fmtNum(metric.peak)} />
          <Stat label="Latest" value={fmtNum(metric.last)} />
          <button onClick={runExplain} disabled={expLoading} title="Explain this in plain language" className="btn-secondary gap-1.5 px-2.5 py-1 text-xs">
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-accent" fill="currentColor">
              <path d="M8 1.5l1.2 3.3 3.3 1.2-3.3 1.2L8 10.5 6.8 7.2 3.5 6l3.3-1.2z" />
            </svg>
            {expLoading ? "Explaining…" : "Explain this"}
          </button>
          <button
            onClick={exportCsv}
            title="Download this metric as CSV"
            className="btn-ghost gap-1.5 px-2 py-1 text-xs"
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-ink-400" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 2v8m0 0 3-3M8 10 5 7M3 12.5h10" />
            </svg>
            CSV
          </button>
        </div>
      </div>

      {/* trend */}
      <div className="mt-4 card p-4">
        <TrendChart
          points={metric.series.map((s: any) => ({ id: s.id, value: s.value, date: s.date }))}
          unit={metric.unit}
          refHigh={metric.refHigh}
          markers={markers}
          onPoint={(i) => {
            const p = metric.series[i];
            showEvidence({ documentId: p.documentId, page: p.page });
          }}
        />
        <p className="mt-1 text-center text-2xs text-ink-400">Select any reading to trace it to the source record.</p>
      </div>

      {/* #8 Explain This Result — plain-language, cited, non-diagnostic */}
      {exp && (
        <div className="mt-4 rounded-lg border border-accent-line bg-accent-soft/40 p-4 animate-fade-in">
          <div className="flex items-center gap-1.5">
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-accent" fill="currentColor"><path d="M8 1.5l1.2 3.3 3.3 1.2-3.3 1.2L8 10.5 6.8 7.2 3.5 6l3.3-1.2z" /></svg>
            <span className="eyebrow">In plain language</span>
          </div>
          <div className="mt-2 text-sm text-ink-800">
            <Markdown text={exp.explanation} />
          </div>
          {exp.questions?.length > 0 && (
            <div className="mt-3 border-t border-line-soft pt-2.5">
              <div className="text-2xs font-medium uppercase tracking-wide text-ink-400">Questions to ask your doctor</div>
              <ul className="mt-1.5 space-y-1">
                {exp.questions.map((q, i) => (
                  <li key={i} className="flex gap-2 text-sm text-ink-700"><span className="text-accent">·</span>{q}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-2.5 flex items-center justify-between">
            <span className="text-2xs text-ink-400">Grounded in your record · not medical advice</span>
            {exp.documentId && (
              <button onClick={() => showEvidence({ documentId: exp.documentId as any })} className="text-2xs font-medium text-accent hover:underline">View source</button>
            )}
          </div>
        </div>
      )}

      {/* insight — restrained, bordered, accent rule */}
      {metric.insight && (
        <div className="mt-4 flex gap-3 rounded-lg border border-line bg-surface p-4">
          <span className="mt-0.5 h-full w-0.5 shrink-0 rounded-full bg-accent" />
          <div>
            <div className="eyebrow">Observed in the record</div>
            <p className="mt-1 text-md text-ink-900">{metric.insight}</p>
            <p className="mt-1 text-xs text-ink-400">Reports the change, not causation — this is what the timeline supports.</p>
          </div>
        </div>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="card p-4">
          <div className="eyebrow">Related in this period</div>
          <RelatedPanel metric={metric} />
        </div>

        <div className="card p-4">
          <div className="eyebrow">Timeline around this change</div>
          <ol className="mt-3">
            {metric.around.map((a: any, i: number) => (
              <li key={i} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className={`mt-1 h-1.5 w-1.5 rounded-full ${kindColor(a.kind)}`} />
                  {i < metric.around.length - 1 && <span className="my-0.5 w-px flex-1 bg-line" />}
                </div>
                <div className="pb-3">
                  <div className="mono text-2xs text-ink-400">{fmtMonthYear(a.date)}</div>
                  <div className="text-sm text-ink-800">{a.label}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div className="mono mt-0.5 text-sm font-medium text-ink-900">{value}</div>
    </div>
  );
}

function kindColor(kind: string) {
  return kind === "medication" ? "bg-good" : kind === "condition" ? "bg-warn" : "bg-ink-900";
}

// Clean, categorized chips — scales to real records (unlike the old radial graph).
function RelatedPanel({ metric }: { metric: any }) {
  const { openMetric, showEvidence } = useStore();
  const groups: { title: string; chips: { label: string; sub?: string; onClick: () => void; tone: string }[] }[] = [
    {
      title: "Compare with",
      chips: (metric.others ?? []).map((o: any) => ({
        label: o.label,
        onClick: () => openMetric(o.code),
        tone: "metric",
      })),
    },
    {
      title: "Medications",
      chips: (metric.relatedMeds ?? []).map((m: any) => ({
        label: m.name,
        sub: m.startDate ? fmtMonthYear(m.startDate) : undefined,
        onClick: () => showEvidence({ documentId: m.documentId, page: m.page }),
        tone: "med",
      })),
    },
    {
      title: "Conditions",
      chips: (metric.relatedConds ?? []).map((c: any) => ({
        label: c.name,
        sub: c.diagnosedDate ? fmtMonthYear(c.diagnosedDate) : undefined,
        onClick: () => showEvidence({ documentId: c.documentId, page: c.page }),
        tone: "cond",
      })),
    },
  ].filter((g) => g.chips.length);

  const dot = (t: string) => (t === "med" ? "bg-good" : t === "cond" ? "bg-warn" : "bg-accent");

  return (
    <div className="mt-3 space-y-3">
      {groups.map((g) => (
        <div key={g.title}>
          <div className="text-2xs font-medium uppercase tracking-wide text-ink-400">{g.title}</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {g.chips.map((c, i) => (
              <button
                key={i}
                onClick={c.onClick}
                className="flex items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1 text-xs text-ink-800 transition-colors hover:border-accent-line hover:bg-canvas"
              >
                <span className={`h-1.5 w-1.5 rounded-full ${dot(c.tone)}`} />
                {c.label}
                {c.sub && <span className="mono text-2xs text-ink-400">{c.sub}</span>}
              </button>
            ))}
          </div>
        </div>
      ))}
      {groups.length === 0 && <div className="text-sm text-ink-400">Nothing else recorded in this period.</div>}
    </div>
  );
}
