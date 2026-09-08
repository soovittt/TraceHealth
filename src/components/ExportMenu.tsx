import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useStore } from "../lib/store";

const FORMATS: { key: "fhir" | "json" | "csv"; label: string; hint: string }[] = [
  { key: "fhir", label: "FHIR Bundle", hint: "Interoperable — import into another system" },
  { key: "csv", label: "Spreadsheet (CSV)", hint: "Every record as rows" },
  { key: "json", label: "JSON", hint: "The full normalized record" },
];

// Background export: requestExport schedules a Convex action that builds the
// file and stores it; we watch the job row reactively and download when ready.
export default function ExportMenu({ className = "" }: { className?: string }) {
  const { patientId } = useStore();
  const requestExport = useMutation(api.export.requestExport);
  const [open, setOpen] = useState(false);
  const [job, setJob] = useState<{ id: any; format: string } | null>(null);
  const status = useQuery(api.export.getExport, job ? { jobId: job.id } : "skip");
  const doneRef = useRef<string | null>(null);

  // When the job flips to "ready", pull the stored file and download it.
  useEffect(() => {
    if (!job || !status) return;
    if (status.status === "ready" && status.url && doneRef.current !== String(job.id)) {
      doneRef.current = String(job.id);
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
      setTimeout(() => setJob(null), 2500);
    } else if (status.status === "error") {
      setTimeout(() => setJob(null), 3500);
    }
  }, [job, status]);

  async function run(format: "fhir" | "json" | "csv") {
    if (!patientId || (job && status?.status === "pending")) return;
    doneRef.current = null;
    const id = await requestExport({ patientId, format });
    setJob({ id, format });
  }

  const busy = !!job && status?.status === "pending";

  return (
    <div className={`relative ${className}`}>
      <button className="btn-secondary w-full justify-start gap-2" onClick={() => setOpen((v) => !v)}>
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-ink-400" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 2v8m0 0 3-3M8 10 5 7M3 12.5h10" />
        </svg>
        Export record
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 z-40 mb-1.5 w-64 rounded-lg border border-line bg-surface p-1 shadow-pop animate-fade-in">
            <div className="px-2 py-1.5 text-2xs font-medium uppercase tracking-wide text-ink-400">Download your record</div>
            {FORMATS.map((f) => {
              const isThis = job?.format === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => run(f.key)}
                  disabled={busy}
                  className="flex w-full flex-col items-start rounded-md px-2 py-1.5 text-left hover:bg-line-soft disabled:opacity-50"
                >
                  <span className="text-sm text-ink-800">
                    {isThis && status?.status === "pending" ? "Preparing…" : isThis && status?.status === "ready" ? "Downloaded ✓" : f.label}
                  </span>
                  <span className="text-2xs text-ink-400">{f.hint}</span>
                </button>
              );
            })}

            {job && status && (
              <div className="mt-1 border-t border-line-soft px-2 py-1.5 text-2xs">
                {status.status === "pending" && (
                  <span className="flex items-center gap-1.5 text-ink-400">
                    <span className="flex gap-0.5">{[0, 1, 2].map((i) => <span key={i} className="h-1 w-1 rounded-full bg-accent" style={{ animation: `pulse 1s ${i * 0.15}s infinite ease-in-out` }} />)}</span>
                    Building your {job.format.toUpperCase()} in the background…
                  </span>
                )}
                {status.status === "ready" && <span className="text-good-ink">✓ {status.records} records exported · downloaded</span>}
                {status.status === "error" && <span className="text-bad">Export failed. Try again.</span>}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
