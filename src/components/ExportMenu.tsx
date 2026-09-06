import { useState } from "react";
import { useConvex } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useStore } from "../lib/store";
import { downloadText } from "../lib/download";

const FORMATS: { key: "fhir" | "json" | "csv"; label: string; hint: string }[] = [
  { key: "fhir", label: "FHIR Bundle", hint: "Interoperable — import into another system" },
  { key: "csv", label: "Spreadsheet (CSV)", hint: "Every record as rows" },
  { key: "json", label: "JSON", hint: "The full normalized record" },
];

// On-demand export: fetches the chosen format imperatively (not reactively) and
// hands the browser a real file download.
export default function ExportMenu({ className = "" }: { className?: string }) {
  const { patientId, shareToken } = useStore();
  const convex = useConvex();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  async function run(format: "fhir" | "json" | "csv") {
    if (!patientId) return;
    setBusy(format);
    try {
      const res = await convex.query(api.export.exportRecord, { patientId, format, shareToken: shareToken ?? undefined });
      if (res) downloadText(res.filename, res.mime, res.content);
    } finally {
      setBusy(null);
      setOpen(false);
    }
  }

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
            {FORMATS.map((f) => (
              <button
                key={f.key}
                onClick={() => run(f.key)}
                disabled={!!busy}
                className="flex w-full flex-col items-start rounded-md px-2 py-1.5 text-left hover:bg-canvas disabled:opacity-50"
              >
                <span className="text-sm text-ink-800">{busy === f.key ? "Preparing…" : f.label}</span>
                <span className="text-2xs text-ink-400">{f.hint}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
