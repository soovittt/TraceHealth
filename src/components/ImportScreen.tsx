import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useStore } from "../lib/store";
import SourceHistory from "./SourceHistory";


// The "Add data" hub — three real ways to get records IN, alongside the
// provider sync on Connections. Renders inside the app shell.
export default function ImportScreen() {
  const { patientId, setPatientId, go, showEvidence } = useStore();
  const ensurePatient = useMutation(api.patients.ensureMyPatient);
  const importBundle = useMutation(api.ingest.importBundle);
  const generateUploadUrl = useMutation(api.ingest.generateUploadUrl);
  const requestIngest = useMutation(api.ingest.requestIngest);

  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // The active AI-extraction job — watched reactively (no polling, no blocking).
  const [jobId, setJobId] = useState<any>(null);
  const job = useQuery(api.ingest.getIngestJob, jobId ? { jobId } : "skip");
  // The last deterministic import, shown with the same preview card as the AI path.
  const [importCard, setImportCard] = useState<any>(null);

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

  // ONE entry point for every file. We detect the type and route it — the user
  // never has to know whether their record is a "data file" or a "document":
  //   FHIR / JSON  → deterministic import (no AI)
  //   PDF          → native PDF reader
  //   image        → vision extraction
  //   text-like    → AI text extraction (txt / csv / xml / C-CDA / HL7)
  async function onFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    const name = file.name.toLowerCase();
    const ext = name.split(".").pop() ?? "";
    setResult(null);
    if (ext === "json" || ext === "fhir") { await importFile(files); return; }
    const isPdf = file.type === "application/pdf" || ext === "pdf";
    const isImage = file.type.startsWith("image/");
    setBusy(true);
    try {
      let id;
      if (isPdf || isImage) {
        const storageId = await upload(file);
        id = await requestIngest({ patientId: await pid(), source: isPdf ? "pdf" : "image", filename: file.name, storageId });
      } else {
        const raw = await file.text();
        id = await requestIngest({ patientId: await pid(), source: "text", filename: file.name, text: raw });
      }
      setJobId(id);
    } catch (e: any) {
      setResult({ ok: false, msg: e?.message ?? "Couldn't read that file." });
    } finally {
      setBusy(false);
    }
  }

  // --- deterministic bundle import (FHIR / TraceHealth JSON) ---
  async function importFile(files: FileList | null) {
    if (!files?.length) return;
    const f = files[0];
    setBusy(true);
    setResult(null);
    try {
      const raw = await f.text();
      const c: any = await importBundle({ patientId: await pid(), filename: f.name, text: raw });
      setImportCard({
        status: "ready",
        source: "import",
        filename: f.name,
        org: c.org,
        counts: { observations: c.observations, medications: c.medications, conditions: c.conditions, encounters: c.encounters, allergies: c.allergies },
        skipped: c.skipped ?? 0,
        preview: c.preview ?? [],
        documentId: c.documentId,
      });
    } catch (e: any) {
      setResult({ ok: false, msg: e?.message ?? "Import failed." });
    } finally {
      setBusy(false);
    }
  }

  const running = !!job && ["pending", "reading", "extracting"].includes(job.status);

  const anyBusy = busy || running;

  return (
    <div className="mx-auto max-w-2xl animate-fade-in pb-10">
      <div className="eyebrow">Add data</div>
      <h1 className="mt-1.5 text-2xl font-semibold text-ink-900">Bring your records in</h1>
      <p className="mt-1 text-sm text-ink-500">Drop any medical file — we read it, structure it, and trace every fact to its source.</p>

      {/* ONE import surface — a single smart dropzone that accepts anything, with
          paste as a secondary affordance. No tabs, no classifying your file. */}
      <div className="mt-5 card p-2">
        <label
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); onFiles(e.dataTransfer.files); }}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-11 text-center transition-colors ${drag ? "border-accent bg-accent-soft" : "border-line-strong hover:border-accent-line hover:bg-line-soft"}`}
        >
          <input type="file" className="hidden" accept=".pdf,.txt,.csv,.md,.html,.xml,.cda,.ccd,.hl7,.json,.fhir,image/*" onChange={(e) => onFiles(e.target.files)} />
          <span className="grid h-11 w-11 place-items-center rounded-full bg-line-soft text-ink-500">
            <svg viewBox="0 0 16 16" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M8 10.5V2.5m0 0L5 5.5m3-3 3 3M3 11v1.5A1.5 1.5 0 0 0 4.5 14h7a1.5 1.5 0 0 0 1.5-1.5V11" /></svg>
          </span>
          <div className="mt-3 text-[15px] font-semibold text-ink-900">
            {anyBusy ? "Reading your file…" : drag ? "Drop to add it" : "Drop a file, or click to browse"}
          </div>
          <div className="mt-1 text-xs text-ink-400">We detect the type and route it automatically</div>
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {["PDF", "Photo", "FHIR / JSON", "C-CDA", "Text"].map((c) => (
              <span key={c} className="rounded border border-line bg-canvas px-1.5 py-0.5 text-2xs font-medium text-ink-500">{c}</span>
            ))}
          </div>
        </label>

        {/* secondary: paste text */}
        <div className="mt-2 rounded-lg bg-canvas px-3 py-2.5">
          <div className="flex items-center justify-between">
            <span className="eyebrow">Or paste text</span>
            <span className="text-2xs text-ink-400">GPT-4o extracts & cites each fact</span>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Quest Diagnostics, 2025-08-07. LDL 164 mg/dL. HbA1c 5.7%. Penicillin allergy — rash."
            className="input mt-2 h-20 resize-none bg-surface font-mono text-xs"
          />
          <div className="mt-2 flex justify-end">
            <button className="btn-primary px-3 py-1.5 text-xs" onClick={startText} disabled={anyBusy || !text.trim()}>
              {running ? "Working…" : "Extract with AI"}
            </button>
          </div>
        </div>
      </div>

      {/* quiet, higher-value alternative */}
      <button onClick={() => go("integrations")} className="mt-3 flex w-full items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3 text-left transition-colors hover:bg-line-soft">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-accent-soft text-accent">
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M6.5 9.5 4.8 11.2a2.4 2.4 0 0 1-3.4-3.4l1.7-1.7M9.5 6.5l1.7-1.7a2.4 2.4 0 0 1 3.4 3.4l-1.7 1.7M6 10l4-4" /></svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-ink-900">Connect a provider</span>
          <span className="block text-2xs text-ink-500">Pull your full history automatically over FHIR — the richest source</span>
        </span>
        <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0 text-ink-400" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4l4 4-4 4" /></svg>
      </button>

      {/* result cards */}
      {job && <JobPanel job={job} onView={() => go("timeline")} onSource={(id: any) => showEvidence({ documentId: id })} onDismiss={() => setJobId(null)} />}
      {importCard && <JobPanel job={importCard} onView={() => go("timeline")} onSource={(id: any) => showEvidence({ documentId: id })} onDismiss={() => setImportCard(null)} />}
      {result && !result.ok && (
        <div className="mt-4 rounded-md border border-bad/30 bg-bad-soft px-3.5 py-2.5 text-sm text-bad-ink">{result.msg}</div>
      )}

      {/* the audit trail */}
      <div className="mt-8">
        <SourceHistory />
      </div>
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

  // Count chips (only the non-zero types) + preview grouped by type so the card
  // reads like a mini record, not a flat dump.
  const chips: [string, number][] = [["labs", c.observations], ["meds", c.medications], ["conditions", c.conditions], ["visits", c.encounters], ["allergies", c.allergies]];
  const groupOrder = ["lab", "medication", "condition", "encounter", "allergy"];
  const groupLabel: Record<string, string> = { lab: "Labs", medication: "Medications", condition: "Conditions", encounter: "Visits", allergy: "Allergies" };
  const groups = groupOrder
    .map((k) => [k, (job.preview ?? []).filter((p: any) => p.kind === k)] as [string, any[]])
    .filter(([, items]) => items.length > 0);

  return (
    <div className="mt-4 rounded-lg border border-good-line bg-good-soft/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-ink-900">
            {total > 0 ? `Added ${total} record${total === 1 ? "" : "s"} from ${job.filename}` : `No new records found in ${job.filename}`}
          </div>
          <div className="mt-0.5 text-xs text-ink-500">
            {job.skipped > 0 && <span className="text-ink-400">{job.skipped} duplicate{job.skipped === 1 ? "" : "s"} skipped · </span>}
            {job.org ? <span>source: {job.org}</span> : null}
          </div>
        </div>
        <button className="text-xs text-ink-400 hover:text-ink-700" onClick={onDismiss}>✕</button>
      </div>

      {/* count chips */}
      {total > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {chips.filter(([, n]) => n > 0).map(([label, n]) => (
            <span key={label} className="rounded-full border border-line bg-surface px-2 py-0.5 text-2xs font-medium text-ink-600">
              {n} {label}
            </span>
          ))}
        </div>
      )}

      {/* records grouped by type */}
      {groups.length > 0 && (
        <div className="mt-3 space-y-3">
          {groups.map(([kind, items]) => (
            <div key={kind}>
              <div className="eyebrow mb-1">{groupLabel[kind]}</div>
              <div className="space-y-1">
                {items.map((p: any, i: number) => (
                  <div key={i} className="flex items-center gap-2.5 rounded-md border border-line bg-surface px-2.5 py-1.5">
                    <span className="tag shrink-0">{tagFor[p.kind] ?? "•"}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-ink-800">{p.text}</span>
                    {p.sub && <span className="mono shrink-0 text-2xs text-ink-400">{p.sub}</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {total > (job.preview?.length ?? 0) && (
            <div className="text-2xs text-ink-400">+ {total - (job.preview?.length ?? 0)} more in your timeline</div>
          )}
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
