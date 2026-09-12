# TraceHealth — full demo script (read-it-off, ~5 min)

Everything end to end: what to click **[DO]**, what to say **[SAY]**, and the exact AI questions. Aim ~5 min — the problem statement matters, don't rush it.

---

## PRE-FLIGHT (before you hit record)
- **[DO]** Sign in as yourself. Record is already wiped (empty Overview).
- **[DO]** Open Finder at `~/Desktop/tracehealth-sample-records`. You'll use, in order:
  1. `05-tracehealth-export.json`  (older baseline — 2022–2023)
  2. `04-fhir-bundle.json`  (a hospital FHIR export — 2024)
  3. `03-labcorp-lab-report.pdf`  (a PDF lab report — the AI showcase)
- **[DO]** Maximize the browser (1280–1440 wide). Turn on Do Not Disturb. Hide the bookmarks bar.
- **[DO]** Do one silent dry-run of the two imports + the PDF so the timing feels smooth on the real take.
- If you need to re-clean between takes: run `npx convex run patients:wipeByEmail '{"email":"sovitnayak1258@gmail.com"}'`.

---

## 1 · THE PROBLEM  (0:00–0:50)  — screen: empty Overview
**[SAY]**
> "Here's a problem everyone has and nobody's solved. Your health data is the most important data about you — and it's scattered everywhere. Every clinic, every lab, every hospital keeps its own copy, in its own format, on a portal you log into once and never again. There's no single place that has *all* of you.
>
> And it gets worse the moment you move. You change cities, you switch insurance, you **travel to another country** — and the new doctor there knows *nothing* about you. Your old records don't follow you, because those systems will never talk to each other. So you start from zero, every time.
>
> Even when you *do* have your records, it's a pile of PDFs and lab codes you can't actually read. And handing them to a new doctor? You're forwarding email attachments and hoping.
>
> TraceHealth fixes all of that. It's one health record that you own — it pulls in everything, from anywhere, makes it understandable, and lets you hand it to any doctor in seconds. Let me show you, starting from nothing."

---

## 2 · BRING IT ALL IN  (0:50–1:50)  — Add data
**[DO]** Click **Add data** in the sidebar. You're on the **Upload** tab with one dropzone.

**[SAY]**
> "First I bring my history in. It doesn't matter what format someone gave me — one dropzone takes all of it and figures out the type automatically."

**[DO]** Drag **`05-tracehealth-export.json`** onto the dropzone. A preview card appears.
**[SAY]**
> "This is a structured export from another system — it imports instantly, exactly, no AI. You can see what came in: labs, meds, conditions, an allergy — each grouped and traced to its source."

**[DO]** Drag **`04-fhir-bundle.json`**.
**[SAY]**
> "This is a **FHIR bundle** — the hospital interoperability standard. Same thing, imported cleanly."

**[DO]** Drag **`03-labcorp-lab-report.pdf`**. Point at the status line as it changes.
**[SAY]**
> "And this is the interesting one — a **PDF lab report**. There's no structured data in a PDF, so the AI reads it. Watch the status: *Reading the PDF… Extracting… Added.* That extraction is running as a **background job on Convex** — I'm not frozen, the UI is streaming the status live, and when it's done the records just appear."

**[DO]** Click the **History** tab (top of Add data).
**[SAY]**
> "And this is the part I care most about — the audit trail. Every source I've added, and if I expand one, the *exact* records it produced, each tagged with where it came from — imported, AI-extracted, whatever. Nothing shows up in my record without a source. No made-up data."

---

## 3 · ONE UNDERSTANDABLE RECORD  (1:50–2:40)
**[DO]** Click **Overview**.
**[SAY]**
> "Now all of that is one record. Up top, **Needs your attention** — the app already flagged what's off: my LDL is above target, my HbA1c is high, blood pressure's up, and a recheck is overdue. That's computed automatically from my data — I didn't ask for it."

**[DO]** Click **Timeline**.
**[SAY]**
> "Everything I've ever added, one dated feed across every provider — labs, visits, meds. Scroll and it just keeps loading; that's real cursor pagination in Convex, not loading everything at once."

**[DO]** Click **Trends**, then open **LDL Cholesterol**.
**[SAY]**
> "Here's the magic of merging sources. Three different clinics reported my cholesterol with different codes and different units — TraceHealth collapses them into *one* metric, so I get a single trend line over years instead of three disconnected numbers. You can see it climbing."

**[DO]** Click **Compare**. Pick two years (e.g. an early year → latest).
**[SAY]**
> "And I can put any two points in time side by side — what got worse, what improved, new diagnoses, new medications. This is the view a stack of PDFs can never give you."

**[DO]** Click **Review**.
**[SAY]**
> "Combining records across providers also surfaces problems a single portal can't — dose conflicts between clinics, and old medications that were never marked as stopped. I reconcile those here."
**[DO]** Click **Yes** or **No** on one "still active?" med.
**[SAY]**
> "One tap and my record is clean and trustworthy — which matters for what's next."

