# TraceHealth — Use Cases & Test Scenarios

**Thesis:** Your doctors hold records; TraceHealth gives *you* a history. It ingests
scattered medical records from any provider, normalizes them into one longitudinal,
evidence-cited health record, and lets an AI reason over that data — grounded, cited,
and never fabricated.

This document is the **canonical list of real use cases** the product is built for, each
written as a concrete, testable scenario. Use it to demo, to QA, and to decide whether a
new feature actually serves a user.

---

## How to run these

- **Frontend:** http://localhost:5173
- **Backend:** Convex (local dev deployment) — real-time, no page refresh needed
- **Data source:** SMART Health IT sandbox (real FHIR OAuth). The pinned sandbox patient
  has ~300 observations spanning 2018–2026, so every scenario below has real data.
- **AI:** OpenAI (`gpt-4o-mini`) — key is set in the Convex deployment env, never in files.

Each use case lists: **Who / Goal / Steps / Expected / What it proves.**

---

## 1. Onboarding & Identity

### UC-1.1 — Create an account
- **Who:** A first-time user who wants their own private record.
- **Goal:** Get an authenticated, isolated workspace.
- **Steps:** Landing → *Get started* → sign-up form → email, password (≥8), confirm password (eye toggle to reveal) → *Create account*.
- **Expected:** Lands on an empty dashboard scoped to their user. No demo data leaks in.
- **Proves:** Real email/password auth (Convex Auth) + per-user record isolation.

### UC-1.2 — Sign back in
- **Who:** A returning user.
- **Steps:** Landing → *Sign in* → credentials.
- **Expected:** Their own records load; another user's data is never visible.
- **Proves:** Row-level security (own record / shared / demo).

### UC-1.3 — Wrong password / duplicate email
- **Steps:** Sign in with a bad password; sign up with an existing email.
- **Expected:** Clear, human error message (not a generic "something went wrong").
- **Proves:** Honest auth error surfacing.

---

## 2. Connecting a Provider (the core ingestion)

### UC-2.1 — Connect the SMART Health IT sandbox
- **Who:** A user who wants to pull real records instead of typing them.
- **Goal:** Authorize a provider and sync a real FHIR record.
- **Steps:** Connections → *SMART Health IT Sandbox* → **Connect** → complete the SMART on FHIR OAuth consent (patient login, pinned rich patient) → returns to app.
- **Expected:** Connection shows **Connected** with a last-synced time and a record count. Timeline/Trends/Overview fill with data within seconds.
- **Proves:** Real OAuth 2.0 + PKCE, token exchange, FHIR R4 ingestion, LOINC → canonical-metric normalization.

### UC-2.2 — Find a real provider by name
- **Steps:** Connections → search "Stanford" or "Kaiser".
- **Expected:** Matching organizations from the Epic open-endpoint directory (479 orgs) appear with real branding.
- **Proves:** Provider directory search is real, not hardcoded.

### UC-2.3 — Re-sync pulls only new data (idempotent)
- **Steps:** Connect, then trigger another sync.
- **Expected:** No duplicated observations/meds; prior records for that org are replaced cleanly.
- **Proves:** Idempotent bundle insertion.

### UC-2.4 — Automatic background sync
- **Steps:** Leave a connection active.
- **Expected:** A cron re-syncs every 2 hours using the refresh token (no re-login).
- **Proves:** Token refresh + scheduled fan-out sync.

---

## 3. Reading Your History

### UC-3.1 — Longitudinal timeline, newest first
- **Who:** Anyone who wants "what happened, when."
- **Steps:** Timeline.
- **Expected:** One unified feed — labs, visits, medications, diagnoses — grouped by month, **newest first**, with lab values inline and abnormal values flagged red.
- **Proves:** Cross-source normalization into a single readable thread.

### UC-3.2 — Filter the timeline
- **Steps:** Timeline → tabs: All / Labs / Visits / Medications / Conditions.
- **Expected:** Feed filters correctly; counts match.
- **Proves:** Typed records, correct filtering.

### UC-3.3 — Trend a single metric
- **Who:** Someone tracking cholesterol, HbA1c, blood pressure, weight.
- **Steps:** Trends → pick a metric (e.g. LDL).
- **Expected:** A time-series chart (ascending by date) with the reference threshold line, latest value, and % change; each point is clickable.
- **Proves:** LOINC canonicalization + real charting from stored observations.

### UC-3.4 — Evidence drill-down (provenance)
- **Steps:** Click any data point or timeline value.
- **Expected:** Opens the **source document** (org + date) the number came from.
- **Proves:** Every fact traces to a document + page — the trust layer.

---

## 4. AI That Reasons Over the Record

### UC-4.1 — Grounded question with a chart
- **Who:** A user asking "how is my cholesterol trending?"
- **Steps:** Open the Assistant (⌘J) → ask.
- **Expected:** A concise answer citing real values/dates, an **inline chart** rendered from the actual record (not model-invented numbers), and citation chips linking to source documents.
- **Proves:** Retrieval-grounded answers; charts fetched live by metric code.

### UC-4.2 — Live step-by-step reasoning trace
- **Steps:** Ask any data question and watch while it answers.
- **Expected:** Steps stream in and complete one by one — *Reading your health record* (with real counts) → *Finding the relevant records* (matched metric) → *Reasoning over the data* → then the model's own analysis steps. After the answer, it collapses to "Reasoned in N steps" (expandable).
- **Proves:** Real, health-framed process transparency — not a fake spinner, and not the model's raw internal monologue.

