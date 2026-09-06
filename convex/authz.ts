import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";

// A patient record is readable if: it's the public demo, it's owned by the
// signed-in user, or it's reached through a valid (unexpired) share token.
export async function patientAccess(ctx: any, patientId: Id<"patients">, shareToken?: string) {
  const patient = await ctx.db.get(patientId);
  if (!patient) return { ok: false as const, patient: null };
  if (patient.isDemo) return { ok: true as const, patient };

  const userId = await getAuthUserId(ctx);
  if (userId && patient.userId === userId) return { ok: true as const, patient };

  if (shareToken) {
    const share = await ctx.db
      .query("shares")
      .withIndex("by_token", (q: any) => q.eq("token", shareToken))
      .first();
    if (share && share.expiresAt > Date.now() && share.patientId === patientId) {
      return { ok: true as const, patient };
    }
  }
  return { ok: false as const, patient };
}

// Read access: demo | owner | valid share token.
export async function assertRead(ctx: any, patientId: Id<"patients">, shareToken?: string) {
  const { ok } = await patientAccess(ctx, patientId, shareToken);
  if (!ok) throw new Error("You don't have access to this record.");
}

// Non-throwing read check. Queries use this so an unauthorized (or briefly
// unauthenticated, mid-login) read returns empty instead of crashing the UI.
export async function canRead(ctx: any, patientId: Id<"patients">, shareToken?: string) {
  const { ok } = await patientAccess(ctx, patientId, shareToken);
  return ok;
}

// Write access: demo (public sandbox) | owner. Never via a share link.
export async function assertWrite(ctx: any, patientId: Id<"patients">) {
  const patient = await ctx.db.get(patientId);
  if (!patient) throw new Error("Record not found.");
  if (patient.isDemo) return;
  const userId = await getAuthUserId(ctx);
  if (userId && patient.userId === userId) return;
  throw new Error("You don't have permission to modify this record.");
}
