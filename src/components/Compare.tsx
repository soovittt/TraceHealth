import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useStore } from "../lib/store";
import { fmtNum, year } from "../lib/format";

export default function Compare() {
  const { patientId } = useStore();
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

  return (
    <div className="mx-auto max-w-3xl animate-fade-in">
      <h1 className="text-2xl font-semibold text-ink-900">Compare periods</h1>
      <p className="mt-1 text-sm text-ink-500">Then versus now — the view a stack of PDFs can’t give you.</p>

      <div className="mt-5 flex items-center gap-2">
        <YearPicker label="From" value={yearA} years={years} onChange={setA} />
        <span className="text-xs text-ink-400">→</span>
        <YearPicker label="To" value={yearB} years={years} onChange={setB} />
      </div>

      {!result ? (
        <div className="mt-6 h-56 animate-pulse rounded-lg bg-line-soft" />
      ) : (
        <div className="mt-6">
          <div className="eyebrow mb-2">Measurements</div>
          <div className="card overflow-hidden">
            {result.measurements.map((m: any, i: number) => {
              const rising = m.to > m.from;
              const bad = (m.direction === "high_bad" && rising) || (m.direction === "low_bad" && !rising);
              const stable = Math.abs(m.changePct) < 3;
              return (
                <div key={m.code} className={`flex items-center justify-between px-3.5 py-2.5 ${i > 0 ? "border-t border-line-soft" : ""}`}>
                  <span className="text-sm text-ink-800">{m.label}</span>
                  <div className="flex items-center gap-3 mono text-sm">
                    <span className="text-ink-400">{fmtNum(m.from)}</span>
                    <span className="text-ink-300">→</span>
                    <span className="font-medium text-ink-900">{fmtNum(m.to)}</span>
                    <span className="text-2xs text-ink-400">{m.unit}</span>
                    <span className={`w-14 text-right text-2xs ${stable ? "text-ink-400" : bad ? "text-bad" : "text-good"}`}>
                      {stable ? "stable" : `${rising ? "↑" : "↓"}${Math.abs(m.changePct)}%`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <ChangeCard title="New conditions" items={result.newConditions} />
            <ChangeCard title="New medications" items={result.newMeds} />
            <ChangeCard title="New providers" items={result.newProviders} />
            <ChangeCard title="Major events" items={result.majorEvents} />
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

function ChangeCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="card p-3.5">
      <div className="eyebrow">{title}</div>
      {items.length === 0 ? (
        <div className="mt-2 text-sm text-ink-400">None</div>
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
