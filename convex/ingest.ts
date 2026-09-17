import { mutation, query, internalMutation, internalAction, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { METRIC_META } from "./metrics";
import { assertWrite, canRead } from "./authz";
import { rebuildEvents } from "./events";

// ---- real upload + OpenAI extraction path --------------------------------

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => ctx.storage.generateUploadUrl(),
});

// Insert AI-extracted facts. Dedups against what's already in the record (and
// within this batch) so re-uploading the same report doesn't duplicate, and
// returns a small preview of what actually landed so the UI can show it.
export const insertExtracted = internalMutation({
  args: {
    patientId: v.id("patients"),
    filename: v.string(),
    org: v.string(),
    excerpt: v.string(),
    storageId: v.optional(v.id("_storage")),
    observations: v.array(
      v.object({
        code: v.string(),
        label: v.string(),
        value: v.number(),
        unit: v.string(),
        date: v.number(),
      }),
    ),
    medications: v.array(
      v.object({
        name: v.string(),
        normalizedName: v.string(),
        dose: v.optional(v.number()),
        doseUnit: v.optional(v.string()),
        startDate: v.optional(v.number()),
      }),
    ),
    conditions: v.array(
      v.object({ name: v.string(), normalizedName: v.string(), diagnosedDate: v.optional(v.number()) }),
    ),
    encounters: v.array(
      v.object({ kind: v.string(), title: v.string(), date: v.number(), summary: v.optional(v.string()) }),
    ),
    allergies: v.optional(v.array(v.object({ substance: v.string(), reaction: v.optional(v.string()) }))),
  },
  handler: async (ctx, a) => {
    await assertWrite(ctx, a.patientId);
    const documentId: Id<"documents"> = await ctx.db.insert("documents", {
      patientId: a.patientId,
      filename: a.filename,
      org: a.org,
      kind: "upload",
      pages: 1,
      receivedVia: "upload",
      receivedAt: Date.now(),
      storageId: a.storageId,
      excerpt: a.excerpt.slice(0, 4000),
    });

    // Dedup keys from what already exists, so a re-upload is (near) idempotent.
    const dayOf = (t: number) => new Date(t).toISOString().slice(0, 10);
    const q = (t: string) => ctx.db.query(t as any).withIndex("by_patient", (x: any) => x.eq("patientId", a.patientId)).collect();
    const [exObs, exMed, exCond, exEnc, exAlg] = await Promise.all([q("observations"), q("medications"), q("conditions"), q("encounters"), q("allergies")]);
    const seenObs = new Set(exObs.map((o: any) => `${o.code}|${dayOf(o.date)}|${o.value}`));
    const seenMed = new Set(exMed.filter((m: any) => m.status === "active").map((m: any) => m.normalizedName));
    const seenCond = new Set(exCond.filter((c: any) => c.status === "active").map((c: any) => c.normalizedName));
    const seenEnc = new Set(exEnc.map((e: any) => `${e.title}|${dayOf(e.date)}`));
    const seenAlg = new Set(exAlg.map((al: any) => al.substance.toLowerCase()));

    const counts = { observations: 0, medications: 0, conditions: 0, encounters: 0, allergies: 0 };
    let skipped = 0;
    const preview: { kind: string; text: string; sub?: string }[] = [];
    const peek = (kind: string, text: string, sub?: string) => { if (preview.length < 14) preview.push({ kind, text, sub }); };

    for (const o of a.observations) {
      const k = `${o.code}|${dayOf(o.date)}|${o.value}`;
      if (seenObs.has(k)) { skipped++; continue; }
      seenObs.add(k);
      await ctx.db.insert("observations", { patientId: a.patientId, code: o.code, label: o.label, value: o.value, unit: o.unit, date: o.date, documentId, page: 1, provenance: "ai_extracted" });
      counts.observations++;
      peek("lab", `${o.label} ${o.value}${o.unit ? " " + o.unit : ""}`, dayOf(o.date));
    }
    for (const m of a.medications) {
      if (m.normalizedName && seenMed.has(m.normalizedName)) { skipped++; continue; }
      if (m.normalizedName) seenMed.add(m.normalizedName);
      await ctx.db.insert("medications", { patientId: a.patientId, name: m.name, normalizedName: m.normalizedName, dose: m.dose, doseUnit: m.doseUnit, status: "active", startDate: m.startDate, documentId, page: 1, provenance: "ai_extracted" });
      counts.medications++;
      peek("medication", `${m.name}${m.dose ? " " + m.dose + (m.doseUnit ? " " + m.doseUnit : "") : ""}`);
    }
    for (const c of a.conditions) {
      if (c.normalizedName && seenCond.has(c.normalizedName)) { skipped++; continue; }
      if (c.normalizedName) seenCond.add(c.normalizedName);
      await ctx.db.insert("conditions", { patientId: a.patientId, name: c.name, normalizedName: c.normalizedName, status: "active", diagnosedDate: c.diagnosedDate, documentId, page: 1, provenance: "ai_extracted" });
      counts.conditions++;
      peek("condition", c.name, c.diagnosedDate ? dayOf(c.diagnosedDate) : undefined);
    }
    for (const e of a.encounters) {
      const k = `${e.title}|${dayOf(e.date)}`;
      if (seenEnc.has(k)) { skipped++; continue; }
      seenEnc.add(k);
      await ctx.db.insert("encounters", { patientId: a.patientId, kind: e.kind, title: e.title, date: e.date, summary: e.summary, documentId, page: 1, provenance: "ai_extracted" });
      counts.encounters++;
      peek("encounter", e.title, dayOf(e.date));
    }
    for (const al of a.allergies ?? []) {
      const k = al.substance.toLowerCase();
      if (seenAlg.has(k)) { skipped++; continue; }
      seenAlg.add(k);
      await ctx.db.insert("allergies", { patientId: a.patientId, substance: al.substance, reaction: al.reaction, documentId, page: 1, provenance: "ai_extracted" });
      counts.allergies++;
      peek("allergy", al.reaction ? `${al.substance} — ${al.reaction}` : al.substance);
    }

    await rebuildEvents(ctx, a.patientId);
    return { documentId, counts, skipped, preview, org: a.org };
  },
});

