import { useState } from "react";
import { useStore } from "../lib/store";
import ExportDialog from "./ExportDialog";

// Opens the full export dialog (format + categories + live preview).
export default function ExportMenu({ className = "" }: { className?: string }) {
  const { patientId } = useStore();
  const [open, setOpen] = useState(false);

  return (
    <div className={className}>
      <button className="btn-secondary w-full justify-start gap-2" onClick={() => setOpen(true)} disabled={!patientId}>
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-ink-400" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 2v8m0 0 3-3M8 10 5 7M3 12.5h10" />
        </svg>
        Export record
      </button>
      {open && <ExportDialog onClose={() => setOpen(false)} />}
    </div>
  );
}
