import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useStore } from "../lib/store";
import { fmtDate } from "../lib/format";
import { Markdown } from "./markdown";

const CADENCES: { key: "daily" | "weekly" | "monthly" | "yearly"; label: string }[] = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "yearly", label: "Yearly" },
];

export default function Reports() {
  const { patientId } = useStore();
  const reports = useQuery(api.reports.listReports, patientId ? { patientId } : "skip");
  const schedules = useQuery(api.reports.listSchedules, patientId ? { patientId } : "skip");
  const setSchedule = useMutation(api.reports.setReportSchedule);
  const generate = useAction(api.reports.generateSummaryReport);
  const remove = useMutation(api.reports.removeReport);
  const writeFhir = useAction(api.reports.writeReportToFhir);

  const enabledOf = (c: string) => (schedules ?? []).find((s: any) => s.cadence === c);

  const [busy, setBusy] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const open = (reports ?? []).find((r: any) => r._id === openId) ?? (reports ?? [])[0] ?? null;

  async function gen() {
    if (!patientId) return;
    setBusy("gen");
    setMsg(null);
    try {
      const r = await generate({ patientId });
      setOpenId(r.reportId);
    } catch (e: any) {
      setMsg(e?.message ?? "Could not generate.");
    } finally {
      setBusy(null);
    }
  }
  async function toFhir(id: any) {
    setBusy(`f:${id}`);
    setMsg(null);
    try {
      const r = await writeFhir({ reportId: id });
      setMsg(r.message);
    } catch (e: any) {
      setMsg(e?.message ?? "Write failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Reports</h1>
          <p className="mt-1 text-sm text-ink-500">
            Generate a clinical summary, export it, or write it back to a connected provider (FHIR).
          </p>
        </div>
        <button className="btn-primary" onClick={gen} disabled={busy === "gen"}>
          {busy === "gen" ? "Generating…" : "Generate health summary"}
        </button>
      </div>

      {msg && (
        <div className="mt-4 rounded-md border border-line bg-canvas px-3 py-2 text-sm text-ink-700">{msg}</div>
      )}

      {/* scheduled reports — auto-generated on cadence via a Convex cron */}
      <div className="mt-5 card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-ink-900">Scheduled reports</div>
            <div className="mt-0.5 text-xs text-ink-500">Auto-generate a health summary on a cadence — runs in the background, even when you’re away.</div>
          </div>
          <span className="tag shrink-0">Cron</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {CADENCES.map(({ key, label }) => {
            const s = enabledOf(key);
            const on = !!s?.enabled;
            return (
              <button
                key={key}
                onClick={() => patientId && setSchedule({ patientId, cadence: key, enabled: !on })}
                className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${on ? "border-accent-line bg-accent-soft text-accent" : "border-line text-ink-600 hover:bg-line-soft"}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${on ? "bg-accent" : "bg-ink-300"}`} />
                {label}
              </button>
            );
          })}
        </div>
        {(schedules ?? []).some((s: any) => s.enabled) && (
          <div className="mt-3 space-y-1 border-t border-line-soft pt-3">
            {(schedules ?? []).filter((s: any) => s.enabled).map((s: any) => (
              <div key={s.cadence} className="flex items-center justify-between text-2xs text-ink-500">
                <span className="capitalize">{s.cadence} summary</span>
                <span className="mono text-ink-400">
                  {s.lastRunAt ? `last ${fmtDate(s.lastRunAt)} · ` : ""}next {s.nextRunAt ? fmtDate(s.nextRunAt) : "—"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[260px_1fr]">
        {/* list */}
        <div className="space-y-2">
          {(reports ?? []).length === 0 && (
            <div className="card p-4 text-sm text-ink-400">No reports yet. Generate one, or save an AI answer as a report from the chat.</div>
          )}
          {(reports ?? []).map((r: any) => (
            <button
              key={r._id}
              onClick={() => setOpenId(r._id)}
              className={`card w-full p-3 text-left transition-colors hover:bg-line-soft ${open?._id === r._id ? "border-accent-line" : ""}`}
            >
              <div className="truncate text-sm font-medium text-ink-900">{r.title}</div>
              <div className="mono mt-0.5 flex items-center gap-2 text-2xs text-ink-400">
                {fmtDate(r.createdAt)}
                {r.fhirStatus === "written" && <span className="text-good-ink">· written to provider</span>}
              </div>
            </button>
          ))}
        </div>

        {/* viewer */}
        {open ? (
          <div className="card p-5">
            <div className="flex items-start justify-between gap-3 border-b border-line-soft pb-3">
              <div>
                <div className="text-md font-semibold text-ink-900">{open.title}</div>
                <div className="mono text-2xs text-ink-400">{fmtDate(open.createdAt)} · {open.kind}</div>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <button className="btn-ghost text-xs" onClick={() => navigator.clipboard?.writeText(open.content)}>Copy</button>
                <button className="btn-ghost text-xs" onClick={() => printReport(open)}>Print</button>
                <button className="btn-secondary text-xs" onClick={() => toFhir(open._id)} disabled={busy === `f:${open._id}`}>
                  {busy === `f:${open._id}` ? "Writing…" : "Write to provider"}
                </button>
                <button className="btn-ghost text-xs text-ink-400 hover:text-bad" onClick={() => remove({ reportId: open._id })}>Delete</button>
              </div>
            </div>
            <div className="prose-report mt-4 text-sm text-ink-800">
              <Markdown text={open.content} />
            </div>
          </div>
        ) : (
          <div className="card grid place-items-center p-10 text-sm text-ink-400">Select or generate a report.</div>
        )}
      </div>
    </div>
  );
}

function printReport(report: any) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(
    `<html><head><title>${escapeHtml(report.title)}</title><style>body{font-family:Inter,system-ui,sans-serif;max-width:720px;margin:40px auto;padding:0 20px;color:#18181b;line-height:1.6}h1,h2,h3{letter-spacing:-.01em}code{font-family:ui-monospace,monospace}</style></head><body><pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(report.content)}</pre></body></html>`,
  );
  w.document.close();
  w.print();
}
function escapeHtml(s: string) {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
}