const CODES = Object.keys(METRIC_META).join(", ");

const EXTRACT_SYSTEM =
  "You extract structured medical events from a health record. " +
  "Return ONLY strict JSON. Dates must be epoch milliseconds (UTC). " +
  `For observations, map the test to one of these canonical codes when possible: ${CODES}. ` +
  "Otherwise invent an UPPER_SNAKE code. Normalize medication names (e.g. Lipitor -> atorvastatin) " +
  "into normalizedName (lowercase generic). Infer org from letterhead. " +
  "Schema: {\"org\":string,\"observations\":[{\"code\":string,\"label\":string,\"value\":number,\"unit\":string,\"date\":number}]," +
  "\"medications\":[{\"name\":string,\"normalizedName\":string,\"dose\":number|null,\"doseUnit\":string|null,\"startDate\":number|null}]," +
  "\"conditions\":[{\"name\":string,\"normalizedName\":string,\"diagnosedDate\":number|null}]," +
  "\"encounters\":[{\"kind\":string,\"title\":string,\"date\":number,\"summary\":string|null}]," +
  "\"allergies\":[{\"substance\":string,\"reaction\":string|null}]}";

// Shared sanitizer for AI-extracted records (from text, an image, OR a PDF).
function sanitizeExtract(parsed: any) {
  const clean = (arr: any) => (Array.isArray(arr) ? arr : []);
  return {
    org: String(parsed?.org ?? "Uploaded record"),
    observations: clean(parsed?.observations)
      .filter((o: any) => typeof o?.value === "number" && typeof o?.date === "number")
      .map((o: any) => ({ code: String(o.code ?? "OTHER").toUpperCase(), label: String(o.label ?? o.code ?? "Measurement"), value: Number(o.value), unit: String(o.unit ?? ""), date: Number(o.date) })),
    medications: clean(parsed?.medications).map((m: any) => ({ name: String(m.name ?? "Medication"), normalizedName: String(m.normalizedName ?? m.name ?? "").toLowerCase(), dose: typeof m.dose === "number" ? m.dose : undefined, doseUnit: m.doseUnit ? String(m.doseUnit) : undefined, startDate: typeof m.startDate === "number" ? m.startDate : undefined })),
    conditions: clean(parsed?.conditions).map((c: any) => ({ name: String(c.name ?? "Condition"), normalizedName: String(c.normalizedName ?? c.name ?? "").toLowerCase(), diagnosedDate: typeof c.diagnosedDate === "number" ? c.diagnosedDate : undefined })),
    encounters: clean(parsed?.encounters).filter((e: any) => typeof e?.date === "number").map((e: any) => ({ kind: String(e.kind ?? "Visit"), title: String(e.title ?? "Encounter"), date: Number(e.date), summary: e.summary ? String(e.summary) : undefined })),
    allergies: clean(parsed?.allergies).filter((a: any) => a?.substance).map((a: any) => ({ substance: String(a.substance), reaction: a.reaction ? String(a.reaction) : undefined })),
  };
}

