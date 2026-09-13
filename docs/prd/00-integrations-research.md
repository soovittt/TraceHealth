# PRD 00 — Integration Landscape (research synthesis)

The map of every way to get health data into TraceHealth, ranked, with the governing constraints. Source of truth for PRDs 01–03. Current as of 2026-09.

## The single distinction that governs a web app
Health sources split into **cloud/server APIs** (OAuth, your Convex backend pulls server-to-server — web-feasible) vs **on-device stores** (data lives in a phone, no cloud API — needs code on the device). Apple Health/HealthKit and Google Health Connect are on-device: **no web path, ever**, even through aggregators (they read them via a mobile SDK). For a web-only app the realistic universe is: **cloud-API sources + one unified aggregator + file-upload fallbacks (Apple Health XML, PDFs, C-CDA).**

---

## A. Clinical records (real provider data)
The "connect to 50,000 providers" vendors are thin layers over three trust networks — **Carequality** (network-of-networks), **CommonWell** (national network + TEFCA QHIN), **TEFCA/QHINs** (federal layer; adds patient **Individual Access Services**, but IAS needs IAL2 identity proofing). Data is document-derived (C-CDA → FHIR R4), so completeness varies by site.

| Service | Records | Hackathon-accessible? | Cost | Effort |
|---|---|---|---|---|
| **Fasten Connect** ⭐ | Labs, meds, conditions, encounters, allergies, immunizations, docs, **+ claims** | **Yes** — free self-serve sandbox, no BAA (patient access right) | Commercial, self-serve | 2 |
| **Metriport** | Full USCDI; C-CDA/HL7→FHIR; open-source | Partial — OSS + sandbox; prod needs BAA | Sales / OSS | 3 |
| Particle Health | Clinical + docs + AI summary; all 3 nets | No — enterprise + BAA | Enterprise | 4 |
| Health Gorilla | Patient360; **is a QHIN** | Sandbox yes, prod BAA+vetting | Free sb / paid | 4 |
| Zus, 1upHealth | Aggregated profile / claims + clinical | No — enterprise | Sales | 4 |
| Direct **Epic / Oracle-Cerner / athenahealth** | Full USCDI, per-org | Sandbox easy; **broad coverage = per-org go-live** | Free dev / negotiated | 2 sandbox / 5 broad |

**Verdict:** SMART sandbox (have it, demo) → **Fasten Connect** for real broad coverage.

## B. Insurance claims (EOBs) — a timeline layer pure-EHR PHRs lack
FHIR `ExplanationOfBenefit` + `Coverage` (CARIN Blue Button IG).

| Source | Provides | Accessible? | Cost |
|---|---|---|---|
| **CMS Blue Button 2.0** ⭐ | Medicare Part A/B/D claims | **Yes** — instant sandbox, free prod w/ CMS approval | Free |
| **Flexpa** | Commercial payer claims, 350+ payers | Test free; **prod $20k/yr** | $20k/yr min |
| 1upHealth | Payer claims + clinical | No — enterprise | License |

**Verdict:** **Blue Button 2.0** now (free); Flexpa test-mode UI, upgrade when funded. Regulatory tailwind: CMS-0057-F payer APIs mandated by Jan 1 2027.

## C. Wearables & personal health
Cloud OAuth sources are web-feasible; a **unified aggregator** gets ~all of them through one integration.

| Integration | Data | Web-feasible? | Cost | Effort |
|---|---|---|---|---|
| **Vital / Junction** ⭐ | All wearables **+ nationwide lab ordering & results** | Yes (cloud); Apple/HC need mobile SDK | Free start, usage-based | 2 |
| **Terra** ⭐ | 500+ devices, CGM, lab-report ingest | Yes (cloud); Apple/HC need SDK | ~$399/mo | 2 |
| Rook, Spike | Aggregators; Spike also EMR + LOINC lab OCR | Yes (cloud) | ~$399–450/mo | 2 |
| Oura / Withings / Whoop | Direct cloud OAuth | Yes | Free | 2 |
| Dexcom (CGM) | Glucose 5-min | Yes (OAuth; gated tiers) | Free sandbox | 3 |
| Fitbit | **Sunsetting ~Sep 2026** → Google Health API (restricted scopes) | degrading | Free | 3 ⚠️ |
| Abbott Libre | No official public API | Enterprise/unofficial | — | 5 ⚠️ |
| **Apple Health — XML export upload** ⭐ | Full HealthKit snapshot (point-in-time) | **Yes** — user uploads `export.zip`, parse client-side | Free | 2 |
| Apple Health (live) / Google Health Connect | Everything on-device | **No** — needs native app | Free | 5 |

