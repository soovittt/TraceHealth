import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useStore } from "../lib/store";

type Fmt = "pdf" | "csv" | "json" | "fhir";
type CatKey = "observations" | "medications" | "conditions" | "encounters" | "allergies";

const FORMATS: { key: Fmt; label: string; hint: string; ext: string }[] = [
  { key: "pdf", label: "Document", hint: "Formatted & printable — save as PDF", ext: "html" },
  { key: "csv", label: "Spreadsheet", hint: "CSV — one row per record", ext: "csv" },
  { key: "json", label: "JSON", hint: "The normalized record", ext: "json" },
  { key: "fhir", label: "FHIR Bundle", hint: "Interoperable — import elsewhere", ext: "json" },
];
const CATS: { key: CatKey; label: string }[] = [
  { key: "observations", label: "Lab results" },
  { key: "medications", label: "Medications" },
  { key: "conditions", label: "Conditions" },
  { key: "encounters", label: "Visits" },
  { key: "allergies", label: "Allergies" },
];

export default function ExportDialog({ onClose }: { onClose: () => void }) {
  const { patientId } = useStore();
  const data = useQuery(api.export.exportData, patientId ? { patientId } : "skip");
  const [fmt, setFmt] = useState<Fmt>("pdf");
  const [sel, setSel] = useState<Set<CatKey>>(new Set(CATS.map((c) => c.key)));

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const k of CATS.map((x) => x.key)) c[k] = (data as any)?.[k]?.length ?? 0;
    return c;
  }, [data]);
  const total = [...sel].reduce((n, k) => n + (counts[k] ?? 0), 0);

  const toggle = (k: CatKey) => setSel((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });

  function doExport() {
    if (!data) return;
    const base = `tracehealth-${((data as any).patient?.name ?? "record").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${new Date().toISOString().slice(0, 10)}`;
    if (fmt === "pdf") { printDoc(buildHtml(data, sel)); return; }
    const { content, mime, ext } =
      fmt === "csv" ? { content: buildCsv(data, sel), mime: "text/csv", ext: "csv" }
      : fmt === "fhir" ? { content: JSON.stringify(buildFhir(data, sel), null, 2), mime: "application/fhir+json", ext: "fhir.json" }
      : { content: JSON.stringify(buildJson(data, sel), null, 2), mime: "application/json", ext: "json" };
    download(`${base}.${ext}`, content, mime);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-pop" onClick={(e) => e.stopPropagation()}>
        {/* header */}
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <div>
            <div className="text-sm font-semibold text-ink-900">Export your record</div>
            <div className="text-2xs text-ink-500">Choose a format and what to include — preview updates live.</div>
          </div>
          <button className="grid h-7 w-7 place-items-center rounded-md text-ink-400 hover:bg-line-soft hover:text-ink-700" onClick={onClose}>✕</button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 sm:grid-cols-[240px_1fr]">
          {/* options */}
          <div className="space-y-5 border-r border-line-soft p-4">
            <div>
              <div className="eyebrow mb-1.5">Format</div>
              <div className="space-y-1.5">
                {FORMATS.map((f) => (
                  <button key={f.key} onClick={() => setFmt(f.key)} className={`flex w-full flex-col items-start rounded-md border px-2.5 py-1.5 text-left transition-colors ${fmt === f.key ? "border-accent-line bg-accent-soft" : "border-line hover:bg-line-soft"}`}>
                    <span className={`text-sm font-medium ${fmt === f.key ? "text-accent" : "text-ink-800"}`}>{f.label}</span>
                    <span className="text-2xs text-ink-400">{f.hint}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="eyebrow">Include</span>
                <button className="text-2xs text-accent hover:underline" onClick={() => setSel(sel.size === CATS.length ? new Set() : new Set(CATS.map((c) => c.key)))}>
                  {sel.size === CATS.length ? "None" : "All"}
                </button>
              </div>
              <div className="space-y-0.5">
                {CATS.map((c) => (
                  <label key={c.key} className="flex cursor-pointer items-center gap-2.5 rounded-md px-1.5 py-1 hover:bg-line-soft">
                    <input type="checkbox" checked={sel.has(c.key)} onChange={() => toggle(c.key)} className="h-3.5 w-3.5 accent-accent" />
                    <span className="flex-1 text-sm text-ink-800">{c.label}</span>
                    <span className="mono text-2xs text-ink-400">{counts[c.key] ?? 0}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* preview */}
          <div className="min-h-0 overflow-y-auto bg-canvas p-4">
            <div className="eyebrow mb-2">Preview</div>
            {!data ? (
              <div className="h-40 animate-pulse rounded-lg bg-line-soft" />
            ) : total === 0 ? (
              <div className="grid h-40 place-items-center text-sm text-ink-400">Select at least one record type.</div>
            ) : fmt === "pdf" ? (
              <DocPreview data={data} sel={sel} />
            ) : fmt === "csv" ? (
              <CsvPreview data={data} sel={sel} />
            ) : (
              <pre className="overflow-x-auto rounded-lg border border-line bg-surface p-3 text-2xs leading-relaxed text-ink-700">
                {JSON.stringify(fmt === "fhir" ? buildFhir(data, sel) : buildJson(data, sel), null, 2).split("\n").slice(0, 40).join("\n")}
                {"\n…"}
              </pre>
            )}
          </div>
        </div>

        {/* footer */}
        <div className="flex items-center justify-between border-t border-line px-5 py-3">
          <span className="text-2xs text-ink-500">{total} record{total === 1 ? "" : "s"} · {FORMATS.find((f) => f.key === fmt)!.label}</span>
          <div className="flex gap-2">
            <button className="btn-ghost text-sm" onClick={onClose}>Cancel</button>
            <button className="btn-primary text-sm" onClick={doExport} disabled={!data || total === 0}>
              {fmt === "pdf" ? "Open & print" : "Download"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- previews -------------------------------------------------------------

function DocPreview({ data, sel }: { data: any; sel: Set<CatKey> }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-6 text-sm">
      <div className="text-base font-semibold text-ink-900">Health Record</div>
      <div className="mt-0.5 text-2xs text-ink-500">
        {data.patient?.name}{data.patient?.age ? ` · ${data.patient.age} yr` : ""}{data.patient?.recordsFrom ? ` · ${data.patient.recordsFrom}` : ""} · Generated {new Date().toISOString().slice(0, 10)}
      </div>
      {sel.has("observations") && <Section title="Lab results">{table(["Test", "Value", "Date"], data.observations.slice(0, 6).map((o: any) => [o.label, `${o.value} ${o.unit ?? ""}`, o.date]))}</Section>}
      {sel.has("medications") && <Section title="Medications">{table(["Medication", "Dose", "Status"], data.medications.slice(0, 6).map((m: any) => [m.name, m.dose ? `${m.dose} ${m.doseUnit ?? ""}` : "—", m.status]))}</Section>}
      {sel.has("conditions") && <Section title="Conditions">{list(data.conditions.slice(0, 6).map((c: any) => `${c.name}${c.status ? ` · ${c.status}` : ""}`))}</Section>}
      {sel.has("encounters") && <Section title="Visits">{list(data.encounters.slice(0, 6).map((e: any) => `${e.title}${e.date ? ` · ${e.date}` : ""}`))}</Section>}
      {sel.has("allergies") && <Section title="Allergies">{list(data.allergies.slice(0, 6).map((a: any) => a.reaction ? `${a.substance} — ${a.reaction}` : a.substance))}</Section>}
      <div className="mt-4 border-t border-line-soft pt-2 text-2xs text-ink-400">Preview shows the first few of each — the export includes everything selected.</div>
    </div>
  );
}
function Section({ title, children }: { title: string; children: any }) {
  return (
    <div className="mt-4">
      <div className="mb-1.5 border-b border-line pb-1 text-2xs font-semibold uppercase tracking-wide text-ink-500">{title}</div>
      {children}
    </div>
  );
}
function table(head: string[], rows: any[][]) {
  if (!rows.length) return <div className="text-2xs text-ink-400">None.</div>;
  return (
    <table className="w-full text-xs">
      <thead><tr>{head.map((h, i) => <th key={i} className="py-1 pr-3 text-left text-2xs font-medium uppercase tracking-wide text-ink-400">{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-line-soft">{r.map((c, j) => <td key={j} className={`py-1 pr-3 ${j === 0 ? "font-medium text-ink-900" : "text-ink-700"}`}>{c}</td>)}</tr>)}</tbody>
    </table>
  );
}
function list(items: string[]) {
  if (!items.length) return <div className="text-2xs text-ink-400">None.</div>;
  return <ul className="space-y-0.5">{items.map((t, i) => <li key={i} className="flex gap-2 text-xs text-ink-800"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-300" />{t}</li>)}</ul>;
}
function CsvPreview({ data, sel }: { data: any; sel: Set<CatKey> }) {
  const rows = csvRows(data, sel).slice(0, 12);
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <table className="w-full text-2xs">
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={i === 0 ? "bg-canvas font-medium text-ink-600" : "border-t border-line-soft text-ink-700"}>
              {r.map((c, j) => <td key={j} className="whitespace-nowrap px-2 py-1">{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---- builders -------------------------------------------------------------

function buildJson(d: any, sel: Set<CatKey>) {
  const out: any = { export: { source: "TraceHealth", exportedAt: new Date().toISOString() }, patient: d.patient };
  for (const k of CATS.map((c) => c.key)) if (sel.has(k)) out[k] = d[k];
  return out;
}
function buildFhir(d: any, sel: Set<CatKey>) {
  const entry: any[] = [];
  if (d.patient) entry.push({ resource: { resourceType: "Patient", name: [{ text: d.patient.name }], gender: d.patient.sex ?? undefined } });
  if (sel.has("observations")) for (const o of d.observations) entry.push({ resource: { resourceType: "Observation", status: "final", code: { coding: [{ code: o.code }], text: o.label }, effectiveDateTime: o.date, valueQuantity: { value: o.value, unit: o.unit } } });
  if (sel.has("medications")) for (const m of d.medications) entry.push({ resource: { resourceType: "MedicationRequest", status: m.status === "active" ? "active" : "stopped", medicationCodeableConcept: { text: m.name }, authoredOn: m.startDate ?? undefined } });
  if (sel.has("conditions")) for (const c of d.conditions) entry.push({ resource: { resourceType: "Condition", clinicalStatus: { coding: [{ code: c.status }] }, code: { text: c.name }, onsetDateTime: c.diagnosedDate ?? undefined } });
  if (sel.has("encounters")) for (const e of d.encounters) entry.push({ resource: { resourceType: "Encounter", status: "finished", type: [{ text: e.title }], period: { start: e.date ?? undefined } } });
  if (sel.has("allergies")) for (const a of d.allergies) entry.push({ resource: { resourceType: "AllergyIntolerance", code: { text: a.substance }, reaction: a.reaction ? [{ manifestation: [{ text: a.reaction }] }] : undefined } });
  return { resourceType: "Bundle", type: "collection", timestamp: new Date().toISOString(), total: entry.length, entry };
}
function csvRows(d: any, sel: Set<CatKey>): string[][] {
  const rows: string[][] = [["type", "date", "name", "value", "unit", "status", "provenance"]];
  if (sel.has("observations")) for (const o of d.observations) rows.push(["lab", o.date ?? "", o.label, String(o.value), o.unit ?? "", "", o.provenance ?? ""]);
  if (sel.has("medications")) for (const m of d.medications) rows.push(["medication", m.startDate ?? "", m.name, m.dose != null ? String(m.dose) : "", m.doseUnit ?? "", m.status ?? "", m.provenance ?? ""]);
  if (sel.has("conditions")) for (const c of d.conditions) rows.push(["condition", c.diagnosedDate ?? "", c.name, "", "", c.status ?? "", c.provenance ?? ""]);
  if (sel.has("encounters")) for (const e of d.encounters) rows.push(["visit", e.date ?? "", e.title, "", "", e.kind ?? "", ""]);
  if (sel.has("allergies")) for (const a of d.allergies) rows.push(["allergy", "", a.substance, a.reaction ?? "", "", "", a.provenance ?? ""]);
  return rows;
}
function buildCsv(d: any, sel: Set<CatKey>) {
  const cell = (v: any) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return csvRows(d, sel).map((r) => r.map(cell).join(",")).join("\n");
}
function esc(s: string) { return String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string)); }
function buildHtml(d: any, sel: Set<CatKey>) {
  const sec = (title: string, inner: string) => inner ? `<section><h2>${esc(title)}</h2>${inner}</section>` : "";
  const tbl = (head: string[], rows: string[][]) => rows.length ? `<table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>` : "<p class=none>None.</p>";
  const body = [
    sel.has("observations") && sec("Lab results", tbl(["Test", "Value", "Date", "Source"], d.observations.map((o: any) => [o.label, `${o.value} ${o.unit ?? ""}`.trim(), o.date ?? "", o.provenance ?? ""]))),
    sel.has("medications") && sec("Medications", tbl(["Medication", "Dose", "Status", "Started"], d.medications.map((m: any) => [m.name, m.dose ? `${m.dose} ${m.doseUnit ?? ""}`.trim() : "—", m.status ?? "", m.startDate ?? ""]))),
    sel.has("conditions") && sec("Conditions", tbl(["Condition", "Status", "Diagnosed"], d.conditions.map((c: any) => [c.name, c.status ?? "", c.diagnosedDate ?? ""]))),
    sel.has("encounters") && sec("Visits", tbl(["Visit", "Type", "Date"], d.encounters.map((e: any) => [e.title, e.kind ?? "", e.date ?? ""]))),
    sel.has("allergies") && sec("Allergies", tbl(["Substance", "Reaction", "Source"], d.allergies.map((a: any) => [a.substance, a.reaction ?? "", a.provenance ?? ""]))),
  ].filter(Boolean).join("");
  const meta = `${esc(d.patient?.name ?? "Patient")}${d.patient?.age ? ` · ${d.patient.age} yr` : ""}${d.patient?.recordsFrom ? ` · Records ${esc(d.patient.recordsFrom)}` : ""}`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>TraceHealth — ${esc(d.patient?.name ?? "Health Record")}</title>
  <style>
    *{box-sizing:border-box} body{font-family:Inter,-apple-system,system-ui,sans-serif;color:#1c1b19;max-width:820px;margin:40px auto;padding:0 28px;line-height:1.5}
    header{border-bottom:2px solid #1c1b19;padding-bottom:12px;margin-bottom:8px}
    h1{font-size:22px;margin:0} .meta{color:#6b6b6b;font-size:13px;margin-top:4px}
    h2{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#6b6b6b;border-bottom:1px solid #e5e5e2;padding-bottom:4px;margin:24px 0 8px}
    table{width:100%;border-collapse:collapse;font-size:13px} th{text-align:left;text-transform:uppercase;font-size:10px;letter-spacing:.04em;color:#8a8a8a;padding:4px 8px 4px 0}
    td{padding:4px 8px 4px 0;border-top:1px solid #efeeec} td:first-child{font-weight:600}
    .none{color:#9a9a9a;font-size:13px} footer{margin-top:32px;border-top:1px solid #e5e5e2;padding-top:8px;color:#9a9a9a;font-size:11px}
    @media print{body{margin:0}}
  </style></head><body>
    <header><h1>Health Record</h1><div class="meta">${meta} · Generated ${new Date().toISOString().slice(0, 10)} · TraceHealth</div></header>
    ${body}
    <footer>Exported from TraceHealth. Every value traces to a source record. Not a medical record of legal authority.</footer>
    <script>window.onload=function(){setTimeout(function(){window.print()},300)}</script>
  </body></html>`;
}

// ---- io -------------------------------------------------------------------

function download(filename: string, content: string, mime: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type: mime }));
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function printDoc(html: string) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}
