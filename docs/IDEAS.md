# TraceHealth — Product Idea Catalog

*A deep, numbered menu of ways to make TraceHealth feel genuinely helpful — patient end, doctor end, and everyone in the care lifecycle. Generated from a 15-agent ideation sweep (12 product lenses → dedup → rank → gap-check → finalize), every idea grounded in what we already have: a normalized, provenance-tracked FHIR record + a cited, chart-drawing AI.*

**How to use this:** skim the index, then just say the numbers you want built (e.g. "build #3 and #21"). 69 ideas across 12 groups. Effort: `S` small · `M` medium · `L` large.

> All ideas are grounded and cited; nothing diagnoses or prescribes — the app describes and associates, and always points to a clinician. "Not medical advice."

---

## Quick index


**🧭 Proactive Intelligence** — The app reads the whole record and tells you what to look at — turning passive charts into an active watch.
1. Needs Attention Feed `L`
2. Open Loops & Overdue Rechecks `M`
3. Screening & Prevention Radar `M`
4. Trajectory Forecast `M`
5. Silent Risk Cluster Detector `M`
6. How Urgent Is This? (Safe Navigator) `M`
7. Periodic Health Digest `M`

**💬 Patient Comprehension** — Meet a real person at their reading level, in their language, by voice if needed — turn naked numbers and jargon into something they understand.
8. Explain This Result `M`
9. Is This Normal — For the Population AND For You `M`
10. Questions to Ask My Doctor `M`
11. Explain My Visit (Vision Recap) `M`
12. Reading-Level Dial `S`
13. Speak My Language (Record Translation) `S`
14. Listen to Your Health (Voice-First & Audio Recaps) `M`

**💊 Medications & Safety** — One reconciled truth about what you take — and an active guard against the cross-provider errors that hurt people.
15. Medication Passport `M`
16. Allergy Cross-Check Guard + Dropped-Allergy Alarm `M`
17. Interaction & Duplicate-Therapy Scanner `M`
18. Lab-Monitoring Gap Detector `M`
19. Redundant Test & Radiation Guard `M`
20. Ingestion-Time Safety Gate `M`
21. Brown-Bag Reconciliation Sheet `M`

**📈 Longitudinal Insight** — Eight years of scattered dots become a story about you — baselines, drug responses, and what moves together.
22. Is It Working — Med Response Tracker `M`
23. Your Baseline — Anomaly Detection `M`
24. Since You Started ___ (Event-Anchored Lens) `M`
25. What Moves Together — Personal Correlations `M`
26. Heart-Health Factors (Non-Diagnostic) `M`

**• Whole-Person & Life-Stage Lenses** — The record isn't just labs — mental health, pregnancy, cycles, and a child's growth are where a real life is lived.
27. Mind & Mood Lens (Behavioral Health) `M`
28. Pregnancy Companion `M`
29. Cycle & Reproductive-Health Lens `M`
30. Pediatric Growth Percentile Charts `M`

**🤖 Agentic Assistant** — The grounded, cited AI doing real multi-step work over the record — never inventing a number.
31. Deep-Dive Research Agent `L`
32. Narrated Trends `M`
33. Living Insights Board `M`
34. Grounded Follow-Up Chips `S`
35. Records-Request Drafting Agent `M`

**🪪 Everyday Utility** — The wallet-ready, real-life moments — the ER, the new-doctor clipboard, the day-to-day management of a condition.
36. Break-Glass Emergency Card & Advance-Care Vault `M`
37. New-Doctor Onboarding Packet `M`
38. Your Care Team Map `M`
39. Home-Monitoring Coach (Active Chronic-Disease Loops) `M`
40. Med & Recheck Reminders with Calendar Export `M`
41. Immunization & Travel Vaccine Passport `M`
42. Symptom & Episode Journal (Tied to Your Labs) `M`

**👪 Caregiver & Family** — The record's real operator is usually not the patient — build for the daughter, the parent, the whole household.
43. One Account, the Whole Household `M`
44. Elder-Care Dashboard `L`
45. Consented, Role-Scoped Caregiver Access `M`
46. Family History That Informs Risk `M`

**🩺 Doctor-Facing / Point of Care** — Front-load exactly what a clinician needs in the 15-minute visit — cited, triaged, and safety-first.
47. Point-of-Care Safety Banner `S`
48. SBAR Pre-Visit Brief `S`
49. Clinician Results Flowsheet `M`
50. Problem List with Live Control Status `M`
51. Cross-Provider Blind-Spot `M`

**📥 Ingestion & Capture** — Get real-world paper, photos, and portals into the record effortlessly — and reconcile them the moment they land.
52. Snap-a-Lab (Camera → Cited Labs) `M`
53. Reconcile-on-Ingest `M`
54. Ambient Visit Capture `L`
55. Radiology & Imaging Report Reader `M`
56. Apple Health & Wearable Import `M`
57. Records Inbox (Forwarding Address) `M`
58. Confirm-What-We-Read `S`

**🔒 Trust & Provenance** — The whole wedge — every fact points to its source, and you can see which numbers to lean on.
59. Source-Quote Highlight on Hover `M`
60. Confidence Chip on Every Fact `M`
61. Conflict Resolution Studio `M`
62. Citation-Integrity Guard `L`
63. How Complete Is My Record? (Data Health Score) `S`
64. Clinician Co-Sign on the Share Link `M`
65. Physiologic & Unit Sanity Checker `M`

**📊 Visualization** — See the whole body at a glance, and watch a life's health become a story.
66. Vitals Wall (Small-Multiples) `S`
67. Reference Zones & Time-in-Range `S`
68. Your Health Story (Cited Scrollytelling) `L`
69. One-Page Health Passport (Printable) `M`

---

## Full catalog


## 🧭 Proactive Intelligence
*The app reads the whole record and tells you what to look at — turning passive charts into an active watch.*

### 1. Needs Attention Feed  ·  `L`
- **What.** A single ranked feed at the top of the app that scores every latest reading against its reference range and trend and surfaces only the handful that matter — 'LDL 171, above the 130 target and rising 4 checks in a row' — each a tappable card with a mini-sparkline and a citation to the exact source page. Newly-synced flags get a 'new since last sync' badge.
- **Why it helps.** The core failure of records apps is storage-without-a-so-what: today you have to hunt across Trends to notice anything. This makes the app do the noticing and hand you a short, honest, ranked list of what's off — a filing cabinet becoming a nurse who read your chart.
- **How (our data / AI).** Server-side query over observations using METRIC_META (direction high_bad/low_bad + refHigh/refLow) plus per-code slope. Rank = distance-out-of-range × worsening-slope × recency. Down-weight/annotate flags resting on ai_extracted provenance so it stays honest. Wire into the existing sync cron so fresh results auto-classify. No model call needed for the ranking.
- **Demo moment.** Open the demo patient: the feed leads with 'LDL rising to 171 (above 130)', then 'HbA1c 5.8% — prediabetes range', then 'BP trending up 118/76 → 134/84'. Tap the LDL card → jumps to the cited 2026 Stanford lab, page 3.

### 2. Open Loops & Overdue Rechecks  ·  `M`
- **What.** Finds dropped threads: abnormal results never rechecked, doctor-ordered follow-ups that never came back ('recheck lipids in 3 months' with no later lab), un-closed specialist referrals, and monitoring overdue for a documented condition. Each loop auto-closes the moment a matching result is ingested, showing the delta.
- **Why it helps.** 6.8–62% of abnormal results are never followed up — a real, dangerous gap that only a cross-provider record can catch. Turning 'the doctor said recheck' into a tracked, self-resolving loop is one of the most concretely life-relevant things the app can do.
- **How (our data / AI).** For each out-of-range observation, look forward for a repeat of the same code, a plausibly-related med start, or a later encounter; none found = open loop. Parse follow-up intervals out of encounter/document text ('return in 3 months') into due dates. Extend the existing missingRecords model into 'expected results'; cite the originating note.
- **Demo moment.** Flags 'Vitamin D was 18 (low) in Aug 2025 — no recheck in the 11 months since,' cited to the Quest page, alongside a green 'Post-statin lipid recheck completed Jun 2026.'

### 3. Screening & Prevention Radar  ·  `M`
- **What.** An age/sex/condition-aware panel that knows guideline screening cadences (lipid panel, HbA1c every 3–6mo if diabetic, BP, colonoscopy at 45+, mammogram, kidney monitoring, plus pediatric vaccine bands) and detects when the record shows one is overdue or never done — computed from when each was LAST actually done, not a generic reminder.
- **Why it helps.** Overdue screenings are the quintessential silent gap: nothing feels wrong, so nothing gets scheduled until it's late. Grounding it in 'your last A1c was 2023 — over 3 years ago' with the citation makes it credible and specific, exactly the proactive stewardship a fragmented care team structurally can't provide.
- **How (our data / AI).** patients.age/sex + active conditions against a small cadence table, cross-referenced with the most recent observation date per canonical code and encounter.kind. Zero matching records + eligible age = 'never recorded'; older than cadence = 'overdue'. Framed 'general guidelines, confirm with your doctor — not medical advice.'
- **Demo moment.** For a 52-year-old: 'Colonoscopy: no record found — typically first done ~age 45' and 'HbA1c: last done 2023, guideline cadence ~3 yrs,' each citing where it read the last date.

