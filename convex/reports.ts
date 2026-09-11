import { action, mutation, query, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { canRead, assertWrite } from "./authz";
import { metaFor } from "./metrics";

// ---- read/list -----------------------------------------------------------

export const listReports = query({
  args: { patientId: v.id("patients") },
  handler: async (ctx, { patientId }) => {
    if (!(await canRead(ctx, patientId))) return [];
    const rows = await ctx.db
      .query("reports")
      .withIndex("by_patient", (q) => q.eq("patientId", patientId))
      .collect();
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const getReport = query({
  args: { reportId: v.id("reports") },
  handler: async (ctx, { reportId }) => {
    const r = await ctx.db.get(reportId);
    if (!r) return null;
    if (!(await canRead(ctx, r.patientId))) return null;
    return r;
  },
});

export const removeReport = mutation({
  args: { reportId: v.id("reports") },
  handler: async (ctx, { reportId }) => {
    const r = await ctx.db.get(reportId);
    if (!r) return;
    await assertWrite(ctx, r.patientId);
    await ctx.db.delete(reportId);
  },
});

// ---- create --------------------------------------------------------------

export const saveReport = internalMutation({
  args: {
    patientId: v.id("patients"),
    title: v.string(),
    content: v.string(),
    kind: v.string(),
  },
  handler: async (ctx, a) => {
    await assertWrite(ctx, a.patientId);
    const patient = await ctx.db.get(a.patientId);
    return ctx.db.insert("reports", {
      patientId: a.patientId,
      userId: patient?.userId,
      title: a.title,
      content: a.content,
      kind: a.kind,
      createdAt: Date.now(),
    });
  },
});

// Save a report directly (e.g. from a chat answer).
export const createReport = mutation({
  args: { patientId: v.id("patients"), title: v.string(), content: v.string(), kind: v.optional(v.string()) },
  handler: async (ctx, a): Promise<Id<"reports">> => {
    await assertWrite(ctx, a.patientId);
    const patient = await ctx.db.get(a.patientId);
    return ctx.db.insert("reports", {
      patientId: a.patientId,
      userId: patient?.userId,
      title: a.title,
      content: a.content,
      kind: a.kind ?? "custom",
      createdAt: Date.now(),
    });
  },
});

// Shared: turn a patient snapshot into the compact JSON the model summarizes.
function summaryContextFrom(s: any) {
  const iso = (t?: number) => (t ? new Date(t).toISOString().slice(0, 10) : null);
  const byCode: Record<string, any[]> = {};
  for (const o of s.obs) (byCode[o.code] ??= []).push(o);
  const metricTrends = Object.entries(byCode).map(([code, arr]: [string, any[]]) => {
    arr.sort((a, b) => a.date - b.date);
    const meta = metaFor(code, arr[0].label, arr[0].unit);
    const first = arr[0];
    const last = arr[arr.length - 1];
    return {
      label: meta.label,
      unit: last.unit || meta.unit,
      first: { v: first.value, date: iso(first.date) },
      latest: { v: last.value, date: iso(last.date) },
      trend: last.value > first.value ? "rising" : last.value < first.value ? "falling" : "flat",
      referenceHigh: meta.refHigh ?? null,
      referenceLow: meta.refLow ?? null,
    };
  });
  return {
    patient: s.patient ? { name: s.patient.name, age: s.patient.age, recordsFrom: s.patient.recordsFrom } : null,
    metricTrends,
    medications: s.meds.map((m: any) => ({ name: m.name, dose: m.dose ? `${m.dose} ${m.doseUnit}` : null, status: m.status })),
    conditions: s.conds.map((c: any) => ({ name: c.name, status: c.status })),
    allergies: s.allergies.map((a: any) => a.substance),
  };
}

// Shared: call the model to write the markdown summary.
async function summaryMarkdown(apiKey: string, model: string, context: any): Promise<string> {
  const system =
    "You are a clinical documentation assistant. Write a concise, well-structured HEALTH SUMMARY REPORT in Markdown from the provided records. " +
    "Sections: Patient overview; Active problems; Current medications; Allergies; Key trends (with values, dates, and reference status); Summary. " +
    "Use only the data provided. Describe findings and trends; do NOT diagnose or recommend treatment. Keep it factual and readable. Return ONLY the Markdown, no preamble.";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      messages: [
        { role: "system", content: system },
        { role: "user", content: `RECORDS (JSON):\n${JSON.stringify(context)}` },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  return String(json.choices?.[0]?.message?.content ?? "").trim() || "No report could be generated.";
}

// AI-generated clinical summary report from the patient's record (manual, authed).
export const generateSummaryReport = action({
  args: { patientId: v.id("patients") },
  handler: async (ctx, { patientId }): Promise<{ reportId: Id<"reports"> }> => {
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set.");
    const s: any = await ctx.runQuery(internal.assistant.aiSnapshot, { patientId });
    const content = await summaryMarkdown(apiKey, model, summaryContextFrom(s));
    const name = s.patient?.name ?? "Patient";
    const reportId: Id<"reports"> = await ctx.runMutation(internal.reports.saveReport, {
      patientId,
      title: `Health summary — ${name}`,
      content,
      kind: "summary",
    });
    return { reportId };
  },
});

// ---- scheduled reports (Convex cron) -------------------------------------
// A cron scans reportSchedules and auto-generates on cadence, in the background.

const CADENCE_MS: Record<string, number> = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
  yearly: 365 * 24 * 60 * 60 * 1000,
};
const CADENCE_LABEL: Record<string, string> = { daily: "Daily", weekly: "Weekly", monthly: "Monthly", yearly: "Yearly" };

// The user's cadences + next-run info, for the settings UI.
export const listSchedules = query({
  args: { patientId: v.id("patients") },
  handler: async (ctx, { patientId }) => {
    if (!(await canRead(ctx, patientId))) return [];
    const rows = await ctx.db.query("reportSchedules").withIndex("by_patient", (q) => q.eq("patientId", patientId)).collect();
    return rows.map((r) => ({
      cadence: r.cadence,
      enabled: r.enabled,
      lastRunAt: r.lastRunAt ?? null,
      nextRunAt: r.enabled ? (r.lastRunAt ? r.lastRunAt + (CADENCE_MS[r.cadence] ?? 0) : Date.now()) : null,
    }));
  },
});

// Toggle a cadence on/off (upsert one row per patient+cadence).
export const setReportSchedule = mutation({
  args: {
    patientId: v.id("patients"),
    cadence: v.union(v.literal("daily"), v.literal("weekly"), v.literal("monthly"), v.literal("yearly")),
    enabled: v.boolean(),
  },
  handler: async (ctx, { patientId, cadence, enabled }) => {
    await assertWrite(ctx, patientId);
    const now = Date.now();
    const existing = (await ctx.db.query("reportSchedules").withIndex("by_patient", (q) => q.eq("patientId", patientId)).collect()).find((r) => r.cadence === cadence);
    // On first enable, kick off the first report right away (don't wait up to a
    // cron cycle); stamp lastRunAt so the cron won't double-generate.
    const kickoff = enabled && !existing?.lastRunAt;
    if (existing) {
      await ctx.db.patch(existing._id, { enabled, ...(kickoff ? { lastRunAt: now } : {}) });
    } else {
      const patient = await ctx.db.get(patientId);
      await ctx.db.insert("reportSchedules", { patientId, userId: patient?.userId, cadence, kind: "summary", enabled, createdAt: now, ...(kickoff ? { lastRunAt: now } : {}) });
    }
    if (kickoff) await ctx.scheduler.runAfter(0, internal.reports.generateScheduledReport, { patientId, cadence });
  },
});

// Trusted insert — no assertWrite; only ever called from the cron path.
export const insertReportTrusted = internalMutation({
  args: { patientId: v.id("patients"), title: v.string(), content: v.string(), kind: v.string() },
  handler: async (ctx, a) => {
    const patient = await ctx.db.get(a.patientId);
    return ctx.db.insert("reports", { patientId: a.patientId, userId: patient?.userId, title: a.title, content: a.content, kind: a.kind, createdAt: Date.now() });
  },
});

// Which enabled schedules are due right now.
export const dueSchedules = internalQuery({
  args: { now: v.number() },
  handler: async (ctx, { now }) => {
    const rows = await ctx.db.query("reportSchedules").withIndex("by_enabled", (q) => q.eq("enabled", true)).collect();
    return rows
      .filter((r) => !r.lastRunAt || now - r.lastRunAt >= (CADENCE_MS[r.cadence] ?? Infinity))
      .map((r) => ({ scheduleId: r._id, patientId: r.patientId, cadence: r.cadence }));
  },
});

export const markScheduleRan = internalMutation({
  args: { scheduleId: v.id("reportSchedules"), now: v.number() },
  handler: async (ctx, { scheduleId, now }) => {
    await ctx.db.patch(scheduleId, { lastRunAt: now });
  },
});

// Cron entry point: find due schedules → generate each in the background.
export const runDueReportSchedules = internalAction({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const due: any[] = await ctx.runQuery(internal.reports.dueSchedules, { now });
    for (const d of due) {
      await ctx.runMutation(internal.reports.markScheduleRan, { scheduleId: d.scheduleId, now });
      await ctx.scheduler.runAfter(0, internal.reports.generateScheduledReport, { patientId: d.patientId, cadence: d.cadence });
    }
  },
});

// Generate one scheduled report (trusted — invoked only by the cron path).
export const generateScheduledReport = internalAction({
  args: { patientId: v.id("patients"), cadence: v.string() },
  handler: async (ctx, { patientId, cadence }) => {
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
    if (!apiKey) return; // silently skip if unconfigured — cron shouldn't throw
    const s: any = await ctx.runQuery(internal.assistant.aiSnapshot, { patientId });
    const content = await summaryMarkdown(apiKey, model, summaryContextFrom(s));
    const name = s.patient?.name ?? "Patient";
    const stamp = new Date().toISOString().slice(0, 10);
    await ctx.runMutation(internal.reports.insertReportTrusted, {
      patientId,
      title: `${CADENCE_LABEL[cadence] ?? "Scheduled"} health summary — ${name} · ${stamp}`,
      content,
      kind: "scheduled",
    });
  },
});

// ---- FHIR write-back -----------------------------------------------------

export const getReportInternal = internalQuery({
  args: { reportId: v.id("reports") },
  handler: async (ctx, { reportId }) => ctx.db.get(reportId),
});

export const latestConnection = internalQuery({
  args: { patientId: v.id("patients") },
  handler: async (ctx, { patientId }) => {
    const rows = await ctx.db
      .query("connections")
      .withIndex("by_patient", (q) => q.eq("patientId", patientId))
      .collect();
    return rows.sort((a, b) => b.connectedAt - a.connectedAt)[0] ?? null;
  },
});

export const markWritten = internalMutation({
  args: { reportId: v.id("reports"), fhirDocId: v.optional(v.string()), status: v.string() },
  handler: async (ctx, a) => {
    await ctx.db.patch(a.reportId, { fhirDocId: a.fhirDocId, fhirStatus: a.status });
  },
});

// Write a report back to the connected FHIR server as a DocumentReference.
export const writeReportToFhir = action({
  args: { reportId: v.id("reports") },
  handler: async (ctx, { reportId }): Promise<{ ok: boolean; fhirDocId?: string; message: string }> => {
    const report: any = await ctx.runQuery(internal.reports.getReportInternal, { reportId });
    if (!report) throw new Error("Report not found.");
    // Ownership check (mirror of assertWrite for actions).
    const userId = await getAuthUserId(ctx);
    const conn: any = await ctx.runQuery(internal.reports.latestConnection, { patientId: report.patientId });
    if (!conn) return { ok: false, message: "No connected provider to write to. Connect one first." };
    if (conn.userId && conn.userId !== userId) throw new Error("Not authorized.");

    const doc = {
      resourceType: "DocumentReference",
      status: "current",
      type: { text: "TraceHealth health summary" },
      subject: conn.patientFhirId ? { reference: `Patient/${conn.patientFhirId}` } : undefined,
      date: new Date().toISOString(),
      description: report.title,
      content: [
        {
          attachment: {
            contentType: "text/markdown",
            data: base64(report.content),
            title: report.title,
          },
        },
      ],
    };

    try {
      const res = await fetch(`${conn.fhirBaseUrl}/DocumentReference`, {
        method: "POST",
        headers: {
          "Content-Type": "application/fhir+json",
          Accept: "application/fhir+json",
          Authorization: `Bearer ${conn.accessToken}`,
        },
        body: JSON.stringify(doc),
      });
      if (!res.ok) {
        const txt = (await res.text()).slice(0, 200);
        await ctx.runMutation(internal.reports.markWritten, { reportId, status: "error" });
        return { ok: false, message: `Provider rejected the write (${res.status}). ${res.status === 403 || res.status === 401 ? "The connection is read-only (no write scope)." : txt}` };
      }
      const created = await res.json();
      await ctx.runMutation(internal.reports.markWritten, { reportId, fhirDocId: created.id, status: "written" });
      return { ok: true, fhirDocId: created.id, message: `Written to ${conn.provider} as DocumentReference/${created.id}.` };
    } catch (e: any) {
      await ctx.runMutation(internal.reports.markWritten, { reportId, status: "error" });
      return { ok: false, message: e?.message ?? "Write failed." };
    }
  },
});

// UTF-8 safe base64 for the attachment payload.
function base64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  // btoa exists in the Convex runtime
  return btoa(bin);
}
