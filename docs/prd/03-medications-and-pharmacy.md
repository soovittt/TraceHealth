# PRD 03 — Medications & Pharmacy

Turn a bare drug name into: **what it is, is it safe with my other meds, what does it cost, and where do I get it.** Powers the med detail view *and* the AI agent's `drug_*` tools (PRD 04).

## Problem
A medication in TraceHealth today is a name + dose + status. Users have real questions the record can't answer: *What is this for? What are the serious warnings? Does it clash with my other meds? What will it cost me and where's it cheapest?* This is exactly the "connect to the medicine / where to get the medicine" ask.

## Goals
1. **Normalize** every med to a stable identity (RxNorm RxCUI) so everything else can join to it.
2. **Enrich**: patient-friendly description, boxed warning + key warnings, indications, NDC — from free gov APIs.
3. **Interactions**: flag serious drug-drug pairs against the user's active meds (with honest limits).
4. **Obtain**: transparent price (Cost Plus) + multi-pharmacy comparison (GoodRx) + pharmacy locator.

## Non-goals (this PRD)
- e-prescribing, prescription transfers, Surescripts fill history, delivery — gated behind credentialed prescribers/contracts. Design the schema to accept them later (PRD 05), don't build now.
- Presenting interaction data as authoritative/complete.

## Integration choices (from PRD 00) — all free & self-serve for Phase 1–2
| Layer | Source | Why | Auth |
|---|---|---|---|
| Normalization | **RxNorm / RxNav** (NIH) | The join key (RxCUI); name→concept, ingredient/brand, NDC↔RxCUI | none |
| Label/safety | **openFDA drug label + NDC** | Boxed warning, indications, dosage, warnings, adverse reactions | free key |
| Patient info | **MedlinePlus Connect** | Plain-language "what is this" by RxCUI/NDC | none |
| Full label | **DailyMed** | Full SPL, images, bulk | none |
| Interactions | **ONCHigh + CredibleMeds** (public subsets) | The only license-clean option; free RxNav DDI API is dead, DrugBank/FDB are enterprise | none |
| Price | **Cost Plus Drugs** (public API) + **GoodRx** (v2 API or affiliate deep-link) | Transparent baseline + multi-pharmacy comparison | Cost Plus none; GoodRx approval or affiliate |
| Locator | **Google Places** | "pharmacies near me / this ZIP" | key |

## Technical design

### Normalization pipeline (on med create/import)
`convex/meds/rxnorm.ts` (action):
1. `findRxcuiByString` / `getApproximateMatch(name)` → RxCUI (+ TTY).
2. `rxcui/{rxcui}/related` / `properties` → ingredient (IN), brand (BN/SBD), clinical drug (SCD), dose form, strength.
3. Persist RxCUI + ingredient onto the `medications` row (PRD 05). Ingredient RxCUI is the key for interactions and duplicate-therapy checks.

### Enrichment (cached per drug, not per user)
`medicationEnrichment` table keyed by `rxcui` with `fetchedAt` TTL. An action fills it from openFDA (label sections) + MedlinePlus (info URL) on first request; the med detail view and `drug_lookup` tool read the cache. openFDA free key raises limits to 240/min.

### Interactions (isolated + disclaimered)
`drugInteractions` table with `dataSource` + `licenseTier: "public"`. Seed from the ONCHigh high-priority DDI list + CredibleMeds QT list (bundled JSON, self-hosted). Check = pairwise ingredient-RxCUI lookups across the user's active meds. **Always** rendered behind: *"Informational, from a curated subset — not a complete interaction check. Confirm with your pharmacist."* Never compute pairwise severity from openFDA label prose.

### Pricing + locator
`drugPrices` table cached per (rxcui, quantity, zip). Cost Plus public API for the transparent number; GoodRx v2 for pharmacy comparison (or affiliate deep-link if not yet approved — zero onboarding, hands off to their coupon page). `find_pharmacy` = Google Places nearby search by chain from the price result.

### Data model (see PRD 05 for full)
`medications` gains: `rxcui`, `ingredientRxcui`, `ingredientName`, `brandName`, `genericName`, `ndc`, `route`, `frequency`, `sigText`, `prescriberNpi`, `pharmacyNcpdpId`. Derived tables: `medicationEnrichment`, `drugInteractions`, `drugPrices` — each with `source`/`licenseTier`/`fetchedAt`, purgeable independently of the user's record.

## UX
- **Med detail** (from Overview/Timeline/Review): header (brand/generic, dose, status), "What it's for" (MedlinePlus), "Serious warnings" (boxed warning collapsed), "Interactions with your meds" (chips: none/moderate/high + disclaimer), "Price near you" (Cost Plus $ + GoodRx compare + "pharmacies near me").
- **AI**: the `drug_lookup` / `drug_interactions` / `drug_price` tools surface the same data conversationally (PRD 04).
- **Safety banner** integration: an active-med × allergy or high-severity interaction escalates into the existing "Needs your attention" signals.

## Risks
- **Interaction licensing trap** (the big one): free comprehensive DDI is gone. Mitigate with public subsets + disclaimer + isolated table; upgrade to a licensed vendor only when funded.
- **RxNorm mismatch** on messy names → show resolved canonical name + confidence; let user correct (ties into agent confirm card).
- **GoodRx approval latency** → ship affiliate deep-link first, swap to API when approved.
- **Rate limits** → cache aggressively in the derived tables (per-drug, not per-user).

## Success metrics
- % meds successfully RxNorm-normalized.
- Med-detail opens; interaction warnings surfaced; price lookups.
- Allergy/interaction signals that led to a user action (verify/stop).

## Phasing
- **P1:** RxNorm normalize + openFDA/MedlinePlus enrichment on every med; med detail view; `drug_lookup` tool.
- **P2:** interactions (ONCHigh/CredibleMeds) + escalate to signals; `drug_interactions` tool.
- **P3:** pricing (Cost Plus + GoodRx) + pharmacy locator; `drug_price` / `find_pharmacy` tools.
- **Later:** Surescripts fill history, e-Rx (DoseSpot/Photon sandbox → prod).

### Sources
RxNorm [rxnav.nlm.nih.gov/RxNormAPIs.html] · openFDA [open.fda.gov/apis/drug/label, /apis/authentication] · MedlinePlus Connect [medlineplus.gov/medlineplus-connect/web-service] · DailyMed [dailymed.nlm.nih.gov] · GoodRx [goodrx.com/developer] · Cost Plus [costplusdrugs.com] · DDI API discontinued [lhncbc.nlm.nih.gov/RxNav/news/APIUpdate.html] · DrugBank free checker retires Mar 25 2026 [blog.drugbank.com].
