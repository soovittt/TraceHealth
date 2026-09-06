import { action, mutation, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { METRIC_META } from "./metrics";
import { assertWrite } from "./authz";

// ---- real upload + OpenAI extraction path --------------------------------

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => ctx.storage.generateUploadUrl(),
});

// Insert AI-extracted facts. Called by the extraction action.
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
    for (const o of a.observations) {
      await ctx.db.insert("observations", {
        patientId: a.patientId,
        code: o.code,
        label: o.label,
        value: o.value,
        unit: o.unit,
        date: o.date,
        documentId,
        page: 1,
        provenance: "ai_extracted",
      });
    }
    for (const m of a.medications) {
      await ctx.db.insert("medications", {
        patientId: a.patientId,
        name: m.name,
        normalizedName: m.normalizedName,
        dose: m.dose,
        doseUnit: m.doseUnit,
        status: "active",
        startDate: m.startDate,
        documentId,
        page: 1,
        provenance: "ai_extracted",
      });
    }
    for (const c of a.conditions) {
      await ctx.db.insert("conditions", {
        patientId: a.patientId,
        name: c.name,
        normalizedName: c.normalizedName,
        status: "active",
        diagnosedDate: c.diagnosedDate,
        documentId,
        page: 1,
        provenance: "ai_extracted",
      });
    }
    for (const e of a.encounters) {
      await ctx.db.insert("encounters", {
        patientId: a.patientId,
        kind: e.kind,
        title: e.title,
        date: e.date,
        summary: e.summary,
        documentId,
        page: 1,
        provenance: "ai_extracted",
      });
    }
    for (const al of a.allergies ?? []) {
      await ctx.db.insert("allergies", {
        patientId: a.patientId,
        substance: al.substance,
        reaction: al.reaction,
        documentId,
        page: 1,
        provenance: "ai_extracted",
      });
    }
    return {
      documentId,
      counts: {
        observations: a.observations.length,
        medications: a.medications.length,
        conditions: a.conditions.length,
        encounters: a.encounters.length,
        allergies: (a.allergies ?? []).length,
      },
    };
  },
});

const CODES = Object.keys(METRIC_META).join(", ");

// Extract structured medical events from raw record text using OpenAI.
// OpenAI is an extractor here — never the source of truth.
export const extractAndImport = action({
  args: {
    patientId: v.id("patients"),
    filename: v.string(),
    text: v.string(),
    storageId: v.optional(v.id("_storage")),
  },
  handler: async (
    ctx,
    { patientId, filename, text, storageId },
  ): Promise<{ observations: number; medications: number; conditions: number; encounters: number; allergies: number }> => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY is not set. Run: npx convex env set OPENAI_API_KEY sk-...",
      );
    }

    const system =
      "You extract structured medical events from a raw health record. " +
      "Return ONLY strict JSON. Dates must be epoch milliseconds (UTC). " +
      `For observations, map the test to one of these canonical codes when possible: ${CODES}. ` +
      "Otherwise invent an UPPER_SNAKE code. Normalize medication names (e.g. Lipitor -> atorvastatin) " +
      "into normalizedName (lowercase generic). Infer org from letterhead. " +
      "Schema: {\"org\":string,\"observations\":[{\"code\":string,\"label\":string,\"value\":number,\"unit\":string,\"date\":number}]," +
      "\"medications\":[{\"name\":string,\"normalizedName\":string,\"dose\":number|null,\"doseUnit\":string|null,\"startDate\":number|null}]," +
      "\"conditions\":[{\"name\":string,\"normalizedName\":string,\"diagnosedDate\":number|null}]," +
      "\"encounters\":[{\"kind\":string,\"title\":string,\"date\":number,\"summary\":string|null}]," +
      "\"allergies\":[{\"substance\":string,\"reaction\":string|null}]}";

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: text.slice(0, 12000) },
        ],
      }),
    });
    if (!res.ok) {
      throw new Error(`OpenAI error ${res.status}: ${await res.text()}`);
    }
    const json = await res.json();
    let parsed: any = {};
    try {
      parsed = JSON.parse(json.choices?.[0]?.message?.content ?? "{}");
    } catch {
      parsed = {};
    }

    const clean = (arr: any) => (Array.isArray(arr) ? arr : []);
    const observations = clean(parsed.observations)
      .filter((o: any) => typeof o?.value === "number" && typeof o?.date === "number")
      .map((o: any) => ({
        code: String(o.code ?? "OTHER").toUpperCase(),
        label: String(o.label ?? o.code ?? "Measurement"),
        value: Number(o.value),
        unit: String(o.unit ?? ""),
        date: Number(o.date),
      }));
    const medications = clean(parsed.medications).map((m: any) => ({
      name: String(m.name ?? "Medication"),
      normalizedName: String(m.normalizedName ?? m.name ?? "").toLowerCase(),
      dose: typeof m.dose === "number" ? m.dose : undefined,
      doseUnit: m.doseUnit ? String(m.doseUnit) : undefined,
      startDate: typeof m.startDate === "number" ? m.startDate : undefined,
    }));
    const conditions = clean(parsed.conditions).map((c: any) => ({
      name: String(c.name ?? "Condition"),
      normalizedName: String(c.normalizedName ?? c.name ?? "").toLowerCase(),
      diagnosedDate: typeof c.diagnosedDate === "number" ? c.diagnosedDate : undefined,
    }));
    const encounters = clean(parsed.encounters)
      .filter((e: any) => typeof e?.date === "number")
      .map((e: any) => ({
        kind: String(e.kind ?? "Visit"),
        title: String(e.title ?? "Encounter"),
        date: Number(e.date),
        summary: e.summary ? String(e.summary) : undefined,
      }));
    const allergies = clean(parsed.allergies)
      .filter((a: any) => a?.substance)
      .map((a: any) => ({ substance: String(a.substance), reaction: a.reaction ? String(a.reaction) : undefined }));

    const result = await ctx.runMutation(internal.ingest.insertExtracted, {
      patientId,
      filename,
      org: String(parsed.org ?? "Uploaded record"),
      excerpt: text,
      storageId,
      observations,
      medications,
      conditions,
      encounters,
      allergies,
    });
    return result.counts;
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

    return { observations: obs.length, medications: meds.length, conditions: conds.length, encounters: encs.length, allergies: algs.length };
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
    return { ok: true };
  },
});
