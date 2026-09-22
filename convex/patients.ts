import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
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
// table → the index whose FIRST field is patientId (events uses a compound one).
const PATIENT_TABLES: Record<string, string> = {
  documents: "by_patient", providers: "by_patient", observations: "by_patient", medications: "by_patient",
  conditions: "by_patient", encounters: "by_patient", allergies: "by_patient", conflicts: "by_patient",
  missingRecords: "by_patient", shares: "by_patient", processingJobs: "by_patient", connections: "by_patient",
  reports: "by_patient", exports: "by_patient", ingestJobs: "by_patient", reportSchedules: "by_patient",
  conversations: "by_patient", chatMessages: "by_patient", notifications: "by_patient",
  events: "by_patient_date", // no plain by_patient index — use the compound one (prefix on patientId)
};

async function clearPatient(ctx: any, patientId: any): Promise<number> {
  let cleared = 0;
  for (const [table, index] of Object.entries(PATIENT_TABLES)) {
    const rows = await ctx.db.query(table).withIndex(index, (q: any) => q.eq("patientId", patientId)).collect();
    for (const r of rows) {
      if (r.storageId) { try { await ctx.storage.delete(r.storageId); } catch { /* orphan blob, ignore */ } }
      await ctx.db.delete(r._id);
      cleared++;
    }
  }
  await ctx.db.patch(patientId, { recordsFrom: undefined, orgCount: undefined });
  return cleared;
}

export const resetMyRecord = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const patient = await ctx.db.query("patients").withIndex("by_user", (q) => q.eq("userId", userId)).first();
    if (!patient) return { cleared: 0 };
    return { cleared: await clearPatient(ctx, patient._id) };
  },
});

// Admin: wipe a record by account email. Runnable from the CLI:
//   npx convex run patients:wipeByEmail '{"email":"you@example.com"}'
export const wipeByEmail = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const users = await ctx.db.query("users").collect();
    const user = users.find((u: any) => (u.email ?? "").toLowerCase() === email.toLowerCase());
    if (!user) return { ok: false, reason: "no user with that email", cleared: 0 };
    const patients = await ctx.db.query("patients").withIndex("by_user", (q) => q.eq("userId", user._id)).collect();
    let cleared = 0;
    for (const p of patients) cleared += await clearPatient(ctx, p._id);
    return { ok: true, patients: patients.length, cleared };
  },
});

// Admin: clear the record data for every guest (anonymous, email-less) account,
// so the SMART-sandbox connect flow can be demoed from a clean slate. Keeps the
// patient + account rows intact (so existing guest sessions stay valid — their
// home just goes empty until they reconnect). Run from the CLI:
//   npx convex run patients:wipeGuests '{}' --prod
export const wipeGuests = internalMutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const guestIds = new Set(users.filter((u: any) => !u.email).map((u) => u._id));
    const patients = await ctx.db.query("patients").collect();
    let guests = 0;
    let cleared = 0;
    for (const p of patients) {
      if (p.userId && guestIds.has(p.userId) && !p.isDemo) {
        cleared += await clearPatient(ctx, p._id);
        guests++;
      }
    }
    return { guests, cleared };
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
      name: (user as any)?.name ?? (user as any)?.email ?? "Guest",
      age: 0,
      isDemo: false,
      userId,
    });
  },
});
