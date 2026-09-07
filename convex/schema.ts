import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

// Provenance is the trust layer that runs through every fact in TraceHealth.
export const provenance = v.union(
  v.literal("imported"),
  v.literal("ai_extracted"),
  v.literal("patient_verified"),
  v.literal("clinician_verified"),
);

export default defineSchema({
  // Convex Auth tables (users, authAccounts, authSessions, ...).
  ...authTables,

  // A patient owns an entire health graph. Each signed-in user owns one.
  patients: defineTable({
    name: v.string(),
    age: v.number(),
    sex: v.optional(v.string()),
    isDemo: v.boolean(),
    userId: v.optional(v.id("users")), // owner; absent for the public demo
    // Convenience denormalized summary rendered on the import screen.
    recordsFrom: v.optional(v.string()), // e.g. "2018–2026"
    orgCount: v.optional(v.number()),
  })
    .index("by_demo", ["isDemo"])
    .index("by_user", ["userId"]),

  // Every ingested source file. All facts trace back to a document + page.
  documents: defineTable({
    patientId: v.id("patients"),
    filename: v.string(),
    org: v.string(), // "Stanford Health", "UCSF", "Quest Diagnostics", ...
    kind: v.string(), // "visit_summary" | "labs" | "specialist_note" | "clinical_export" | "fhir"
    pages: v.number(),
    receivedVia: v.string(), // "upload" | "email" | "demo"
    receivedAt: v.number(),
    storageId: v.optional(v.id("_storage")),
    // Raw text kept for evidence viewing when there is no original PDF.
    excerpt: v.optional(v.string()),
  })
    .index("by_patient", ["patientId"])
    // Native full-text search over document content, scoped per patient.
    .searchIndex("search_excerpt", { searchField: "excerpt", filterFields: ["patientId"] }),

  providers: defineTable({
    patientId: v.id("patients"),
    name: v.string(),
    org: v.string(),
    specialty: v.optional(v.string()),
  }).index("by_patient", ["patientId"]),

  // Numeric measurements over time (LDL, HbA1c, weight, BP...). The graph hero.
  observations: defineTable({
    patientId: v.id("patients"),
    code: v.string(), // canonical: "LDL" | "HBA1C" | "WEIGHT" | "BP_SYS" | ...
    label: v.string(), // human: "LDL Cholesterol"
    value: v.number(),
    unit: v.string(),
    date: v.number(),
    provider: v.optional(v.string()),
    documentId: v.id("documents"),
    page: v.number(),
    provenance,
  })
    .index("by_patient", ["patientId"])
    .index("by_patient_code", ["patientId", "code"]),

  medications: defineTable({
    patientId: v.id("patients"),
    name: v.string(),
    normalizedName: v.string(), // "Lipitor" and "Atorvastatin" collapse here
    dose: v.optional(v.number()),
    doseUnit: v.optional(v.string()),
    status: v.string(), // "active" | "stopped"
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    prescriber: v.optional(v.string()),
    documentId: v.id("documents"),
    page: v.number(),
    provenance,
  })
    .index("by_patient", ["patientId"])
    .searchIndex("search_name", { searchField: "name", filterFields: ["patientId"] }),

  conditions: defineTable({
    patientId: v.id("patients"),
    name: v.string(),
    normalizedName: v.string(),
    status: v.string(), // "active" | "resolved"
    diagnosedDate: v.optional(v.number()),
    documentId: v.id("documents"),
    page: v.number(),
    provenance,
  })
    .index("by_patient", ["patientId"])
    .searchIndex("search_name", { searchField: "name", filterFields: ["patientId"] }),

  encounters: defineTable({
    patientId: v.id("patients"),
    kind: v.string(), // "Annual physical" | "Specialist visit" | "ER visit" | "Procedure"
    title: v.string(),
    provider: v.optional(v.string()),
    org: v.optional(v.string()),
    date: v.number(),
    summary: v.optional(v.string()),
    documentId: v.id("documents"),
    page: v.number(),
    provenance,
  })
    .index("by_patient", ["patientId"])
    .searchIndex("search_title", { searchField: "title", filterFields: ["patientId"] }),

  allergies: defineTable({
    patientId: v.id("patients"),
    substance: v.string(),
    reaction: v.optional(v.string()),
    documentId: v.id("documents"),
    page: v.number(),
    provenance,
  }).index("by_patient", ["patientId"]),

  // Detected contradictions across records. Shipped feature.
  conflicts: defineTable({
    patientId: v.id("patients"),
    kind: v.string(), // "medication_dose" | "allergy" | "duplicate_condition"
    label: v.string(), // "Metformin"
    detail: v.optional(v.string()),
    options: v.array(
      v.object({
        value: v.string(),
        source: v.string(), // "Stanford Health"
        documentId: v.optional(v.id("documents")),
      }),
    ),
    status: v.string(), // "open" | "resolved"
    resolvedValue: v.optional(v.string()),
  }).index("by_patient", ["patientId"]),

  // Referenced-but-absent records (feeds Firecrawl / records-request flow).
  missingRecords: defineTable({
    patientId: v.id("patients"),
    label: v.string(), // "Knee MRI"
    org: v.string(), // "Stanford Radiology"
    date: v.optional(v.number()),
    referencedInDocumentId: v.id("documents"),
    status: v.string(), // "open" | "requested"
  })
    .index("by_patient", ["patientId"])
    .searchIndex("search_label", { searchField: "label", filterFields: ["patientId"] }),

  // Temporary doctor-share links.
  shares: defineTable({
    patientId: v.id("patients"),
    token: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
  })
    .index("by_patient", ["patientId"])
    .index("by_token", ["token"]),

  // Drives the live "building your health history" ingestion animation.
  processingJobs: defineTable({
    patientId: v.id("patients"),
    status: v.string(), // "running" | "done"
    steps: v.array(
      v.object({
        label: v.string(),
        count: v.optional(v.number()),
        done: v.boolean(),
      }),
    ),
    startedAt: v.number(),
  }).index("by_patient", ["patientId"]),

  // A provider connection established via SMART on FHIR OAuth (consumer link).
  connections: defineTable({
    patientId: v.id("patients"),
    userId: v.optional(v.id("users")),
    providerId: v.string(), // "smart-sandbox" | "epic" | ...
    provider: v.string(), // display name
    fhirBaseUrl: v.string(),
    patientFhirId: v.optional(v.string()),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    tokenEndpoint: v.optional(v.string()),
    clientId: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    scope: v.optional(v.string()),
    status: v.string(), // "connected" | "error"
    connectedAt: v.number(),
    lastSyncedAt: v.optional(v.number()),
    lastCounts: v.optional(v.number()), // records pulled on last sync
  }).index("by_patient", ["patientId"]),

  // Generated reports (health summaries, chat exports) — can be written back to FHIR.
  reports: defineTable({
    patientId: v.id("patients"),
    userId: v.optional(v.id("users")),
    title: v.string(),
    content: v.string(), // markdown
    kind: v.string(), // "summary" | "chat" | "file"
    createdAt: v.number(),
    fhirDocId: v.optional(v.string()), // set after write-back
    fhirStatus: v.optional(v.string()), // "written" | "error"
  }).index("by_patient", ["patientId"]),

  // Denormalized, dated feed of every record type — one row per timeline item.
  // Kept in sync from the source tables on ingest, so the timeline is a single
  // indexed query with real cursor-based pagination (Convex .paginate()).
  events: defineTable({
    patientId: v.id("patients"),
    type: v.string(), // "lab" | "medication" | "condition" | "encounter" | "allergy"
    date: v.number(),
    title: v.string(),
    subtitle: v.optional(v.string()),
    code: v.optional(v.string()), // metric code, for labs
    value: v.optional(v.number()),
    unit: v.optional(v.string()),
    abnormal: v.optional(v.boolean()),
    documentId: v.optional(v.id("documents")),
    page: v.optional(v.number()),
    sourceId: v.string(), // _id of the underlying observation/med/etc.
  })
    .index("by_patient_date", ["patientId", "date"])
    .index("by_patient_type_date", ["patientId", "type", "date"]),

  // Each distinct AI chat thread.
  conversations: defineTable({
    patientId: v.id("patients"),
    userId: v.optional(v.id("users")),
    title: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_patient", ["patientId"]),

  // AI assistant transcript — persisted so it streams in real time via Convex.
  chatMessages: defineTable({
    patientId: v.id("patients"),
    conversationId: v.optional(v.id("conversations")),
    role: v.string(), // "user" | "assistant"
    content: v.string(),
    pending: v.optional(v.boolean()), // assistant placeholder while reasoning
    stage: v.optional(v.string()), // legacy single-line status (superseded by steps)
    // Live, step-by-step reasoning trace over the health data (streams via Convex).
    steps: v.optional(
      v.array(
        v.object({
          title: v.string(),
          detail: v.optional(v.string()),
          status: v.string(), // "running" | "done"
        }),
      ),
    ),
    error: v.optional(v.boolean()),
    charts: v.optional(v.array(v.string())), // metric codes to render inline (data is fetched live)
    followups: v.optional(v.array(v.string())), // suggested follow-up questions
    webSources: v.optional(v.array(v.object({ title: v.string(), url: v.string() }))), // cited public reference pages (Firecrawl)

    // Citations point every claim back to a source document.
    citations: v.optional(
      v.array(
        v.object({
          documentId: v.id("documents"),
          label: v.string(),
          page: v.optional(v.number()),
        }),
      ),
    ),
    createdAt: v.number(),
  })
    .index("by_patient", ["patientId"])
    .index("by_conversation", ["conversationId"]),
});
