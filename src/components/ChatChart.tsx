import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useStore } from "../lib/store";
import { TrendChart } from "./charts";
import { fmtNum } from "../lib/format";

// An inline chart in a chat answer. The AI picks the metric code; the data is
// fetched live from Convex, so the numbers are always the real record.
export default function ChatChart({ code }: { code: string }) {
  const { patientId, openMetric, showEvidence } = useStore();
  const metric = useQuery(api.health.getMetric, patientId ? { patientId, code } : "skip");
  if (!metric || metric.series.length < 2) return null;

  const rising = metric.last > metric.first;
  const bad =
    (metric.direction === "high_bad" && rising) || (metric.direction === "low_bad" && !rising);
  const changePct =
    metric.first === 0 ? 0 : Math.round(((metric.last - metric.first) / metric.first) * 100);

  return (
    <div className="mt-2 rounded-lg border border-line bg-canvas p-3">
      <div className="flex items-center justify-between">
        <button
          onClick={() => openMetric(code)}
          className="text-xs font-medium text-ink-800 hover:text-accent"
          title="Open full trend"
        >
          {metric.label}
        </button>
        {metric.direction !== "neutral" && (
          <span className={`mono text-2xs ${bad ? "text-bad" : "text-good"}`}>
            {rising ? "↑" : "↓"}
            {Math.abs(changePct)}%
          </span>
        )}
      </div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span className="mono text-lg font-semibold text-ink-900">{fmtNum(metric.last)}</span>
        <span className="text-2xs text-ink-400">{metric.unit}</span>
        <span className="mono ml-1 text-2xs text-ink-400">
          {fmtNum(metric.first)}→{fmtNum(metric.last)}
        </span>
      </div>
      <div className="mt-1">
        <TrendChart
          points={metric.series.map((s: any) => ({ id: s.id, value: s.value, date: s.date }))}
          unit={metric.unit}
          refHigh={metric.refHigh}
          height={150}
          onPoint={(i) => {
            const p = metric.series[i];
            showEvidence({ documentId: p.documentId, page: p.page });
          }}
        />
      </div>
    </div>
  );
}