// One OpenAI JSON call. Content is either a plain string (text records) or the
// multimodal parts array (an image or a PDF file). OpenAI is an EXTRACTOR here —
// never the source of truth; every value it returns is stored against its source.
async function openaiExtract(apiKey: string, model: string, extraSystem: string, content: any) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: EXTRACT_SYSTEM + extraSystem },
        { role: "user", content },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  let parsed: any = {};
  try { parsed = JSON.parse(json.choices?.[0]?.message?.content ?? "{}"); } catch { parsed = {}; }
  return sanitizeExtract(parsed);
}

// Encode stored bytes as a base64 data URL (for GPT-4o's native PDF input).
async function pdfDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (bytes.length > 30 * 1024 * 1024) throw new Error("PDF is too large (30MB max). Split it and try again.");
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
  return `data:application/pdf;base64,${btoa(binary)}`;
}

// ---- background AI-extraction job ----------------------------------------
// The deep-Convex path: requestIngest inserts a job row + schedules an action.
// The action calls the model (text / vision / PDF), inserts structured facts,
// and flips the row to "ready" with counts + a preview. The client watches the
// row REACTIVELY (getIngestJob) — no blocking await, no polling.

export const patchIngest = internalMutation({
  args: {
    jobId: v.id("ingestJobs"),
    status: v.string(),
    org: v.optional(v.string()),
    documentId: v.optional(v.id("documents")),
    counts: v.optional(v.object({ observations: v.number(), medications: v.number(), conditions: v.number(), encounters: v.number(), allergies: v.number() })),
    skipped: v.optional(v.number()),
    preview: v.optional(v.array(v.object({ kind: v.string(), text: v.string(), sub: v.optional(v.string()) }))),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { jobId, ...patch }) => {
    await ctx.db.patch(jobId, patch);
  },
});

export const getIngestJobInternal = internalQuery({
  args: { jobId: v.id("ingestJobs") },
  handler: async (ctx, { jobId }) => ctx.db.get(jobId),
});

// Reactive status the client subscribes to.
export const getIngestJob = query({
  args: { jobId: v.id("ingestJobs") },
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get(jobId);
    if (!job || !(await canRead(ctx, job.patientId))) return null;
    return {
      status: job.status,
      source: job.source,
      filename: job.filename,
      org: job.org ?? null,
      documentId: job.documentId ?? null,
      counts: job.counts ?? null,
      skipped: job.skipped ?? 0,
      preview: job.preview ?? [],
      error: job.error ?? null,
    };
  },
});

