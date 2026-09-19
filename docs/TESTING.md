# Thread — UI Testing Walkthrough

A step-by-step guide to navigating and testing every screen. Follow it top to
bottom; it mirrors the 3-minute demo.

---

## 0. Start the app

You need **two processes**: the Convex backend and the Vite frontend.

```bash
# from the project root
npm run dev:all
```

That runs both together. When you see `Convex functions ready!` and Vite's
`Local: http://localhost:5173/`, open **http://localhost:5173** in your browser.

> If `npm run dev:all` complains, run them in two terminals:
> `npx convex dev` in one, `npm run dev` in the other.

**One-time (optional):** the paste/upload import uses OpenAI. Without a key the
rest of the app still works fully (the demo patient needs no key). To enable it:
```bash
npx convex env set OPENAI_API_KEY sk-...
```

You can inspect/edit data directly anytime in the Convex dashboard (URL printed
by `npx convex dev`).

---

## 1. Landing page

**What you see:** "Your doctors have records. Thread gives you a history." with
two buttons and three feature cards.

**Test:**
1. Confirm the headline, the blue **Upload records** button, and the
   **Try the demo patient →** button render.
2. The three cards fade up in sequence (staggered animation).

➡️ Click **Try the demo patient →**.

---

## 2. Import / live processing

**What you see:** "Building your health history…" with a checklist that fills in
one row at a time (Reading 10 documents → Encounters → Lab results →
Medications → Conditions → Providers → Relationships → Conflicts). Each row
flips from a spinner to a green check with a count.

**What to verify:**
- Rows complete sequentially (this is Convex `ctx.scheduler` driving real-time
  updates — the counts come from the database, not hardcoded in the UI).
- When done, the title becomes **"Your health history is ready"** and three stat
  tiles appear: **8 years**, **26 lab results**, **10 encounters**.

➡️ Click **View your health →**.

---

## 3. Health Home

**What you see:** "Your health" header (Sarah Williams · 34 · records 2018–2026 ·
4 organizations), an amber **"⚠ 3 records need review"** pill, a **Key trends**
row of 4 cards, **Recent events**, and **Current medications**.

**Test each element:**
1. **Trend cards** (LDL, HbA1c, Weight, Vitamin D): each shows the latest value,
   a % change with ↑/↓ in red (bad) or green (good), and a sparkline.
   - LDL should read **139** with an overall ↑ from 104.
2. Hover a card — it lifts slightly. **Click the LDL card** → goes to the graph
   (covered next). Come back with the sidebar.
3. **Recent events** list: click any row → the **evidence panel** slides in from
   the right (see §9).
4. **Current medications**: Atorvastatin, Metformin, Vitamin D3. Click one → its
   source evidence opens.
5. Click the amber **"3 records need review"** pill → jumps to Conflicts (§7).

**Left sidebar:** Health, Timeline, Graph, Compare, Conflicts, plus a blue
**Share with Doctor** button pinned at the bottom. Click through each nav item.

---

## 4. Timeline

**Sidebar → Timeline.**

**What you see:** a vertical timeline grouped by year (2018 → 2026). Each year
shows measurement chips (e.g. "LDL Cholesterol 104 mg/dL") and event cards
(visits, Rx starts, diagnoses) with colored badges (Visit / Rx / Dx).

**Test:**
1. Scroll the full 8 years. Confirm the story reads chronologically:
   2018 baseline → 2023 new PCP → 2025 hyperlipidemia + metformin →
   2026 statin started → 2026 LDL down to 139.
2. **Filter chips** (All / Visits / Labs / Medications / Conditions): click each
   and confirm the list narrows accordingly.
3. Click a **measurement chip** → opens that metric's graph.
4. Click an **event card** → opens its source evidence.

---

## 5. Relationship Graph (the hero screen)

**Sidebar → Graph**, or click any metric anywhere. Defaults to **LDL**.

**What you see:**
- A metric switcher row (LDL, HbA1c, Weight, Vitamin D).
- Big value readout: **104 → 171 → 139**.
- A **trend chart** with plotted points, an amber dashed reference line
  (130 mg/dL), and a vertical marker where **Atorvastatin** started.
- A green **"What your records show"** insight box:
  *"LDL Cholesterol decreased 19% in the months following the recorded
  Atorvastatin start."* (Note: it says *following*, not *caused by* — defensible.)
- A **constellation graph**: LDL in the center with related nodes orbiting
  (HbA1c, Weight, Vitamin D, Metformin, Atorvastatin, Hyperlipidemia,
  Prediabetes…), connected by lines.
- A **"Timeline around this change"** list on the right.

**Test:**
1. **Click any point on the trend line** → evidence panel opens showing the exact
   source document and page for that lab value (e.g. click **171** →
   `Stanford_Labs_Feb_2026.pdf`, page 3).
2. In the constellation, **click a blue metric node** (e.g. HbA1c) → the whole
   graph reorganizes around that metric.
3. **Click a green medication node** or **amber condition node** → opens its
   source evidence.
4. Switch metrics with the top chips and confirm each redraws (Weight is neutral,
   no reference line; Vitamin D is "low is bad").

This is the moment Thread stops being a record viewer and becomes a health graph.

---

## 6. Compare periods

**Sidebar → Compare.**

**What you see:** two year dropdowns ("From" / "To", defaulting to 2018 → 2026)
and a **"What changed?"** report.

**Test:**
1. Set **From = 2023**, **To = 2026**.
2. Confirm the **Measurements** table shows each metric's from → to value with a
   colored % badge (or "Stable").
