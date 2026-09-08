import { query, mutation, internalQuery, internalMutation, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { canRead, assertWrite } from "./authz";
import { metaFor } from "./metrics";

// ---- record export -------------------------------------------------------
// One place to get the whole record OUT — as a portable FHIR Bundle, raw JSON,
// or a spreadsheet-friendly CSV. Read-only and access-gated (owner | demo |
// valid share). The client turns {content} into a downloadable Blob.

async function loadAll(ctx: any, patientId: Id<"patients">, shareToken?: string) {
  if (!(await canRead(ctx, patientId, shareToken))) return null;
  const get = (t: string) =>
    ctx.db.query(t).withIndex("by_patient", (q: any) => q.eq("patientId", patientId)).collect();
  const [patient, documents, observations, medications, conditions, encounters, allergies] = await Promise.all([
    ctx.db.get(patientId),
    get("documents"),
    get("observations"),
    get("medications"),
    get("conditions"),
    get("encounters"),
    get("allergies"),
  ]);
  return { patient, documents, observations, medications, conditions, encounters, allergies };
}

const iso = (t?: number) => (t ? new Date(t).toISOString() : undefined);
const day = (t?: number) => (t ? new Date(t).toISOString().slice(0, 10) : undefined);

function csvCell(v: any): string {
  const s = v === undefined || v === null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function csvRows(rows: (string | number | undefined)[][]): string {
  return rows.map((r) => r.map(csvCell).join(",")).join("\n");
}

// A plain, human-readable normalized record (what the app actually stores).
function toJson(d: any) {
  return {
    exportedAt: new Date().toISOString(),
    source: "TraceHealth",
    patient: d.patient ? { name: d.patient.name, age: d.patient.age, sex: d.patient.sex, recordsFrom: d.patient.recordsFrom } : null,
    sources: d.documents.map((x: any) => ({ org: x.org, kind: x.kind, receivedAt: iso(x.receivedAt) })),
    observations: d.observations
      .sort((a: any, b: any) => a.date - b.date)
      .map((o: any) => ({ code: o.code, label: o.label, value: o.value, unit: o.unit, date: day(o.date), provider: o.provider, provenance: o.provenance })),
    medications: d.medications.map((m: any) => ({ name: m.name, dose: m.dose, doseUnit: m.doseUnit, status: m.status, startDate: day(m.startDate), endDate: day(m.endDate), provenance: m.provenance })),
    conditions: d.conditions.map((c: any) => ({ name: c.name, status: c.status, diagnosedDate: day(c.diagnosedDate), provenance: c.provenance })),
    encounters: d.encounters.map((e: any) => ({ title: e.title, kind: e.kind, org: e.org, date: day(e.date), summary: e.summary })),
    allergies: d.allergies.map((a: any) => ({ substance: a.substance, reaction: a.reaction, provenance: a.provenance })),
  };
}

// A FHIR R4 "collection" Bundle — the interoperable form other systems can read.
function toFhirBundle(d: any) {
  const entry: any[] = [];
  const push = (resource: any) => entry.push({ resource });
  if (d.patient) {
    push({ resourceType: "Patient", id: "patient", name: [{ text: d.patient.name }], gender: d.patient.sex });
  }
  for (const o of d.observations) {
    push({
      resourceType: "Observation",
      status: "final",
      category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "laboratory" }] }],
      code: { coding: [{ system: "http://tracehealth.app/metric", code: o.code }], text: o.label },
      effectiveDateTime: iso(o.date),
      valueQuantity: { value: o.value, unit: o.unit },
      subject: { reference: "Patient/patient" },
    });
  }
  for (const m of d.medications) {
    push({
      resourceType: "MedicationRequest",
      status: m.status === "active" ? "active" : "stopped",
      intent: "order",
      medicationCodeableConcept: { text: m.name },
      dosageInstruction: m.dose ? [{ text: `${m.dose} ${m.doseUnit ?? ""}`.trim() }] : undefined,
      authoredOn: iso(m.startDate),
      subject: { reference: "Patient/patient" },
    });
  }
  for (const c of d.conditions) {
    push({
      resourceType: "Condition",
      clinicalStatus: { coding: [{ code: c.status === "active" ? "active" : "resolved" }] },
      code: { text: c.name },
      onsetDateTime: iso(c.diagnosedDate),
      subject: { reference: "Patient/patient" },
    });
  }
  for (const a of d.allergies) {
    push({ resourceType: "AllergyIntolerance", code: { text: a.substance }, reaction: a.reaction ? [{ manifestation: [{ text: a.reaction }] }] : undefined, patient: { reference: "Patient/patient" } });
  }
  for (const e of d.encounters) {
    push({ resourceType: "Encounter", status: "finished", class: { code: e.kind }, type: [{ text: e.title }], period: { start: iso(e.date) }, subject: { reference: "Patient/patient" } });
  }
  return { resourceType: "Bundle", type: "collection", timestamp: new Date().toISOString(), total: entry.length, entry };
}

