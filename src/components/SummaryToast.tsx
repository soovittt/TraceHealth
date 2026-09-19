import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useStore } from "../lib/store";

// Bottom-right progress toast for background summary generation. Shows a spinner
// while the Convex job runs, then flips to "ready" (detected reactively from a
// notification watermark) with a View link, and auto-dismisses.
export default function SummaryToast() {
  const { patientId, summaryJob, setSummaryJob, go, setFocusReport } = useStore();
  const notes = useQuery(api.notifications.list, patientId && summaryJob ? { patientId } : "skip");

  const [phase, setPhase] = useState<"pending" | "ready" | "error">("pending");
  const [readyId, setReadyId] = useState<string | null>(null);
  const watermark = useRef<number | null>(null);

  // Reset whenever a new job starts.
  useEffect(() => {
    if (summaryJob) { setPhase("pending"); setReadyId(null); watermark.current = null; }
  }, [summaryJob?.startedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  // Detect completion via a new report_ready / report_failed notification.
  useEffect(() => {
    if (!summaryJob || phase !== "pending" || !notes) return;
    if (watermark.current === null) {
      watermark.current = notes.reduce((m: number, n: any) => Math.max(m, n.createdAt), 0);
      return;
    }
    const done = notes.find(
      (n: any) => n.createdAt > (watermark.current as number) && (n.kind === "report_ready" || n.kind === "report_failed"),
    );
    if (done) {
      if (done.kind === "report_ready") { setReadyId(done.refId ?? null); setPhase("ready"); }
      else setPhase("error");
    }
  }, [notes, summaryJob, phase]);

  // Auto-dismiss once resolved.
  useEffect(() => {
    if (phase === "ready" || phase === "error") {
      const t = setTimeout(() => setSummaryJob(null), 6000);
      return () => clearTimeout(t);
    }
  }, [phase, setSummaryJob]);

  // Safety: never leave a stuck spinner forever.
  useEffect(() => {
    if (!summaryJob) return;
    const t = setTimeout(() => setSummaryJob(null), 120000);
    return () => clearTimeout(t);
  }, [summaryJob?.startedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!summaryJob) return null;

  function view() {
    if (readyId) { setFocusReport(readyId); go("reports"); }
    setSummaryJob(null);
  }

  return (
    <div className="fixed bottom-4 right-4 z-[60] w-72 animate-rise rounded-lg border border-line bg-surface p-3 shadow-pop">
      <div className="flex items-start gap-2.5">
        <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md ${phase === "error" ? "bg-bad-soft" : "bg-accent-soft"}`}>
          {phase === "pending" ? (
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 animate-spin text-accent"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" fill="none" /><path d="M14 8a6 6 0 0 0-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" /></svg>
          ) : phase === "ready" ? (
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-good" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 8.5l3 3 6-7" /></svg>
          ) : (
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-bad" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="m4 4 8 8M12 4l-8 8" /></svg>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-ink-900">
            {phase === "pending" ? "Generating your summary…" : phase === "ready" ? "Summary ready" : "Couldn't generate summary"}
          </div>
          <div className="mt-0.5 text-2xs text-ink-500">
            {phase === "pending"
              ? "This usually takes a few seconds — we'll let you know."
              : phase === "ready"
                ? "Your health summary is ready to view."
                : "Something went wrong — please try again."}
          </div>
          {phase === "ready" && (
            <button onClick={view} className="mt-1 inline-block text-2xs font-medium text-accent hover:underline">
              View report →
            </button>
          )}
        </div>
        <button onClick={() => setSummaryJob(null)} className="grid h-5 w-5 shrink-0 place-items-center rounded text-ink-400 hover:bg-line-soft hover:text-ink-700">
          <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m4 4 8 8M12 4l-8 8" /></svg>
        </button>
      </div>
    </div>
  );
}
