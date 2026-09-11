import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useStore } from "../lib/store";
import { fmtDate } from "../lib/format";

const CADENCES: { key: "daily" | "weekly" | "monthly" | "yearly"; label: string; every: string }[] = [
  { key: "daily", label: "Daily summary", every: "A fresh summary every day" },
  { key: "weekly", label: "Weekly summary", every: "Every 7 days" },
  { key: "monthly", label: "Monthly summary", every: "Once a month" },
  { key: "yearly", label: "Yearly review", every: "A year-in-review, once a year" },
];

export default function Settings() {
  const { patientId, go } = useStore();
  const schedules = useQuery(api.reports.listSchedules, patientId ? { patientId } : "skip");
  const setSchedule = useMutation(api.reports.setReportSchedule);
  const rowOf = (c: string) => (schedules ?? []).find((s: any) => s.cadence === c);

  return (
    <div className="mx-auto max-w-2xl animate-fade-in">
      <h1 className="text-2xl font-semibold text-ink-900">Settings</h1>
      <p className="mt-1 text-sm text-ink-500">Manage how TraceHealth works for you.</p>

      {/* Automated reports */}
      <section className="mt-7">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-ink-900">Automated reports</h2>
            <p className="mt-0.5 text-xs text-ink-500">
              Generate a health summary automatically on a schedule. It runs in the background — even when you’re away — and lands in{" "}
              <button className="font-medium text-accent" onClick={() => go("reports")}>Reports</button>.
            </p>
          </div>
          <span className="tag shrink-0">Cron</span>
        </div>

        <div className="mt-3 card divide-y divide-line-soft">
          {CADENCES.map(({ key, label, every }) => {
            const s = rowOf(key);
            const on = !!s?.enabled;
            return (
              <div key={key} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-ink-900">{label}</div>
                  <div className="mt-0.5 text-2xs text-ink-500">
                    {on && s
                      ? <>{s.lastRunAt ? `Last generated ${fmtDate(s.lastRunAt)} · ` : ""}next {s.nextRunAt ? fmtDate(s.nextRunAt) : "soon"}</>
                      : every}
                  </div>
                </div>
                <Switch on={on} onChange={() => patientId && setSchedule({ patientId, cadence: key, enabled: !on })} label={label} />
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-2xs text-ink-400">Turning one on generates the first report right away, then keeps it current on the cadence you chose.</p>
      </section>
    </div>
  );
}

function Switch({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onChange}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${on ? "bg-accent" : "bg-line-strong"}`}
    >
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${on ? "translate-x-4" : "translate-x-0.5"}`} />
    </button>
  );
}
