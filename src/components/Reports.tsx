import { useState, type ReactNode } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useStore } from "../lib/store";
import { fmtDate } from "../lib/format";
import { Markdown } from "./markdown";

export default function Reports() {
  const { patientId, go } = useStore();
  const reports = useQuery(api.reports.listReports, patientId ? { patientId } : "skip");
  const generate = useAction(api.reports.generateSummaryReport);
  const remove = useMutation(api.reports.removeReport);

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
  return (
    <div className="animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Reports</h1>
          <p className="mt-1 text-sm text-ink-500">
            A clinical summary of your record — copy, print, or export it. Schedule auto-reports in{" "}
            <button className="font-medium text-accent" onClick={() => go("settings")}>Settings</button>.
          </p>
        </div>
        <button className="btn-primary shrink-0" onClick={gen} disabled={busy === "gen"}>
          {busy === "gen" ? "Generating…" : "Generate summary"}
        </button>
      </div>

      {msg && (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-line bg-canvas px-3.5 py-2.5 text-sm text-ink-700">
          <span className="min-w-0 flex-1">{msg}</span>
          <button className="shrink-0 text-ink-400 hover:text-ink-700" onClick={() => setMsg(null)}>✕</button>
        </div>
      )}

      <div className="mt-6 grid items-start gap-5 lg:grid-cols-[300px_1fr]">
        {/* master list */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line-soft px-3.5 py-2.5">
            <span className="eyebrow">All reports</span>
            <span className="text-2xs text-ink-400">{(reports ?? []).length}</span>
          </div>
          {(reports ?? []).length === 0 ? (
            <div className="px-3.5 py-8 text-center text-sm text-ink-400">No reports yet.<br />Generate one above.</div>
          ) : (
            <div className="max-h-[calc(100vh-15rem)] overflow-y-auto">
              {(reports ?? []).map((r: any, i: number) => {
                const sel = open?._id === r._id;
                return (
                  <button
                    key={r._id}
                    onClick={() => setOpenId(r._id)}
                    className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${i > 0 ? "border-t border-line-soft" : ""} ${sel ? "bg-line-soft" : "hover:bg-line-soft"}`}
                  >
                    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${sel ? "bg-accent-soft text-accent" : "bg-line-soft text-ink-400"}`}><DocIcon /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink-900">{shortTitle(r.title)}</span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-2xs text-ink-400">
                        <span className="mono">{fmtDate(r.createdAt)}</span>
                        <span className="text-ink-300">·</span>
                        <span>{kindLabel(r.kind)}</span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* document viewer */}
        {open ? (
          <div className="card overflow-hidden">
            <div className="flex items-start justify-between gap-3 border-b border-line-soft px-5 py-3.5">
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md bg-accent-soft text-accent"><DocIcon /></span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-ink-900">{shortTitle(open.title)}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-2xs text-ink-400">
                    <span className="mono">{fmtDate(open.createdAt)}</span>
                    <span className="rounded bg-line-soft px-1.5 py-0.5 font-medium text-ink-500">{kindLabel(open.kind)}</span>
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <IconBtn title="Copy" onClick={() => navigator.clipboard?.writeText(open.content)}><CopyIcon /></IconBtn>
                <IconBtn title="Print" onClick={() => printReport(open)}><PrintIcon /></IconBtn>
                <IconBtn title="Delete" danger onClick={() => { remove({ reportId: open._id }); setOpenId(null); }}><TrashIcon /></IconBtn>
              </div>
            </div>
            <div className="max-h-[calc(100vh-14rem)] overflow-y-auto px-6 py-7">
              <div className="mx-auto max-w-2xl text-sm text-ink-800">
                <Markdown text={open.content} />
              </div>
            </div>
          </div>
        ) : (
          <div className="card grid min-h-[420px] place-items-center p-10 text-center">
            <div>
              <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-line-soft text-ink-400"><DocIcon /></div>
              <div className="mt-3 text-sm font-medium text-ink-700">No report selected</div>
              <div className="mt-1 text-xs text-ink-400">Pick one on the left, or generate a summary.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function shortTitle(title: string) {
  return title.split(" — ")[0].replace(/health summary/i, "Health summary").trim() || title;
}
function kindLabel(kind: string) {
  return ({ summary: "Summary", scheduled: "Auto", chat: "From chat", custom: "Custom", file: "File" } as Record<string, string>)[kind] ?? kind;
}

function IconBtn({ title, onClick, danger, children }: { title: string; onClick: () => void; danger?: boolean; children: ReactNode }) {
  return (
    <button title={title} onClick={onClick} className={`grid h-7 w-7 place-items-center rounded-md text-ink-400 transition-colors hover:bg-line-soft ${danger ? "hover:text-bad" : "hover:text-ink-800"}`}>
      {children}
    </button>
  );
}
const svg = "h-3.5 w-3.5";
function DocIcon() { return <svg viewBox="0 0 16 16" className={svg} fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M4 2h6l3 3v9H4zM10 2v3h3M6 8.5h5M6 11h4" /></svg>; }
function CopyIcon() { return <svg viewBox="0 0 16 16" className={svg} fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><rect x="5.5" y="5.5" width="8" height="8" rx="1" /><path d="M10.5 5.5V3.5a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2" /></svg>; }
function PrintIcon() { return <svg viewBox="0 0 16 16" className={svg} fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6.5V2.5h8v4M4 11.5H3a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1M4 9.5h8v4H4z" /></svg>; }
function TrashIcon() { return <svg viewBox="0 0 16 16" className={svg} fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.8 4.5l.4 8.5a1 1 0 0 0 1 .95h3.6a1 1 0 0 0 1-.95l.4-8.5" /></svg>; }

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
