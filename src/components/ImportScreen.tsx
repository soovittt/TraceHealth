import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useStore } from "../lib/store";

type Mode = "extract" | "import";

// The "Add data" hub — three real ways to get records IN, alongside the
// provider sync on Connections. Renders inside the app shell.
export default function ImportScreen() {
  const { patientId, setPatientId, go, showEvidence } = useStore();
  const ensurePatient = useMutation(api.patients.ensureMyPatient);
  const importBundle = useMutation(api.ingest.importBundle);
  const generateUploadUrl = useMutation(api.ingest.generateUploadUrl);
  const requestIngest = useMutation(api.ingest.requestIngest);

  const [mode, setMode] = useState<Mode>("extract");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // The active AI-extraction job — watched reactively (no polling, no blocking).
  const [jobId, setJobId] = useState<any>(null);
  const job = useQuery(api.ingest.getIngestJob, jobId ? { jobId } : "skip");

  async function pid() {
    if (patientId) return patientId;
    const id = await ensurePatient({});
    setPatientId(id);
    return id;
  }

  async function upload(file: File): Promise<any> {
    const url = await generateUploadUrl();
    const up = await fetch(url, { method: "POST", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
    const { storageId } = await up.json();
    return storageId;
  }

  // --- AI extract (unstructured text/notes) ---
  const [text, setText] = useState("");
  const [filename, setFilename] = useState("Pasted record.txt");

  async function startText() {
    if (!text.trim()) return;
    setResult(null);
    const id = await requestIngest({ patientId: await pid(), source: "text", filename, text });
    setJobId(id);
    setText("");
  }

  // A dropped file in the main uploader: PDF → PDF reader, image → vision,
  // anything text-like (txt/csv/xml/C-CDA/HL7) → the box for review + AI extract.
  async function chooseRecord(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    const name = file.name.toLowerCase();
    const isPdf = file.type === "application/pdf" || name.endsWith(".pdf");
    const isImage = file.type.startsWith("image/");
    if (isPdf || isImage) {
      setBusy(true);
      setResult(null);
      try {
        const storageId = await upload(file);
        const id = await requestIngest({ patientId: await pid(), source: isPdf ? "pdf" : "image", filename: file.name, storageId });
        setJobId(id);
      } catch (e: any) {
        setResult({ ok: false, msg: e?.message ?? "Upload failed." });
      } finally {
        setBusy(false);
      }
      return;
    }
    setFilename(file.name);
    setText(await file.text().catch(() => ""));
  }

  // --- deterministic bundle import (FHIR / TraceHealth JSON) ---
  async function importFile(files: FileList | null) {
    if (!files?.length) return;
    const f = files[0];
    setBusy(true);
    setResult(null);
    try {
      const raw = await f.text();
      const c = await importBundle({ patientId: await pid(), filename: f.name, text: raw });
      const total = c.observations + c.medications + c.conditions + c.encounters + c.allergies;
      setResult({ ok: true, msg: `Imported ${total} records from ${f.name} (${c.observations} labs · ${c.medications} meds · ${c.conditions} conditions · ${c.allergies} allergies).` });
    } catch (e: any) {
      setResult({ ok: false, msg: e?.message ?? "Import failed." });
    } finally {
      setBusy(false);
    }
  }

  const running = !!job && ["pending", "reading", "extracting"].includes(job.status);

  return (
    <div className="mx-auto max-w-2xl animate-fade-in">
      <div className="eyebrow">Add data</div>
      <h1 className="mt-1.5 text-xl font-semibold text-ink-900">Bring records into your history</h1>
      <p className="mt-1 text-sm text-ink-500">
        The richest source is a live provider —{" "}
        <button className="font-medium text-accent" onClick={() => go("integrations")}>connect one on Connections</button>. You can also add data by hand here.
      </p>

      {/* mode tabs */}
      <div className="mt-5 flex gap-1 rounded-lg border border-line bg-canvas p-1">
        {([
          ["extract", "Paste / upload a record"],
          ["import", "Import a data file"],
        ] as [Mode, string][]).map(([m, label]) => (
          <button
            key={m}
            onClick={() => { setMode(m); setResult(null); }}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${mode === m ? "bg-surface text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-800"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {mode === "extract" && (
          <section>
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-line-strong bg-surface px-6 py-7 text-center transition-colors hover:border-accent-line hover:bg-line-soft">
              <input type="file" className="hidden" accept=".pdf,.txt,.csv,.md,.html,.xml,.cda,.ccd,.hl7,image/*" onChange={(e) => chooseRecord(e.target.files)} />
              <div className="text-sm font-medium text-ink-800">{busy ? "Uploading…" : "Drop a PDF, photo, or text file — or paste below"}</div>
              <div className="mt-1 text-xs text-ink-400">Lab reports, discharge & after-visit summaries, C-CDA/XML — AI extracts labs, meds, conditions & allergies, each cited to this document</div>
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Quest Diagnostics, 2025-08-07. LDL 164 mg/dL. HbA1c 5.7%. Penicillin allergy — rash."
              className="input mt-3 h-32 resize-none font-mono text-xs"
            />
            <div className="mt-3 flex items-center gap-3">
              <button className="btn-primary" onClick={startText} disabled={running || !text.trim()}>
                {running ? "Working…" : "Extract with AI"}
              </button>
            </div>

            <div className="my-4 flex items-center gap-3 text-2xs text-ink-400">
              <span className="h-px flex-1 bg-line" /> or snap a photo <span className="h-px flex-1 bg-line" />
            </div>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-line-strong bg-surface px-6 py-5 text-center transition-colors hover:border-accent-line hover:bg-line-soft">
              <input type="file" className="hidden" accept="image/*" capture="environment" onChange={(e) => chooseRecord(e.target.files)} />
              <svg viewBox="0 0 16 16" className="h-5 w-5 text-ink-400" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2.5 5.5h2l1-1.5h5l1 1.5h2v7h-11zM8 10.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
              </svg>
              <span className="text-sm font-medium text-ink-800">Photograph a lab report or med list</span>
              <span className="text-2xs text-ink-400">GPT-4o vision reads the values</span>
            </label>

            {job && <JobPanel job={job} onView={() => go("timeline")} onSource={(id: any) => showEvidence({ documentId: id })} onDismiss={() => setJobId(null)} />}
          </section>
        )}

        {mode === "import" && (
          <section>
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-line-strong bg-surface px-6 py-9 text-center transition-colors hover:border-accent-line hover:bg-line-soft">
              <input type="file" className="hidden" accept=".json,.fhir" onChange={(e) => importFile(e.target.files)} />
              <svg viewBox="0 0 16 16" className="h-6 w-6 text-ink-300" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 10V2m0 0L5 5m3-3 3 3M3 11.5v1a1.5 1.5 0 0 0 1.5 1.5h7A1.5 1.5 0 0 0 13 12.5v-1" />
              </svg>
              <div className="mt-2 text-sm font-medium text-ink-800">{busy ? "Importing…" : "Choose a FHIR Bundle or JSON export"}</div>
              <div className="mt-1 text-xs text-ink-400">A FHIR R4 Bundle or a TraceHealth JSON export — imported exactly, no AI</div>
            </label>
            <p className="mt-2 text-2xs text-ink-400">Tip: export your record from another TraceHealth account (or any FHIR system) and re-import it here — the round-trip is lossless.</p>
          </section>
        )}
      </div>

      {result && (
        <div className={`mt-4 rounded-md border px-3.5 py-2.5 text-sm ${result.ok ? "border-good-line bg-good-soft text-good-ink" : "border-bad/30 bg-bad-soft text-bad-ink"}`}>
          {result.msg}
        </div>
      )}

      {patientId && (
        <div className="mt-6 flex gap-2">
          <button className="btn-secondary" onClick={() => go("timeline")}>View timeline →</button>
          <button className="btn-ghost" onClick={() => go("home")}>Overview</button>
        </div>
      )}
    </div>
  );
}

// Live status + the actual extracted records — so the user SEES what came in,
// traced to the source document, before trusting it.
function JobPanel({ job, onView, onSource, onDismiss }: { job: any; onView: () => void; onSource: (id: any) => void; onDismiss: () => void }) {
  const stage: Record<string, string> = {
    pending: "Queued…",
    reading: job.source === "pdf" ? "Reading the PDF…" : job.source === "image" ? "Reading the image…" : "Reading the record…",
    extracting: "Extracting structured records…",
  };

  if (job.status === "error") {
    return (
      <div className="mt-4 rounded-md border border-bad/30 bg-bad-soft px-3.5 py-2.5 text-sm text-bad-ink">
        <div className="font-medium">Couldn’t read {job.filename}.</div>
        <div className="mt-0.5 text-xs opacity-90">{job.error}</div>
        <button className="mt-2 text-xs font-medium underline" onClick={onDismiss}>Dismiss</button>
      </div>
    );
  }

  if (job.status !== "ready") {
    return (
      <div className="mt-4 flex items-center gap-3 rounded-md border border-line bg-canvas px-3.5 py-3 text-sm text-ink-600">
        <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-line-strong border-t-accent" />
        <span>{stage[job.status] ?? "Working…"}</span>
        <span className="mono ml-auto text-2xs text-ink-400">{job.filename}</span>
      </div>
    );
  }

  const c = job.counts ?? { observations: 0, medications: 0, conditions: 0, encounters: 0, allergies: 0 };
  const total = c.observations + c.medications + c.conditions + c.encounters + c.allergies;
  const tagFor: Record<string, string> = { lab: "Lab", medication: "Rx", condition: "Dx", encounter: "Visit", allergy: "Allergy" };

  return (
    <div className="mt-4 rounded-lg border border-good-line bg-good-soft/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-ink-900">
            {total > 0 ? `Added ${total} record${total === 1 ? "" : "s"} from ${job.filename}` : `No new records found in ${job.filename}`}
          </div>
          <div className="mt-0.5 text-xs text-ink-500">
            {c.observations} labs · {c.medications} meds · {c.conditions} conditions · {c.allergies} allergies
            {job.skipped > 0 && <span className="text-ink-400"> · {job.skipped} duplicate{job.skipped === 1 ? "" : "s"} skipped</span>}
            {job.org ? <span className="text-ink-400"> · source: {job.org}</span> : null}
          </div>
        </div>
        <button className="text-xs text-ink-400 hover:text-ink-700" onClick={onDismiss}>✕</button>
      </div>

      {job.preview?.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {job.preview.map((p: any, i: number) => (
            <div key={i} className="flex items-center gap-2.5 rounded-md border border-line bg-surface px-2.5 py-1.5">
              <span className="tag shrink-0">{tagFor[p.kind] ?? "•"}</span>
              <span className="min-w-0 flex-1 truncate text-sm text-ink-800">{p.text}</span>
              {p.sub && <span className="mono shrink-0 text-2xs text-ink-400">{p.sub}</span>}
            </div>
          ))}
        </div>
      )}

      <div className="mt-3.5 flex gap-2">
        <button className="btn-primary px-3 py-1.5 text-xs" onClick={onView}>View in timeline →</button>
        {job.documentId && <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => onSource(job.documentId)}>View source</button>}
        <button className="btn-ghost px-3 py-1.5 text-xs" onClick={onDismiss}>Add more</button>
      </div>
    </div>
  );
}
