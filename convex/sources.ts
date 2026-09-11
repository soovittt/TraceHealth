import { query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { canRead } from "./authz";

// ---- source history ------------------------------------------------------
// Every record in TraceHealth traces to a source document (a FHIR sync, an
// import, an AI-extracted upload, or a manual entry). This is the audit trail:
// what you added, when, how it arrived, and exactly which records it produced.

async function byPatient(ctx: any, table: string, patientId: Id<"patients">, shareToken?: string) {
  if (!(await canRead(ctx, patientId, shareToken))) return [];
  return ctx.db.query(table).withIndex("by_patient", (q: any) => q.eq("patientId", patientId)).collect();
}

// The list of sources, newest-first, each with a per-type record tally and the
// mix of provenance it carries.
export const listSources = query({
  args: { patientId: v.id("patients"), shareToken: v.optional(v.string()) },
  handler: async (ctx, { patientId, shareToken }) => {
    if (!(await canRead(ctx, patientId, shareToken))) return [];
    const [documents, obs, meds, conds, encs, algs] = await Promise.all([
      byPatient(ctx, "documents", patientId, shareToken),
      byPatient(ctx, "observations", patientId, shareToken),
      byPatient(ctx, "medications", patientId, shareToken),
      byPatient(ctx, "conditions", patientId, shareToken),
      byPatient(ctx, "encounters", patientId, shareToken),
      byPatient(ctx, "allergies", patientId, shareToken),
    ]);

    // Tally records + provenance per documentId in a single pass each.
    type Tally = { observations: number; medications: number; conditions: number; encounters: number; allergies: number; prov: Set<string> };
    const byDoc = new Map<string, Tally>();
    const bump = (docId: any, key: keyof Omit<Tally, "prov">, prov?: string) => {
      const id = String(docId);
      if (!byDoc.has(id)) byDoc.set(id, { observations: 0, medications: 0, conditions: 0, encounters: 0, allergies: 0, prov: new Set() });
      const t = byDoc.get(id)!;
      t[key]++;
      if (prov) t.prov.add(prov);
    };
    for (const o of obs) bump(o.documentId, "observations", o.provenance);
    for (const m of meds) bump(m.documentId, "medications", m.provenance);
    for (const c of conds) bump(c.documentId, "conditions", c.provenance);
    for (const e of encs) bump(e.documentId, "encounters", e.provenance);
    for (const a of algs) bump(a.documentId, "allergies", a.provenance);

    return documents
      .map((d: any) => {
        const t = byDoc.get(String(d._id)) ?? { observations: 0, medications: 0, conditions: 0, encounters: 0, allergies: 0, prov: new Set<string>() };
        const total = t.observations + t.medications + t.conditions + t.encounters + t.allergies;
        return {
          documentId: d._id,
          filename: d.filename,
          org: d.org,
          kind: d.kind,
          receivedVia: d.receivedVia,
          receivedAt: d.receivedAt,
          hasFile: !!d.storageId,
          counts: { observations: t.observations, medications: t.medications, conditions: t.conditions, encounters: t.encounters, allergies: t.allergies, total },
          provenances: [...t.prov],
        };
      })
      .sort((a: any, b: any) => (b.receivedAt ?? 0) - (a.receivedAt ?? 0));
  },
});

// The exact records that came from one source — grouped, with provenance — so a
// user (or clinician) can trace any single fact back to what brought it in.
export const sourceRecords = query({
  args: { documentId: v.id("documents"), shareToken: v.optional(v.string()) },
  handler: async (ctx, { documentId, shareToken }) => {
    const doc = await ctx.db.get(documentId);
    if (!doc) return null;
    if (!(await canRead(ctx, doc.patientId, shareToken))) return null;
    const same = (arr: any[]) => arr.filter((r) => String(r.documentId) === String(documentId));
    const [obs, meds, conds, encs, algs] = await Promise.all([
      byPatient(ctx, "observations", doc.patientId, shareToken),
      byPatient(ctx, "medications", doc.patientId, shareToken),
      byPatient(ctx, "conditions", doc.patientId, shareToken),
      byPatient(ctx, "encounters", doc.patientId, shareToken),
      byPatient(ctx, "allergies", doc.patientId, shareToken),
    ]);
    return {
      document: { filename: doc.filename, org: doc.org, kind: doc.kind, receivedVia: doc.receivedVia, receivedAt: doc.receivedAt },
      labs: same(obs).sort((a, b) => a.date - b.date).map((o) => ({ label: o.label, value: o.value, unit: o.unit, date: o.date, provenance: o.provenance })),
      medications: same(meds).map((m) => ({ name: m.name, dose: m.dose ?? null, doseUnit: m.doseUnit ?? null, status: m.status, provenance: m.provenance })),
      conditions: same(conds).map((c) => ({ name: c.name, status: c.status, date: c.diagnosedDate ?? null, provenance: c.provenance })),
      encounters: same(encs).map((e) => ({ title: e.title, kind: e.kind, date: e.date, provenance: e.provenance })),
      allergies: same(algs).map((a) => ({ substance: a.substance, reaction: a.reaction ?? null, provenance: a.provenance })),
    };
  },
});