### 4. Trajectory Forecast  ·  `M`
- **What.** On any worsening metric, a lightweight projection that says non-diagnostically 'at the current rate, HbA1c is trending toward 6.5%' — with a shaded 'if the trend continues' cone drawn on the existing Trends chart — and flags when a trend is ACCELERATING versus your own earlier pace.
- **Why it helps.** A rising number is far more motivating when you can see where it's going, not just where it is. Prediabetes creeping toward diabetes is the moment a person can still change the outcome, and patients almost never notice the inflection point on their own.
- **How (our data / AI).** Fit a simple/robust slope over each metric's existing point series and extrapolate to the METRIC_META threshold; compare recent vs earlier segment slopes to detect acceleration. Reuse the chart's reference-line rendering; only show with ≥3 points and a clear direction. Strictly 'trend projection, not a prediction or diagnosis.'
- **Demo moment.** HbA1c shows the real 5.1→5.8 climb, then a dashed cone nudging toward the 6.5 diabetes line: 'climbing ~3× faster since 2023 — worth watching. Not a diagnosis.'

### 5. Silent Risk Cluster Detector  ·  `M`
- **What.** Detects when several individually-borderline metrics co-occur into a recognizable pattern — rising LDL + HbA1c in the prediabetes band + climbing weight + BP drifting up — and surfaces it as one 'these tend to travel together' card that associates (never diagnoses) and links each contributing value.
- **Why it helps.** The dangerous risks are the ones no single visit catches because each number is only 'a little' off and they're scattered across different labs and providers. A record spanning all sources is uniquely able to see the whole picture — the cross-provider synthesis a fragmented team can't do.
- **How (our data / AI).** Rule-based co-occurrence over latest observations (LDL, HBA1C, GLUCOSE, TRIG, BMI/WEIGHT, BP) using METRIC_META ranges. Optionally hand the assembled cited facts to gpt-4o for a plain-language, explicitly non-diagnostic summary. Every component keeps its own provenance citation.
- **Demo moment.** A card: 'Four related signals are trending together since 2024: LDL, HbA1c (prediabetes range), weight, and blood pressure' with four cited chips and 'commonly associated — worth raising with a clinician.'

### 6. How Urgent Is This? (Safe Navigator)  ·  `M`
- **What.** On any flagged value or logged symptom, a strictly non-diagnostic urgency triage that maps to safe next-step language — 'this is typically routine, mention at your next visit' vs 'values in this range are usually discussed promptly, consider contacting your clinician' vs hard-coded emergency-warning-signs — never naming a disease, always pointing to a human.
- **Why it helps.** The scariest gap for a real person seeing a red value at 11pm is 'do I go to the ER or wait?' The catalog explains numbers but never helps with the urgency decision, so users default to panic-Googling. A conservative, safety-first navigator that always routes to a clinician is genuinely calming and demonstrably responsible.
- **How (our data / AI).** Deterministic tiering from METRIC_META distance-out-of-range plus a curated red-flag list (e.g. chest pain, glucose extremes) that maps ONLY to action language, not diagnoses. gpt-4o phrases the routing under a hard 'never diagnose, never say wait if any red flag, always name calling a professional / 911' guardrail. Emergency-warning-signs card is fully static, not model-generated.
- **Demo moment.** Tap an LDL 171 → 'Typically routine — worth raising at your next visit, not an emergency.' Log 'crushing chest pain' → an immediate, static red card: 'These can be signs of a medical emergency — call 911. This app cannot assess emergencies.'

### 7. Periodic Health Digest  ·  `M`
- **What.** An automatically generated, cited 'what changed in your health' recap on a cadence (monthly/quarterly): new abnormal values, metrics that improved, screenings that came due, new meds or conditions since the last digest — saved into Reports and announced on next open.
- **Why it helps.** Most people never proactively review their record; a periodic, digestible recap makes health awareness a background habit instead of a crisis reaction. Because it only reports movement since last time, it stays short and relevant — the health equivalent of a monthly statement you'll actually read.
- **How (our data / AI).** A scheduled Convex cron (the auto-sync pattern already exists) diffs the record against the prior digest timestamp, assembles the changed facts, and asks gpt-4o for a grounded, citation-backed, non-diagnostic summary — written to the existing reports table (kind='summary'), reusing report + FHIR write-back plumbing.
- **Demo moment.** 'Since June: LDL improved 171→139 after your statin start; HbA1c held at 5.7% (prediabetes); no colonoscopy on record' — every line cited, saved as a shareable report.


## 💬 Patient Comprehension
*Meet a real person at their reading level, in their language, by voice if needed — turn naked numbers and jargon into something they understand.*

### 8. Explain This Result  ·  `M`
- **What.** A one-tap 'Explain in plain language' button on any lab value or metric that produces a short card: what the test measures, what your number means, and where it sits relative to the reference line — grounded, cited, never diagnostic.
- **Why it helps.** A person sees 'LDL 96' or 'eGFR 58' and has no idea if that's good, bad, or scary. This closes the single biggest comprehension gap — turning a naked number into a sentence a human understands — without them having to know to ask.
- **How (our data / AI).** getMetric already returns the series, refHigh/refLow, direction, and first→peak→latest. We DETERMINISTICALLY classify in-range/above/below and rising/falling (no hallucination risk), then use gpt-4o-mini only to phrase it. The card cites the exact source document+page of the latest reading via the existing citation pipeline.
- **Demo moment.** On the LDL graph, tap Explain → 'LDL is the "bad" cholesterol that can build up in arteries. Yours is 96 — below the 130 cutoff, and down from a peak of 165 in 2019.' A source chip links to the Quest PDF.

### 9. Is This Normal — For the Population AND For You  ·  `M`
- **What.** A one-tap answer on any reading that separates two things people conflate — is this inside the standard reference range, and is it normal for YOUR personal baseline — rendered as a labeled low/normal/high band with your dot and a faint trail of past readings.
- **Why it helps.** 'Normal' is ambiguous and anxiety-driving. A glucose of 99 is technically in-range, but if yours climbed 82→99 over three years, that's your story. Distinguishing population-normal from personal-normal is more honest and more useful than a red/green flag — and for lower-literacy users, a picture lands where a sentence doesn't.
- **How (our data / AI).** Fully deterministic from data we hold: refHigh/refLow + direction give the population band; the patient's own min/max/first/latest series gives the personal-trend band. Render both as a position bar (your dot + trail) reusing TrendChart's reference logic, plus one AI-phrased sentence. No invented numbers.
- **Demo moment.** Tap Glucose 99 → 'In the normal range (under 100). But for you it's your highest yet — up from 82 in 2021,' with a two-band visual showing the climb inside the green zone.

### 10. Questions to Ask My Doctor  ·  `M`
- **What.** From any result or trend, generate 3–5 specific, plainly-worded questions the patient can bring to their next visit — grounded in what their own record actually shows, printable and foldable into the doctor-snapshot share link.
- **Why it helps.** The 15-minute visit is where comprehension turns into care, and most people freeze or forget. Handing them precise, record-specific questions ('my A1c crossed 5.7 and no med changed — should we recheck?') turns a passive patient into a prepared one.
- **How (our data / AI).** getMetric gives the trend, reference crossings, and related meds/conditions within the timespan. Feed that structured slice to the model with a strict 'ask questions, never advise/diagnose' guardrail. Output is printable and travels with the existing snapshot.
- **Demo moment.** On a rising HbA1c crossing 5.7 with no med start: '1) My A1c has risen each year and just passed the prediabetes line — should we retest? 2) Does my family history change this?' with a Print button.

### 11. Explain My Visit (Vision Recap)  ·  `M`
- **What.** Point at any visit summary or specialist note — including scanned/faxed notes — and get a plain-language recap: what happened, what they found, what changed in your meds/problems, and what's next — cited to that exact document.
- **Why it helps.** The after-visit summary is the densest, most jargon-packed artifact a patient owns and the one they most need to understand. Turning 'A&O x3, continue lisinopril, f/u 3mo' into human sentences is where the record earns its keep for a real person.
- **How (our data / AI).** We have documents with excerpt text and linked encounters; gpt-4o VISION (already available) reads scanned/image notes the current text-only path misses. The model summarizes ONLY that document into a fixed 'what happened / found / changed / next' frame, every claim cited to the page it came from.
- **Demo moment.** Open a cardiology note → 'At this visit your heart rhythm looked normal. They kept your blood-pressure medicine the same and want to see you again in 3 months.' Each line cites the source page; a scanned fax works too.

### 12. Reading-Level Dial  ·  `S`
- **What.** A persistent toggle (Grade 6 / Plain / Clinical) that re-renders every AI explanation, result card, and report at the reader's chosen literacy level — from 6th-grade plain English up to clinical shorthand.
- **Why it helps.** One record is read by a teenager managing their asthma, a caregiver daughter, and the patient's nurse — each needs different words for the same fact. Meeting people at their reading level is the difference between 'I get it' and 'I'll just trust the doctor.'
- **How (our data / AI).** Grounded facts stay fixed (values, ranges, dates); only the phrasing layer changes. Add a `level` param to the explain/report prompts and store the preference on the patient. gpt-4o-mini rewrites the same cited sentences at the target grade, numbers and citations locked to the record so meaning can't drift.
- **Demo moment.** Slide from Clinical → Grade 6 on the HbA1c card and watch 'HbA1c 6.1%, above the 5.7% prediabetes threshold' become 'Your average blood sugar over ~3 months is a little high — just over the line doctors watch.'

### 13. Speak My Language (Record Translation)  ·  `S`
- **What.** One toggle re-renders the entire record — result explanations, summaries, med instructions, the clinician snapshot — in the user's language (Spanish, Mandarin, etc.), while keeping numbers, units, dates, and citations locked to the source.
- **Why it helps.** Millions manage their own or a parent's health in a non-English language, and language is the single biggest access barrier in real care. A caregiver daughter translating for an immigrant parent, or a patient handing a doctor abroad a snapshot in the local language, is a viscerally real use case.
- **How (our data / AI).** Grounded facts stay fixed; only the phrasing layer translates. Add a `locale` param to the explain/report/snapshot prompts (reusing the exact Reading-Level Dial pattern); gpt-4o-mini translates the cited sentences with values/citations pinned so meaning can't drift. Store the preference on the patient.
- **Demo moment.** Switch to Español → the HbA1c card reads 'Su azúcar en sangre promedio está un poco alto…' with the same Quest source chip; generate a clinician snapshot in the doctor's language for a trip abroad.

