import { useState } from "react";
import { useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useStore } from "../lib/store";

type Mode = "extract" | "import" | "manual";
type Kind = "observation" | "medication" | "condition" | "allergy";

// The "Add data" hub — three real ways to get records IN, alongside the
// provider sync on Connections. Renders inside the app shell.
export default function ImportScreen() {
  const { patientId, setPatientId, go } = useStore();
  const ensurePatient = useMutation(api.patients.ensureMyPatient);
  const extract = useAction(api.ingest.extractAndImport);
  const importBundle = useMutation(api.ingest.importBundle);

  const [mode, setMode] = useState<Mode>("extract");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  async function pid() {
    if (patientId) return patientId;
    const id = await ensurePatient({});
    setPatientId(id);
    return id;
  }

  // --- AI extract (unstructured text/notes) ---
  const [text, setText] = useState("");
  const [filename, setFilename] = useState("Pasted record.txt");

  async function runExtract() {
    if (!text.trim()) return;
    setBusy(true);
    setResult(null);
    try {
      const c = await extract({ patientId: await pid(), filename, text });
      const total = c.observations + c.medications + c.conditions + c.encounters + c.allergies;
      setResult({ ok: true, msg: `Extracted ${c.observations} labs · ${c.medications} meds · ${c.conditions} conditions · ${c.allergies} allergies (${total} facts).` });
      setText("");
    } catch (e: any) {
      setResult({ ok: false, msg: e?.message ?? "Extraction failed." });
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
      const c = await importBundle({ patientId: await pid(), filename: f.name, text: raw });
      const total = c.observations + c.medications + c.conditions + c.encounters + c.allergies;
      setResult({ ok: true, msg: `Imported ${total} records from ${f.name} (${c.observations} labs · ${c.medications} meds · ${c.conditions} conditions · ${c.allergies} allergies).` });
    } catch (e: any) {
      setResult({ ok: false, msg: e?.message ?? "Import failed." });
    } finally {
      setBusy(false);
    }
  }

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
          ["manual", "Add manually"],
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
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-line-strong bg-surface px-6 py-7 text-center transition-colors hover:border-accent-line hover:bg-canvas">
              <input type="file" className="hidden" accept=".txt,.csv,.md,.html" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { setFilename(f.name); setText(await f.text().catch(() => "")); } }} />
              <div className="text-sm font-medium text-ink-800">Choose a text file, or paste below</div>
              <div className="mt-1 text-xs text-ink-400">AI extracts labs, meds, conditions & allergies — every fact cited to this document</div>
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Quest Diagnostics, 2025-08-07. LDL 164 mg/dL. HbA1c 5.7%. Penicillin allergy — rash."
              className="input mt-3 h-32 resize-none font-mono text-xs"
            />
            <div className="mt-3 flex items-center gap-3">
              <button className="btn-primary" onClick={runExtract} disabled={busy || !text.trim()}>
                {busy ? "Extracting…" : "Extract with AI"}
              </button>
            </div>
          </section>
        )}

        {mode === "import" && (
          <section>
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-line-strong bg-surface px-6 py-9 text-center transition-colors hover:border-accent-line hover:bg-canvas">
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

        {mode === "manual" && <ManualForm getPid={pid} onResult={setResult} busy={busy} setBusy={setBusy} />}
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

function ManualForm({
  getPid,
  onResult,
  busy,
  setBusy,
}: {
  getPid: () => Promise<any>;
  onResult: (r: { ok: boolean; msg: string }) => void;
  busy: boolean;
  setBusy: (b: boolean) => void;
}) {
  const addManual = useMutation(api.ingest.addManualRecord);
  const [kind, setKind] = useState<Kind>("observation");
  const [f, setF] = useState<Record<string, string>>({ date: new Date().toISOString().slice(0, 10) });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function submit() {
    setBusy(true);
    try {
      const date = f.date ? new Date(f.date).getTime() : undefined;
      const args: any = { patientId: await getPid(), kind, date };
      if (kind === "observation") { args.code = f.code || undefined; args.label = f.label || undefined; args.value = f.value ? Number(f.value) : undefined; args.unit = f.unit || undefined; }
      if (kind === "medication") { args.name = f.name; args.dose = f.dose ? Number(f.dose) : undefined; args.doseUnit = f.doseUnit || undefined; args.status = f.status || "active"; }
      if (kind === "condition") { args.name = f.name; args.status = f.status || "active"; }
      if (kind === "allergy") { args.substance = f.substance; args.reaction = f.reaction || undefined; }
      await addManual(args);
      onResult({ ok: true, msg: `Added ${kind}. It's in your record now.` });
      setF({ date: new Date().toISOString().slice(0, 10) });
    } catch (e: any) {
      onResult({ ok: false, msg: e?.message ?? "Could not add record." });
    } finally {
      setBusy(false);
    }
  }

  const Field = ({ label, k, type = "text", ph = "" }: { label: string; k: string; type?: string; ph?: string }) => (
    <label className="block">
      <span className="text-2xs font-medium uppercase tracking-wide text-ink-400">{label}</span>
      <input type={type} value={f[k] ?? ""} onChange={(e) => set(k, e.target.value)} placeholder={ph} className="input mt-1 py-1.5 text-sm" />
    </label>
  );

  return (
    <section className="card p-4">
      <div className="flex gap-1.5">
        {(["observation", "medication", "condition", "allergy"] as Kind[]).map((k) => (
          <button key={k} onClick={() => setKind(k)} className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors ${kind === k ? "bg-brand text-brand-fg" : "border border-line text-ink-600 hover:bg-canvas"}`}>
            {k === "observation" ? "Lab" : k}
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {kind === "observation" && (<>
          <Field label="Code" k="code" ph="LDL" />
          <Field label="Name" k="label" ph="LDL Cholesterol" />
          <Field label="Value" k="value" type="number" ph="120" />
          <Field label="Unit" k="unit" ph="mg/dL" />
          <Field label="Date" k="date" type="date" />
        </>)}
        {kind === "medication" && (<>
          <Field label="Name" k="name" ph="Atorvastatin" />
          <Field label="Dose" k="dose" type="number" ph="20" />
          <Field label="Unit" k="doseUnit" ph="mg" />
          <StatusField f={f} set={set} options={["active", "stopped"]} />
          <Field label="Started" k="date" type="date" />
        </>)}
        {kind === "condition" && (<>
          <Field label="Name" k="name" ph="Type 2 diabetes" />
          <StatusField f={f} set={set} options={["active", "resolved"]} />
          <Field label="Diagnosed" k="date" type="date" />
        </>)}
        {kind === "allergy" && (<>
          <Field label="Substance" k="substance" ph="Penicillin" />
          <Field label="Reaction" k="reaction" ph="Rash" />
        </>)}
      </div>

      <button className="btn-primary mt-4" onClick={submit} disabled={busy}>{busy ? "Adding…" : "Add to record"}</button>
    </section>
  );
}

function StatusField({ f, set, options }: { f: Record<string, string>; set: (k: string, v: string) => void; options: string[] }) {
  return (
    <label className="block">
      <span className="text-2xs font-medium uppercase tracking-wide text-ink-400">Status</span>
      <select value={f.status ?? options[0]} onChange={(e) => set("status", e.target.value)} className="input mt-1 py-1.5 text-sm capitalize">
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}
