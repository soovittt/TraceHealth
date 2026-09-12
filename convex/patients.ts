import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// The signed-in user (name + email), or null.
export const getMe = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;
    return { id: userId, name: (user as any).name ?? null, email: (user as any).email ?? null };
  },
});

// The current user's own health record (patient), or null if not signed in / none yet.
export const getMyPatient = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const patient = await ctx.db
      .query("patients")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    return patient?._id ?? null;
  },
});

// Clear the signed-in user's entire record — every lab, med, condition, visit,
// document, report, connection, chat, etc. — leaving an empty record (and the
// account) intact. For starting a clean demo. Not reversible.
const PATIENT_TABLES = [
  "documents", "providers", "observations", "medications", "conditions", "encounters",
  "allergies", "conflicts", "missingRecords", "shares", "processingJobs", "connections",
  "reports", "events", "exports", "ingestJobs", "reportSchedules", "conversations", "chatMessages",
] as const;

export const resetMyRecord = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const patient = await ctx.db.query("patients").withIndex("by_user", (q) => q.eq("userId", userId)).first();
    if (!patient) return { cleared: 0 };
    let cleared = 0;
    for (const t of PATIENT_TABLES) {
      const rows = await ctx.db.query(t as any).withIndex("by_patient", (q: any) => q.eq("patientId", patient._id)).collect();
      for (const r of rows) {
        if ((r as any).storageId) { try { await ctx.storage.delete((r as any).storageId); } catch { /* orphan blob, ignore */ } }
        await ctx.db.delete(r._id);
        cleared++;
      }
    }
    await ctx.db.patch(patient._id, { recordsFrom: undefined, orgCount: undefined });
    return { cleared };
  },
});

// Create the user's record on first entry (idempotent). Returns its id.
export const ensureMyPatient = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const existing = await ctx.db
      .query("patients")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (existing) return existing._id;
    const user = await ctx.db.get(userId);
    return ctx.db.insert("patients", {
      name: (user as any)?.name ?? (user as any)?.email ?? "My health",
      age: 0,
      isDemo: false,
      userId,
    });
  },
});