---

## 4 · ASK YOUR RECORD ANYTHING  (2:40–3:40)  — Ask AI (⌘J)
**[DO]** Press **⌘J** (or click **Ask AI**). The assistant opens.

**[DO]** Ask question 1 — type:
> **What should a new doctor know about me?**

**[SAY]** (while it runs)
> "This is an AI grounded entirely in *my* record. Watch the reasoning trace — it's a real tool-calling agent: it pulls my active problems, my medications, my allergies, my recent labs. And notice it's not guessing — every claim links back to the source document it came from."

**[DO]** Ask question 2 — type:
> **Is my LDL cholesterol getting better or worse, and what should I do?**

**[SAY]**
> "It reads my actual trend, tells me the direction, and renders my *real* chart inline — not a stock image, my data."

**[DO]** Ask question 3 — type:
> **What does an HbA1c of 6.4% mean and should I be worried?**

**[SAY]**
> "For general medical questions like this, it doesn't make things up either — it pulls a cited answer from **trusted medical sources via Firecrawl**, and shows me the source. So I get real explanation, grounded, with references."

*(Optional 4th if time: **"What are all my allergies, and is anything I take a problem?"** — shows the safety check.)*

---

## 5 · TURN IT INTO A REPORT  (3:40–4:15)  — Reports + Settings
**[DO]** Click **Reports** → **Generate summary**.
**[SAY]**
> "I can turn my whole record into a formatted clinical summary — sections, a key-value patient overview, my medications, a trends table. A real one-page document, generated from my data."

**[DO]** Click the **⚙ gear (Settings)** in the bottom-left → **Automated reports** → toggle **Weekly** on.
**[SAY]**
> "And I can put that on autopilot. Turn on a weekly summary, and a **Convex cron job** generates it in the background on schedule — even when I never open the app. Daily, weekly, monthly, yearly — my choice."
**[DO]** Click back to **Reports** — the weekly summary is already in the list.
**[SAY]**
> "See — it already generated the first one."

---

## 6 · THE TRAVEL PAYOFF — SHARE WITH ANY DOCTOR  (4:15–4:50)
**[DO]** Click **Share with clinician** (bottom-left). A modal shows a link.
**[SAY]**
> "Now the moment that matters. I'm in a new city — a new *country* — and I need to see a doctor who's never met me."

**[DO]** Click **Preview snapshot** (opens a clean read-only view in a new tab).
**[SAY]**
> "Instead of asking them to integrate with my old country's system — which never happens — I just send this link. Read-only, no account, no portal. Allergies and red flags right at the top, then my medications, conditions, longitudinal trends, and recent history — and every single item links to its source record so they can verify it.
>
> And on the link *they* open, the doctor even gets a record-scoped AI and an auto-generated **SBAR brief** for triage — but that's for them, not cluttering my preview."

---

## 7 · IT'S PORTABLE — YOU OWN IT  (4:50–5:15)  — Export
**[DO]** Click **Export record** → the export dialog opens.
**[SAY]**
> "And it's mine to take anywhere. I choose what to include and the format — a formatted **Document** I can save as a PDF, a spreadsheet, JSON, or a **FHIR** bundle any hospital system on earth can import — with a live preview so I know exactly what I'm sending."
**[DO]** Switch format to **Document**, glance at the preview, then optionally click **Open & print**.
**[SAY]**
> "Clean, formatted, standards-based. My record is never locked inside one clinic or one country again."

---

## 8 · CLOSE  (5:15–5:30)
**[SAY]**
> "So that's TraceHealth. Every health record you have — from any clinic, any country, any format — pulled into one place you own, made understandable, with an AI that actually knows your history, and one link that hands it to any doctor in seconds.
>
> Your health should travel with you. Now it does."

---

## APPENDIX — the AI questions (copy/paste)
1. `What should a new doctor know about me?`
2. `Is my LDL cholesterol getting better or worse, and what should I do?`
3. `What does an HbA1c of 6.4% mean and should I be worried?`
4. `What are all my allergies, and is anything I take a problem?`  *(optional)*
5. `Is my kidney function declining?`  *(optional — eGFR trend)*

## APPENDIX — tech name-drops (for judges, sprinkle naturally)
- **Convex**: real-time reactive queries, **background jobs** (PDF extraction, exports), **cron** (scheduled reports), file storage, cursor pagination, full-text search.
- **OpenAI**: PDF/vision extraction + the grounded tool-calling agent.
- **Firecrawl**: cited answers from trusted medical sources.
- **FHIR / SMART on FHIR**: import and export in the healthcare interoperability standard.

## APPENDIX — recording
- macOS `⇧⌘5` → Record (free). Nicer: **Screen Studio** (auto zoom-to-cursor). Free power tool: **OBS**.
- Pause ~1s after every screen change. During the PDF read, keep talking — the "background job" line covers the wait.
- If you fumble, just pause and re-say the line — cut it later.
