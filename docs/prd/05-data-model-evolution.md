# PRD 05 — Data-Model Evolution

The schema changes that make PRDs 01–04 possible. All **additive and incremental** — nothing here breaks existing data. Grounded in the current `convex/schema.ts`.

## Where we are today
- Every fact table (`observations`, `medications`, `conditions`, `encounters`, `allergies`) is **document-centric**: `documentId: v.id("documents")` is **required**, plus `page` + `provenance`.
- `provenance = imported | ai_extracted | patient_verified | clinician_verified`.
- `connections` models a single SMART OAuth link.
- `events.type = lab | medication | condition | encounter | allergy` (denormalized timeline).
- No tables for: immunizations, claims, coverage, consents, device/wearable data, medication enrichment, symptoms.

## What breaks with real integrations
1. **API-sourced facts have no PDF** → `documentId` being *required* forces synthesizing fake documents. Make it **optional**.
2. **Multi-network** → we must know a lab came from "Fasten → CommonWell → Stanford Epic", for provenance and **dedup**.
3. **New resource types** → immunizations, claims (EOB), coverage, wearable time-series, symptoms have nowhere to live.
4. **Enrichment/derived data** (drug info, interactions, prices) must be **cached and isolated** (licensing).

---

## Change set

### 1. Make `documentId` optional + add source lineage (all fact tables)
Apply to `observations`, `medications`, `conditions`, `encounters`, `allergies` (and new `immunizations`):
```ts
documentId: v.optional(v.id("documents")),           // was required
sourceConnectionId: v.optional(v.id("connections")), // which link produced it
sourceNetwork: v.optional(v.string()),   // "carequality" | "commonwell" | "tefca_ias" | "payer" | "direct_epic" | "upload" | "device"
sourceSystem: v.optional(v.string()),    // "Fasten Connect" | "Blue Button 2.0" | "Apple Health" | ...
fhirResourceId: v.optional(v.string()),  // upstream FHIR logical id — dedup/refresh key
fhirVersion: v.optional(v.string()),     // "R4"
```
> Migration: existing rows keep `documentId`; new fields default undefined. No backfill needed.

### 2. Extend `provenance`
```ts
export const provenance = v.union(
  v.literal("imported"), v.literal("ai_extracted"),
  v.literal("patient_verified"), v.literal("clinician_verified"),
  v.literal("synced"),        // pulled from a live connection/network
  v.literal("ai_assisted"),   // created via the agent, pre-confirmation (PRD 04)
);
```

### 3. Generalize `connections` (PRD 01)
```ts
aggregator: v.optional(v.string()),   // "fasten" | "bluebutton" | "flexpa" | "vital" | "smart-sandbox" | null
kind: v.optional(v.string()),         // "clinical" | "claims" | "device"
networks: v.optional(v.array(v.string())),
externalConnectionId: v.optional(v.string()),
identityAssuranceLevel: v.optional(v.string()), // "IAL2"
```

### 4. New: `consents` (audit + revocation — PRD 01)
```ts
consents: defineTable({
  patientId: v.id("patients"),
  connectionId: v.optional(v.id("connections")),
  purposeOfUse: v.string(),   // "treatment" | "individual_access"
  scope: v.optional(v.string()),
  grantedAt: v.number(),
  expiresAt: v.optional(v.number()),
  revokedAt: v.optional(v.number()),
  identityProofing: v.optional(v.string()),
  source: v.string(),
}).index("by_patient", ["patientId"]),
```

### 5. New: `immunizations` (USCDI core — PRD 01)
```ts
immunizations: defineTable({
  patientId: v.id("patients"),
  vaccine: v.string(), cvxCode: v.optional(v.string()),
  date: v.optional(v.number()),
  status: v.optional(v.string()),
  provider: v.optional(v.string()),
  documentId: v.optional(v.id("documents")),
  provenance,
  // + source lineage fields (#1)
}).index("by_patient", ["patientId"]),
```

### 6. New: `claims` + `coverage` (EOBs — PRD 01)
```ts
claims: defineTable({
  patientId: v.id("patients"),
  eobFhirId: v.optional(v.string()),
  type: v.string(),  // "pharmacy" | "professional" | "institutional" | "inpatient"
  billablePeriodStart: v.optional(v.number()), billablePeriodEnd: v.optional(v.number()),
  provider: v.optional(v.string()), payer: v.optional(v.string()),
  diagnosisCodes: v.optional(v.array(v.string())), procedureCodes: v.optional(v.array(v.string())),
  billedAmount: v.optional(v.number()), paidAmount: v.optional(v.number()),
  patientResponsibility: v.optional(v.number()), currency: v.optional(v.string()),
  sourceConnectionId: v.optional(v.id("connections")), sourceSystem: v.optional(v.string()),
  provenance,
}).index("by_patient", ["patientId"]),

coverage: defineTable({
  patientId: v.id("patients"),
  payer: v.string(), memberId: v.optional(v.string()), planName: v.optional(v.string()),
  periodStart: v.optional(v.number()), periodEnd: v.optional(v.number()),
  sourceConnectionId: v.optional(v.id("connections")),
}).index("by_patient", ["patientId"]),
```

