# Hackathon log

- **Project:** TraceHealth
- **Event:** Convex All Gas Hackathon
- **What it does:** Turns years of scattered medical records from multiple providers into one interactive, evidence-backed longitudinal health history.
- **Live app:** not deployed
- **Repo:** private
- **Frontend:** Convex static hosting
- **Convex deployment:** not deployed
- **Components:** none
- **Convex features:** schema, tables, indexes, queries, mutations, actions, internal functions, scheduled functions, file storage, realtime queries
- **Auth:** none
- **AI models:** gpt-4o-mini (OpenAI, record extraction)
- **Started:** 2026-08-28T05:09:47Z
- **Last updated:** 2026-08-28T17:00:00Z

## Log

### 2026-08-29 - working tree
Renamed the product to TraceHealth across UI, backend copy, titles, and package
metadata. Added a real provider integration: **SMART on FHIR** against the open
SMART Health IT R4 sandbox (`convex/fhir.ts`) — a live FHIR R4 fetch (no
credentials) that pulls a patient's Observations, MedicationRequests,
Conditions, AllergyIntolerance, and Encounters, maps LOINC → TraceHealth's
canonical model, and imports them as source-traceable records. Verified live:
connected patient "Elsy Hermiston" → 120 observations, 37 medications, 9
conditions, 40 encounters over the network. Added a "Connect a provider" flow to
the import screen, marked canonical metrics as `primary` so imported panels don't
flood the overview, and switched metric display to each record's own unit (kg vs
lb) (`convex/fhir.ts`, `convex/metrics.ts`, `convex/health.ts`,
`src/components/ImportScreen.tsx`).

### 2026-08-28 - working tree
Scaffolded TraceHealth: a Vite + React + TypeScript + Tailwind frontend on a Convex
backend.

Backend (`convex/`):
- Normalized "TraceHealth Event" data model — one ingestion pipeline for every
  source. Tables: patients, documents, providers, observations, medications,
  conditions, encounters, allergies, conflicts, missingRecords, shares,
  processingJobs, each with `by_patient` indexes and a per-fact `provenance`
  trust field (`convex/schema.ts`).
- One-click demo patient (Sarah Williams, 8 years, 4 organizations, 10
  documents) seeded with a full clinical story: rising LDL 104→171, a statin
  started in 2026, LDL falling to 139, plus a metformin dose conflict, an
  allergy conflict, a duplicate-condition conflict, and a referenced-but-missing
  knee MRI. Loading it runs a live ingestion animation via `ctx.scheduler`
  (`convex/demo.ts`, `convex/demoData.ts`).
- Read API: timeline, per-metric trend + surrounding relationships, compare two
  periods, doctor snapshot, temporary share links, and a health search that
  routes to metrics/years/keywords (`convex/health.ts`, `convex/metrics.ts`).
- Write API: conflict resolution, patient verification, doctor-share creation,
  a canned email-import that extends the graph in real time, and a real
  OpenAI (gpt-4o-mini) extraction action that turns pasted/uploaded record text
  into structured events via Convex file storage (`convex/mutations.ts`,
  `convex/ingest.ts`).

Frontend (`src/`):
- Screens: Landing, live Import/processing, Health Home (trend cards +
  sparklines), Timeline (per-year, filterable), the hero Relationship Graph
  (clickable trend + radial constellation of related meds/conditions/metrics),
  Compare, Conflicts + verification, and a shareable Doctor View. Every fact
  opens a source-evidence side panel. All data flows through realtime `useQuery`
  subscriptions (`src/components/*`).

Verified: frontend builds with Vite (119 modules) and typechecks with zero
errors. Backend awaits `npx convex dev` (interactive login) to generate types,
push functions, and provision the deployment.

### 2026-08-28 - working tree
Provisioned a local Convex dev deployment and pushed all functions (14 indexes
created). Ran the whole stack end-to-end against real generated types (zero
typecheck errors). Verified via `npx convex run`: `demo:loadDemo` seeds 10
documents / 26 labs / 3 meds / 4 conditions / 10 encounters / 6 providers over
8 years; `health:getMetric` returns the LDL arc 104→171→139 with the defensible
insight sentence; `health:compare`, `health:doctorSnapshot`, and `health:search`
(metric/year/keyword routing) all return correct data; `ingest:addEmailedRecord`
extends the LDL series live. Frontend serves at :5173 connected to the backend.
Added `TESTING.md` (step-by-step UI walkthrough) and fixed the doctor-snapshot
condition dedup to prefer the most recent diagnosis name
(`convex/health.ts`, `TESTING.md`).
