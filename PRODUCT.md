# TraceHealth — Product Spec (PM view)

> How a real AI-embedded health portal should think, page by page. This is the
> north star; the ✅/🔜/🧭 tags mark what's built, what's next, and what's vision.

---

## 0. Thesis

Your health data already exists — it's just scattered across portals, PDFs, and
faxes, and none of it is *longitudinal*. TraceHealth is the **system of record for
a person's health over time**: it ingests from anywhere, normalizes to one model,
and makes every fact **traceable to its source** and **queryable by AI**.

The wedge isn't "AI reads a PDF" (commodity). It's: **every new record permanently
updates one evolving, evidence-backed model of you** — and an AI can reason over
that model with citations, for both the patient and their doctor.

**Design principles**
1. **Evidence over opinion.** Every number links to a document + page. The AI says
   "your records show," never "I think."
2. **Longitudinal by default.** One lab is noise; ten years of it is signal.
3. **Two audiences, one truth.** Patients get exploration; doctors get compression.
   Same data, different altitude.
4. **Trust is a feature.** Provenance (imported → AI-extracted → patient-verified →
   clinician-verified), conflict surfacing, and "not a diagnosis" framing are core,
   not disclaimers.

---

## 1. Users & jobs-to-be-done

- **Patient (primary).** "Help me understand what's happening to my body over
  time, and walk into an appointment prepared." Anxious, non-clinical, time-poor.
- **Caregiver.** Manages a parent/child's record. Needs multi-profile + sharing.🧭
- **Clinician (recipient).** "Give me this patient's relevant 10-year history in
  90 seconds, with sources I can trust." Won't log in, won't read a graph.
- **(Later) Care team / coach.**🧭 Longitudinal monitoring, nudges, escalation.

Every page below is evaluated against *whose job it does* and *how deep it goes*.

---

## 2. Trust, safety & privacy model (cross-cutting)

- **Provenance on every fact** ✅ — 4 tiers; the graph visibly distinguishes them.
- **No diagnosis / no treatment advice** ✅ — the AI describes associations and
  trends, never causation or prescriptions; framed as "your records show."
- **Auth + ownership** ✅ — email/password (Convex Auth); each user owns a private
  record (`patients.userId`). Demo is public and read-only; share links are
  scoped, expiring tokens.
- **Row-level security** 🔜 — enforce owner/share checks in *every* query, not just
  resolution. (Today the UI only ever loads your own/demo/shared record; hardening
  is the next backend pass.)
- **Audit log** 🧭 — who viewed/shared what, when. Table stakes for health.
- **Data export & delete** 🧭 — user can export FHIR bundle / delete account.
- **PHI hygiene** ✅ — secrets never written to disk/logs; AI context is per-user.

---

## 3. Page & flow specs

### 3.1 Auth & onboarding ✅ (with 🔜 depth)
**Job:** get a nervous non-technical person to a populated record fast.
- **Shallow:** email + password, dump them on an empty dashboard.
- **Deep (target):**
  - Split-screen sign-up (brand + value props) ✅; 8-char password; name captured.
  - **Progressive onboarding, not a wall:** after sign-up, a 3-step "build your
    record" — (1) Connect a provider (FHIR) / import / email, (2) confirm identity
    fields, (3) first AI summary. 🔜
  - **Empty state that teaches** ✅ — the Overview greets by name and offers Connect
    / Import / Email as first actions instead of a barren dashboard.
  - **Zero-to-value in <60s:** "Try the demo" needs no account ✅; sign-up reuses the
    same import rails.
  - 🧭 Magic-link / OTP, SSO (Apple/Google), passkeys; 2FA for a health app.
- **Metrics:** activation = % of new accounts with ≥1 real record within 24h;
  time-to-first-insight.

### 3.2 Overview (Home) ✅
**Job:** "What's the state of me right now, and what needs attention?"
- **Deep components:**
  - **Vitals strip** ✅ — canonical metrics with sparkline + directional delta,
    colored only when clinically meaningful.
  - **Attention rail** ✅ — open conflicts / records to review surfaced up top.
  - **Recent activity table** ✅ — every ingest event, source-linked.
  - **Active meds & conditions** ✅ — deduped, latest-name-wins.
  - 🔜 **"What changed since your last visit"** AI digest card (auto-generated).
  - 🧭 Care-gap nudges ("HbA1c due"), risk scores (ASCVD) *as information, sourced*.
- **Metrics:** DAU/WAU, cards clicked, attention-items resolved.

### 3.3 Timeline ✅
**Job:** "Tell the story of my health so anyone can follow it."
- **Deep:** per-year bucketing ✅, type filters ✅, measurement chips → trend ✅,
  every event → source evidence ✅.
- 🔜 zoom (decade ↔ month), density view, "pin" key events, life-events overlay
  (pregnancy, surgery) that recontextualize labs.
- **Metric:** can a stranger explain the patient's history in 2 min? (usability).

