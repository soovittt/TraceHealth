import { useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useStore } from "../lib/store";

// A global, bottom-right toast for the background export job. Watches the job
// row reactively; when the Convex action finishes, it pulls the stored file and
// downloads it, then auto-dismisses.
export default function ExportToast() {
  const { exportJob, setExportJob } = useStore();
  const status = useQuery(api.export.getExport, exportJob ? { jobId: exportJob.id } : "skip");
  const doneRef = useRef<string | null>(null);

  useEffect(() => {
    if (!exportJob || !status) return;
    if (status.status === "ready" && status.url && doneRef.current !== String(exportJob.id)) {
      doneRef.current = String(exportJob.id);
      (async () => {
        const res = await fetch(status.url as string);
        const blob = await res.blob();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = status.filename ?? "tracehealth-export";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      })();
      const t = setTimeout(() => setExportJob(null), 4500);
      return () => clearTimeout(t);
    }
    if (status.status === "error") {
      const t = setTimeout(() => setExportJob(null), 5000);
      return () => clearTimeout(t);
    }
  }, [exportJob, status, setExportJob]);

  if (!exportJob) return null;
  const fmt = exportJob.format.toUpperCase();
  const st = status?.status ?? "pending";

  return (
    <div className="fixed bottom-4 right-4 z-[60] w-72 animate-rise rounded-lg border border-line bg-surface p-3 shadow-pop">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-accent-soft">
          {st === "pending" ? (
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 animate-spin text-accent"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" fill="none" /><path d="M14 8a6 6 0 0 0-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" /></svg>
          ) : st === "ready" ? (
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-good" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 8.5l3 3 6-7" /></svg>
          ) : (
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-bad" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="m4 4 8 8M12 4l-8 8" /></svg>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-ink-900">
            {st === "pending" ? `Exporting your ${fmt}…` : st === "ready" ? "Export ready" : "Export failed"}
          </div>
          <div className="mt-0.5 text-2xs text-ink-500">
            {st === "pending"
              ? "This usually takes a few seconds…"
              : st === "ready"
                ? `${status?.records ?? 0} records · downloaded to your device`
                : status?.error ?? "Please try again."}
          </div>
          {st === "ready" && status?.url && (
            <a href={status.url} download={status.filename ?? undefined} className="mt-1 inline-block text-2xs font-medium text-accent hover:underline">
              Download again ↓
            </a>
          )}
        </div>
        <button onClick={() => setExportJob(null)} className="grid h-5 w-5 shrink-0 place-items-center rounded text-ink-400 hover:bg-line-soft hover:text-ink-700">
          <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m4 4 8 8M12 4l-8 8" /></svg>
        </button>
      </div>
    </div>
  );
}
