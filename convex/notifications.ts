import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { canRead, assertWrite } from "./authz";

// Recent notifications for the record (newest first), for the top-bar bell.
export const list = query({
  args: { patientId: v.id("patients") },
  handler: async (ctx, { patientId }) => {
    if (!(await canRead(ctx, patientId))) return [];
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_patient", (q) => q.eq("patientId", patientId))
      .collect();
    return rows.sort((a, b) => b.createdAt - a.createdAt).slice(0, 30);
  },
});

// Unread count — drives the badge (reactive, so it updates the moment a job finishes).
export const unreadCount = query({
  args: { patientId: v.id("patients") },
  handler: async (ctx, { patientId }) => {
    if (!(await canRead(ctx, patientId))) return 0;
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_patient", (q) => q.eq("patientId", patientId))
      .collect();
    return rows.filter((r) => !r.read).length;
  },
});

export const markRead = mutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, { id }) => {
    const n = await ctx.db.get(id);
    if (!n) return;
    await assertWrite(ctx, n.patientId);
    if (!n.read) await ctx.db.patch(id, { read: true });
  },
});

export const markAllRead = mutation({
  args: { patientId: v.id("patients") },
  handler: async (ctx, { patientId }) => {
    await assertWrite(ctx, patientId);
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_patient", (q) => q.eq("patientId", patientId))
      .collect();
    for (const r of rows) if (!r.read) await ctx.db.patch(r._id, { read: true });
  },
});

// Trusted insert — called from background jobs (no user auth in that context).
export const createTrusted = internalMutation({
  args: {
    patientId: v.id("patients"),
    kind: v.string(),
    title: v.string(),
    body: v.optional(v.string()),
    refType: v.optional(v.string()),
    refId: v.optional(v.string()),
  },
  handler: async (ctx, a) => {
    const patient = await ctx.db.get(a.patientId);
    return ctx.db.insert("notifications", {
      patientId: a.patientId,
      userId: patient?.userId,
      kind: a.kind,
      title: a.title,
      body: a.body,
      read: false,
      refType: a.refType,
      refId: a.refId,
      createdAt: Date.now(),
    });
  },
});