### 3.4 Trends / Relationship graph ✅ (hero)
**Job:** turn a viewer into an *analytical* tool. "Show me what was happening
around this measurement."
- **Deep:** clickable trend with reference lines + event markers ✅; the constellation
  reorganizes around any entity ✅; defensible insight sentence ("decreased 19% in
  the months following the recorded statin start") ✅; every point → evidence ✅.
- 🔜 multi-metric overlay, correlation hints ("weight ↔ LDL move together"), export
  a chart to the doctor view / PDF.
- **Metric:** graph interactions/session (depth of exploration).

### 3.5 Compare ✅
**Job:** "Then vs now, in seconds." The thing PDFs fundamentally can't do.
- **Deep:** pick two periods → measurement deltas + new conditions/meds/providers/
  events ✅.
- 🔜 "explain this change" AI button per row; compare vs population norms (sourced).

### 3.6 Review (conflicts & verification) ✅
**Job:** combined records reveal contradictions a single portal can't.
- **Deep:** dose/allergy/duplicate-condition conflicts with source-by-source options
  and one-click resolve ✅; medication verification upgrades provenance ✅; missing-record
  detection with "how to obtain" ✅ (🔜 real Firecrawl lookup + AgentMail request).
- 🧭 reconciliation history; "ask my provider to confirm" workflow.

### 3.7 Ask AI ✅ (the embedded intelligence)
**Job:** a clinician-grade analyst that reasons over *your* structured record.
- **Deep (built):** loads the real graph as structured context → OpenAI → **grounded,
  cited** answer; citations validated against real documents (hallucinated IDs
  dropped) and open the evidence panel; guardrails (no dx/rx, associations-not-
  causation); persisted transcript that streams via Convex live queries.
- **Deeper (target):**
  - 🔜 **Agentic retrieval / tools** — instead of one JSON dump, let the model call
    `getMetric`, `compare`, `search`, `listMeds` as tools, so it scales to huge
    records and shows its work.
  - 🔜 **Proactive AI** — auto-generate a "since last visit" brief; flag trends
    crossing reference ranges; draft the doctor summary.
  - 🔜 **Structured actions** — "resolve this conflict," "prep questions for my
    cardiologist," "draft a records request" (→ AgentMail).
  - 🧭 voice, multilingual, reading-level adaptation.
- **Metrics:** answers/user, citation-click rate (trust), thumbs-up rate.

### 3.8 Doctor view (share) ✅
**Job:** compression for a clinician who won't log in.
- **Deep:** tokenized, expiring public link ✅; one-screen snapshot — meds, conditions,
  allergies, longitudinal changes, recent history, **conflict banner** ✅; every item
  drills to source ✅.
- 🔜 clinician can *comment*/confirm (→ clinician-verified provenance), print/PDF,
  specialty presets (a cardiologist sees lipids first).
- **Metric:** share→open rate; clinician time-on-page.

### 3.9 Import / Connect ✅
**Job:** one ingestion pipeline for any source; everything becomes a normalized event.
- **Deep (built):** **SMART on FHIR** live connect ✅ (LOINC→canonical mapper);
  file/paste → **OpenAI extraction** ✅; canned email ingest ✅.
- 🔜 real **Epic/Cerner OAuth**; **Metriport/1up** aggregators; **AgentMail** inbox;
  PDF/CCDA parsing; dedupe on re-import (idempotency).
- **Metric:** sources connected/user; extraction accuracy.

### 3.10 Account / Settings 🔜
- Profile & identity (name, DOB, sex, height) that improve normalization & risk calc.
- Connected sources management (revoke, re-sync, last-synced).
- Privacy: export FHIR, delete account, active share links + revoke, audit log.
- Notification prefs.

### 3.11 Notifications / activity 🧭
- "New Quest lab ingested," "conflict detected," "share opened by Dr. X."
- Convex live updates make this real-time; today the toast + live queries prove it.

---

## 4. What this implies about "depth" (anti-shallow checklist)

Every page must answer:
1. **Whose job** does it do, at what altitude (patient explore vs doctor compress)?
2. **Where's the evidence?** Can I click any claim to its source?
3. **Where's the AI?** Not a chatbot bolted on — embedded assistance in-context.
4. **What's the empty/error/loading state?** (Onboarding, not a void.)
5. **What's the trust signal?** Provenance, conflicts, "not a diagnosis."
6. **What's the next best action?** Every screen proposes one.

---

## 5. Build status snapshot

- ✅ Convex data model + live queries, demo patient, timeline, trend graph, compare,
  conflicts/verification, doctor share, evidence everywhere.
- ✅ Real integration: SMART on FHIR (live) + OpenAI extraction.
- ✅ Embedded AI: grounded, cited assistant over the graph (real-time).
- ✅ Auth: email/password, per-user private record, demo stays public.
- 🔜 Highest-value next: **Firecrawl** (free credits) for missing-records; **AgentMail**
  inbox; **Epic OAuth**; agentic AI tools; RLS hardening; onboarding wizard; settings.

The scorecard gap vs the hackathon's own criteria is now just **Firecrawl +
AgentMail + public deploy** — the product depth and Convex depth (incl. auth) are in.
