import { query, mutation } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { canRead, assertWrite } from "./authz";
import { METRIC_META } from "./metrics";

// Rebuild the denormalized event feed for a patient from the source tables.
// Idempotent: wipes the patient's events, then re-derives them. Called from
// every ingest path so the timeline stays in sync. (Ingests are infrequent, so
// a full rebuild per ingest is cheap and drift-free.)
export async function rebuildEvents(ctx: any, patientId: Id<"patients">) {
  const existing = await ctx.db
    .query("events")
    .withIndex("by_patient_date", (q: any) => q.eq("patientId", patientId))
    .collect();
  for (const e of existing) await ctx.db.delete(e._id);

  const get = (t: string) => ctx.db.query(t as any).withIndex("by_patient", (q: any) => q.eq("patientId", patientId)).collect();
  const [obs, meds, conds, encs, allergies] = await Promise.all([
    get("observations"), get("medications"), get("conditions"), get("encounters"), get("allergies"),
  ]);
  const insert = (e: any) => ctx.db.insert("events", { patientId, ...e });

  for (const o of obs as any[]) {
    const meta = METRIC_META[o.code];
    const abnormal = !!(
      meta &&
      ((meta.direction === "high_bad" && meta.refHigh != null && o.value > meta.refHigh) ||
        (meta.direction === "low_bad" && meta.refLow != null && o.value < meta.refLow))
    );
    await insert({ type: "lab", date: o.date, title: o.label, code: o.code, value: o.value, unit: o.unit, abnormal, documentId: o.documentId, page: o.page, sourceId: o._id });
  }
  for (const m of meds as any[]) await insert({ type: "medication", date: m.startDate ?? m._creationTime, title: m.name, subtitle: m.dose ? `${m.dose} ${m.doseUnit ?? ""}`.trim() : undefined, documentId: m.documentId, page: m.page, sourceId: m._id });
  for (const c of conds as any[]) await insert({ type: "condition", date: c.diagnosedDate ?? c._creationTime, title: c.name, subtitle: c.status, documentId: c.documentId, page: c.page, sourceId: c._id });
  for (const e of encs as any[]) await insert({ type: "encounter", date: e.date, title: e.title, subtitle: e.org, documentId: e.documentId, page: e.page, sourceId: e._id });
  for (const a of allergies as any[]) await insert({ type: "allergy", date: a._creationTime, title: `Allergy: ${a.substance}`, subtitle: a.reaction, documentId: a.documentId, page: a.page, sourceId: a._id });
}

// Backfill for records that predate the events table (owner-gated). No-op if the
// feed is already built.
export const ensureEvents = mutation({
  args: { patientId: v.id("patients") },
  handler: async (ctx, { patientId }) => {
    await assertWrite(ctx, patientId);
    const hasEvent = await ctx.db.query("events").withIndex("by_patient_date", (q) => q.eq("patientId", patientId)).first();
    if (hasEvent) return null;
    const hasRecord = await ctx.db.query("observations").withIndex("by_patient", (q) => q.eq("patientId", patientId)).first();
    if (hasRecord) await rebuildEvents(ctx, patientId);
    return null;
  },
});

// The timeline: a single indexed query with real cursor-based pagination.
export const pagedTimeline = query({
  args: {
    patientId: v.id("patients"),
    type: v.optional(v.string()),
    shareToken: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { patientId, type, shareToken, paginationOpts }) => {
    if (!(await canRead(ctx, patientId, shareToken))) {
      return { page: [], isDone: true, continueCursor: "" };
    }
    const base =
      type && type !== "all"
        ? ctx.db.query("events").withIndex("by_patient_type_date", (q) => q.eq("patientId", patientId).eq("type", type))
        : ctx.db.query("events").withIndex("by_patient_date", (q) => q.eq("patientId", patientId));
    return await base.order("desc").paginate(paginationOpts);
  },
});