// A tidy long-format CSV across every record type (one row per fact).
function toCsv(d: any) {
  const header = ["type", "date", "code", "name", "value", "unit", "status", "source", "provenance"];
  const rows: (string | number | undefined)[][] = [header];
  for (const o of [...d.observations].sort((a: any, b: any) => a.date - b.date))
    rows.push(["lab", day(o.date), o.code, o.label, o.value, o.unit, "", o.provider, o.provenance]);
  for (const m of d.medications)
    rows.push(["medication", day(m.startDate), "", m.name, m.dose, m.doseUnit, m.status, "", m.provenance]);
  for (const c of d.conditions)
    rows.push(["condition", day(c.diagnosedDate), "", c.name, "", "", c.status, "", c.provenance]);
  for (const a of d.allergies) rows.push(["allergy", "", "", a.substance, a.reaction, "", "", "", a.provenance]);
  for (const e of d.encounters) rows.push(["encounter", day(e.date), "", e.title, "", "", e.kind, e.org, ""]);
  return csvRows(rows);
}

export const exportRecord = query({
  args: {
    patientId: v.id("patients"),
    format: v.union(v.literal("fhir"), v.literal("json"), v.literal("csv")),
    shareToken: v.optional(v.string()),
  },
  handler: async (ctx, { patientId, format, shareToken }) => {
    const d = await loadAll(ctx, patientId, shareToken);
    if (!d) return null;
    const stamp = new Date().toISOString().slice(0, 10);
    const base = `tracehealth-${(d.patient?.name ?? "record").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${stamp}`;
    if (format === "csv") return { filename: `${base}.csv`, mime: "text/csv", content: toCsv(d) };
    if (format === "fhir") return { filename: `${base}.fhir.json`, mime: "application/fhir+json", content: JSON.stringify(toFhirBundle(d), null, 2) };
    return { filename: `${base}.json`, mime: "application/json", content: JSON.stringify(toJson(d), null, 2) };
  },
});

// A single metric as CSV (date,value,unit) — for the Trends "export" affordance.
export const exportMetricCsv = query({
  args: { patientId: v.id("patients"), code: v.string(), shareToken: v.optional(v.string()) },
  handler: async (ctx, { patientId, code, shareToken }) => {
    if (!(await canRead(ctx, patientId, shareToken))) return null;
    const obs = await ctx.db
      .query("observations")
      .withIndex("by_patient_code", (q: any) => q.eq("patientId", patientId).eq("code", code))
      .collect();
    if (!obs.length) return null;
    obs.sort((a: any, b: any) => a.date - b.date);
    const meta = metaFor(code, obs[0].label, obs[0].unit);
    const rows: (string | number | undefined)[][] = [["date", "value", "unit", "provider"]];
    for (const o of obs) rows.push([day(o.date), o.value, o.unit, o.provider]);
    return { filename: `tracehealth-${code.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`, mime: "text/csv", content: csvRows(rows), label: meta.label };
  },
});

// ---- background export job ------------------------------------------------
// The deep-Convex path: requestExport schedules an ACTION that builds the file,
// stores it in FILE STORAGE, and flips the job to "ready". The client watches
// the job row REACTIVELY (no polling) and downloads when it's done.