### UC-4.3 — Page-aware "this"
- **Steps:** On an LDL trend, ask "is this concerning?"
- **Expected:** The AI resolves "this" to the LDL chart in view.
- **Proves:** Current-view context injection.

### UC-4.4 — Refuses to fabricate / diagnose
- **Steps:** Ask about a metric you have no data for; ask "what disease do I have?"
- **Expected:** Says the data isn't in the record; describes findings and temporal associations but does not diagnose or prescribe.
- **Proves:** Safety rails + honesty.

### UC-4.5 — Ambiguous question → clarifies
- **Steps:** On the full-page chat (no chart in view) ask a bare "is this normal?"
- **Expected:** Asks one short clarifying question instead of guessing.
- **Proves:** Ambiguity handling.

### UC-4.6 — File analysis in chat
- **Who:** Someone with an outside lab result as text/CSV/FHIR/JSON.
- **Steps:** Assistant → 📎 attach a supported text file → ask "analyze this and compare to my record."
- **Expected:** The AI reads the file and relates it to existing data, with citations.
- **Proves:** Bring-your-own-document analysis. *(Known limit: text-based files only — PDF/image OCR is future work.)*

---

## 5. Multi-Conversation Chat

### UC-5.1 — Separate chats with history
- **Steps:** Assistant → *New chat*, ask something; *New chat* again, ask something else; open *History* (clock icon).
- **Expected:** Each chat is its own thread, auto-titled from its first question, listed newest-first; clicking one reopens it.
- **Proves:** Persisted conversations, not one endless thread.

### UC-5.2 — Persistence across reload / new tab
- **Steps:** Reload the page; open the assistant in a new tab.
- **Expected:** Conversations survive; most recent continues.
- **Proves:** Real-time server-backed transcript.

---

## 6. Comparison, Conflicts & Reports

### UC-6.1 — Compare two periods
- **Steps:** Compare → pick two time windows.
- **Expected:** Side-by-side deltas for key metrics.
- **Proves:** Longitudinal comparison.

### UC-6.2 — Review record conflicts
- **Who:** Someone whose providers disagree (e.g. a med dose recorded two ways).
- **Steps:** Review.
- **Expected:** Detected contradictions listed with each source's value; resolvable.
- **Proves:** Cross-source conflict detection.

### UC-6.3 — Generate a health summary report
- **Steps:** Reports → *Generate summary*.
- **Expected:** An AI-written markdown summary grounded in the record; viewable, copyable, printable.
- **Proves:** Report generation over the normalized data.

### UC-6.4 — Write a report back to the provider (FHIR)
- **Steps:** Reports → open a report → *Write to provider*.
- **Expected:** Posts a `DocumentReference` (base64 markdown) to the connected FHIR server → 201 Created.
- **Proves:** Round-trip write-back, not just read.

---

## 7. Sharing With a Clinician

### UC-7.1 — Share a read-only snapshot
- **Steps:** Sidebar → *Share with clinician* → copy link → open it.
- **Expected:** A temporary, login-free, read-only clinical snapshot; evidence still resolves.
- **Proves:** Time-boxed doctor view via share token, without exposing the account.

---

## 8. App Experience & Robustness

### UC-8.1 — Global assistant dock
- **Steps:** ⌘J to toggle; dock left/right; expand/collapse; open in new tab.
- **Expected:** Persists across navigation and reload; layout stays aligned (sidebar never clipped) regardless of dock state.
- **Proves:** The fixed-frame shell layout.

### UC-8.2 — Real URL routing
- **Steps:** Navigate; use browser back/forward; deep-link `/timeline`, `/trends`, `/chat`.
- **Expected:** URL reflects the view; back/forward works; refresh lands on the same page.
- **Proves:** Real routing, not just state.

### UC-8.3 — Dark / light mode
- **Steps:** Toggle theme.
- **Expected:** Whole app re-themes via CSS variables; persists.
- **Proves:** Token-based theming.

### UC-8.4 — Resilience during auth race
- **Steps:** Hard refresh right after login.
- **Expected:** No blank page; reads fail safe (empty, not crash) until the session resolves.
- **Proves:** Non-throwing reads + error boundary.

---

## Non-goals (explicitly out of scope right now)
- PDF/image OCR of scanned records (chat file analysis is text-based today).
- Anything marked **"Coming soon"** in the UI is a stub, not a claim.
- Not a medical device; no diagnosis, prescription, or treatment advice.

---

## Coverage map (use case → where it lives)
| Area | Backend | Frontend |
|---|---|---|
| Auth / RLS | `convex/auth.ts`, `convex/authz.ts`, `convex/patients.ts` | `Auth.tsx`, `Landing.tsx` |
| FHIR sync | `convex/fhir.ts`, `convex/connections.ts`, `convex/directory.ts`, `convex/crons.ts` | `Integrations.tsx`, `OAuthCallback.tsx`, `src/lib/smart.ts` |
| History / charts | `convex/health.ts`, `convex/metrics.ts` | `Timeline.tsx`, `MetricGraph.tsx`, `Compare.tsx`, `charts.tsx` |
| AI assistant | `convex/assistant.ts` | `AssistantChat.tsx`, `AssistantDock.tsx`, `ChatPage.tsx`, `ChatChart.tsx` |
| Evidence | `convex/health.ts` (getDocument) | `EvidencePanel.tsx` |
| Conflicts | `convex/schema.ts` (conflicts) | `Conflicts.tsx` |
| Reports | `convex/reports.ts` | `Reports.tsx` |
| Sharing | `convex/mutations.ts` (shares) | `DoctorView.tsx` |
