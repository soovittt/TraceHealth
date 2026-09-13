# PRD 01 — Clinical Records & Insurance Claims

Go from "SMART sandbox only" to **real records from 50,000+ providers** and **insurance claims**, with the least per-provider work and no BAA burden.

## Problem
TraceHealth's only real data path is a SMART-on-FHIR *sandbox*. To be useful, a user must pull their *actual* records — but every hospital runs its own EHR instance, and connecting each is per-org work. And no PHR shows **insurance claims** (cost + utilization over time), which are a differentiating timeline layer.

## Goals
- One integration that retrieves a user's records across **Carequality + CommonWell (+ TEFCA)** — labs, meds, conditions, encounters, allergies, immunizations, documents/C-CDA.
- **Medicare claims** (free) and a path to **commercial claims**.
- Keep the SMART sandbox as the zero-friction demo connection.
- Every retrieved fact stamped with **which network/connection** produced it, and **deduped** across overlapping sources.

## Non-goals
- Enterprise aggregators requiring a signed BAA (Particle, Zus, 1up, Health Gorilla prod, Metriport prod) — post-hackathon.
- Direct per-org Epic/Cerner go-lives for broad coverage (that's what the aggregator replaces).

## Integration choices (from PRD 00)
| Need | Pick | Why | Access |
|---|---|---|---|
| Broad clinical records | **Fasten Connect** | Self-serve free sandbox, 50k+ orgs via patient-portal OAuth + TEFCA, full USCDI **+ some claims**, **runs on patient access right → no BAA** | Dev portal, test/live |
| Medicare claims | **CMS Blue Button 2.0** | Instant sandbox (synthetic EOBs), free prod w/ CMS app approval | Self-serve |
| Commercial claims (later) | **Flexpa** | 350+ payers, CARIN FHIR; **test mode free**, prod $20k/yr | Test now, pay later |
| Records (self-host, later) | **Metriport** | Open-source, CommonWell+Carequality; prod needs BAA | OSS + sandbox |

**Why Fasten as primary:** it's essentially "SMART on FHIR with the per-provider registration + network querying done for you" — our existing OAuth mental model transfers directly, and it's the only broad option that's free/self-serve with no BAA.

## Technical design

### Connection model
Generalize the existing `connections` table (currently one SMART OAuth link) to describe an **aggregator connection** (PRD 05): `aggregator` ("fasten" | "bluebutton" | "smart-sandbox"), `kind` ("clinical" | "claims"), `networks`, `externalConnectionId`, `identityAssuranceLevel`.

### Fasten Connect flow
1. Client opens Fasten Connect widget → user logs into *their* provider portal (SMART OAuth) → Fasten returns a connection id.
2. `convex/integrations/fasten.ts` action: exchange, pull FHIR R4 bundles (paged), map resources → our tables via the existing `insertFhirBundle` path (extend for `Immunization`, `DocumentReference` C-CDA), stamp `sourceNetwork`/`sourceConnectionId`.
3. Background **sync job** (Convex scheduler) like the current auto-sync cron; reactive UI shows progress.

### Blue Button 2.0 flow
OAuth via Medicare.gov; pull `ExplanationOfBenefit` + `Coverage` → new `claims` / `coverage` tables (PRD 05). Sandbox first (synthetic), then request CMS prod approval.

### Dedup (now mandatory)
Pulling the same patient from Carequality *and* CommonWell *and* a direct link returns overlapping records. Key dedup on `fhirResourceId` + `sourceSystem`, then a fuzzy pass on (code/name + date + value). Reuse existing `normalizedName` + the med-dedup logic; extend to labs/conditions. Surface unresolved dupes in **Review** (existing conflicts surface).

## UX
- **Connections** page: cards for **SMART sandbox** (demo), **Fasten Connect** ("Connect your real providers"), **Medicare (Blue Button)**, **Insurance claims (Flexpa — coming soon)**. Each shows status, last sync, networks, record counts.
- **Claims → timeline**: a new event type renders claims (visit, cost, what insurance paid vs you owed) inline in Timeline — the cost/utilization layer EHR-only PHRs lack.
- **Consent surfacing**: show the user exactly what was authorized, for how long, and a **revoke** button (backed by a `consents` table, PRD 05).

## Risks
- **HIPAA/BAA:** Fasten + Blue Button are patient-access-right (no BAA). Any enterprise aggregator is BAA-gated — explicitly out for hackathon. Storing real PHI means Convex now handles PHI → for hackathon prefer synthetic/sandbox end-to-end behind a consented, minimal-scope flow.
- **Data completeness varies** (document-derived) → set expectations; show source + retrieval date per record.
- **IAL2 identity proofing** for TEFCA IAS → Fasten handles; note the friction.
- **Dedup correctness** → conservative merge, surface conflicts to Review rather than auto-collapsing.

## Success metrics
- Real providers connected per user; records retrieved; % deduped.
- Claims connected; claims rendered on timeline.
- Sync success rate; time-to-first-record after connect.

## Phasing
- **P1:** `connections` generalization + `immunizations`/`claims`/`coverage`/`consents` tables (PRD 05, minimal). **Fasten Connect** sandbox → records. **Blue Button 2.0** sandbox → claims. Keep SMART sandbox demo.
- **P2:** claims→timeline UI; dedup across networks → Review; consent/revoke UI; Fasten live mode.
- **P3:** Flexpa commercial claims (test→prod when funded); Metriport self-host; direct Epic/Cerner prod for marquee systems.

### Sources
Fasten [fastenhealth.com, docs.connect.fastenhealth.com] · Blue Button [bluebutton.cms.gov, IG bluebutton.cms.gov/assets/ig] · Flexpa [flexpa.com/pricing, /docs] · Metriport [metriport.com/medical, github.com/metriport/metriport] · TEFCA [rce.sequoiaproject.org, medplum.com/blog/technical-guide-to-tefca] · Epic [fhir.epic.com, open.epic.com] · CARIN BB IG.