// 1) Request → job row + scheduled action. Returns a jobId instantly.
export const requestIngest = mutation({
  args: {
    patientId: v.id("patients"),
    source: v.union(v.literal("pdf"), v.literal("image"), v.literal("text")),
    filename: v.string(),
    storageId: v.optional(v.id("_storage")),
    text: v.optional(v.string()),
  },
  handler: async (ctx, { patientId, source, filename, storageId, text }): Promise<Id<"ingestJobs">> => {
    await assertWrite(ctx, patientId);
    const userId = await getAuthUserId(ctx);
    const jobId = await ctx.db.insert("ingestJobs", {
      patientId,
      userId: userId ?? undefined,
      source,
      filename,
      storageId,
      text,
      status: "pending",
      createdAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.ingest.runIngest, { jobId });
    return jobId;
  },
});

// 2) Background action: read the source → model → insert → mark ready.
export const runIngest = internalAction({
  args: { jobId: v.id("ingestJobs") },
  handler: async (ctx, { jobId }) => {
    const job: any = await ctx.runQuery(internal.ingest.getIngestJobInternal, { jobId });
    if (!job) return;
    const apiKey = process.env.OPENAI_API_KEY;
    try {
      if (!apiKey) throw new Error("OPENAI_API_KEY is not set. Run: npx convex env set OPENAI_API_KEY sk-...");
      await ctx.runMutation(internal.ingest.patchIngest, { jobId, status: "reading" });

      let s;
      let excerpt: string;
      if (job.source === "text") {
        s = await openaiExtract(apiKey, "gpt-4o-mini", "", String(job.text ?? "").slice(0, 12000));
        excerpt = String(job.text ?? "");
      } else if (job.source === "image") {
        const url = await ctx.storage.getUrl(job.storageId);
        if (!url) throw new Error("Uploaded image not found.");
        s = await openaiExtract(apiKey, "gpt-4o", " Read all values visible in the image (a photo or scan of a lab report, after-visit summary, or medication list). If a date is missing, use the document date.", [
          { type: "text", text: "Extract every medical record visible in this image as JSON." },
          { type: "image_url", image_url: { url } },
        ]);
        excerpt = `Extracted from image: ${job.filename}`;
      } else {
        const blob = await ctx.storage.get(job.storageId);
        if (!blob) throw new Error("Uploaded PDF not found.");
        const dataUrl = await pdfDataUrl(blob);
        s = await openaiExtract(apiKey, "gpt-4o", " The document is a PDF medical record (lab report, discharge or after-visit summary, radiology report, or medication list) — it may be text-based or a scan. Read every page and extract every measurable value, medication, diagnosis, visit, and allergy. If a specific record has no date, use the document date on the letterhead.", [
          { type: "text", text: "Extract every medical record in this PDF as strict JSON." },
          { type: "file", file: { filename: job.filename, file_data: dataUrl } },
        ]);
        excerpt = `Extracted from PDF: ${job.filename}`;
      }

      await ctx.runMutation(internal.ingest.patchIngest, { jobId, status: "extracting" });
      const r: any = await ctx.runMutation(internal.ingest.insertExtracted, {
        patientId: job.patientId,
        filename: job.filename,
        org: s.org,
        excerpt,
        storageId: job.storageId,
        observations: s.observations,
        medications: s.medications,
        conditions: s.conditions,
        encounters: s.encounters,
        allergies: s.allergies,
      });

      await ctx.runMutation(internal.ingest.patchIngest, {
        jobId,
        status: "ready",
        org: r.org,
        documentId: r.documentId,
        counts: r.counts,
        skipped: r.skipped,
        preview: r.preview,
      });
    } catch (e: any) {
      await ctx.runMutation(internal.ingest.patchIngest, { jobId, status: "error", error: String(e?.message ?? e).slice(0, 300) });
    }
  },
});

// Inline chat attachment: read an image/PDF with vision, insert the structured
// records into the patient's record, and return what landed (so the assistant can
// explain it in the same turn). Synchronous — returns the result, no job row.
export const extractAttachment = internalAction({
  args: { patientId: v.id("patients"), filename: v.string(), storageId: v.id("_storage"), kind: v.string() },
  handler: async (ctx, { patientId, filename, storageId, kind }): Promise<any> => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return null;
    let s: any;
    let excerpt: string;
    if (kind === "pdf") {
      const blob = await ctx.storage.get(storageId);
      if (!blob) return null;
      const dataUrl = await pdfDataUrl(blob);
      s = await openaiExtract(apiKey, "gpt-4o", " The document is a PDF medical record — read every page and extract every measurable value, medication, diagnosis, visit, and allergy.", [
        { type: "text", text: "Extract every medical record in this PDF as strict JSON." },
        { type: "file", file: { filename, file_data: dataUrl } },
      ]);
      excerpt = `Extracted from PDF: ${filename}`;
    } else {
      const url = await ctx.storage.getUrl(storageId);
      if (!url) return null;
      s = await openaiExtract(apiKey, "gpt-4o", " Read all values visible in the image (a photo or scan of a lab report, after-visit summary, or medication list). If a date is missing, use the document date.", [
        { type: "text", text: "Extract every medical record visible in this image as JSON." },
        { type: "image_url", image_url: { url } },
      ]);
      excerpt = `Extracted from image: ${filename}`;
    }
    const r: any = await ctx.runMutation(internal.ingest.insertExtracted, {
      patientId, filename, org: s.org, excerpt, storageId,
      observations: s.observations, medications: s.medications, conditions: s.conditions, encounters: s.encounters, allergies: s.allergies,
    });
    return { documentId: r.documentId, counts: r.counts, skipped: r.skipped, preview: r.preview, org: r.org };
  },
});

// ---- structured re-import (closes the export→import loop) -----------------
// Accepts a TraceHealth JSON export OR a FHIR R4 Bundle and inserts records
// directly — no AI needed, deterministic. Provenance "imported".
const ms = (s: any): number | undefined => {
  if (typeof s === "number") return s;
  if (typeof s === "string") {
    const t = Date.parse(s);
    return isNaN(t) ? undefined : t;
  }
  return undefined;
};

