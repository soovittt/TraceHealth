# Hackathon log

- **Project:** TraceHealth
- **Event:** Convex All Gas Hackathon
- **What it does:** Turns years of scattered medical records from multiple providers into one interactive, evidence-backed longitudinal health history.
- **Live app:** https://ideal-swan-48.convex.site
- **Demo video:** https://youtu.be/LJQBlzxFDoE
- **Repo:** https://github.com/soovittt/TraceHealth
- **Frontend:** Convex static hosting
- **Convex deployment:** https://ideal-swan-48.convex.cloud
- **Components:** @convex-dev/static-hosting
- **Convex features:** schema, tables, indexes, full-text search, queries, mutations, actions, internal functions, HTTP actions, crons, scheduled functions, file storage, realtime queries, paginated queries, registered components
- **Auth:** Convex Auth (Password + Anonymous)
- **AI models:** gpt-4o (OpenAI, vision document extraction + assistant tool-loop), gpt-4o-mini (summaries/reports)
- **Started:** 2026-08-28T05:09:47Z
- **Last updated:** 2026-09-21T23:30:00Z

## Log

### 2026-09-21 - 79f516a
Expanded the connector suite and made multi-provider real. Added connectors for
**Epic MyChart** and **VA Health (Lighthouse)** sandboxes (real SMART on FHIR
OAuth + PKCE, client ids via env) and three **open FHIR servers** pulled
server-side with no login (HAPI FHIR, Oracle Health open sandbox, ONC Inferno /
US Core) via a new `fhir.connectOpenServer` action that discovers or pins a
data-rich patient and reuses the collect/insert/re-sync path (`convex/fhir.ts`,
`src/lib/smart.ts`). Verified in prod: connecting multiple providers accumulates
onto one record (SMART 139 + Epic 8 merged) instead of overwriting. Fixed a
guest-session bug where each OAuth connect fragmented into a new anonymous
account, so connections now stack on one guest (`src/components/Landing.tsx`).
Reworked the Connections UI into uniform, equal-height provider cards with
"Sandbox" / "Open, no login" labels and bottom-aligned actions
(`src/components/Integrations.tsx`). Recorded the 3-minute demo video.

### 2026-09-19 - cd97fa2
Shipped to production on **Convex static hosting**: registered the
`@convex-dev/static-hosting` component and served the built SPA at
https://ideal-swan-48.convex.site alongside the auth routes
(`convex/convex.config.ts`, `convex/http.ts`). Fixed SMART OAuth to finish
client-side (no full reload) so the session is preserved and the user lands on
the synced record (`src/App.tsx`, `src/components/OAuthCallback.tsx`). Added
configurable summary reports — pick sections and embed live trend graphs that
export to PDF — generated as a **background Convex job** that posts a
notification when done, surfaced by a new top-bar bell and a bottom-right
progress toast (new `notifications` table + reactive `list`/`unreadCount`
queries and `markRead` mutations). Dark theme by default, drag-to-resize AI
dock, cleaner chat composer. Convex features: registered components, crons,
scheduled functions, HTTP actions, full-text search, file storage, realtime
queries (`convex/schema.ts`, `convex/notifications.ts`, `convex/reports.ts`,
`src/components/SummaryDialog.tsx`, `src/components/NotificationBell.tsx`).

### 2026-09-17 - d0a29b5
Onboarding built for judge testing: a guest/anonymous "Try it — no signup"
entry and a first-run product tour that walks the real screens (spotlight
coachmarks with Back/Next/Skip, replayable from Settings), ending on a single
clean path to add data by connecting a provider. Sandbox connect uses the real
SMART on FHIR OAuth flow (log in + authorize + sync). Auth: added the Anonymous
provider (`convex/auth.ts`, `src/components/Tour.tsx`, `src/components/Landing.tsx`).

### 2026-09-16 - 82b6c3f
Live drug prices via **Firecrawl** v2 scrape — the assistant's `drug_price` tool
pulls real GoodRx + Cost Plus Drugs prices in parallel, cited; web-backed
answers carry a floor of 5 distinct-domain sources with favicons
(`convex/firecrawl.ts`, `convex/assistant.ts`). Chat file analysis: attach an
image/PDF → GPT-4o vision reads it, ingests the records into the data layer, then
explains them (robust multi-file, paste, drag-and-drop). Added reference ranges
for thyroid/iron/vitamin/liver/CBC labs so out-of-range values flag correctly.
Added an AI-answer eval harness (deterministic checks + LLM judge over a fixture
patient) (`convex/ingest.ts`, `convex/metrics.ts`, `convex/evals.ts`).

### 2026-09-12 - caddc49
Proper export dialog — pick format + record types, live preview, formatted
document (`src/components/ExportDialog.tsx`). Hardened the clinician share: AI
shows only on the real shared link, and the owner preview opens in a new tab.
Admin record reset (Settings danger zone + `wipeByEmail`) and "Explain with AI"
on the Review page. Added integration/platform PRDs under `docs/prd`.

### 2026-09-11 - 876aff8
Redesigned Add-data into one smart, auto-routing dropzone with Upload/History
tabs and a source audit trail. Added **scheduled reports**
(daily/weekly/monthly/yearly) via a Convex **cron**, with a dedicated Settings
page. Reports render as a formatted clinical document with real styled tables.
Convex features: crons, scheduled functions (`convex/reports.ts`,
`convex/crons.ts`, `src/components/ImportScreen.tsx`, `src/components/Settings.tsx`).

### 2026-09-10 - 33807a6
Native PDF/image ingestion — GPT-4o vision reads scanned/text medical PDFs into
structured, source-traced records, and the uploader auto-routes PDF/image/C-CDA.
Made ingestion a reactive **background pipeline** with dedup, preview, and live
status (`ctx.scheduler`). Deeper Compare page with out-of-range flags and
"Explain this period with AI" (`convex/ingest.ts`, `src/components/Compare.tsx`).

### 2026-09-08 - 0bf39cd
Visit-centric record: FHIR encounter-reference linking (with a same-day
fallback) so each visit shows the labs/meds/diagnoses recorded that day, plus
"Explain this visit with AI". Deduped medications (FHIR emits one
MedicationRequest per refill) at ingest and across snapshot/overview/AI context.
Evidence panel now shows the specific record (`convex/fhir.ts`, `convex/health.ts`).

### 2026-09-07 - 788d083
Background data export as a Convex job — scheduler + action + file storage with
reactive, no-poll status, surfaced by a global bottom-right toast; the export
bundles summary, conflicts, missing records, and provenance. New TraceHealth
logo/mark + favicon. Convex features: scheduled functions, actions, file storage
(`convex/export.ts`, `src/components/ExportToast.tsx`).

### 2026-09-06 - 4064310
AI assistant + web grounding landed (merged feature branches): a tool-calling
assistant over the record, Firecrawl-backed medical reference lookup, a clinician
chat, an AI signals/insights view, and structured export/import. Search upgraded
to Convex **full-text search** indexes with a typo-tolerant fuzzy + substring
fallback. Notion-inspired light/dark UI. Convex features: full-text search,
actions (`convex/assistant.ts`, `convex/firecrawl.ts`, `convex/health.ts`).

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