### 7. New: `deviceObservations` + `dailySummaries` (wearables — PRD 02)
```ts
deviceObservations: defineTable({
  patientId: v.id("patients"),
  source: v.string(),       // "apple_health" | "vital" | "oura" | ...
  sourceType: v.string(),   // "file_import" | "aggregator" | "direct_oauth"
  metric: v.string(),       // "heart_rate" | "steps" | "sleep_stage" | "glucose" | "weight" | "blood_pressure" | "spo2"
  value: v.number(), unit: v.string(),
  startTime: v.number(), endTime: v.optional(v.number()), timezone: v.optional(v.string()),
  providerRecordId: v.optional(v.string()), // dedup
  ingestedAt: v.number(),
}).index("by_patient_metric_time", ["patientId", "metric", "startTime"]),

dailySummaries: defineTable({
  patientId: v.id("patients"), date: v.string(), metric: v.string(),
  min: v.optional(v.number()), max: v.optional(v.number()),
  avg: v.optional(v.number()), sum: v.optional(v.number()), source: v.string(),
}).index("by_patient_metric_date", ["patientId", "metric", "date"]),
```
Kept **separate** from clinical `observations` (dense/uncoded/interval vs sparse/LOINC/point). A thin UI type unions them for overlay charts.

### 8. Enrich `medications` + derived tables (PRD 03)
Add to `medications`: `rxcui`, `rxcuiTty`, `ingredientRxcui`, `ingredientName`, `brandName`, `genericName`, `ndc`, `route`, `frequency`, `sigText`, `prescriberNpi`, `pharmacyName`, `pharmacyNcpdpId`, `fhirResourceId`. New indexes: `by_rxcui`.
Derived (cached, per-drug, purgeable):
```ts
medicationEnrichment: defineTable({ rxcui, boxedWarning?, indications?, warnings?, adverseReactions?, patientInfoUrl?, labelSplId?, source, fetchedAt }).index("by_rxcui", ["rxcui"]),
drugInteractions:     defineTable({ patientId, ingredientRxcuiA, ingredientRxcuiB, severity, description, dataSource, licenseTier, fetchedAt }).index("by_patient", ["patientId"]),
drugPrices:           defineTable({ rxcui, ndc?, quantity, zip?, pharmacyName, pharmacyNcpdpId?, price, priceType, source, couponUrl?, fetchedAt }).index("by_rxcui", ["rxcui"]),
```
`licenseTier` on `drugInteractions` governs display and lets us purge restricted data independently.

### 9. New: `symptoms` (agent + manual logging — PRD 04)
```ts
symptoms: defineTable({
  patientId: v.id("patients"),
  text: v.string(), severity: v.optional(v.string()), date: v.number(),
  createdBy: v.optional(v.string()),        // "user" | "agent"
  conversationId: v.optional(v.id("conversations")),
  provenance,
}).index("by_patient", ["patientId"]),
```

### 10. Agent-authored provenance (PRD 04)
Add to fact tables (optional): `createdBy: v.optional(v.string())`, `conversationId: v.optional(v.id("conversations"))`, `messageId: v.optional(v.id("chatMessages"))` — so History shows "added via AI on <date>" and links back.

### 11. Extend the `events` feed
`events.type` gains `immunization | claim | device`. `rebuildEvents` learns the new tables so Timeline renders them (claims = the cost/utilization layer).

### 12. Documents metadata
Add `mimeType` / `format` (e.g. `"application/xml; ccda"`, `"application/pdf"`) + `fhirResourceId` to `documents`, to distinguish uploaded PDFs from network-retrieved C-CDA and dedup on refresh.

---

## Dedup strategy (cross-cutting)
With multiple networks + connections, the same fact arrives repeatedly. Rule:
1. **Hard key:** `(fhirResourceId, sourceSystem)` — identical upstream resource → skip.
2. **Soft key:** `(canonical code/name, date-day, value)` — collapse near-duplicates; keep highest-trust provenance (`clinician_verified` > `synced` > `imported` > `ai_extracted`), record the others as alternate sources.
3. **Unresolvable conflicts** (e.g. two dose values) → surface in **Review** (existing conflicts flow), not silently merged.
Reuse the existing `normalizedName` + med-dedup logic; extend to labs/conditions.

## Migration & rollout
- All changes are **additive** (new optional fields / new tables) → deploy with no backfill.
- Make `documentId` optional **first** (unblocks API-sourced facts).
- Add lineage fields alongside; start stamping them as each integration lands.
- Ship new tables per PRD as their feature is built — schema can grow incrementally.

## Success criteria
- API-sourced facts store with no synthetic document.
- Every fact answerable: "which connection/network produced this?"
- Multi-network pulls dedup to a clean record; genuine conflicts land in Review.
- Wearable time-series renders performantly (daily summaries), overlaid with clinical labs.
