# TraceHealth — 3-minute demo (travel / cross-border angle)

**Hook:** You take your passport everywhere — but not your health record. Different countries, different clinics, different systems that don't talk to each other. TraceHealth makes your record travel with you: one record you own, that you can hand to any doctor, anywhere, in seconds.

**Pre-flight:** Sign in → record is empty (already wiped). Keep `~/Desktop/tracehealth-sample-records` open (04-fhir-bundle.json, 03-labcorp-lab-report.pdf, 01-quest-lab-report.txt). Dry-run once so the PDF timing feels smooth.

~430 words ≈ 3:00.

---

## 0:00–0:25 · The problem
> "When you travel, your health follows you — but your records don't. Every country, every clinic keeps its own file, in its own format, on a portal you'll never log into again. So when you land somewhere new and need a doctor, they start from zero."

*(On screen: empty Overview.)*

> "TraceHealth fixes that. One record, from everywhere, that you actually own — and can share instantly."

## 0:25–1:05 · Bring it together (Add data)
> "First, pull it all in. It doesn't matter what format a country gave you."

- Drop **04-fhir-bundle.json** → "A hospital export — imported exactly."
- Drop **03-labcorp-lab-report.pdf** → "A PDF lab report from another clinic — the AI reads it in the background." *(Point at live status: Reading → Extracting → Added.)*

> "PDFs, photos, FHIR, plain text — different systems, one dropzone. And every fact traces back to its source."

*(Open **History** tab briefly.)*
> "Here's the audit trail — every source, and exactly what it added."

## 1:05–1:40 · One record, no matter where it came from
> "Now it's a single record."

- **Timeline** — "Every visit and lab across every country, one feed."
- **Trends → LDL** — "Different labs, different units, different codes for the same test — we normalize them into one metric and one trend line."
- **Compare** — "Then-versus-now across any years — what changed while you were away."

## 1:40–2:10 · Ask it anything (⌘J)
Type: **"What should a new doctor know about me?"**
> "It's an AI grounded in *my* record — watch it reason over my trends, flag what's out of range, and pull the key history. Every claim cites the source document, and general medical facts cite trusted sources — nothing made up. It even renders my real charts inline."

## 2:10–2:45 · Share with any doctor — the travel payoff
Sidebar → **Share with clinician → Preview snapshot** (opens a clean, read-only clinical snapshot).
> "This is the part that matters when you're abroad. Instead of asking a new doctor to integrate with your old country's system — which never happens — you just hand them a link. Read-only, no account, no portal. Allergies and red flags up top, meds, conditions, trends, every item linking to its source. On the shared link they even get a record-scoped AI and an SBAR brief for triage."

## 2:45–3:00 · And it's portable, in standard formats
Sidebar → **Export record → Document / FHIR**.
> "Or export the whole thing as a formatted document, or a **FHIR** bundle any hospital system on earth can read — so your record is never locked in one country again."

> "Your health, in one place, that travels with you and any doctor can understand. **That's TraceHealth.**"

---

## Recording
- macOS `⇧⌘5` (free) or Screen Studio / OBS. Maximized browser at 1280–1440 wide, Do Not Disturb on.
- Pause ~1s after each screen change. During the PDF read, keep talking (the "background job" / "AI reads it" line covers the wait).