function buildFile(d: any, format: "fhir" | "json" | "csv") {
  const stamp = new Date().toISOString().slice(0, 10);
  const base = `tracehealth-${(d.patient?.name ?? "record").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${stamp}`;
  if (format === "csv") return { filename: `${base}.csv`, mime: "text/csv", content: toCsv(d) };
  if (format === "fhir") return { filename: `${base}.fhir.json`, mime: "application/fhir+json", content: JSON.stringify(toFhirBundle(d), null, 2) };
  return { filename: `${base}.json`, mime: "application/json", content: JSON.stringify(toJson(d), null, 2) };
}

// Internal, no-auth loader — reachable only from the scheduled action, which was
// authorized upstream in requestExport.
export const rawData = internalQuery({
  args: { patientId: v.id("patients") },
  handler: async (ctx, { patientId }) => {
    const get = (t: string) => ctx.db.query(t as any).withIndex("by_patient", (q: any) => q.eq("patientId", patientId)).collect();
    const [patient, documents, observations, medications, conditions, encounters, allergies] = await Promise.all([
      ctx.db.get(patientId), get("documents"), get("observations"), get("medications"), get("conditions"), get("encounters"), get("allergies"),
    ]);
    return { patient, documents, observations, medications, conditions, encounters, allergies };
  },
});

export const getExportJob = internalQuery({
  args: { jobId: v.id("exports") },
  handler: async (ctx, { jobId }) => ctx.db.get(jobId),
});

export const markExportReady = internalMutation({
  args: { jobId: v.id("exports"), storageId: v.id("_storage"), filename: v.string(), mime: v.string(), records: v.number() },
  handler: async (ctx, a) => {
    await ctx.db.patch(a.jobId, { status: "ready", storageId: a.storageId, filename: a.filename, mime: a.mime, records: a.records });
  },
});

export const markExportError = internalMutation({
  args: { jobId: v.id("exports"), error: v.string() },
  handler: async (ctx, { jobId, error }) => {
    await ctx.db.patch(jobId, { status: "error", error });
  },
});

// 1) Request → job row + scheduled action. Returns instantly.
export const requestExport = mutation({
  args: { patientId: v.id("patients"), format: v.union(v.literal("fhir"), v.literal("json"), v.literal("csv")) },
  handler: async (ctx, { patientId, format }): Promise<Id<"exports">> => {
    await assertWrite(ctx, patientId);
    const userId = await getAuthUserId(ctx);
    const jobId = await ctx.db.insert("exports", { patientId, userId: userId ?? undefined, format, status: "pending", createdAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.export.generateExport, { jobId });
    return jobId;
  },
});

// 2) Background action: build → store in file storage → mark ready.
export const generateExport = internalAction({
  args: { jobId: v.id("exports") },
  handler: async (ctx, { jobId }) => {
    const job: any = await ctx.runQuery(internal.export.getExportJob, { jobId });
    if (!job) return;
    try {
      const d: any = await ctx.runQuery(internal.export.rawData, { patientId: job.patientId });
      const { filename, mime, content } = buildFile(d, job.format);
      const storageId = await ctx.storage.store(new Blob([content], { type: mime }));
      const records = d.observations.length + d.medications.length + d.conditions.length + d.encounters.length + d.allergies.length;
      await ctx.runMutation(internal.export.markExportReady, { jobId, storageId, filename, mime, records });
    } catch (e: any) {
      await ctx.runMutation(internal.export.markExportError, { jobId, error: String(e?.message ?? e).slice(0, 200) });
    }
  },
});

// 3) Reactive status + signed download URL once ready.
export const getExport = query({
  args: { jobId: v.id("exports") },
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get(jobId);
    if (!job || !(await canRead(ctx, job.patientId))) return null;
    const url = job.storageId ? await ctx.storage.getUrl(job.storageId) : null;
    return { status: job.status, format: job.format, filename: job.filename ?? null, mime: job.mime ?? null, records: job.records ?? null, error: job.error ?? null, url };
  },
});
