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
    return {
      documentId,
      counts: {
        observations: a.observations.length,
        medications: a.medications.length,
        conditions: a.conditions.length,
        encounters: a.encounters.length,
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
  ): Promise<{ observations: number; medications: number; conditions: number; encounters: number }> => {
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
      "\"encounters\":[{\"kind\":string,\"title\":string,\"date\":number,\"summary\":string|null}]}";

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
    });
    return result.counts;
  },
});