export const importBundle = mutation({
  args: { patientId: v.id("patients"), filename: v.string(), text: v.string() },
  handler: async (ctx, { patientId, filename, text }) => {
    await assertWrite(ctx, patientId);
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("This file isn't valid JSON. Import a TraceHealth JSON or a FHIR Bundle.");
    }

    const obs: any[] = [];
    const meds: any[] = [];
    const conds: any[] = [];
    const encs: any[] = [];
    const algs: any[] = [];

    if (data?.resourceType === "Bundle" && Array.isArray(data.entry)) {
      for (const e of data.entry) {
        const r = e?.resource;
        if (!r?.resourceType) continue;
        if (r.resourceType === "Observation" && r.valueQuantity) {
          const coding = r.code?.coding?.[0];
          obs.push({
            code: String(coding?.code ?? r.code?.text ?? "OTHER").toUpperCase(),
            label: String(r.code?.text ?? coding?.code ?? "Measurement"),
            value: Number(r.valueQuantity.value),
            unit: String(r.valueQuantity.unit ?? ""),
            date: ms(r.effectiveDateTime),
          });
        } else if (r.resourceType === "MedicationRequest") {
          meds.push({ name: String(r.medicationCodeableConcept?.text ?? "Medication"), status: r.status, startDate: ms(r.authoredOn), doseText: r.dosageInstruction?.[0]?.text });
        } else if (r.resourceType === "Condition") {
          conds.push({ name: String(r.code?.text ?? "Condition"), status: r.clinicalStatus?.coding?.[0]?.code, date: ms(r.onsetDateTime) });
        } else if (r.resourceType === "AllergyIntolerance") {
          algs.push({ substance: String(r.code?.text ?? "Allergen"), reaction: r.reaction?.[0]?.manifestation?.[0]?.text });
        } else if (r.resourceType === "Encounter") {
          encs.push({ kind: String(r.class?.code ?? "Visit"), title: String(r.type?.[0]?.text ?? "Encounter"), date: ms(r.period?.start) });
        }
      }
    } else {
      // TraceHealth JSON export shape.
      for (const o of data.observations ?? []) obs.push({ code: String(o.code ?? "OTHER").toUpperCase(), label: String(o.label ?? "Measurement"), value: Number(o.value), unit: String(o.unit ?? ""), date: ms(o.date) });
      for (const m of data.medications ?? []) meds.push({ name: String(m.name ?? "Medication"), status: m.status, startDate: ms(m.startDate), dose: typeof m.dose === "number" ? m.dose : undefined, doseUnit: m.doseUnit });
      for (const c of data.conditions ?? []) conds.push({ name: String(c.name ?? "Condition"), status: c.status, date: ms(c.diagnosedDate) });
      for (const e of data.encounters ?? []) encs.push({ kind: String(e.kind ?? "Visit"), title: String(e.title ?? "Encounter"), date: ms(e.date) });
      for (const a of data.allergies ?? []) algs.push({ substance: String(a.substance ?? "Allergen"), reaction: a.reaction });
    }

    const documentId = await ctx.db.insert("documents", {
      patientId,
      filename,
      org: String(data?.patient?.org ?? "Imported record"),
      kind: "import",
      pages: 1,
      receivedVia: "import",
      receivedAt: Date.now(),
      excerpt: `Imported ${obs.length + meds.length + conds.length + encs.length + algs.length} records from ${filename}.`,
    });
    const base = { patientId, documentId, page: 1, provenance: "imported" as const };
    for (const o of obs) if (typeof o.value === "number" && !isNaN(o.value)) await ctx.db.insert("observations", { ...base, code: o.code, label: o.label, value: o.value, unit: o.unit, date: o.date ?? Date.now() });
    for (const m of meds) {
      let dose = m.dose, doseUnit = m.doseUnit;
      if (dose === undefined && m.doseText) { const mm = String(m.doseText).match(/([\d.]+)\s*(\w+)?/); if (mm) { dose = parseFloat(mm[1]); doseUnit = mm[2]; } }
      await ctx.db.insert("medications", { ...base, name: m.name, normalizedName: m.name.toLowerCase(), dose, doseUnit, status: m.status === "stopped" ? "stopped" : "active", startDate: m.startDate });
    }
    for (const c of conds) await ctx.db.insert("conditions", { ...base, name: c.name, normalizedName: c.name.toLowerCase(), status: c.status === "resolved" ? "resolved" : "active", diagnosedDate: c.date });
    for (const e of encs) await ctx.db.insert("encounters", { ...base, kind: e.kind, title: e.title, date: e.date ?? Date.now() });
    for (const a of algs) await ctx.db.insert("allergies", { ...base, substance: a.substance, reaction: a.reaction });

    // Build a preview of what landed so the UI can show the actual records,
    // not just a count — same shape the AI-extraction path returns.
    const dayStr = (t?: number) => (t ? new Date(t).toISOString().slice(0, 10) : undefined);
    const preview: { kind: string; text: string; sub?: string }[] = [];
    const peek = (kind: string, text: string, sub?: string) => { if (preview.length < 16) preview.push({ kind, text, sub }); };
    for (const o of obs) if (typeof o.value === "number" && !isNaN(o.value)) peek("lab", `${o.label} ${o.value}${o.unit ? " " + o.unit : ""}`, dayStr(o.date));
    for (const m of meds) {
      let d = m.dose, u = m.doseUnit;
      if (d === undefined && m.doseText) { const mm = String(m.doseText).match(/([\d.]+)\s*(\w+)?/); if (mm) { d = parseFloat(mm[1]); u = mm[2]; } }
      peek("medication", `${m.name}${d ? ` ${d}${u ? " " + u : ""}` : ""}`);
    }
    for (const c of conds) peek("condition", c.name, dayStr(c.date));
    for (const e of encs) peek("encounter", e.title, dayStr(e.date));
    for (const a of algs) peek("allergy", a.reaction ? `${a.substance} — ${a.reaction}` : a.substance);

    await rebuildEvents(ctx, patientId);
    return {
      observations: obs.length,
      medications: meds.length,
      conditions: conds.length,
      encounters: encs.length,
      allergies: algs.length,
      skipped: 0,
      preview,
      documentId,
      org: String(data?.patient?.org ?? "Imported record"),
    };
  },
});

