import { mutation, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import {
  DEMO_PATIENT,
  DEMO_DOCS,
  DEMO_PROVIDERS,
  DEMO_OBSERVATIONS,
  DEMO_MEDICATIONS,
  DEMO_CONDITIONS,
  DEMO_ENCOUNTERS,
  DEMO_ALLERGIES,
  DEMO_MISSING,
} from "./demoData";

// Delete an existing patient's whole graph so "Load demo" is idempotent.
async function wipePatient(ctx: any, patientId: Id<"patients">) {
  const tables = [
    "documents",
    "providers",
    "observations",
    "medications",
    "conditions",
    "encounters",
    "allergies",
    "conflicts",
    "missingRecords",
    "shares",
    "processingJobs",
  ] as const;
  for (const t of tables) {
    const rows = await ctx.db
      .query(t)
      .withIndex("by_patient", (q: any) => q.eq("patientId", patientId))
      .collect();
    for (const r of rows) await ctx.db.delete(r._id);
  }
  await ctx.db.delete(patientId);
}

// One-click demo loader. Seeds the full graph immediately, then runs a
// short live "building your health history" animation via the scheduler.
export const loadDemo = mutation({
  args: {},
  handler: async (ctx) => {
    // Reset any prior demo patient.
    const existing = await ctx.db
      .query("patients")
      .withIndex("by_demo", (q) => q.eq("isDemo", true))
      .collect();
    for (const p of existing) await wipePatient(ctx, p._id);

    const patientId = await ctx.db.insert("patients", {
      ...DEMO_PATIENT,
      isDemo: true,
    });

    // Documents first — everything references them for evidence.
    const docIds: Record<string, Id<"documents">> = {};
    for (const doc of DEMO_DOCS) {
      docIds[doc.key] = await ctx.db.insert("documents", {
        patientId,
        filename: doc.filename,
        org: doc.org,
        kind: doc.kind,
        pages: doc.pages,
        receivedVia: doc.receivedVia,
        receivedAt: doc.receivedAt,
        excerpt: doc.excerpt,
      });
    }

    for (const p of DEMO_PROVIDERS) {
      await ctx.db.insert("providers", { patientId, ...p });
    }

    for (const o of DEMO_OBSERVATIONS) {
      await ctx.db.insert("observations", {
        patientId,
        code: o.code,
        label: o.label,
        value: o.value,
        unit: o.unit,
        date: o.date,
        provider: o.provider,
        documentId: docIds[o.doc],
        page: o.page,
        provenance: "imported",
      });
    }

    for (const m of DEMO_MEDICATIONS) {
      await ctx.db.insert("medications", {
        patientId,
        name: m.name,
        normalizedName: m.normalizedName,
        dose: m.dose,
        doseUnit: m.doseUnit,
        status: m.status,
        startDate: m.startDate,
        prescriber: m.prescriber,
        documentId: docIds[m.doc],
        page: m.page,
        provenance: "imported",
      });
    }

    for (const c of DEMO_CONDITIONS) {
      await ctx.db.insert("conditions", {
        patientId,
        name: c.name,
        normalizedName: c.normalizedName,
        status: c.status,
        diagnosedDate: c.diagnosedDate,
        documentId: docIds[c.doc],
        page: c.page,
        provenance: "imported",
      });
    }

    for (const e of DEMO_ENCOUNTERS) {
      await ctx.db.insert("encounters", {
        patientId,
        kind: e.kind,
        title: e.title,
        provider: e.provider,
        org: e.org,
        date: e.date,
        summary: e.summary,
        documentId: docIds[e.doc],
        page: e.page,
        provenance: "imported",
      });
    }

    for (const a of DEMO_ALLERGIES) {
      await ctx.db.insert("allergies", {
        patientId,
        substance: a.substance,
        reaction: a.reaction,
        documentId: docIds[a.doc],
        page: a.page,
        provenance: "imported",
      });
    }

    // Conflicts detected across combined records — the thing one portal can't do.
    await ctx.db.insert("conflicts", {
      patientId,
      kind: "medication_dose",
      label: "Metformin",
      detail: "Two records disagree on the current dose.",
      options: [
        { value: "1000 mg", source: "Stanford Health", documentId: docIds["stanMar2026"] },
        { value: "500 mg", source: "UCSF", documentId: docIds["ucsf2025"] },
      ],
      status: "open",
    });
    await ctx.db.insert("conflicts", {
      patientId,
      kind: "allergy",
      label: "Penicillin",
      detail: "One record lists a penicillin allergy; another lists none.",
      options: [
        { value: "Penicillin allergy", source: "Stanford Health", documentId: docIds["stan2023"] },
        { value: "No known allergies", source: "UCSF", documentId: docIds["ucsfMed2026"] },
      ],
      status: "open",
    });
    await ctx.db.insert("conflicts", {
      patientId,
      kind: "duplicate_condition",
      label: "High cholesterol = Hyperlipidemia",
      detail: "Two records describe the same concept with different names.",
      options: [
        { value: "High cholesterol", source: "Stanford Health", documentId: docIds["stan2023"] },
        { value: "Hyperlipidemia", source: "Quest Diagnostics", documentId: docIds["quest2025"] },
      ],
      status: "open",
    });

    for (const mr of DEMO_MISSING) {
      await ctx.db.insert("missingRecords", {
        patientId,
        label: mr.label,
        org: mr.org,
        date: mr.date,
        referencedInDocumentId: docIds[mr.referencedIn],
        status: "open",
      });
    }

    // Live ingestion animation.
    const steps = [
      { label: "Reading 10 documents", count: 10, done: false },
      { label: "Encounters found", count: DEMO_ENCOUNTERS.length, done: false },
      { label: "Lab results found", count: DEMO_OBSERVATIONS.length, done: false },
      { label: "Medications found", count: DEMO_MEDICATIONS.length, done: false },
      { label: "Conditions found", count: DEMO_CONDITIONS.length, done: false },
      { label: "Providers linked", count: DEMO_PROVIDERS.length, done: false },
      { label: "Relationships mapped", count: undefined, done: false },
      { label: "Conflicts detected", count: 3, done: false },
    ];
    const jobId = await ctx.db.insert("processingJobs", {
      patientId,
      status: "running",
      steps,
      startedAt: Date.now(),
    });
    // Reveal steps one at a time for the demo effect.
    for (let i = 0; i < steps.length; i++) {
      await ctx.scheduler.runAfter(350 + i * 420, internal.demo.advanceJob, {
        jobId,
        index: i,
      });
    }

    return { patientId };
  },
});

export const advanceJob = internalMutation({
  args: { jobId: v.id("processingJobs"), index: v.number() },
  handler: async (ctx, { jobId, index }) => {
    const job = await ctx.db.get(jobId);
    if (!job) return;
    const steps = job.steps.map((s, i) => (i === index ? { ...s, done: true } : s));
    const status = index === steps.length - 1 ? "done" : "running";
    await ctx.db.patch(jobId, { steps, status });
  },
});
