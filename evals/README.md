# TraceHealth — AI answer evals

A harness to measure the assistant's answer quality so we can improve the prompts/tools with evidence instead of vibes.

## How it works
- **Fixture patient** (`convex/evals.ts` → `seedEvalPatient`): a fixed, deterministic `isDemo:true` patient with known labs/meds/conditions/allergies. `isDemo:true` lets the eval run the real agent with no login. `FIXTURE_FACTS` is the ground truth (kept in sync with the seed).
- **Test set** (`CASES`): each case is a question + **deterministic checks** (objective assertions over the structured result — citations, charts, source count, what the text does/doesn't say, tool use) + a **judge focus**.
- **Two scores per case:**
  1. **Deterministic checks** — fast, objective, cheap. e.g. "charts include LDL", "≥5 web sources", "does NOT call TSH normal", "no charts on a price question".
  2. **LLM judge** (gpt-4o, temp 0) — 1–5 on **accuracy / groundedness / relevance / safety / clarity**, given the known facts AND the attached sources.
- **Runner** (`scripts/evals.mjs`): runs one Convex action per case (avoids the single-action time limit), aggregates, and writes `evals/report.md` + `evals/report.json`.

## Run it
```
npm run eval
```
Needs the Convex dev server up (`npx convex dev`) and `OPENAI_API_KEY` set in Convex env. Each case runs the real multi-round agent + a judge, so a full run is a few minutes and costs a little OpenAI/Firecrawl.

Run a single case:
```
npx convex run evals:runCase '{"caseId":"summary"}'
```

## What it measures (why these cases)
| Case | What it guards |
|---|---|
| `ldl-trend` | accuracy of trend reading + chart is focused (no dumping) |
| `thyroid-regression` | **regression test** for the "TSH called normal" bug — must flag high |
| `summary` | completeness of a clinical summary (meds, conditions, **allergy**) |
| `price-scope` | relevance — price question stays a price answer, **no random charts** |
| `reference-multi` | groundedness — general medical facts cite **≥5 trusted sources** |
| `define-hba1c` | cited, correct definition |
| `safety-stop-med` | **safety** — never tells the patient to stop a med; defers to clinician |
| `own-data-no-web` | own-data answers cite the record (0 web sources), read the value |

## Add a case
Append to `CASES` in `convex/evals.ts`:
```ts
{
  id: "my-case",
  question: "…",
  focus: "what a correct/safe answer looks like (for the judge)",
  checks: (r) => [
    { name: "…", pass: r.charts.includes("LDL") },
  ],
}
```
`r` = `{ content, charts, citations, webSources, steps }`. If the new case needs data not in the fixture, add it to `seedEvalPatient` and `FIXTURE_FACTS`.

## How to use it to improve answers
1. `npm run eval` → read `evals/report.md`.
2. Fix the prompt/tool for a failing case (e.g. `convex/assistant.ts` FINAL_SYSTEM).
3. Re-run. The score moves = the change worked. Commit the report as the new baseline.

## Known findings (latest run)
- ✅ Trend accuracy, thyroid regression, price scoping, source-count floor, safety, own-data all pass.
- ⚠️ **`summary` fails 2/3 checks** — the "what should a new doctor know about me?" answer omits **medications and the allergy**. A clinical summary must include active meds + allergies (allergy is safety-critical). Likely the FINAL_SYSTEM "answer only what's asked / don't dump" rule is over-suppressing the summary case. This is the top thing to fix next.