### 14. Listen to Your Health (Voice-First & Audio Recaps)  ·  `M`
- **What.** Ask questions out loud and hear grounded, cited answers read back — plus one-tap audio versions of any explanation, digest, or visit recap — designed for elderly, low-vision, or low-literacy users and hands-free moments.
- **Why it helps.** Every other idea assumes a user reading a screen; a 78-year-old managing meds, a vision-impaired patient, or a caregiver driving cannot. Voice in/audio out is the accessibility layer that makes the whole product usable by the people who need a health record most.
- **How (our data / AI).** Wrap the existing grounded assistant.answer with speech-to-text on input and TTS on the cited answer text (browser SpeechRecognition/SpeechSynthesis or a hosted TTS). Audio only ever reads text the assistant already grounded and cited — no new claims. Large-text/high-contrast mode ships alongside.
- **Demo moment.** Hold the mic: 'Is my cholesterol getting better?' → the app speaks 'Your LDL fell from 171 to 139 after your statin, still above the 130 target,' and shows the cited chart; tap the speaker on any digest to hear it.


## 💊 Medications & Safety
*One reconciled truth about what you take — and an active guard against the cross-provider errors that hurt people.*

### 15. Medication Passport  ·  `M`
- **What.** A single 'what you're actually taking right now' surface that collapses the same drug reported by multiple providers into one row (normalizedName merges Lipitor/Atorvastatin), picks the most-recent authoritative dose, shows every recorded dose over time, and flags every source that disagrees inline with a one-tap resolve that stamps the med patient_verified.
- **Why it helps.** The #1 medication-safety failure is that no two of a patient's providers hold the same list. A caregiver or ER doc needs one trustworthy list, not five portals — and the disagreements are exactly what causes double-dosing and errors. A dose history that spans providers also makes titration or a transcription error obvious.
- **How (our data / AI).** Deterministic group-by over medications on normalizedName; surface dose/status/prescriber/startDate with provenance + documentId citations, plus an ordered dose ladder per drug (mirrors getMetric's 'around' event list). Reuse the conflicts table and resolveConflict/verifyMedication mutations already wired in Review. AI writes only the plain-language 'why these disagree' line, cited to each source.
- **Demo moment.** Metformin shows a single row badged '500 mg or 1000 mg? — 2 sources disagree', its ladder showing '500 mg — UCSF, May 2025' then '1000 mg — Stanford, Mar 2026'; tap 'This one's right' → row turns green, patient_verified, and the Review conflict resolves in lockstep.

### 16. Allergy Cross-Check Guard + Dropped-Allergy Alarm  ·  `M`
- **What.** Every active and newly-added drug is cross-checked against the allergies table by ingredient/class, AND the app surfaces when one source silently dropped a documented allergy — blocking the 'safe to prescribe?' gap in both directions.
- **Why it helps.** A dropped penicillin allergy is a genuine path to anaphylaxis: if the next clinician trusts the wrong list, they prescribe a beta-lactam. Reconciling allergies across sources — not just meds — is a safety story only a cross-provider record can tell.
- **How (our data / AI).** Cross-reference allergies.substance against a curated allergen→cross-reactive-class map over active + incoming meds; detect allergy conflicts (Stanford lists Penicillin/rash, UCSF says NKDA) from the existing conflicts machinery. AI drafts the cited warning; provenance shows which record is missing it.
- **Demo moment.** Banner: 'One of your records (UCSF, 2026) dropped your penicillin allergy that Stanford documented (rash, 2023).' Paste an amoxicillin script → hard STOP: 'Amoxicillin is a penicillin — you have a documented reaction,' both docs cited.

### 17. Interaction & Duplicate-Therapy Scanner  ·  `M`
- **What.** A standing safety board that scans the active regimen for drug-drug interactions and duplicate therapy (two drugs in the same class) using a curated interaction/drug-class table, and lets the grounded assistant explain each hit in plain language — cited to the source doc of every drug.
- **Why it helps.** Interactions and accidental duplicates (two statins, two BP meds from different specialists) are the classic cross-provider harm a single portal can never catch. Turning the passive med list into an active 'is anything here risky together?' check is the core of the safety promise.
- **How (our data / AI).** Ship a curated static JSON of common pairwise interactions + drug classes (public references, NOT model-invented) keyed to normalizedName; set-intersect against active meds. AI only phrases severity/mechanism, hard-constrained to describe/associate. Reuses the validated-citation + reasoning-trace pattern.
- **Demo moment.** Board shows 'No major interactions — checked 3 active drugs.' Attach a clarithromycin script → red card: 'Clarithromycin strongly raises atorvastatin levels (CYP3A4) — muscle-injury risk,' Atorvastatin cited to the Stanford note.

### 18. Lab-Monitoring Gap Detector  ·  `M`
- **What.** A curated map of drug → recommended safety labs (metformin→eGFR/creatinine, statin→liver panel + lipid recheck, ACE/ARB→creatinine/potassium), checked against observations, that flags monitoring a chronic med requires but the record is missing or overdue.
- **Why it helps.** Being on a medication without the follow-up bloodwork it requires is a real, common, silent risk — the prescription happens, the monitoring lapses when it's a different provider's job. Tying the med you're actually taking to the lab you're actually missing is exactly the connect-the-dots a person can't track themselves.
- **How (our data / AI).** Static curated map intersected with observations by canonical code and recency, using startDate as the clock. eGFR/CREATININE are already canonical codes with ranges but absent in the demo, so the gap is real and groundable. AI writes the cited explanation; one tap opens the missing-records request flow.
- **Demo moment.** 'You've been on Metformin ~14 months, but your record has no kidney-function result (eGFR/creatinine) — metformin dosing depends on it.' One tap requests the missing lab.

### 19. Redundant Test & Radiation Guard  ·  `M`
- **What.** Detects when a test is about to be (or was recently) repeated needlessly — a lab reordered well inside its useful interval, or duplicate imaging of the same body part across providers — and tallies cumulative imaging/radiation exposure, so you can ask 'do we actually need this again?'
- **Why it helps.** Cross-provider care silently drives duplicate labs and repeat CT/X-rays no single doctor sees; that's real cost, needle sticks, and radiation. Turning the record into something that says 'Stanford already did this MRI 5 weeks ago' is a concrete, protective 'the app caught something' moment that only a unified record can produce.
- **How (our data / AI).** Group observations by canonical code and encounters/documents by modality+body-part; flag repeats whose gap is shorter than a curated per-test sensible-interval table. Maintain a small modality→typical-dose table to sum lifetime imaging exposure. Cite both the prior and the duplicate document. Deterministic; AI only phrases the 'consider whether this is needed' line.
- **Demo moment.** 'Heads up: a lipid panel was drawn twice 3 weeks apart (UCSF + Stanford) — usually rechecked every ~3 months' and 'You've had 2 chest CTs in 14 months (~14 mSv total) — worth confirming a third is needed.'

### 20. Ingestion-Time Safety Gate  ·  `M`
- **What.** The moment a medication enters from any pipeline — AI extraction, bundle import, manual entry, or a connection auto-sync — it's intercepted and run through allergy, interaction, and duplicate checks before it silently lands, surfacing a confirmation card with the live check animation.
- **Why it helps.** New meds arrive without fanfare — an auto-synced record can add a drug the patient never noticed. Catching risk at the moment of entry, not only on a board they might never open, is the difference between a passive log and an active guardian.
- **How (our data / AI).** Hook the existing insertExtracted, importBundle, addManualRecord, and connection-sync paths; on each new med run the curated allergy/interaction/duplicate checks and raise a review card. Reuse the processingJobs live-animation pattern to show the check running.
- **Demo moment.** Trigger an auto-sync: a gate card pops — 'New from UCSF: Metformin 500 mg — conflicts with the 1000 mg Stanford has on file. Keep, replace, or resolve?' — before it's committed.

### 21. Brown-Bag Reconciliation Sheet  ·  `M`
- **What.** One tap generates a clinician-ready, fully cited medication-review page: the merged single list, every unresolved dose/allergy discrepancy, monitoring gaps, and interaction flags — print, QR, or FHIR write-back.
- **Why it helps.** The 'brown-bag' med review is a real clinical ritual, and caregivers say med tracking is the hardest part. A cited, print/QR/EHR-ready sheet is the tangible artifact that makes the whole safety engine useful at the point of care.
- **How (our data / AI).** Composes the passport, allergy guard, monitoring-gap, and interaction outputs into a document; reuses the clinician-snapshot printable layout, Reports generation, and FHIR DocumentReference write-back already shipped. Every line carries its documentId citation.
- **Demo moment.** Tap 'Med review sheet' → reconciled list, 'Unresolved: Metformin 500 vs 1000 mg,' 'Allergy dropped by one source: Penicillin,' 'Missing: eGFR for metformin' — each cited — then QR it or write it back to the EHR.


## 📈 Longitudinal Insight
*Eight years of scattered dots become a story about you — baselines, drug responses, and what moves together.*

### 22. Is It Working — Med Response Tracker  ·  `M`
- **What.** For every medication tied to a metric it targets, an auto-generated cited before/after card quantifying the change in the affected lab across the drug's start date (Δ absolute, Δ%, time-to-effect) — with an honest 'can't tell, no follow-up lab' state and a gentle 'still above goal' nudge.
- **Why it helps.** The single question a real patient has after starting a drug — 'is it doing anything?' — is buried across labs from different clinics. Closing the drug→outcome loop is the most satisfying 'the app thinks about my health' moment, and 'improved but still above target' is genuinely useful, non-prescriptive intelligence.
- **How (our data / AI).** Map med normalizedName → target code (atorvastatin→LDL, metformin→HBA1C, cholecalciferol→VITD); pair startDate with nearest-before and after readings; verdict is deterministic against refHigh/refLow. Reuse getMetric's insight/around and the reference-line chart; AI only narrates, framed as association not causation.
- **Demo moment.** Atorvastatin card: real LDL chart 171 (Feb, pre) → 139 (Jun, post) with the 130 line drawn — 'down 19% since your statin start, still above 130; worth discussing next visit.' Vitamin D3 card: 'no follow-up level on file — effect unknown.'

### 23. Your Baseline — Anomaly Detection  ·  `M`
- **What.** Learns each metric's personal baseline from your stable early history and flags readings that deviate meaningfully from THAT baseline, plus surfaces the single biggest jump in each series — separating 'this changed for you' from 'this has always been your normal.'
- **Why it helps.** Population reference ranges miss the story of change. A value can be in-range yet a big move for you, or 'high' but flat for a decade. This is the difference between a static chart and the app understanding your personal trajectory.
- **How (our data / AI).** Over observations grouped by code (by_patient_code index), compute a rolling median of the earliest stable window as baseline, then flag later readings and the largest point-to-point delta. Reuse direction metadata so only concerning deviations get a badge; each flag links to its source reading.
- **Demo moment.** A badge on the LDL trend: 'Biggest change in your record — +14 between 2023 and 2024, now 64% above your 2018–21 baseline of ~104.' Weight shows '+18 lb above baseline.'

### 24. Since You Started ___ (Event-Anchored Lens)  ·  `M`
- **What.** An interactive control that re-frames the entire record around any chosen clinical event — a med start, the ER visit, a diagnosis: every metric's before/after delta, plus new conditions and new meds since that moment, in one view.
- **Why it helps.** People think in life events, not calendar years — 'what's happened to my health since that pill, or since that scare?' This answers it directly instead of making them eyeball eight separate charts.
- **How (our data / AI).** Re-key the existing compare() logic from two years to a single anchor date sourced from medications, conditions, or encounters, computing nearest-before vs latest-after per metric plus what's new since. Renders in the current Compare UI with an event picker.
- **Demo moment.** Pick 'Atorvastatin started (Mar 2026)': LDL −32, weight −2, HbA1c flat, no new conditions. Pick 'ER chest-pain visit (Jan 2026)' and see everything that moved since that scare.

### 25. What Moves Together — Personal Correlations  ·  `M`
- **What.** Finds metrics that trend together over time in your own record and presents them as a normalized overlay with a plain-language, association-only summary.
- **Why it helps.** Seeing that your weight, cholesterol, and blood sugar have all risen in lockstep is a more motivating, coherent story than four separate charts — it reveals the cluster, safely, without claiming one caused another.
- **How (our data / AI).** Align observations by date across primary codes, compute pairwise correlation over the shared window, and overlay the top co-movers as min-max normalized lines (charts infra already renders multi-series). The assistant writes the summary with explicit 'move together in your record — association, not cause' framing.
- **Demo moment.** 'Three of your metrics have risen together since 2021: weight (172→186), LDL (117→171), and HbA1c (drifting to 5.7).' One normalized overlay makes the shared march visible, each line traceable to its labs.

### 26. Heart-Health Factors (Non-Diagnostic)  ·  `M`
- **What.** Assembles the cardiovascular risk factors actually present in the record into one clearly-labeled checklist — each marked present/at-target/off-target and cited — without ever computing a diagnosis or a risk percentage.
- **Why it helps.** A patient's CV risk factors are scattered across a lipid panel here, a weight there, an A1c and a BP note elsewhere. Seeing them assembled — 'these are the levers' — is genuinely orienting, and stays safe by describing documented factors, not predicting events.
- **How (our data / AI).** Pull the factor set straight from the record: LDL vs refHigh, rising weight/BMI, HbA1c at the prediabetes line, documented BP readings, and the flagged ER chest-pain encounter. Render as a cited card under the standing 'describe/associate, not diagnose' guardrail.
- **Demo moment.** 'Heart-health factors your records show': LDL 139 (above 130), HbA1c 5.7 (prediabetes), weight +18 lb, BP 134/84 documented Feb 2026, plus 'Jan 2026 ER visit — cardiac workup negative.' Each clickable to source. Big 'a factor list, not a diagnosis.'


## • Whole-Person & Life-Stage Lenses
*The record isn't just labs — mental health, pregnancy, cycles, and a child's growth are where a real life is lived.*

### 27. Mind & Mood Lens (Behavioral Health)  ·  `M`
- **What.** A first-class behavioral-health surface: capture standard validated screeners (PHQ-9 depression, GAD-7 anxiety) as scored observations over time, and correlate mood scores against the physical record — thyroid (TSH), Vitamin D, new meds, and life events — as association, never diagnosis.
- **Why it helps.** Most of a health record is somatic; mental health is invisible, yet it's the domain patients most struggle to track and articulate to a doctor. Showing a PHQ-9 rising while Vitamin D is 18 and a beta-blocker just started is exactly the cross-domain synthesis a fragmented care team misses — the difference between a 'lab app' and one that treats the whole person.
- **How (our data / AI).** Add PHQ-9/GAD-7 as canonical codes in METRIC_META with their standard severity bands (minimal/mild/moderate/severe) so they plot on the existing banded TrendChart. Score deterministically from item answers; overlay against existing observations (TSH, VITD) and medication startDates. gpt-4o narrates associations under the standing 'describe/associate, not diagnose' guardrail. Includes a hard-coded crisis-resources card if a severe/suicidal-ideation item is flagged.
- **Demo moment.** Log a 2-minute PHQ-9 → score 14 (moderate) plots on a banded chart; a card notes 'your mood scores rose over the same months your Vitamin D read 18 (low) and after propranolol started — worth raising,' each chip cited.

### 28. Pregnancy Companion  ·  `M`
- **What.** A pregnancy-aware lens that, given an EDD/gestational age, frames the record around the pregnancy: trimester timeline, which prenatal labs/screenings are due when (glucose tolerance, CBC, blood type/Rh, Group B strep), pregnancy-appropriate reference ranges, and a medication-safety check flagging drugs to discuss in pregnancy.
- **Why it helps.** Pregnancy is one of the most record-intensive, anxiety-laden, time-boxed health journeys — a whole population with a hard deadline and specific, well-defined screening cadences, making it both high-value and unusually groundable.
- **How (our data / AI).** Add gestationalAge/EDD to the patient; drive a curated prenatal schedule table (weeks-based) against existing observations/encounters to compute due/overdue, exactly like the Screening Radar but pregnancy-scoped. Swap in pregnancy reference ranges for affected labs. Cross-check active medications against a curated 'discuss-in-pregnancy' list, cited, non-directive.
- **Demo moment.** Enter 'due June 2026' → 'Week 27: glucose tolerance test due now; blood type on file (O+, no Rh issue); Group B strep at 36w' and a gentle 'lisinopril is typically reviewed in pregnancy — raise with your OB,' each cited.

### 29. Cycle & Reproductive-Health Lens  ·  `M`
- **What.** For menstruating users, a cycle log that overlays onto the same timeline as labs and symptoms, contextualizes results by cycle phase (e.g. hormone or hemoglobin readings), tracks cycle regularity, and lets the grounded assistant answer 'is my period pattern changing?' as association, never diagnosis.
- **Why it helps.** Reproductive health is a massive, daily-relevant domain, and cycle data is exactly the kind of longitudinal signal that only makes sense when overlaid with labs and symptoms. Correlating an iron/hemoglobin dip or mood scores with cycle phase is real, useful synthesis women rarely get in fragmented care.
- **How (our data / AI).** Add a cycle-events log (reuse the journal/observation pattern) rendered on the existing Timeline/TrendChart x-axis; compute cycle length/regularity deterministically. The assistant correlates phase against existing observations (e.g. HGB, mood scores) under the association-only guardrail, each claim cited.
- **Demo moment.** Log periods for a few months → 'Your cycles ranged 26–41 days (irregular); your lowest hemoglobin readings line up with your heaviest months' — overlaid on the timeline, cited, framed 'worth mentioning, not a diagnosis.'

### 30. Pediatric Growth Percentile Charts  ·  `M`
- **What.** For a child profile, plot weight, height, and (for infants) head circumference as CDC/WHO percentile curves for age and sex, and flag when a child crosses two major percentile bands — the specific pattern pediatricians act on.
- **Why it helps.** Parents get a raw number at each visit with no longitudinal context; a percentile crossing (50th → 15th) is a genuine growth red flag that's invisible in a plain weight line but obvious on banded curves.
- **How (our data / AI).** observations already store WEIGHT with dates; add HEIGHT/HC codes to METRIC_META, compute percentile from patient.age + sex against standard LMS reference tables, and render on the existing charts with shaded percentile bands instead of a single reference line.
- **Demo moment.** Leo's weight tracks the 60th percentile then dips toward the 25th — the chart shades the bands and flags 'crossed 2 major bands since the last visit — worth raising with the pediatrician.'


## 🤖 Agentic Assistant
*The grounded, cited AI doing real multi-step work over the record — never inventing a number.*

### 31. Deep-Dive Research Agent  ·  `L`
- **What.** A multi-step reasoning mode for open-ended questions ('why has my weight been climbing?') where the agent forms a plan, pulls multiple related metrics and meds, correlates them over time, and returns a cited synthesis with inline charts.
- **Why it helps.** The best questions aren't single-metric lookups — they need the app to actually investigate across the record, the way a thoughtful clinician would. This is the assistant doing real work, not just retrieving a number.
- **How (our data / AI).** The assistant already streams a live step-by-step trace and renders real charts by code. Extend it into a planner: decompose the question into sub-lookups (WEIGHT, BMI, GLUCOSE, HBA1C, steroid meds, thyroid), run them, reason over the joint timeline, present each step with its citation — never inventing numbers.
- **Demo moment.** Ask 'why is my weight up 22 lb since 2022?' — steps stream: pulls weight + BMI, checks glucose/HbA1c drift, finds a prednisone course and documented hypothyroidism, then answers with a charted, cited, association-only narrative.

### 32. Narrated Trends  ·  `M`
- **What.** Every metric chart gets a short, cited, plain-language story of what happened and why the line likely moved — peak, nadir, and threshold-crossing points auto-labeled on the line — generalizing the one 'LDL fell after your statin' insight to every metric.
- **Why it helps.** A line going down means nothing without the story around it. 'Your LDL dropped 34% in the 8 months after atorvastatin started' makes the number meaningful — grounded association, never a causal claim.
- **How (our data / AI).** getMetric already builds the series, related meds/conditions, an 'around' event list, and even computes the statin→LDL insight. Compute peak/nadir/first-crossing deterministically; feed the series + surrounding events to gpt-4o-mini to phrase a temporal-association caption, reusing the existing 'reports change, not causation' framing, with a rules fallback and citations.
- **Demo moment.** On HbA1c: 'Climbed from 5.8% to 6.4% across 2023, then eased to 6.1% after metformin was recorded Jan 2024.' Tapping the sentence highlights those points and the med start.

### 33. Living Insights Board  ·  `M`
- **What.** A pinnable board of insights (from the feed, trend narratives, or a deep-dive) that stay alive — a background agent re-checks each pinned question on every sync and tells you when the answer changes.
- **Why it helps.** Health questions aren't one-and-done; you want to keep an eye on your LDL. Pinning a question and having the app re-answer it as new labs arrive is the app genuinely watching your health over time, not just at the moment you asked.
- **How (our data / AI).** Reuse the conversations/reports persistence pattern to store pinned insight specs (metric code or saved query). On each cron sync, recompute them; if a value crosses a threshold or a new point lands, update the card and mark it 'new'.
- **Demo moment.** Pin 'Keep watching my LDL toward 130.' Two weeks later after an auto-sync the card updates itself: 'New reading Apr 30: LDL 118 — below target for the first time since 2021,' with the source lab.

### 34. Grounded Follow-Up Chips  ·  `S`
- **What.** After every answer, the assistant offers 2–3 tappable follow-up questions generated from your actual record, so a single question naturally becomes an investigation.
- **Why it helps.** Most people don't know the next good question to ask about their own data. Surfacing the right next move ('compare to before your statin', 'show kidney function alongside') makes the record explorable instead of a dead end.
- **How (our data / AI).** The answer action already returns structured output; add a chips field the model populates from the same grounded context (the metrics and events it just touched). Each chip is a one-tap prefilled query that reuses the existing chart/citation pipeline.
- **Demo moment.** After an LDL answer, chips appear: 'Compare to before atorvastatin', 'Show triglycerides too', 'Is my HDL protective?' — tapping continues the thread with a new cited chart.

### 35. Records-Request Drafting Agent  ·  `M`
- **What.** Turns referenced-but-missing records and dropped gaps into a specific, ready-to-send records-request letter addressed to the right organization.
- **Why it helps.** Everyone knows records are missing; almost nobody chases them because writing the request is friction. The agent naming exactly what's missing, from whom, and why, then handing you a finished letter, is it doing the annoying legwork for you.
- **How (our data / AI).** The missingRecords table already tracks referenced-but-absent items with the org and referring document. The agent composes a per-org letter citing the source note ('the 2023 ortho note references a right-knee MRI at Stanford Radiology not present in my file'), reusing the export/report pipeline for output.
- **Demo moment.** 'Missing (2)' → 'Draft request': a completed letter to Stanford Radiology for the knee MRI referenced in your 2023 ortho note — copy, download, or email.


## 🪪 Everyday Utility
*The wallet-ready, real-life moments — the ER, the new-doctor clipboard, the day-to-day management of a condition.*

### 36. Break-Glass Emergency Card & Advance-Care Vault  ·  `M`
- **What.** A wallet-sized, printable and phone-lockscreen card holding the life-critical facts an ER needs — allergies, active meds, active conditions, emergency contact, code status/advance directive, implanted devices, organ-donor status — plus a QR that opens a read-only, auto-expiring critical snapshot even when the patient can't speak.
- **Why it helps.** In an emergency the patient often can't talk, and the facts that must not be missed — the Penicillin allergy, a DNR, a pacemaker, who to call — are exactly what gets lost. It puts the safest version of the record, plus the care decisions families scramble for, in a paramedic's hands in seconds.
- **How (our data / AI).** Reuses the existing shares token + doctorSnapshot pipeline, filtered to allergies + active meds + active conditions + a lightweight care-preferences record and an uploaded directive document (reusing the documents pipeline with provenance/citation). Critically, it resolves the real allergy conflict by defaulting to the SAFEST value and flagging the disagreement, so the card never under-reports a danger.
- **Demo moment.** Scan the QR → 'PENICILLIN (rash)' in red with a 'source disagreement' badge, active meds, plus 'Emergency contact: Maria (daughter) 555-0100 · DNR on file (uploaded 2025, p.1) · Pacemaker since 2022 · Organ donor.'

### 37. New-Doctor Onboarding Packet  ·  `M`
- **What.** One tap builds a clinician-ready intake packet for a specific upcoming appointment: cover sheet (demographics, allergies, meds, conditions, PCP, pharmacy), a one-paragraph AI narrative history, the trend charts that matter for that specialty, recent labs, questions to ask, and any missing records to chase.
- **Why it helps.** The 'tell me your history' moment at a new provider is where care gaps and repeated tests are born. Handing over a tight, cited packet saves the visit and prevents the record from starting empty — and missing history harms care in ~44% of information-gap visits.
- **How (our data / AI).** Extends reports + doctorSnapshot + the share link, appointment-scoped and specialty-tailored. For Cardiology it leads with the lipid trend (peaked 171, statin-responsive to 139), BP, and the Jan-2026 ER workup, and lists the referenced-but-missing left-knee MRI to request. Cited AI narrative; FHIR write-back optional.
- **Demo moment.** Choose 'Cardiology — next Tuesday' → a 1-page packet renders with the LDL story, the ER note, and 'Questions to ask,' shareable by QR or PDF.

### 38. Your Care Team Map  ·  `M`
- **What.** A single roster of every clinician and organization that appears anywhere in the record — name, specialty, org, first/last time you saw them, what they treat you for, and what they've prescribed — assembled across all sources into one 'who's actually on my care team' view.
- **Why it helps.** Patients genuinely cannot name all their providers across a fragmented history, and no single portal can show the whole team. Seeing 'Dr. Nair (Stanford Cardiology) — last seen Mar 2026, manages your lipids, prescribed atorvastatin' is an immediate 'this app knows my life' aha, and it's the natural launch point for records requests and referrals.
- **How (our data / AI).** The schema already has a dedicated but currently unused `providers` table plus prescriber fields on medications and org/prescriber on encounters/documents. Group by provider across encounters + medications + documents; derive specialty from encounter.kind and treated conditions; every row cites the documents they appear in. Pure data transform, no model needed.
- **Demo moment.** Open 'Care Team': five cards — 'Dr. Lee, PCP (UCSF), 2019–2026, manages hyperlipidemia & prediabetes'; 'Dr. Nair, Cardiology (Stanford)'; tap one to see every visit and script tied to them, each cited.

### 39. Home-Monitoring Coach (Active Chronic-Disease Loops)  ·  `M`
- **What.** Turns passive monitoring into an active daily loop for hypertension and diabetes: log home BP or glucose in seconds, set a shared target with your clinician's goal, and get time-in-range, streaks, and a weekly 'here's your average vs goal' that interleaves with clinical labs on the same axis.
- **Why it helps.** The record watches numbers but rarely helps a person MANAGE a condition day to day — the actual work of living with diabetes/hypertension. Between quarterly labs, home readings are where the disease is won or lost; a coach that closes that daily gap is one of the most 'genuinely helpful to a real person' things possible.
- **How (our data / AI).** Reuse the wearable/home-reading import path and METRIC_META (BP, GLUCOSE supported) to accept manual/home entries with provenance patient_verified; compute time-in-range against reference bands, rolling averages, and streaks deterministically. Goal is stored per metric (optionally seeded from a clinician plan note). Weekly nudge via the existing crons.
- **Demo moment.** Log '128/82' in one tap → 'In target 6 of your last 8 mornings, avg 131/84 — down from 138 last month, closing on your <130 goal,' plotted right beside your clinic BP readings.

### 40. Med & Recheck Reminders with Calendar Export  ·  `M`
- **What.** Turns your active meds and doctor-ordered rechecks into reminders and a downloadable .ics: daily med prompts, rough refill estimates, and lab-recheck due dates you can drop straight into Apple/Google Calendar.
- **Why it helps.** 6–62% of lab results never get followed up and non-adherence is a massive silent harm. Putting the next lipid panel and the morning statin on the calendar the patient already lives in is quietly high-impact.
- **How (our data / AI).** Reads active medications (dose/start) and recheck intent parsed from encounter summaries ('recheck lipids in 3 months'); can even mark that a later Quest panel satisfied it. Generates a standards .ics; optional daily nudge via the existing crons.
- **Demo moment.** Tap 'Add to calendar' — an .ics downloads with a repeating 'Atorvastatin 10 mg, AM' event and a 'Lipid recheck due' event dated from the doctor's own plan note.

### 41. Immunization & Travel Vaccine Passport  ·  `M`
- **What.** Consolidates every vaccine across sources into one deduplicated immunization record with next-dose-due dates (Tdap 10-yr, flu annual, COVID, shingles/pneumococcal by age, childhood series), plus a travel mode that, given a destination, flags recommended vaccines you're missing.
- **Why it helps.** Vaccine records are the most scattered, most-often-requested document in real life — for schools, jobs, and travel. A clean, forecast-driven passport is an instantly recognizable 'finally, all in one place' artifact, and travel mode is a memorable demo.
- **How (our data / AI).** Model immunizations from observations/encounters/documents (or add a lightweight table on import); dedupe by vaccine, compute next-due from a curated cadence + patient.age, cite each source. Travel mode intersects a small destination→recommended-vaccine table with what's on file. Printable via the existing snapshot/PDF path.
- **Demo moment.** 'Immunizations: Tdap 2019 — due 2029; Flu — last 2024, due now; Shingles — recommended at 50, not on record.' Toggle 'Traveling to Kenya' → 'Missing: Yellow Fever, Typhoid, Hep A.'

### 42. Symptom & Episode Journal (Tied to Your Labs)  ·  `M`
- **What.** A 10-second journal for symptoms and episodes (severity + tags) whose entries land on the SAME timeline and trend x-axis as your labs and meds, so you can see a symptom next to what changed in your body or your prescriptions.
- **Why it helps.** People forget when a symptom started and how it lines up with a new pill or a lab shift — the detail a doctor most wants. This makes 'when did this start?' answerable and grounded, without ever diagnosing.
- **How (our data / AI).** New journalEntries table overlaid on MetricGraph/Timeline; the grounded assistant correlates and cites. In the demo, logging 'muscle aches' surfaces that it began ~2 weeks after Atorvastatin started — a known statin association it describes (never asserts as cause) with a 'worth mentioning to your doctor' prompt.
- **Demo moment.** Journal 'muscle aches, moderate' — it pins onto the med/LDL timeline with a callout 'started 16 days after Atorvastatin was started' and a one-tap 'add to my next visit questions.'


## 👪 Caregiver & Family
*The record's real operator is usually not the patient — build for the daughter, the parent, the whole household.*

### 43. One Account, the Whole Household  ·  `M`
- **What.** A profile switcher that lets one caregiver hold several linked records — 'Me,' 'Mom (72),' 'Leo (4)' — each with its own timeline, trends, conflicts, and grounded AI, without logging out. The foundation every other caregiver feature sits on.
- **Why it helps.** 1 in 4 adults is a family caregiver, and the person who actually builds and carries a record is usually not the patient. Today the app is strictly one-user-one-record, which designs the caregiver out of the product entirely.
- **How (our data / AI).** The patients table is already keyed by userId; extend it to allow multiple patients per user plus a relationship/role field, and thread the selected patientId through the existing per-patient queries — they already all take patientId. authz.canRead/assertWrite gain a caregiver-link branch.
- **Demo moment.** Tap a household picker to switch from your own rising-LDL record to 'Mom' — her dashboard instantly reloads her meds, labs, and open conflicts. Same app, one tap, no re-login.

### 44. Elder-Care Dashboard  ·  `L`
- **What.** A single caregiver card per elder pulling the four things a caregiver actually checks — active meds, recent out-of-range labs, open cross-source conflicts, and what's overdue — into one glanceable panel, each tile drilling to its source document.
- **Why it helps.** Caregivers juggle meds, appointments, and labs scattered across providers with no summary; 70% manage medications and say tracking is the hardest part. They need the 10-second 'is anything wrong?' view, not a records archive.
- **How (our data / AI).** Reuse the aiSnapshot aggregation; flag observations against METRIC_META (BP>130, EGFR<60, HBA1C>5.7, VITD<30), list active medications, count open conflicts, surface missingRecords. Every tile links to the source doc/page via the existing provenance drill-down.
- **Demo moment.** Open 'Mom': one screen shows 'BP 138/86 (above 130), LDL 171 and rising, 3 active meds, 1 unresolved Metformin dose conflict, Knee MRI still missing' — each cited.

### 45. Consented, Role-Scoped Caregiver Access  ·  `M`
- **What.** Invite a family member or aide to a specific profile with a role (view-only, or caregiver who can add notes and verify meds but not delete), an expiry date, one-tap revocation, and an append-only access log of who viewed what.
- **Why it helps.** Multi-profile is only safe if access is explicit and revocable. A parent granting a daughter access — or revoking a former aide — must be a first-class, auditable action, not a shared password.
- **How (our data / AI).** Generalize the existing shares token model (already patient-scoped with expiry) into per-user invites carrying a role plus an access-log table; authz gains a delegated-access branch beside the owner and share-token paths, so all existing per-patient queries respect it automatically.
- **Demo moment.** 'Invite my sister to Mom's record — can add notes, can't delete, expires in 90 days.' She accepts and sees the record; the owner watches an access-log entry appear and revokes it in one tap.

### 46. Family History That Informs Risk  ·  `M`
- **What.** A structured family-history capture (relation, condition, age of onset) that the grounded assistant folds into its reasoning, so it can contextualize the patient's own trends against first-degree history — associatively, and explicitly never as a diagnosis.
- **Why it helps.** Family history is the most under-captured high-value input in any record; a caregiver often knows 'Dad had a heart attack at 52' but nothing connects that to the patient's own rising labs where it would change urgency.
- **How (our data / AI).** Add a familyHistory table (relation, condition, onsetAge, provenance) into the aiSnapshot context the assistant already reasons over. The AI cites the record's own facts (LDL 171 rising, HbA1c 5.7) and pairs them with the entered history under the existing 'describe/associate, not diagnose' prompt.
- **Demo moment.** Enter 'Father — heart attack at 52; Mother — type 2 diabetes,' then ask about heart risk: 'your records show LDL rising to 171 and prediabetes at 5.7, alongside a first-degree history of early heart disease' — cited, not diagnostic.


## 🩺 Doctor-Facing / Point of Care
*Front-load exactly what a clinician needs in the 15-minute visit — cited, triaged, and safety-first.*

### 47. Point-of-Care Safety Banner  ·  `S`
- **What.** An always-on red/amber banner pinned to the top of the clinician view that fires only on true safety discrepancies — contradicted allergies and medication-dose conflicts — before anything else renders.
- **Why it helps.** The most dangerous data gap is a contradicted allergy; a doctor about to write an antibiotic needs 'one org charted NKDA, another has a Penicillin rash' screaming at them, not buried three panels down.
- **How (our data / AI).** Reads the existing conflicts table (kind allergy/medication_dose) already exposed in doctorSnapshot.conflicts, ranks allergy > dose > duplicate, and renders both sources with evidence-panel drill-down. No new AI.
- **Demo moment.** Sarah's snapshot opens with a red bar: 'ALLERGY DISCREPANCY — Penicillin (rash), Stanford 2023 vs "No known drug allergies", UCSF 2026 — confirm before prescribing,' plus an amber Metformin dose conflict.

### 48. SBAR Pre-Visit Brief  ·  `S`
- **What.** A four-line, triage-ordered SBAR the clinician reads in 20 seconds before walking in — Situation, Background, Assessment, and a 'verify-first' flag line — with every clause cited to its source document.
- **Why it helps.** Chart review is the largest EHR time sink and a 15-minute visit leaves no time to reconstruct 8 years across 4 orgs; a cited 4-liner front-loads exactly what matters instead of a raw record dump.
- **How (our data / AI).** New AI action modeled on generateSummaryReport but constrained to strict SBAR JSON with a validated citations array (same documentId-validation as assistant.answer), fed from doctorSnapshot's activeMeds/activeConds/trends/conflicts.
- **Demo moment.** 'S: 34F, lipid follow-up. B: Hyperlipidemia + prediabetes, on atorvastatin + metformin. A: LDL peaked 171, down to 139 post-statin but still >130; HbA1c 5.8%. Verify: Penicillin allergy vs NKDA conflict.' — every clause links to its doc.

### 49. Clinician Results Flowsheet  ·  `M`
- **What.** The results grid doctors actually think in: rows are labs (LDL, HbA1c, Weight, Vitamin D), columns are dates, each cell color-coded against its reference range with its source org, click-through to the document.
- **Why it helps.** Clinicians read labs as flowsheets, not one chart at a time; a color grid makes an 8-year trajectory legible at a glance and exposes gaps a single-metric chart hides.
- **How (our data / AI).** Pivot observations by code × date, color cells via metaFor refHigh/refLow + direction, tag each with its documentId/org for the existing evidence panel. Pure data transform, no AI.
- **Demo moment.** The grid shows LDL cells reddening 104→171 then cooling to 139, HbA1c creeping into amber at the 5.7 line, Vitamin D 18 flagged red — click the 171 cell and the Feb '26 Stanford lab opens.

### 50. Problem List with Live Control Status  ·  `M`
- **What.** A clean, deduped problem list where each condition carries its governing metric's mini-trend, latest value vs reference, and the drug treating it — 'controlled / uncontrolled' at a glance.
- **Why it helps.** A bare problem list ('hyperlipidemia, prediabetes') tells a doctor nothing about control; attaching the number, trend, and treating drug makes it actionable in seconds.
- **How (our data / AI).** Dedupe conditions by normalizedName (already done in doctorSnapshot), then join each to its metric + related med using the same relatedMeds/relatedConds logic getMetric already computes.
- **Demo moment.** 'Hyperlipidemia — LDL 139 ▲ (target <130), improving, on atorvastatin 10 mg' with a sparkline; 'Prediabetes — HbA1c 5.7% at threshold, on metformin'; 'Vitamin D deficiency — 18, on D3.'

### 51. Cross-Provider Blind-Spot  ·  `M`
- **What.** For any encounter, a panel showing which facts originated outside the treating organization — the context that team most likely did NOT have in front of them — plus, for a returning patient, the delta since that provider's own previous visit.
- **Why it helps.** Missing outside information is a documented cause of diagnostic harm; making the blind spot explicit is a visceral, one-screen argument for why a unified record matters at all. In a follow-up the only question that matters is what changed since they last saw you.
- **How (our data / AI).** For a chosen encounter, diff facts by source org/documentId against the encounter's org and date — anything charted elsewhere before that date is flagged 'likely absent at this visit.' Reuse compare()'s nearest-value-per-metric logic anchored to the provider's prior encounter date for the since-last-visit delta.
- **Demo moment.** On the Jan '26 Stanford ER chest-pain visit: 'This ED likely didn't have — UCSF cardiology dyslipidemia workup (2025), the peak-LDL 171 trend, and the prediabetes diagnosis.' For Dr. Nair: 'Since your 3/5/26 visit — LDL rechecked 139 (was 171), weight 186→184, no new meds, no ER visits.'


## 📥 Ingestion & Capture
*Get real-world paper, photos, and portals into the record effortlessly — and reconcile them the moment they land.*

### 52. Snap-a-Lab (Camera → Cited Labs)  ·  `M`
- **What.** Point your phone at a paper lab printout or a photo of a portal screen; GPT-4o Vision reads it into structured observations (canonical code, value, unit, date) and stores the photo itself as the tappable source document behind every point.
- **Why it helps.** Millions of results still arrive as paper faxes, discharge printouts, or a screenshot texted from a parent — today those never make it into any record. This is the fastest 'my data is finally in one place' moment and closes the top technical gap: our upload path is text-only.
- **How (our data / AI).** New vision branch on ingest.extractAndImport: upload to _storage, send to gpt-4o vision with the METRIC_META canonical-code list, insert facts with provenance ai_extracted + page. Each value auto-flags against its reference line and drops onto the existing Trends chart.
- **Demo moment.** Snap the Quest Aug-2025 sheet → within seconds a red LDL 164 point appears above the 130 line, VitD 18 flags 'Low', and tapping the point opens the actual photo you just took.

### 53. Reconcile-on-Ingest  ·  `M`
- **What.** The moment any new document is extracted, an engine diffs its facts against everything already in the record and surfaces contradictions — dose mismatches, allergy disagreements, duplicate diagnoses, unit clashes — as reviewable conflicts.
- **Why it helps.** This is the thing a single portal structurally cannot do and where real harm hides (a med list that says 500mg while another says 1000mg). It turns ingestion from passive filing into 'the app noticed something before my doctor did.'
- **How (our data / AI).** Runs after extractAndImport/importBundle. Compares by normalizedName (meds/conditions), substance (allergies), and canonical code + reference range, writing rows into the existing conflicts table — the same table Review already renders. Each conflict cites both source documents by page.
- **Demo moment.** Import the UCSF med list → an alert fires: 'UCSF lists No Known Drug Allergies, but your Stanford 2023 note recorded a Penicillin rash' plus a fresh Metformin 500-vs-1000 dose conflict, both one-tap resolvable.

### 54. Ambient Visit Capture  ·  `L`
- **What.** Record the appointment on your phone (or paste the transcript) and get three things: a clinician-style structured note, a friendly 'what happened / what changed / what to do next' recap, and the actual record deltas — new meds, dose changes, diagnoses, ordered labs — folded into your timeline.
- **Why it helps.** Patients forget ~half of what's said in a 15-minute visit, and nothing today captures the history-changing decisions the moment they happen. This makes the record self-updating from real life.
- **How (our data / AI).** The transcript becomes a document; GPT-4o emits the recap plus structured deltas that flow through the same insert path as extraction (provenance ai_extracted, cited to the visit doc). Every claim in the recap links back to the transcript line.
- **Demo moment.** Paste the Mar-2026 Stanford follow-up transcript → the timeline gains 'Atorvastatin 10 mg started,' a plain-language card, and the visit becomes the cited source — all from a paragraph of conversation.

### 55. Radiology & Imaging Report Reader  ·  `M`
- **What.** Parse free-text radiology/imaging reports into a structured entry — modality, body part, date, the Impression, incidental findings, and any recommended follow-up — then fold it into the timeline and resolve the matching referenced-but-missing record.
- **Why it helps.** Imaging narratives are the highest-value unstructured document and the one Apple Health can't touch. Buried follow-up recommendations ('suggest 6-month interval CT') are a leading cause of dropped care — pulling them out is genuinely protective.
- **How (our data / AI).** GPT-4o extracts Impression + a recommendedFollowUp field; create an encounter-style timeline item cited to the report page. If it matches an open missingRecords row (the demo's referenced knee MRI), flip that record to resolved and attach the impression.
- **Demo moment.** Paste the Stanford left-knee MRI report → the 'Referenced but missing: Knee MRI' gap turns green and now shows its impression ('no acute findings'), with the report as evidence.

### 56. Apple Health & Wearable Import  ·  `M`
- **What.** Import an Apple Health export, a hospital C-CDA/CCD XML, or a wearable CSV of home BP, heart rate, weight, or glucose; map to canonical codes, downsample sanely, and interleave with clinical labs on the same charts.
- **Why it helps.** Clinical labs are a few dots a year; the space between them is where health actually moves. Home readings fill that gap, and C-CDA/Apple export is the format most portals actually hand patients.
- **How (our data / AI).** Reuse the LOINC→canonical map and METRIC_META (BP, HR, WEIGHT, GLUCOSE all supported). Add an Apple Health export.xml + C-CDA parser alongside the existing FHIR-bundle importer, provenance imported, downsampled to a readable cadence.
- **Demo moment.** Drop an Apple Health export → Weight and BP trends fill in with dozens of home readings, and a home BP cluster averaging ~134/85 lines up with the Jan-2026 ER chest-pain visit.

### 57. Records Inbox (Forwarding Address)  ·  `M`
- **What.** Give each patient a private address (e.g. sarah@in.tracehealth.app); any lab PDF, visit summary, or portal email forwarded there is auto-extracted and lands in the record, tagged as arriving via email.
- **Why it helps.** The record stays fresh with zero re-uploading effort — you just forward the result email you already get. It attacks the 'empty shell' failure mode that killed every prior PHR: data has to flow in on its own.
- **How (our data / AI).** A Convex HTTP action (http.ts already exists) receives the inbound email/attachment, runs it through the vision+text extraction pipeline, and stores it with documents.receivedVia='email'. Same reconciliation + trend-plotting fires as any other ingest.
- **Demo moment.** Forward a Quest results email → moments later a toast: 'New lab filed from email: 3 values added, 1 above range,' and the new points are already on the trend, cited to the forwarded PDF.

### 58. Confirm-What-We-Read  ·  `S`
- **What.** After any AI extraction, a compact confirm card shows each extracted fact next to the exact source snippet it came from, with one-tap 'looks right' that upgrades its provenance to patient_verified, or an inline edit to fix a misread. Riskiest extractions sort first.
- **Why it helps.** AI ingestion is only trustworthy if the human can see and vouch for what was read. This is the safety layer that makes every other vision/ambient feature demo-safe, and it's the visible expression of TraceHealth's whole provenance thesis.
- **How (our data / AI).** Query facts where provenance=='ai_extracted', render each with its documents.excerpt/page. Confirming flips to patient_verified, changing its dot/pill styling everywhere; edits write a corrected value keeping the original snippet as evidence. gpt-4o-mini pre-fills a confidence hint for sorting.
- **Demo moment.** Right after Snap-a-Lab, the card shows 'LDL 164' beside the highlighted line in your photo → tap Confirm and the chart point restyles from dashed AI-extracted to solid patient-verified.


## 🔒 Trust & Provenance
*The whole wedge — every fact points to its source, and you can see which numbers to lean on.*

### 59. Source-Quote Highlight on Hover  ·  `M`
- **What.** Hovering or tapping any number pops the exact sentence from the source document with the value highlighted in place — you literally see the words the fact came from, without opening the full evidence panel.
- **Why it helps.** A citation that just names a file still asks the user to trust it. Showing the original sentence ('LDL cholesterol 154 mg/dL (H)') with the digits highlighted is the difference between 'the app says' and 'the lab report says.'
- **How (our data / AI).** We already store documents.excerpt + page and every observation links to documentId+page. A fuzzy match locates the value's span in the excerpt (fallback: gpt-4o-mini returns the char offsets). Render the snippet inline with a <mark> around the matched value.
- **Demo moment.** Hover 'HbA1c 6.8%' on the Trends chart — a mini-popover shows the highlighted line lifted straight from the Stanford Endocrine note, p.2, with a 'View full source' link.

### 60. Confidence Chip on Every Fact  ·  `M`
- **What.** A small trust badge on every lab, med, condition, and allergy composing provenance tier + cross-source corroboration + recency into a High/Medium/Low signal with a plain-English reason — expandable into the full chain of custody (source doc→page, how it entered, who verified it and when, any conflicts it was part of).
- **Why it helps.** Right now all facts look equally authoritative, but an AI-extracted allergy from a blurry fax is not the same as an LDL confirmed by both Quest and Stanford. Users and doctors need to know which numbers to lean on, and 'where did my diabetes diagnosis come from?' deserves a definitive, timestamped answer.
- **How (our data / AI).** Pure function over data we already store: map the provenance enum to a base tier, add points for corroborating observations of the same code within tolerance, subtract for age past the metric's expected cadence. Assemble the lineage from documents (org/kind/receivedVia/receivedAt) + the fact's provenance/documentId/page + conflict resolutions, backed by a lightweight append-only auditEvents table.
- **Demo moment.** Hover the LDL 122 chip: 'High — 2 sources agree (Quest 3/24, Stanford 4/24), patient-verified.' Expand Type 2 Diabetes: 'Documented in Stanford visit summary 6/12/2019, p.1 — imported via Epic OAuth sync 8/2024 — patient-verified 9/2025.'

### 61. Conflict Resolution Studio  ·  `M`
- **What.** Upgrades Review from a passive list into a side-by-side arbitration view: for each conflict, both source excerpts, dates, orgs, and provenance shown together, with a suggested pick (most recent + most authoritative) and a one-click resolve that stamps patient_verified and can write back to FHIR.
- **Why it helps.** Cross-source conflicts (Metformin 500mg per Stanford vs 1000mg per UCSF) are exactly the medication-safety errors that hurt people. Great arbitration UX makes reconciling them feel deliberate and evidence-based instead of a guess.
- **How (our data / AI).** The conflicts table already carries options[] with value/source/documentId and a resolveConflict mutation that sets patient_verified. Add the side-by-side layout pulling each option's excerpt, a recency/authority heuristic for the suggestion, and reuse existing FHIR write-back.
- **Demo moment.** Open the Metformin conflict: two source cards, 'Suggested: 1000mg (UCSF, 3 months newer).' Click resolve — the med's provenance flips to patient_verified live and the timeline updates.

### 62. Citation-Integrity Guard  ·  `L`
- **What.** A verifier pass on every AI answer that checks each sentence maps to a real citation from the record; unsupported claims are visibly withheld ('removed — no source') and each answer gets a groundedness score.
- **Why it helps.** The whole product wedge is 'every claim cited to its source.' A guard that actively refuses to state anything it can't cite makes the assistant provably safer than a general chatbot — you can trust it precisely because it withholds.
- **How (our data / AI).** The assistant already emits citations[] and a reasoning trace. Add a post-generation gpt-4o-mini check that, per sentence, confirms a supporting citation exists; strip or flag the unsupported ones and surface an 'X of Y claims sourced' badge tied to the existing citations schema.
- **Demo moment.** Ask 'Is my kidney function declining?' with sparse eGFR data — the answer states the two cited values, then shows 'Removed 1 unsupported claim about trend — not enough sourced data.' Groundedness 100%.

### 63. How Complete Is My Record? (Data Health Score)  ·  `S`
- **What.** A meta signal that grades the record's own completeness and freshness — which core domains are populated (labs, meds, allergies, conditions, immunizations, family history), what's stale, what's referenced-but-missing, what rests on unverified AI extraction — as a single score with a ranked 'fill these gaps' punch list.
- **Why it helps.** Every prior PHR died as an empty shell, and users never know how trustworthy their own record is. A completeness score reframes the app as something you actively improve, turns setup into progress, and honestly signals when a doctor should NOT rely on it yet — which paradoxically builds trust.
- **How (our data / AI).** Pure function over existing tables: coverage per domain, recency vs each metric's expected cadence, count of missingRecords rows, and share of facts still provenance=ai_extracted/unverified. Each gap deep-links to the exact fix flow (connect a source, confirm an extraction, request a missing record).
- **Demo moment.** 'Record completeness 68%: strong on labs & meds, but no immunizations, no family history, and 2 referenced records missing. 4 facts still unverified.' Tap 'Add immunizations' or 'Verify these 4' to jump straight in.

### 64. Clinician Co-Sign on the Share Link  ·  `M`
- **What.** A lightweight attestation on the read-only clinician snapshot: a doctor viewing the share link can confirm 'this active medication list is correct as of today,' stamping those facts clinician_verified with their name and timestamp.
- **Why it helps.** clinician_verified is the highest trust tier and it already exists in the schema but nothing produces it. A doctor's attestation is the strongest possible provenance and closes the loop between patient-owned data and clinical trust.
- **How (our data / AI).** The shares table + share-token read path already exist. Add a scoped write from the share view that sets clinician_verified and records the attester name/time in the audit trail. No login needed — the token authorizes the scoped confirm.
- **Demo moment.** Open the doctor snapshot, tap 'Confirm med list,' type a name — the five active meds' chips turn to a gold 'Clinician-verified 9/6/2026 · Dr. Lee' badge that persists back in the patient's app.

### 65. Physiologic & Unit Sanity Checker  ·  `M`
- **What.** An automatic plausibility check that flags values which are physiologically impossible or likely unit-mis-parsed — an OCR'd 'LDL 1540', an HbA1c of 62 that's really mmol/mol not %, a weight in kg labeled lb — and quarantines them from the trend until confirmed.
- **Why it helps.** Bad OCR and unit confusion silently corrupt trends and can drive wrong conclusions. Catching 'that number can't be real' before it pollutes a chart is a concrete safety win unique to a provenance-first record.
- **How (our data / AI).** Extend METRIC_META with plausible physiologic min/max per code (already has units + refHigh/refLow). On ingest and on demand, flag observations outside bounds or whose value fits a different common unit's range, routing them to the confirm queue with a suggested correction.
- **Demo moment.** Import a fax where HbA1c reads 62 — the checker flags 'Likely mmol/mol, not % — implies ~7.8%. Verify?' and holds the point off the trend line until confirmed.


## 📊 Visualization
*See the whole body at a glance, and watch a life's health become a story.*

### 66. Vitals Wall (Small-Multiples)  ·  `S`
- **What.** One screen of ~14 sparkline tiles — LDL, HDL, HbA1c, glucose, BP, BMI, eGFR, creatinine, Vitamin D, weight, HR — each with its reference band, latest value, in-range color, and trend arrow. The whole body at a glance.
- **Why it helps.** People never see everything at once; they tab through metrics one at a time. A single red/green wall instantly tells them (and a doctor) where to look.
- **How (our data / AI).** Reuse the existing Sparkline component in a grid, color each tile by METRIC_META.direction + refHigh/refLow, and pull latest+first from observations. Click any tile → existing full TrendChart.
- **Demo moment.** Open the wall: two tiles glow amber (eGFR trending down, LDL above ref), the rest green — click the eGFR tile and it expands to the full traced chart.

### 67. Reference Zones & Time-in-Range  ·  `S`
- **What.** Upgrades every trend chart with named, shaded clinical bands instead of a single line — BP into Normal/Elevated/Stage 1/Stage 2, HbA1c into Normal/Prediabetes/Diabetes, LDL into Optimal/Borderline/High — colors each reading by its band, and adds a headline stat: 'In target for 4 of your last 7 LDL readings.'
- **Why it helps.** '134/84' means nothing to most people; 'Stage 1 high blood pressure' and 'in target 43% of the time' mean something. Naming the zone and quantifying time-in-range turns a bare line into an at-a-glance verdict.
- **How (our data / AI).** Extend METRIC_META with an optional ordered bands array for codes with standard staging; render shaded regions behind the existing TrendChart (which already draws reference lines) and a colored status chip on cards/timeline. Compute in-range fraction over the series. Non-diagnostic labels only.
- **Demo moment.** Open Blood Pressure: the chart is banded, the 134/84 point sits in an amber 'Stage 1' zone with a 'time-in-range 43%' badge, and the same chip shows on its Needs-Attention card.

### 68. Your Health Story (Cited Scrollytelling)  ·  `L`
- **What.** An AI-generated, year-by-year narrative of the whole record — auto-chaptered ('2019: prediabetes flagged at HbA1c 6.2%', '2021: started Metformin') — that you scroll like a magazine feature while the relevant mini-chart animates and the exact readings highlight beside each paragraph.
- **Why it helps.** A record is a pile of facts; a story is what a person actually remembers and can retell to a new doctor. It turns 8 years of scattered labs/meds/visits into one coherent, human arc they finally understand.
- **How (our data / AI).** Order observations + medications + conditions + encounters by date, segment into chapters at inflection points (threshold crossings, med starts, diagnoses), and have gpt-4o write prose where EVERY sentence carries a documentId+page citation. Charts render from real series, never invented.
- **Demo moment.** Scroll 2018→2026: prose reads like a feature article, but every clause is clickable to the source page, and the HbA1c line draws itself as its chapter enters view.

### 69. One-Page Health Passport (Printable)  ·  `M`
- **What.** A print-optimized single page: identity, active conditions, active meds with doses, allergies flagged in red, 4–6 key trends as inline sparklines, a 3-sentence AI summary, and a provenance legend — every item cited, dated, and source-labeled.
- **Why it helps.** The clinician snapshot exists but a genuinely beautiful, dense one-pager is the artifact a person carries to the ER or a new specialist. It's the tangible 'my whole health on one page' moment.
- **How (our data / AI).** Upgrade the existing printable clinician snapshot with a real print layout (sparklines from charts.tsx, allergy highlighting, provenance chips) and a cited gpt-4o summary; export via the existing PDF/share-link path.
- **Demo moment.** Hit Print: a magazine-quality one-pager renders — allergies in red, meds with doses, six sparklines, last-updated stamp — that a doctor would actually keep.
