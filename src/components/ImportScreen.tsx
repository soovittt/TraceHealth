import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useStore } from "../lib/store";
import { Wordmark } from "./brand";

function Check() {
  return (
    <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none">
      <path d="M3.5 8.5 6.5 11.5 12.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function Spinner() {
  return (
    <svg viewBox="0 0 16 16" className="h-3 w-3 animate-spin text-ink-400">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2" fill="none" />
      <path d="M14 8a6 6 0 0 0-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export default function ImportScreen() {
  const { patientId, setPatientId, go } = useStore();
  const job = useQuery(api.health.getProcessingJob, patientId ? { patientId } : "skip");
  const summary = useQuery(api.health.getSummary, patientId ? { patientId } : "skip");
  const ensurePatient = useMutation(api.patients.ensureMyPatient);
  const extract = useAction(api.ingest.extractAndImport);

  const [text, setText] = useState("");
  const [filename, setFilename] = useState("Pasted record.txt");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const done = job?.status === "done";
  const processing = !!job && !done;

  async function onFile(files: FileList | null) {
    if (!files || !files.length) return;
    const f = files[0];
    setFilename(f.name);
    setText(await f.text().catch(() => ""));
  }

  async function runExtract() {
    if (!text.trim()) return;
    setBusy(true);
    setResult(null);
    try {
      let pid = patientId;
      if (!pid) { pid = await ensurePatient({}); setPatientId(pid); }
      const c = await extract({ patientId: pid, filename, text });
      const total = c.observations + c.medications + c.conditions + c.encounters;
      setResult(`Extracted ${c.observations} labs · ${c.medications} meds · ${c.conditions} conditions · ${c.encounters} encounters (${total} facts).`);
      setText("");
    } catch (e: any) {
      setResult(e?.message ?? "Extraction failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-full">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-3xl items-center px-6 py-3.5">
          <button onClick={() => go("landing")}><Wordmark /></button>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-6 py-14">
        {processing || done ? (
          <section className="animate-fade-in">
            <div className="eyebrow">{done ? "Complete" : "Processing"}</div>
            <h1 className="mt-1.5 text-2xl font-semibold text-ink-900">
              {done ? "Health history reconstructed" : "Reconstructing health history"}
            </h1>
            <p className="mt-1 text-sm text-ink-500">
              Normalizing records from {summary?.providers ?? "…"} providers across {summary?.years ?? "…"} years.
            </p>

            <div className="mt-6 card divide-y divide-line-soft">
              {job?.steps.map((s: any, i: number) => (
                <div key={i} className="flex items-center justify-between px-3.5 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className={`grid h-5 w-5 place-items-center rounded-full ${s.done ? "bg-brand text-brand-fg" : "border border-line-strong bg-surface text-ink-400"}`}>
                      {s.done ? <Check /> : <Spinner />}
                    </span>
                    <span className={`text-sm ${s.done ? "text-ink-800" : "text-ink-400"}`}>{s.label}</span>
                  </div>
                  {s.count !== undefined && s.done && <span className="mono text-sm text-ink-900">{s.count}</span>}
                </div>
              ))}
            </div>

            {done && (
              <div className="mt-5 animate-fade-in">
                <div className="grid grid-cols-3 overflow-hidden rounded-lg border border-line">
                  <Stat n={summary?.years ?? 0} l="years" />
                  <Stat n={summary?.labResults ?? 0} l="lab results" border />
                  <Stat n={summary?.encounters ?? 0} l="encounters" border />
                </div>
                <button className="btn-primary mt-4 w-full py-2" onClick={() => go("home")}>Open health record →</button>
              </div>
            )}
          </section>
        ) : (
          <section className="animate-fade-in">
            <div className="eyebrow">Import</div>
            <h1 className="mt-1.5 text-2xl font-semibold text-ink-900">Add a document</h1>
            <p className="mt-1 text-sm text-ink-500">
              Upload or paste a record — extracted with AI into one normalized history. To connect a
              provider account,{" "}
              <button className="font-medium text-accent" onClick={() => go("integrations")}>
                go to Connections
              </button>
              .
            </p>

            <label className="mt-6 flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-line-strong bg-surface px-6 py-8 text-center transition-colors hover:border-accent-line hover:bg-canvas">
              <input type="file" className="hidden" accept=".txt,.csv,.json,.md,.pdf,.xml" onChange={(e) => onFile(e.target.files)} />
              <div className="text-sm font-medium text-ink-800">Choose a file, or paste below</div>
              <div className="mt-1 text-xs text-ink-400">Text records extract instantly</div>
            </label>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Quest Diagnostics, 2025-08-07. LDL 164 mg/dL. HbA1c 5.7%."
              className="input mt-3 h-32 resize-none font-mono text-xs"
            />

            <div className="mt-3 flex items-center gap-3">
              <button className="btn-primary" onClick={runExtract} disabled={busy || !text.trim()}>
                {busy ? "Extracting…" : "Extract with AI"}
              </button>
              {result && <span className="text-xs text-ink-500">{result}</span>}
            </div>

            {patientId && <button className="btn-secondary mt-6 w-full" onClick={() => go("home")}>Open health record →</button>}

            <div className="mt-8 rounded-md border border-line bg-canvas px-3.5 py-3 text-sm text-ink-500">
              In a hurry?{" "}
              <button className="font-medium text-accent" onClick={() => go("landing")}>Load the demo patient</button>{" "}
              for the full 8-year history.
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function Stat({ n, l, border }: { n: number; l: string; border?: boolean }) {
  return (
    <div className={`bg-surface px-3 py-3 text-center ${border ? "border-l border-line" : ""}`}>
      <div className="mono text-xl font-semibold text-ink-900">{n}</div>
      <div className="text-2xs text-ink-400">{l}</div>
    </div>
  );
}