3. Confirm the four cards populate: **New conditions** (Hyperlipidemia,
   Prediabetes, Vitamin D deficiency), **New medications** (Metformin,
   Atorvastatin, Vitamin D3), **New providers** (UCSF, Quest Diagnostics),
   **Major events** (Cardiology consult, Emergency — chest pain).
4. Change the years and watch the whole report recompute live.

---

## 7. Conflicts + verification

**Sidebar → Conflicts.**

**What you see three sections:**

**A. Records requiring attention** — three conflict cards:
- **Medication discrepancy — Metformin**: Stanford 1000 mg vs UCSF 500 mg.
- **Allergy conflict — Penicillin**: Stanford allergy vs UCSF none.
- **Duplicate condition**: "High cholesterol" = "Hyperlipidemia".

**Test:**
1. On the Metformin card, click **"View source"** on either option → opens that
   record's evidence.
2. Click **"This is correct"** on one dose → the card flips to a green
   **"✓ Resolved: …"** badge, and the chosen dose is applied to the medication
   (its provenance becomes *patient verified*).

**B. Help clean up your health history** — "Is [medication] still active?" with
Yes / No.
3. Click **Yes** or **No** on a medication → the row disappears (it's now
   patient-verified). Answer all → "All medications verified 🎉".

**C. Missing from your history** — **Knee MRI (left)**, Stanford Radiology, with a
**"How to obtain this record"** block.
4. Click **"See reference"** → opens the UCSF note that mentions the MRI
   ("MRI … from Stanford Radiology dated 05/14/24").

---

## 8. Doctor View (second wow moment)

**Click "Share with Doctor"** (bottom of the sidebar).

**What you see:** a modal with a temporary share link (`…#/share/<token>`) and a
**"Preview doctor view →"** button.

**Test:**
1. Click **Preview doctor view →**. You get a clean, compressed **Clinical
   Snapshot**: patient header, an amber conflicts banner, Current medications,
   Active conditions, Allergies, Care organizations, **Significant longitudinal
   changes** (LDL 104 → 171, most recent 139; etc.), and **Recent medical
   history**.
2. Click any item (a medication, a condition, a history line) → its source
   evidence opens. Everything is traceable.
3. Click **"← Back to patient view"** to return.
4. **Test the real share link:** copy the link from the modal, open it in a new
   tab (or paste after clicking Copy). It loads the same doctor snapshot with
   **no login** — this is what a physician receives. (Links expire after 7 days;
   an invalid/expired token shows a friendly message.)

---

## 9. Evidence panel (works everywhere)

Any clickable fact opens the right-side **Source evidence** panel:
- Organization + date, File / Page / Via metadata.
- The **original record** text with a PDF-style header.
- Closes via the ✕ or by clicking the dimmed backdrop.

**Test:** open it from at least three different screens (a trend point, a
timeline event, a doctor-view row) and confirm the source matches the fact.

---

## 10. Live email import (real-time update)

In the app header (top bar) there's a **"✉ Email a new lab"** button. This
simulates forwarding a lab to `records@my.thread.health`.

**Test — this is the real-time showcase:**
1. Open the **LDL graph** (§5) and note the last point is **139**.
2. Click **✉ Email a new lab** in the header.
3. A toast appears: **"New record added · Quest Diagnostics · 3 measurements."**
4. **Without refreshing**, the LDL trend gains a new point (**128**), Home's
   trend cards update, and the timeline gains a Sep 2026 entry — all pushed live
   by Convex subscriptions.

---

## 11. Search (navigation through your history)

Use the search box in the top bar.

**Test each query type:**
- Type **`cholesterol`** (or `ldl`) → result offers **"Open the LDL trend
  graph"**; click it → jumps to the graph.
- Type **`2024`** → reconstructs 2024 (encounters + lab counts, "Open full
  timeline").
- Type **`metformin`** → shows it under Medications.
- Type **`knee`** → surfaces the missing **Knee MRI** under "Missing records".

---

## 12. Upload / paste import (optional, needs OpenAI key)

From Landing → **Upload records** (or the Import screen's uploader):
1. Paste a snippet, e.g.
   `Quest Diagnostics, 2027-01-10. LDL 121 mg/dL. HbA1c 5.5%. Weight 179 lb.`
2. Click **Extract with AI**. OpenAI (`gpt-4o-mini`) parses it into structured
   events and inserts them (provenance = *AI extracted*).
3. A result line reports the counts; the new facts appear in the graph/timeline.

> Requires `OPENAI_API_KEY` set on the backend (§0). The demo patient path does
> not need it.

---

## Reset / fresh demo

Loading the demo again wipes and reseeds it cleanly:
- Landing → **Try the demo patient →** resets everything (including any email
  imports or resolved conflicts) to the pristine 8-year story.

---

## Quick "everything works" checklist

- [ ] Demo loads with the live processing animation
- [ ] Home shows 4 trend cards; LDL = 139
- [ ] Timeline spans 2018–2026 with filters
- [ ] LDL graph: click a point → evidence; click a node → graph reorganizes
- [ ] Insight sentence says "following" (not "caused by")
- [ ] Compare 2023→2026 lists new conditions/meds/providers/events
- [ ] Conflicts: resolve Metformin dose; verify a medication; see missing MRI
- [ ] Share with Doctor → snapshot; open the share link in a new tab
- [ ] Evidence panel opens from multiple screens
- [ ] "✉ Email a new lab" updates the LDL graph live
- [ ] Search: cholesterol / 2024 / knee behave correctly
