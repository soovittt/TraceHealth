# PRD 06 — Deeper Firecrawl Embedding

## Where we are
`convex/firecrawl.ts` uses exactly one endpoint — **v1 `/search`** → pick a trusted-domain result → summarize with OpenAI → cite the URL. It powers the chat `reference_lookup` tool and `explainMetric`/`clinicalBrief`. That's grounding-as-a-paragraph. Firecrawl can give us **typed data we render as cards and store**, and **proactive change alerts** — same citation guarantee, far more product.

## The two unlocks we're missing
1. **`/v2/extract`** — LLM structured extraction across one/many URLs or a whole domain (`site.com/*`), driven by a **JSON schema** + prompt, with optional `enableWebSearch`. Returns typed JSON that drops straight into Convex. This is the big one.
2. **Change tracking + Monitor** — re-check a page on a schedule, get `changeStatus: new|same|changed|removed` with schema-scoped diffs → proactive **recall / drug-shortage alerts**. Nobody's PHR does this.

Also worth adopting: **`/v2/scrape`** with `formats:["json","summary","screenshot"]` + `onlyMainContent` (handles PDFs/images natively, `maxAge` caching), and **actions** (click/scroll/type) for ZIP-gated pages.

> Migration note: move off v1 `/search` to **v2** (`api.firecrawl.dev/v2/...`). Keep sending ONLY public topic terms — never patient data. 20k hackathon credits is plenty (scrape 1cr, extract 1cr/page, json/summary +4, change-tracking-json 5); cache with `maxAge` so repeats are near-free.

## Ranked features
| # | Feature | Endpoint | Schema/params sketch | Effort | Ties to |
|---|---|---|---|---|---|
| 1 | **Live drug price card** | `/v2/extract` | urls: Cost Plus (`costplusdrugs.com/medications/*`) + GoodRx; schema `{drugName, prices:[{pharmacy,price,quantity,asOf}], genericAvailable, sourceUrl}`; `enableWebSearch` | 2 | PRD 03, PRD 04 `drug_price` |
| 2 | **Paste a lab/portal URL → structured record** | `/v2/scrape` `formats:["json","markdown","screenshot"]` `onlyMainContent` | schema: labs `[{testName,value,unit,referenceRange,flag,collectedAt}]`; screenshot = provenance thumbnail | 3 | Add data (new source), PRD 05 |
| 3 | **Lab reference-range + plain-English explainer** | `/v2/extract` on `medlineplus.gov/lab-tests/*` | `{testName,whatItMeasures,normalRange,highMeaning,lowMeaning,sourceUrl}` | 2 | Trends "Explain this" |
| 4 | **Recall & drug-shortage Monitor** | `/v2/scrape` `formats:["changeTracking","json"]` (or Monitor) via Convex cron | `{drugName,status:"shortage|recall|resolved",reason,updatedAt}`; alert on `changed` | 3 | Signals, PRD 03 |
| 5 | **"Am I due for screenings?" panel** | `/v2/extract` on USPSTF + `cdc.gov/vaccines/schedules/*` | `{recommendation,population:{ageMin,ageMax,sex},grade,frequency,sourceUrl}` → filter by user age/sex | 2 | Overview/Signals |
| 6 | **Provider/clinic/pharmacy lookup** | `/v2/search` (`location`) + `scrapeOptions.json`, or `/v2/extract` on a directory | `{name,specialty,address,phone,acceptingPatients,hours,sourceUrl}` | 3 | PRD 03 `find_pharmacy`, PRD 04 |
| 7 | **"My doctor sent this article" → cited takeaways** | `/v2/scrape` `formats:["summary","json"]` | `{title,keyPoints[],recommendedActions[],cautions[],sourceUrl}` | 2 | Chat, Add data |
| 8 | **Trusted-source KB via Crawl** (pre-demo) | `/v2/crawl` `includePaths` + webhook → embed in Convex | markdown per page → RAG for chat, fully cited, no live call per turn | 4 | Ask AI grounding |

## Quick wins for the demo (high wow / low effort / good credit use)
1. **Paste-lab-URL → structured record (#2):** messy page/PDF → clean typed labs + a source screenshot. Dramatic. ~5 cr.
2. **Live drug price card (#1)** off Cost Plus (flat price, no ZIP): a real dollar amount pulled live. Judges love concrete numbers. ~1–2 cr.
3. **Screening panel (#5):** pre-extract USPSTF/CDC once into Convex (~hundreds of cr), then filter by the demo user's age/sex live — feels like magic, ~free at demo time.
4. **Recall alert (#4):** pre-seed one med's shortage/recall status so a real alert badge shows. Proactive-safety is a strong differentiator. ~5 cr.

## Why each beats search-only
Every one returns **typed JSON with a `sourceUrl`** you render as a card and persist — vs today's "search → summarize a paragraph." Same grounding + citation discipline, far better UX and reusability.

## Safety framing (unchanged rules)
- Only ever send public topic terms to Firecrawl — never patient data.
- All outputs are **informational, cited, non-diagnostic**; scraped clinical values land as **unverified/self-reported** until reconciled (Review).
- Scoped to public/shared pages + PDFs — authenticated portal pages won't scrape.

### Sources
Extract [docs.firecrawl.dev/features/extract] · Scrape [/features/scrape] · Crawl [/features/crawl] · Search [/features/search] · Change tracking [firecrawl.dev/blog/...change-tracking] · FIRE-1 [firecrawl.dev/blog/...fire-1] · Pricing [firecrawl.dev/pricing] · LLM extract [docs.firecrawl.dev/features/llm-extract].
