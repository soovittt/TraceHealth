import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { assertWrite } from "./authz";

// Fresh patient for the real upload path — owned by the signed-in user.
export const createPatient = mutation({
  args: { name: v.optional(v.string()) },
  handler: async (ctx, { name }) => {
    const userId = await getAuthUserId(ctx);
    return ctx.db.insert("patients", {
      name: name ?? "My health",
      age: 0,
      isDemo: false,
      userId: userId ?? undefined,
    });
  },
});

// Remove a connected source: deletes its documents and every fact traced to them.
export const disconnectSource = mutation({
  args: { patientId: v.id("patients"), org: v.string() },
  handler: async (ctx, { patientId, org }) => {
    await assertWrite(ctx, patientId);
    const docs = await ctx.db
      .query("documents")
      .withIndex("by_patient", (q) => q.eq("patientId", patientId))
      .collect();
    const targetIds = new Set(docs.filter((d) => d.org === org).map((d) => d._id));
    if (targetIds.size === 0) return { removed: 0 };

    for (const t of ["observations", "medications", "conditions", "encounters", "allergies"] as const) {
      const rows = await ctx.db
        .query(t)
        .withIndex("by_patient", (q) => q.eq("patientId", patientId))
        .collect();
      for (const r of rows) if ((r as any).documentId && targetIds.has((r as any).documentId)) await ctx.db.delete(r._id);
    }
    const conflicts = await ctx.db
      .query("conflicts")
      .withIndex("by_patient", (q) => q.eq("patientId", patientId))
      .collect();
    for (const c of conflicts)
      if (c.options?.some((o: any) => o.documentId && targetIds.has(o.documentId))) await ctx.db.delete(c._id);
    const missing = await ctx.db
      .query("missingRecords")
      .withIndex("by_patient", (q) => q.eq("patientId", patientId))
      .collect();
    for (const m of missing) if (targetIds.has(m.referencedInDocumentId)) await ctx.db.delete(m._id);

    for (const id of targetIds) await ctx.db.delete(id);
    return { removed: targetIds.size };
  },
});

export const resolveConflict = mutation({
  args: { conflictId: v.id("conflicts"), value: v.string() },
  handler: async (ctx, { conflictId, value }) => {
    const conflict = await ctx.db.get(conflictId);
    if (!conflict) return;
    await assertWrite(ctx, conflict.patientId);
    await ctx.db.patch(conflictId, { status: "resolved", resolvedValue: value });

    // For a dose conflict, apply the chosen value to the medication + mark verified.
    if (conflict.kind === "medication_dose") {
      const meds = await ctx.db
        .query("medications")
        .withIndex("by_patient", (q) => q.eq("patientId", conflict.patientId))
        .collect();
      const doseNum = parseFloat(value);
      for (const m of meds) {
        if (m.name.toLowerCase() === conflict.label.toLowerCase()) {
          await ctx.db.patch(m._id, {
            dose: isNaN(doseNum) ? m.dose : doseNum,
            provenance: "patient_verified",
          });
        }
      }
    }
  },
});

export const verifyMedication = mutation({
  args: { medicationId: v.id("medications"), active: v.boolean() },
  handler: async (ctx, { medicationId, active }) => {
    const med = await ctx.db.get(medicationId);
    if (!med) return;
    await assertWrite(ctx, med.patientId);
    await ctx.db.patch(medicationId, {
      status: active ? "active" : "stopped",
      provenance: "patient_verified",
    });
  },
});

// Doctor share link — temporary, 7 days.
export const createShare = mutation({
  args: { patientId: v.id("patients") },
  handler: async (ctx, { patientId }) => {
    await assertWrite(ctx, patientId);
    // Reuse an unexpired share if present.
    const existing = await ctx.db
      .query("shares")
      .withIndex("by_patient", (q) => q.eq("patientId", patientId))
      .collect();
    const now = Date.now();
    const live = existing.find((s) => s.expiresAt > now);
    if (live) return live.token;

    const token = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
    await ctx.db.insert("shares", {
      patientId,
      token,
      createdAt: now,
      expiresAt: now + 7 * 24 * 60 * 60 * 1000,
    });
    return token;
  },
});
