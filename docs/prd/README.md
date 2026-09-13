# TraceHealth — Integration & Platform PRDs

TraceHealth today is a **read + reconcile + share** health record built on Convex, with one real data path (SMART on FHIR sandbox), AI extraction, a grounded chat agent, reports, and clinician sharing. These PRDs plan the jump from *viewer* to **integrated health platform**: pull from many real sources, understand medicine, and let the AI *do things*, not just answer.

## The thesis
Everything hangs off three moves:
1. **Get more data in, from real sources** — clinical records networks, insurance claims, wearables, Apple Health.
2. **Make the data actionable** — enrich medications (what it is, is it safe, where to get it, what it costs), interactions, pricing.
3. **Let the AI act** — create/edit records, request records, set schedules, look up drugs — with user confirmation.

## The PRDs
| # | PRD | What it unlocks | Hackathon-feasible primary? |
|---|-----|-----------------|-----------------------------|
| [00](00-integrations-research.md) | Integration landscape (research) | The map: every option, ranked, sourced | — |
| [01](01-clinical-records-and-claims.md) | Clinical records + claims networks | Real records from 50k+ providers via **Fasten Connect**; Medicare claims via **Blue Button 2.0** | ✅ Fasten (free sandbox, no BAA) + Blue Button (free) |
| [02](02-wearables-and-apple-health.md) | Wearables + Apple Health | Steps/HR/sleep/glucose/weight via one **aggregator (Vital/Terra)** + **Apple Health XML import** | ✅ Apple XML import; aggregator = fast follow |
| [03](03-medications-and-pharmacy.md) | Medications + pharmacy | Every med enriched (RxNorm/openFDA/DailyMed/MedlinePlus), interactions, price + where to buy (Cost Plus/GoodRx) | ✅ All-free enrichment core |
| [04](04-ai-agent-actions.md) | AI agent write-actions | "Add a medication", "log a symptom", "request my records", "explain & price this drug" — the agent *does* it | ✅ Builds on existing tool loop |
| [05](05-data-model-evolution.md) | Data-model evolution | The schema changes that make 01–04 possible (device observations, immunizations, claims, coverage, consents, med enrichment, multi-source provenance + dedup) | ✅ Incremental, additive |

## Phased roadmap (recommended build order)
**Phase 1 — "Real data + the agent acts" (hackathon-shippable):**
- Data model: make `documentId` optional on facts; add `immunizations`; stamp `sourceNetwork`/`sourceConnectionId` (PRD 05, minimal slice).
- **Fasten Connect** clinical records + **Blue Button 2.0** Medicare claims (PRD 01) — keep SMART sandbox as the demo.
- **Medication enrichment core**: RxNorm → openFDA → MedlinePlus, on every med (PRD 03, Phase 1).
- **AI agent actions**: add/edit medication, add observation/condition/allergy, log symptom, "explain & price this drug", "request my records" (PRD 04, Phase 1). This is the highest-wow, lowest-cost differentiator.

**Phase 2 — "Understand your body over time":**
- **Apple Health XML import** (PRD 02) + `deviceObservations` + daily summaries (PRD 05).
- **Drug pricing + pharmacy locator** (Cost Plus + GoodRx affiliate + Google Places) (PRD 03, Phase 3).
- **Claims → cost/utilization timeline** UI (PRD 01).

**Phase 3 — "Full platform":**
- Unified **wearable aggregator** (Vital/Terra) (PRD 02).
- **Commercial claims** (Flexpa) + **Metriport** self-host (PRD 01).
- Companion iOS app for live Apple Health / Health Connect (PRD 02).
- e-prescribing / med history (DoseSpot/Photon/Surescripts) once credentialed (PRD 03).

## Hard constraints threaded through everything
- **HIPAA/BAA:** Fasten Connect + Blue Button run on the patient's access right → **no BAA burden**. Enterprise aggregators (Particle, Zus, 1up, Health Gorilla prod, Metriport prod) require a signed BAA — post-hackathon only. For the hackathon, prefer sandbox/synthetic data end to end.
- **Interaction-data licensing trap:** the free RxNav DDI API is gone (Jan 2024); DrugBank's free checker retires Mar 25 2026; FDB/Medi-Span/DrugBank are five-figure enterprise. Ship interactions from public subsets (ONCHigh + CredibleMeds) behind a clear "not a complete check — ask your pharmacist" disclaimer, in an isolated `drugInteractions` table with a `licenseTier` flag.
- **Secrets:** every API key via `npx convex env set` — never in files or logs.
- **Provenance stays sacred:** every new fact still traces to a source; multi-network means we now also stamp *which network/connection* produced it, and dedup across overlapping sources.
