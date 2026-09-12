# TraceHealth — 3-minute demo script

**Goal:** show the whole loop from an empty record → aggregated, source-traced health record → AI, reports, clinician share, export. Emphasize **Convex** (real-time, background jobs, crons, file storage, search) and the sponsor stack (OpenAI, Firecrawl).

**Before recording — reset to a clean slate:**
1. Sign in as yourself.
2. Sidebar → ⚙ **Settings → Danger zone → Clear records** (confirm). The record empties instantly.
3. Have the Finder folder open: `~/Desktop/tracehealth-sample-records` (04-fhir-bundle.json, 03-labcorp-lab-report.pdf, 01-quest-lab-report.txt).
4. Optional: pre-open a second browser tab you'll use for the clinician share.

Total spoken ~430 words ≈ 3:00 at a natural pace. Timings are targets.

---

## 0:00–0:20 — The problem (Overview, empty state)
> "Your health records are scattered across every clinic, portal, and PDF you've ever had. TraceHealth pulls them into **one** record you actually own — and can ask questions of."

*(On screen: the empty Overview — "Your record is empty. Bring your history in.")*

> "Let's build one from scratch."

---

## 0:20–1:00 — Bring records in (Add data)
Click **Add data**.

> "One dropzone takes anything — a FHIR export, a PDF lab report, a photo, plain text. It detects the type and routes it."

- Drop **04-fhir-bundle.json** → *"A FHIR bundle imports deterministically — labs, meds, a diagnosis, an allergy, a visit."* (preview card appears with grouped records).
- Drop **03-labcorp-lab-report.pdf** → *"A real PDF — GPT-4o reads it in the background."* Point at the live status: **Reading the PDF… → Extracting… → Added N records**.

> "That extraction runs as a **Convex background job** — I'm not blocked, and the UI streams the status live."

Switch to the **History** tab.

> "And everything's traceable — every source we ingested, and the exact records it produced, each tagged with its provenance. Nothing appears without a source."

---

## 1:00–1:35 — Explore the record (Timeline · Trends · Compare · Review)
> "Now it's one normalized record."

- **Timeline** — *"One dated feed across every provider."* (scroll a touch — infinite scroll is cursor-paginated in Convex.)
- **Trends** — open LDL → *"Different clinics use different codes for the same test; we collapse them into one metric with a real trend line."*
- **Compare** — *"Then-versus-now between any two years — what got worse, what improved, new diagnoses and meds."*
- **Review** — *"Aggregation across providers surfaces what a single portal can't: dose conflicts, and stale meds to verify. I reconcile it here."* Click one **Yes/No** verify.

---

## 1:35–2:15 — Ask the AI (grounded, cited)
Hit **⌘J / Ask AI**. Type: **"What's driving my cardiovascular risk and what should I watch?"**

> "The assistant is a **tool-calling agent** grounded in *my* data — watch the reasoning trace: it pulls my trends, checks reference ranges, and finds open loops."

*(Point at the step-by-step tool trace.)*

> "Every claim cites the source document it came from — and for general medical facts it cites **trusted sources via Firecrawl**, not made-up numbers. It even renders my real charts inline."

---

## 2:15–2:40 — Reports + automation (Reports · Settings)
- **Reports** → **Generate summary** → *"A formatted clinical one-pager — sections, tables, all from my record."*
- **Settings → Automated reports** → toggle **Weekly** on → *"And it can run on a schedule — a **Convex cron** generates weekly or monthly summaries in the background, even when I'm away."* (the weekly report appears in the list).

---

## 2:40–3:00 — Share + export
- Sidebar → **Share with clinician** → **Preview snapshot** (opens a new tab).
  > "A clean, read-only clinical snapshot — allergies and flags up top, meds, conditions, trends, every item linking to its source. The **shared link** also gives the clinician a record-scoped AI and an SBAR brief."
- Sidebar → **Export record** → pick **Document** → *"And I can export the whole thing — formatted PDF, CSV, JSON, or FHIR — choosing exactly what to include, with a live preview."*

> "One record. Source-traced. Yours — and an AI that actually knows it. That's TraceHealth."

---

## Recording tips
- **Software:** macOS built-in — `⇧⌘5` → Record Selected Portion (or full screen). Free, clean. For webcam bubble / zoom-to-cursor, **Screen Studio** (paid) is the nicest for demos; **OBS** is the free power option.
- Record in a **maximized browser window** at 1280–1440 wide so text is legible.
- Turn on **Do Not Disturb**; hide bookmarks bar.
- Do the reset + the two ingests **once as a dry run** so the PDF extraction timing feels smooth on the take.
- Keep the mouse deliberate; pause ~1s after each screen change so cuts are clean.
- If a step is slow (PDF read), keep narrating the "Convex background job" point — it covers the wait.

## The one-line pitch (if you need a title card)
> **TraceHealth — every health record you own, in one place, that an AI actually understands.**
