import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { canRead, assertWrite } from "./authz";

// Connections for a patient — WITHOUT tokens (never sent to the client).
export const listMyConnections = query({
  args: { patientId: v.id("patients") },
  handler: async (ctx, { patientId }) => {
    if (!(await canRead(ctx, patientId))) return [];
    const rows = await ctx.db
      .query("connections")
      .withIndex("by_patient", (q) => q.eq("patientId", patientId))
      .collect();
    return rows
      .sort((a, b) => b.connectedAt - a.connectedAt)
      .map((c) => ({
        _id: c._id,
        providerId: c.providerId,
        provider: c.provider,
        fhirBaseUrl: c.fhirBaseUrl,
        status: c.status,
        connectedAt: c.connectedAt,
        lastSyncedAt: c.lastSyncedAt,
        lastCounts: c.lastCounts,
        expiresAt: c.expiresAt,
      }));
  },
});

export const removeConnection = mutation({
  args: { connectionId: v.id("connections") },
  handler: async (ctx, { connectionId }) => {
    const conn = await ctx.db.get(connectionId);
    if (!conn) return;
    await assertWrite(ctx, conn.patientId);
    await ctx.db.delete(connectionId);
  },
});
