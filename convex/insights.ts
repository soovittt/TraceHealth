import { action, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { canRead } from "./authz";
import { metaFor } from "./metrics";

// AI capabilities that live *inside* the product — invoked from the UI but
// powered by grounded, cited generation. Never diagnose; describe & associate.

const OPENAI = "https://api.openai.com/v1/chat/completions";
async function chat(apiKey: string, model: string, system: string, user: string) {
  const res = await fetch(OPENAI, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, temperature: 0.2, response_format: { type: "json_object" }, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  return JSON.parse(j.choices?.[0]?.message?.content ?? "{}");
}
const iso = (t?: number) => (t ? new Date(t).toISOString().slice(0, 10) : null);

// ---- #8 Explain This Result ---------------------------------------------

export const metricData = internalQuery({
  args: { patientId: v.id("patients"), code: v.string(), shareToken: v.optional(v.string()) },
  handler: async (ctx, { patientId, code, shareToken }) => {
    if (!(await canRead(ctx, patientId, shareToken))) return null;
    const obs = (await ctx.db
      .query("observations")
      .withIndex("by_patient_code", (q: any) => q.eq("patientId", patientId).eq("code", code))
      .collect()) as any[];
    if (!obs.length) return null;
    obs.sort((a, b) => a.date - b.date);
    const meta = metaFor(code, obs[0].label, obs[0].unit);
    return {
      code, label: meta.label, unit: obs[0].unit || meta.unit,
      refHigh: meta.refHigh ?? null, refLow: meta.refLow ?? null, direction: meta.direction,
      series: obs.map((o) => ({ value: o.value, date: iso(o.date) })),
      latest: { value: obs[obs.length - 1].value, date: iso(obs[obs.length - 1].date), documentId: obs[obs.length - 1].documentId },
    };
  },
});

export const explainMetric = action({
  args: { patientId: v.id("patients"), code: v.string(), shareToken: v.optional(v.string()) },
  handler: async (
    ctx,
    { patientId, code, shareToken },
  ): Promise<{ label: string; explanation: string; questions: string[]; documentId: Id<"documents"> | null; source: { title: string; url: string } | null } | null> => {
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
    const m: any = await ctx.runQuery(internal.insights.metricData, { patientId, code, shareToken });
    if (!m) return null;
    if (!apiKey) return { label: m.label, explanation: "Set OPENAI_API_KEY to enable explanations.", questions: [], documentId: m.latest.documentId, source: null };

    // Ground the explanation in a trusted public source (Firecrawl) when available.
    const ref: any = await ctx.runAction(internal.firecrawl.referenceLookup, { topic: m.label, hint: "lab test" });
    const source = ref && ref.source ? ref.source : null;
    const grounding = ref && ref.summary ? `\n\nTRUSTED REFERENCE (from ${source?.url}): ${ref.summary}\nUse this reference for the general explanation; use the patient data for their specific numbers/trend.` : "";

    const system =
      "You explain ONE lab/vital to a patient in plain, calm, non-alarming language. Use ONLY the provided data (and the trusted reference, if given). " +
      "Never diagnose, never prescribe, never say something is 'fine' or 'dangerous' definitively — describe and contextualize, and defer to a clinician. " +
      'Return STRICT JSON: {"explanation": string (2-4 short sentences, markdown ok: what it measures, what the reference range means, and what THIS person\'s trend shows), "questions": [string] (2-3 specific questions to ask their doctor)}.';
    const user = `METRIC: ${JSON.stringify(m)}${grounding}\n\nExplain ${m.label} for this person.`;
    try {
      const parsed = await chat(apiKey, model, system, user);
      return {
        label: m.label,
        explanation: String(parsed.explanation ?? "").trim() || "No explanation available.",
        questions: (Array.isArray(parsed.questions) ? parsed.questions : []).map((q: any) => String(q)).slice(0, 3),
        documentId: m.latest.documentId,
        source,
      };
    } catch (e: any) {
      return { label: m.label, explanation: `Couldn't generate an explanation (${String(e?.message ?? e).slice(0, 120)}).`, questions: [], documentId: m.latest.documentId, source };
    }
  },
});

// ---- #48 SBAR Pre-Visit Brief (doctor-facing) ---------------------------

export const briefData = internalQuery({
  args: { patientId: v.id("patients"), shareToken: v.optional(v.string()) },
  handler: async (ctx, { patientId, shareToken }) => {
    if (!(await canRead(ctx, patientId, shareToken))) return null;
    const get = (t: string) => ctx.db.query(t as any).withIndex("by_patient", (q: any) => q.eq("patientId", patientId)).collect();
    const [patient, obs, meds, conds, allergies, encs, docs] = await Promise.all([
      ctx.db.get(patientId), get("observations"), get("medications"), get("conditions"), get("allergies"), get("encounters"), get("documents"),
    ]);
    const byCode: Record<string, any[]> = {};
    for (const o of obs as any[]) (byCode[o.code] ??= []).push(o);
    const trends = Object.entries(byCode).map(([code, arr]) => {
      (arr as any[]).sort((a, b) => a.date - b.date);
      const meta = metaFor(code, (arr as any[])[0].label, (arr as any[])[0].unit);
      const last = (arr as any[])[(arr as any[]).length - 1];
      return { metric: meta.label, latest: last.value, unit: last.unit || meta.unit, date: iso(last.date), first: (arr as any[])[0].value, documentId: last.documentId, refHigh: meta.refHigh ?? null, refLow: meta.refLow ?? null };
    });
    return {
      patient: patient ? { name: (patient as any).name, age: (patient as any).age, sex: (patient as any).sex } : null,
      activeConditions: (conds as any[]).filter((c) => c.status === "active").map((c) => ({ name: c.name, documentId: c.documentId })),
      activeMeds: (meds as any[]).filter((m) => m.status === "active").map((m) => ({ name: m.name, dose: m.dose ? `${m.dose} ${m.doseUnit ?? ""}`.trim() : null, documentId: m.documentId })),
      allergies: (allergies as any[]).map((a) => ({ substance: a.substance, reaction: a.reaction })),
      trends,
      recentVisits: (encs as any[]).sort((a, b) => b.date - a.date).slice(0, 5).map((e) => ({ title: e.title, date: iso(e.date) })),
      docIds: (docs as any[]).map((d) => d._id),
    };
  },
});

export const clinicalBrief = action({
  args: { patientId: v.id("patients"), shareToken: v.optional(v.string()) },
  handler: async (
    ctx,
    { patientId, shareToken },
  ): Promise<{ markdown: string; citations: { documentId: Id<"documents">; label: string }[] } | null> => {
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
    const d: any = await ctx.runQuery(internal.insights.briefData, { patientId, shareToken });
    if (!d) return null;
    if (!apiKey) return { markdown: "_Set OPENAI_API_KEY to generate the clinical brief._", citations: [] };

    const system =
      "You are drafting a concise clinician-facing pre-visit brief from a patient's aggregated record. Use ONLY the provided data. " +
      "This is a summary for a clinician's triage — factual, no diagnosis, no treatment recommendations. Note temporal associations, not causation. " +
      "Structure as SBAR. Return STRICT JSON: " +
      '{"oneLiner": string (1 sentence: age/sex + the headline), "situation": string, "background": string (key active problems, meds, allergies), "assessment": string (notable labs/vitals & trends, anything out of range), "watch": [string] (2-4 things a clinician might want to review), "citationDocIds": [string]}. ' +
      "Keep each field to 1-3 tight sentences or a short bullet list (markdown ok). Only cite documentId values that appear in the data.";
    const user = `RECORD: ${JSON.stringify(d)}`;
    try {
      const p = await chat(apiKey, model, system, user);
      const valid = new Set<string>((d.docIds || []).map((x: any) => String(x)));
      const citations = (Array.isArray(p.citationDocIds) ? p.citationDocIds : [])
        .map((x: any) => String(x))
        .filter((id: string) => valid.has(id))
        .slice(0, 6)
        .map((id: string) => ({ documentId: id as Id<"documents">, label: "Source" }));
      const watch = Array.isArray(p.watch) ? p.watch.map((w: any) => `- ${String(w)}`).join("\n") : "";
      const md = [
        p.oneLiner ? `**${String(p.oneLiner)}**` : "",
        p.situation ? `**S — Situation.** ${String(p.situation)}` : "",
        p.background ? `**B — Background.** ${String(p.background)}` : "",
        p.assessment ? `**A — Assessment.** ${String(p.assessment)}` : "",
        watch ? `**R — Review.**\n${watch}` : "",
      ].filter(Boolean).join("\n\n");
      return { markdown: md || "No brief could be generated.", citations };
    } catch (e: any) {
      return { markdown: `_Couldn't generate the brief (${String(e?.message ?? e).slice(0, 120)})._`, citations: [] };
    }
  },
});
