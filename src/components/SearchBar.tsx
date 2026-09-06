import { useState, useRef, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useStore } from "../lib/store";
import { fmtDate } from "../lib/format";

export default function SearchBar() {
  const { patientId, openMetric, go, showEvidence } = useStore();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useQuery(api.health.search, patientId && q.trim() ? { patientId, q } : "skip");

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  function pickMetric(code: string) {
    setOpen(false);
    setQ("");
    openMetric(code);
  }

  function openDoc(documentId?: string, page?: number) {
    setOpen(false);
    setQ("");
    if (documentId) showEvidence({ documentId: documentId as any, page });
    else go("timeline");
  }

  return (
    <div ref={boxRef} className="relative w-full min-w-0 max-w-sm">
      <div className="flex items-center gap-2 rounded-md border border-line-strong bg-canvas px-2.5 py-1.5 focus-within:border-accent-line focus-within:bg-surface">
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-ink-400" fill="none" stroke="currentColor" strokeWidth="1.4">
          <circle cx="7" cy="7" r="4.5" />
          <path d="M11 11l3 3" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search records — cholesterol, metformin, 2024…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-ink-400"
        />
        <span className="kbd hidden sm:flex">⌘K</span>
      </div>

      {open && q.trim() && results && (
        <div className="absolute z-30 mt-1.5 max-h-96 w-full overflow-auto rounded-lg border border-line bg-surface p-1 shadow-pop animate-fade-in">
          {results.kind === "metric" && (
            <button className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left hover:bg-canvas" onClick={() => pickMetric(results.code)}>
              <span className="text-sm">Open <span className="font-medium">{results.code}</span> trend</span>
              <span className="text-xs text-ink-400">↵</span>
            </button>
          )}

          {results.kind === "year" && (
            <div>
              <div className="eyebrow px-2 py-1.5">
                {results.year} · {results.encounters.length} encounters · {results.observations.length} labs
              </div>
              {results.encounters.map((e: any) => (
                <button key={e._id} onClick={() => openDoc(e.documentId, e.page)} className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-canvas">
                  <span className="text-ink-800">{e.title}</span>
                  <span className="mono text-2xs text-ink-400">{fmtDate(e.date)}</span>
                </button>
              ))}
              <button className="mt-0.5 w-full rounded-md px-2.5 py-1.5 text-left text-sm text-accent hover:bg-canvas" onClick={() => { setOpen(false); go("timeline"); }}>
                Open full timeline →
              </button>
            </div>
          )}

          {results.kind === "results" && (
            <div>
              <Group label="Medications" items={results.medications.map((m: any) => ({ label: m.name, onClick: () => openDoc(m.documentId, m.page) }))} />
              <Group label="Conditions" items={results.conditions.map((c: any) => ({ label: c.name, onClick: () => openDoc(c.documentId, c.page) }))} />
              <Group label="Visits" items={results.encounters.map((e: any) => ({ label: e.title, onClick: () => openDoc(e.documentId, e.page) }))} />
              <Group label="Missing records" items={results.missing.map((m: any) => ({ label: `${m.label} · ${m.org}`, onClick: () => openDoc(m.referencedInDocumentId) }))} />
              {results.medications.length + results.conditions.length + results.encounters.length + results.missing.length === 0 && (
                <div className="px-2.5 py-3 text-sm text-ink-400">No matches.</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Group({ label, items }: { label: string; items: { label: string; onClick: () => void }[] }) {
  if (!items.length) return null;
  return (
    <div className="mb-0.5">
      <div className="eyebrow px-2 py-1.5">{label}</div>
      {items.map((it, i) => (
        <button key={i} onClick={it.onClick} className="block w-full rounded-md px-2.5 py-1.5 text-left text-sm text-ink-800 hover:bg-canvas">{it.label}</button>
      ))}
    </div>
  );
}
