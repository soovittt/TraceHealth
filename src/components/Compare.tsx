import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useStore } from "../lib/store";
import { fmtNum, year } from "../lib/format";

export default function Compare() {
  const { patientId, openMetric, askAI } = useStore();
  const obs = useQuery(api.health.listObservations, patientId ? { patientId } : "skip");

  const years = useMemo(() => {
    const set = new Set<number>();
    (obs ?? []).forEach((o: any) => set.add(year(o.date)));
    return [...set].sort((a, b) => a - b);
  }, [obs]);

  const [a, setA] = useState<number | null>(null);
  const [b, setB] = useState<number | null>(null);
  const yearA = a ?? (years.length ? years[0] : 2023);
  const yearB = b ?? (years.length ? years[years.length - 1] : 2026);

  const result = useQuery(api.health.compare, patientId ? { patientId, yearA, yearB } : "skip");

  // Interpret each measurement: better / worse / stable, and out-of-range.
  const rows = (result?.measurements ?? []).map((m: any) => {
    const rising = m.to > m.from;
    const stable = Math.abs(m.changePct) < 3;
    const worse = !stable && ((m.direction === "high_bad" && rising) || (m.direction === "low_bad" && !rising));
    const better = !stable && !worse && m.direction !== "neutral";
    const outOfRange =
      (m.refHigh != null && m.to > m.refHigh && m.direction === "high_bad") ||
      (m.refLow != null && m.to < m.refLow && m.direction === "low_bad");
    return { ...m, rising, stable, worse, better, outOfRange };
  });
  const nWorse = rows.filter((r: any) => r.worse).length;
  const nBetter = rows.filter((r: any) => r.better).length;

  function explainPeriod() {
    if (!result) return;
    const changed = rows.filter((r: any) => !r.stable).map((r: any) => `${r.label} ${fmtNum(r.from)}→${fmtNum(r.to)} ${r.unit}`).join(", ");
    askAI(
      `Compare my health between ${yearA} and ${yearB}. Notable changes: ${changed || "measurements were largely stable"}. ` +
        `New conditions in that window: ${result.newConditions.join(", ") || "none"}. New medications: ${result.newMeds.join(", ") || "none"}. ` +
        `In plain language: what changed, what's concerning, and what should I pay attention to?`,
    );
  }

  return (
    <div className="mx-auto max-w-3xl animate-fade-in">
      <h1 className="text-2xl font-semibold text-ink-900">Compare periods</h1>
      <p className="mt-1 text-sm text-ink-500">Then versus now — the view a stack of PDFs can’t give you.</p>

      {/* how to use it */}
      <p className="mt-2 text-xs leading-relaxed text-ink-400">
        Pick two years to see exactly what changed — useful before a doctor visit, for a second opinion, or to check whether a treatment is working.
        Each value is your closest reading to that year; a change is flagged only when it moves in the direction that matters clinically.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <YearPicker label="From" value={yearA} years={years} onChange={setA} />
        <span className="text-xs text-ink-400">→</span>
        <YearPicker label="To" value={yearB} years={years} onChange={setB} />
        {result && (
          <button onClick={explainPeriod} className="btn-secondary ml-auto gap-1.5">
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-accent" fill="currentColor"><path d="M8 1.5l1.2 3.3 3.3 1.2-3.3 1.2L8 10.5 6.8 7.2 3.5 6l3.3-1.2z" /></svg>
            Explain this period with AI
          </button>
        )}
      </div>

      {!result ? (
        <div className="mt-6 h-56 animate-pulse rounded-lg bg-line-soft" />
      ) : (
        <div className="mt-5">
          {/* at-a-glance digest */}
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="text-ink-500">{rows.length} metrics compared</span>
            {nWorse > 0 && <span className="text-bad">↑ {nWorse} moved the wrong way</span>}
            {nBetter > 0 && <span className="text-good">↓ {nBetter} improved</span>}
            {nWorse === 0 && nBetter === 0 && <span className="text-ink-400">largely stable</span>}
            {result.newConditions.length > 0 && <span className="text-warn">+{result.newConditions.length} new condition{result.newConditions.length > 1 ? "s" : ""}</span>}
            {result.newMeds.length > 0 && <span className="text-ink-500">+{result.newMeds.length} new med{result.newMeds.length > 1 ? "s" : ""}</span>}
          </div>

          <div className="eyebrow mb-2">Measurements · {yearA} → {yearB}</div>
          <div className="card overflow-hidden">
            {rows.map((m: any, i: number) => (
              <button
                key={m.code}
                onClick={() => openMetric(m.code)}
                title="Open the full trend"
                className={`flex w-full items-center justify-between px-3.5 py-2.5 text-left transition-colors hover:bg-line-soft ${i > 0 ? "border-t border-line-soft" : ""}`}
              >
                <span className="flex items-center gap-2 text-sm text-ink-800">
                  {m.label}
                  {m.outOfRange && <span className="rounded bg-bad-soft px-1.5 py-px text-2xs font-medium text-bad">{m.direction === "high_bad" ? "above target" : "below target"}</span>}
                </span>
                <div className="flex items-center gap-3 mono text-sm">
                  <span className="text-ink-400">{fmtNum(m.from)}</span>
                  <span className="text-ink-300">→</span>
                  <span className={`font-medium ${m.outOfRange ? "text-bad" : "text-ink-900"}`}>{fmtNum(m.to)}</span>
                  <span className="text-2xs text-ink-400">{m.unit}</span>
                  <span className={`w-20 text-right text-2xs font-medium ${m.stable ? "text-ink-400" : m.worse ? "text-bad" : m.better ? "text-good" : "text-ink-400"}`}>
                    {m.stable ? "stable" : m.worse ? `worsened ${Math.abs(m.changePct)}%` : m.better ? `improved ${Math.abs(m.changePct)}%` : `${m.rising ? "↑" : "↓"}${Math.abs(m.changePct)}%`}
                  </span>
                </div>
              </button>
            ))}
            {rows.length === 0 && <div className="px-3.5 py-4 text-sm text-ink-400">No metric had a reading in both {yearA} and {yearB}.</div>}
          </div>
          <p className="mt-1.5 text-2xs text-ink-400">Tap any row to see its full trend between these years.</p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <ChangeCard title="New conditions" empty={`No new conditions diagnosed ${yearA}–${yearB}`} items={result.newConditions} />
            <ChangeCard title="New medications" empty={`No new medications started ${yearA}–${yearB}`} items={result.newMeds} />
            <ChangeCard title="New providers" empty="No new care organizations in this window" items={result.newProviders} />
            <ChangeCard title="Notable visits" empty="No ER or specialist visits in this window" items={result.majorEvents} />
          </div>
        </div>
      )}
    </div>
  );
}

function YearPicker({ label, value, years, onChange }: { label: string; value: number; years: number[]; onChange: (y: number) => void }) {
  return (
    <label className="flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-2">
      <span className="eyebrow">{label}</span>
      <select value={value} onChange={(e) => onChange(Number(e.target.value))} className="mono bg-transparent text-md font-semibold text-ink-900 outline-none">
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
    </label>
  );
}

function ChangeCard({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div className="card p-3.5">
      <div className="eyebrow">{title}</div>
      {items.length === 0 ? (
        <div className="mt-2 text-sm text-ink-400">{empty}.</div>
      ) : (
        <ul className="mt-2 space-y-1">
          {items.map((it, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-ink-800">
              <span className="h-1 w-1 rounded-full bg-ink-300" />
              {it}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