**Verdict:** **Apple Health XML import** (covers iPhone users, no app) now; **Vital or Terra** aggregator as the multi-wearable unlock (Vital if labs matter). Companion iOS app only when live Apple/HC sync is required.

## D. Medications & pharmacy
Enrichment is **free & self-serve**; interactions are a **licensing trap**; obtaining medicine splits into pricing (accessible) vs prescribing/fulfillment (gated).

| Source | Provides | Free? | Accessible? | Effort |
|---|---|---|---|---|
| **RxNorm / RxNav** ⭐ | Normalize name→RxCUI, ingredient/brand, NDC↔RxCUI | Yes | Yes, no key | 1 |
| **openFDA** ⭐ | Label sections (boxed warning, dosage, warnings), NDC, FAERS | Yes | Free key | 1–2 |
| **MedlinePlus Connect** ⭐ | Patient-friendly drug info by RxCUI/NDC | Yes | Yes, no reg | 1 |
| **DailyMed** | Full SPL labels, images, bulk | Yes | Yes, no key | 2 |
| **GoodRx API v2** | Multi-pharmacy cash/coupon prices | API paid; affiliate free | Partial (approval) / affiliate trivial | 3 |
| **Cost Plus Drugs** | Transparent cost-plus prices, public API | Yes/low | Partial (public data) | 2–3 |
| Google Places | Pharmacy locator | Pay-as-you-go | Yes | 2 |
| Photon Health | e-prescribe + benefits; **free sandbox** | Sandbox free | Prototype yes, prod sales | 3–4 |
| DoseSpot / Truepill-Fuze / Surescripts | e-Rx / fulfillment / med history | Paid | Contracts + credentialed prescribers | 4–5 |
| **DrugBank / FDB / Medi-Span** (interactions) | Gold-standard DDI | No — enterprise; DrugBank free checker **retires Mar 25 2026** | No | 5 ⚠️ |

**Verdict:** enrichment core **RxNorm + openFDA + MedlinePlus + DailyMed** (all free); interactions from **ONCHigh + CredibleMeds** public subsets behind a disclaimer; pricing from **Cost Plus + GoodRx**; defer e-Rx/med-history.

## Cross-cutting flags
- **BAA-free for hackathon:** Fasten Connect, Blue Button 2.0, all med-enrichment gov APIs, Apple XML import. **BAA/enterprise (later):** Particle, Zus, 1up, Health Gorilla prod, Metriport prod, Flexpa prod ($).
- **Dedup becomes real** once multiple networks return the same patient — key on `fhirResourceId` + `sourceSystem` + (code+date+value).
- **Interaction licensing:** isolate in its own table with a `licenseTier` flag; never present openFDA label text as a computed pairwise checker.

### Key source URLs
Fasten [docs.connect.fastenhealth.com] · Blue Button [bluebutton.cms.gov] · Metriport [metriport.com/medical, github.com/metriport/metriport] · Flexpa [flexpa.com/pricing] · TEFCA [rce.sequoiaproject.org, medplum.com/blog/technical-guide-to-tefca] · Vital [tryvital.io] · Terra [tryterra.co] · Oura [cloud.ouraring.com/docs] · Dexcom [developer.dexcom.com] · Apple export [applehealthdata.com] · RxNorm [rxnav.nlm.nih.gov] · openFDA [open.fda.gov/apis] · MedlinePlus Connect [medlineplus.gov/medlineplus-connect] · DailyMed [dailymed.nlm.nih.gov] · GoodRx [goodrx.com/developer] · Cost Plus [costplusdrugs.com] · Photon [docs.photon.health].
