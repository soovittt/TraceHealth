import { query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { canRead } from "./authz";
import { metaFor, METRIC_META } from "./metrics";

// ---- the intelligence layer ----------------------------------------------
// Deterministic "what needs attention" over the whole record. No model call —
// grounded, cited, non-diagnostic. Powers the dashboard feed, the doctor-view
// safety banner, and is folded into the AI's context.

const MONTH = 30 * 24 * 60 * 60 * 1000;
// Rough guideline recheck cadences (months) for the labs/vitals we track.
const CADENCE: Record<string, number> = {
  LDL: 60, CHOL_TOTAL: 60, HDL: 60, TRIG: 60,
  HBA1C: 36, GLUCOSE: 36,
  BP_SYS: 12, BP_DIA: 12,
  EGFR: 12, CREATININE: 12, VITD: 24,
};

export type Signal = {
  id: string;
  severity: "high" | "moderate" | "info";
  kind: "abnormal" | "worsening" | "overdue" | "allergy_med";
  title: string;
  detail: string;
  code?: string;
  value?: number;
  unit?: string;
  documentId?: Id<"documents">;
  page?: number;
  date?: number;
};

const RANK = { high: 0, moderate: 1, info: 2 };

async function load(ctx: any, patientId: Id<"patients">, shareToken?: string) {
  if (!(await canRead(ctx, patientId, shareToken))) return null;
  const get = (t: string) => ctx.db.query(t).withIndex("by_patient", (q: any) => q.eq("patientId", patientId)).collect();
  const [patient, obs, meds, conds, allergies, docs] = await Promise.all([
    ctx.db.get(patientId), get("observations"), get("medications"), get("conditions"), get("allergies"), get("documents"),
  ]);
  return { patient, obs, meds, conds, allergies, docs };
}

function computeSignals(d: any, now: number): Signal[] {
  const out: Signal[] = [];
  const byCode: Record<string, any[]> = {};
  for (const o of d.obs) (byCode[o.code] ??= []).push(o);

  for (const [code, arr] of Object.entries(byCode)) {
    const meta = METRIC_META[code];
    if (!meta) continue;
    (arr as any[]).sort((a, b) => a.date - b.date);
    const series = arr as any[];
    const last = series[series.length - 1];
    const prev = series.length > 1 ? series[series.length - 2] : null;
    const monthsOld = (now - last.date) / MONTH;

    const high = meta.refHigh !== undefined && last.value > meta.refHigh;
    const low = meta.refLow !== undefined && last.value < meta.refLow;
    const abnormal = (meta.direction === "high_bad" && high) || (meta.direction === "low_bad" && low);

    if (abnormal) {
      const ref = high ? meta.refHigh : meta.refLow;
      const overBy = high ? last.value - (meta.refHigh ?? 0) : (meta.refLow ?? 0) - last.value;
      const rel = ref ? overBy / ref : 0;
      const rising = prev ? (high ? last.value > prev.value : last.value < prev.value) : false;
      out.push({
        id: `abn-${code}`,
        severity: rel > 0.25 ? "high" : "moderate",
        kind: "abnormal",
        title: `${meta.label} ${high ? "above" : "below"} target`,
        detail: `Latest ${last.value} ${last.unit || meta.unit} (${high ? "target ≤" : "target ≥"} ${ref} ${meta.unit})${rising ? ", and still moving the wrong way" : ""}.`,
        code, value: last.value, unit: last.unit || meta.unit, documentId: last.documentId, page: last.page, date: last.date,
      });
    } else if (meta.direction !== "neutral" && series.length >= 3) {
      // In range but trending toward the threshold quickly.
      const first = series[0];
      const worsening = meta.direction === "high_bad" ? last.value > first.value : last.value < first.value;
      const ref = meta.direction === "high_bad" ? meta.refHigh : meta.refLow;
      const near = ref !== undefined && (meta.direction === "high_bad" ? last.value > ref * 0.9 : last.value < ref * 1.1);
      if (worsening && near) {
        out.push({
          id: `wrs-${code}`,
          severity: "moderate",
          kind: "worsening",
          title: `${meta.label} trending toward its limit`,
          detail: `Moved ${first.value} → ${last.value} ${meta.unit} and is approaching the ${ref} ${meta.unit} threshold.`,
          code, value: last.value, unit: last.unit || meta.unit, documentId: last.documentId, page: last.page, date: last.date,
        });
      }
    }

    // Overdue recheck for a tracked metric.
    const cad = CADENCE[code];
    if (cad && monthsOld > cad) {
      out.push({
        id: `due-${code}`,
        severity: abnormal ? "moderate" : "info",
        kind: "overdue",
        title: `${meta.label} recheck overdue`,
        detail: `Last measured ${Math.round(monthsOld)} months ago${abnormal ? " — and it was out of range" : ""} (typical cadence ~${Math.round(cad / 12) || 1}y).`,
        code, documentId: last.documentId, page: last.page, date: last.date,
      });
    }
  }

  // Allergy vs active medication cross-check (safety).
  const activeMeds = d.meds.filter((m: any) => m.status === "active");
  for (const al of d.allergies) {
    const sub = String(al.substance || "").toLowerCase();
    if (!sub) continue;
    for (const m of activeMeds) {
      const name = `${m.name} ${m.normalizedName}`.toLowerCase();
      if (sub.length > 3 && name.includes(sub)) {
        out.push({
          id: `alg-${m._id}`,
          severity: "high",
          kind: "allergy_med",
          title: `Active med may match a recorded allergy`,
          detail: `“${m.name}” appears related to your recorded allergy to ${al.substance}. Worth confirming with your clinician.`,
          documentId: m.documentId, page: m.page,
        });
      }
    }
  }

  out.sort((a, b) => RANK[a.severity] - RANK[b.severity] || (b.date ?? 0) - (a.date ?? 0));
  return out;
}

export const getSignals = query({
  args: { patientId: v.id("patients"), shareToken: v.optional(v.string()) },
  handler: async (ctx, { patientId, shareToken }): Promise<Signal[]> => {
    const d = await load(ctx, patientId, shareToken);
    if (!d) return [];
    return computeSignals(d, Date.now());
  },
});

// #63 — how complete is my record? A simple, honest data-health score.
export const dataHealth = query({
  args: { patientId: v.id("patients") },
  handler: async (ctx, { patientId }) => {
    const d = await load(ctx, patientId);
    if (!d) return null;
    const orgs = new Set(d.docs.map((x: any) => x.org));
    const codes = new Set(d.obs.map((o: any) => o.code));
    const lastActivity = Math.max(0, ...d.obs.map((o: any) => o.date), ...d.docs.map((x: any) => x.receivedAt));
    const monthsStale = lastActivity ? (Date.now() - lastActivity) / MONTH : 999;

    // Coverage of the core metric set + presence of each data class.
    const core = ["LDL", "HBA1C", "BP_SYS", "WEIGHT"];
    const coreHit = core.filter((c) => codes.has(c)).length;
    const classes = [d.obs.length > 0, d.meds.length > 0, d.conds.length > 0, d.allergies.length > 0].filter(Boolean).length;

    let score = 0;
    score += Math.min(40, (coreHit / core.length) * 40);
    score += (classes / 4) * 30;
    score += Math.min(20, orgs.size * 10);
    score += monthsStale < 12 ? 10 : monthsStale < 24 ? 5 : 0;

    const gaps: string[] = [];
    if (!codes.has("LDL")) gaps.push("No cholesterol panel");
    if (!codes.has("HBA1C")) gaps.push("No HbA1c / glucose");
    if (!codes.has("BP_SYS")) gaps.push("No blood pressure");
    if (d.allergies.length === 0) gaps.push("No allergies recorded");
    if (monthsStale >= 12) gaps.push(`Newest record is ${Math.round(monthsStale)} months old`);
    if (orgs.size < 2) gaps.push("Only one source connected");

    return {
      score: Math.round(score),
      sources: orgs.size,
      metrics: codes.size,
      classes,
      monthsStale: Math.round(monthsStale),
      gaps: gaps.slice(0, 4),
    };
  },
});