// ---- manual entry --------------------------------------------------------
// Add a single record by hand. Attaches to a per-patient "Manual entry"
// document so it still traces to a source. Provenance "patient_verified".
export const addManualRecord = mutation({
  args: {
    patientId: v.id("patients"),
    kind: v.union(v.literal("observation"), v.literal("medication"), v.literal("condition"), v.literal("allergy")),
    date: v.optional(v.number()),
    // observation
    code: v.optional(v.string()),
    label: v.optional(v.string()),
    value: v.optional(v.number()),
    unit: v.optional(v.string()),
    // medication
    name: v.optional(v.string()),
    dose: v.optional(v.number()),
    doseUnit: v.optional(v.string()),
    // condition
    status: v.optional(v.string()),
    // allergy
    substance: v.optional(v.string()),
    reaction: v.optional(v.string()),
  },
  handler: async (ctx, a) => {
    await assertWrite(ctx, a.patientId);
    const existing = await ctx.db
      .query("documents")
      .withIndex("by_patient", (q) => q.eq("patientId", a.patientId))
      .collect();
    let documentId = existing.find((d) => d.org === "Manual entry")?._id;
    if (!documentId) {
      documentId = await ctx.db.insert("documents", {
        patientId: a.patientId,
        filename: "Manual entries",
        org: "Manual entry",
        kind: "manual",
        pages: 1,
        receivedVia: "manual",
        receivedAt: Date.now(),
        excerpt: "Records you entered by hand.",
      });
    }
    const base = { patientId: a.patientId, documentId, page: 1, provenance: "patient_verified" as const };
    const date = a.date ?? Date.now();
    if (a.kind === "observation") {
      if (typeof a.value !== "number") throw new Error("A value is required.");
      await ctx.db.insert("observations", { ...base, code: (a.code ?? "OTHER").toUpperCase(), label: a.label ?? a.code ?? "Measurement", value: a.value, unit: a.unit ?? "", date });
    } else if (a.kind === "medication") {
      if (!a.name) throw new Error("A medication name is required.");
      await ctx.db.insert("medications", { ...base, name: a.name, normalizedName: a.name.toLowerCase(), dose: a.dose, doseUnit: a.doseUnit, status: a.status === "stopped" ? "stopped" : "active", startDate: date });
    } else if (a.kind === "condition") {
      if (!a.name) throw new Error("A condition name is required.");
      await ctx.db.insert("conditions", { ...base, name: a.name, normalizedName: a.name.toLowerCase(), status: a.status === "resolved" ? "resolved" : "active", diagnosedDate: date });
    } else {
      if (!a.substance) throw new Error("A substance is required.");
      await ctx.db.insert("allergies", { ...base, substance: a.substance, reaction: a.reaction });
    }
    await rebuildEvents(ctx, a.patientId);
    return { ok: true };
  },
});
