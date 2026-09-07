# TraceHealth — Product Strategy

*How a hackathon demo becomes a real, full-scale product across the care lifecycle. Grounded in 2024–2026 market research (interoperability regulation, the consumer-PHR landscape, and stakeholder value). Sources cited inline; analyst/vendor figures are directional.*

---

## 0. Honest verdict: is what we built actually helpful?

**On the right axis — yes. At real scale — not yet.**

Every serious analysis of why consumer health records failed (Google Health, Microsoft HealthVault) lands on the same three causes: (1) the **empty-shell problem** — no data flowed in automatically; (2) **no actionable insight** — storage without a "so what?"; (3) **no business model**. The entire industry now agrees aggregation is becoming *commoditized* (Apple Health, Fasten, Flexpa, TEFCA), and the **durable, defensible layer is interpretation + verifiable trust on top**.

TraceHealth's kernel — an **evidence-cited AI that reasons over a normalized, provenance-tracked FHIR record**, with export/import and clinician sharing — sits *exactly* on that defensible layer. That's the good news: the concept is aimed correctly.

The gap: today it's a **single-sandbox demo**. To be "actually helpful in the medical industry," it needs real data breadth, the unstructured layer, stakeholder-specific surfaces, a trust/compliance stack, and a business model that isn't consumer subscription. This doc is the plan to get there.

---

## 1. The market reality in five facts

1. **The regulatory tailwind is enormous and legally guaranteed.** The 21st Century Cures Act forces every certified EHR to expose a **free, patient-facing FHIR R4 API**, and providers **cannot block** a patient-directed app ([healthit.gov](https://healthit.gov/regulations/cures-act-final-rule/)). TEFCA's national network went from ~10M records exchanged (Jan 2025) to ~500M (Mar 2026), with **Individual Access Services (IAS)** as a defined patient-pull path. Payer data (claims, prior-auth) opens via mandated FHIR APIs by 2027 (CMS-0057-F). *The rails we need now exist — they didn't in 2011.*

2. **Big Tech just entered our exact lane (2026).** OpenAI launched **ChatGPT Health** and acquired **Torch** (a medical-memory/context engine, ~$100M); **Microsoft Copilot Health** reviews records from 50,000+ orgs. We **cannot out-distribute them** as a general "AI health copilot." This is the single most important strategic fact.

3. **But general chatbots have a credibility hole.** They give health *advice* and face clinical-safety and citation scrutiny. **Verifiability — every claim cited to the exact source record + medical evidence — is the one thing a general chatbot cannot credibly promise.** That is our wedge.

4. **The problem is massive and worsening.** Median Medicare patient sees **7–8 providers/year across ~4 practices** ([Springer](https://link.springer.com/article/10.1007/s11606-019-04859-1)); **13.6% of primary-care visits have missing clinical info, harming care in ~44% of those** ([JAMA 2005](https://www.eurekalert.org/news-releases/465912)); **~795,000 Americans/year die or are disabled from diagnostic error** ([Johns Hopkins/BMJ 2023](https://www.hopkinsmedicine.org/news/newsroom/news-releases/2023/07/report-highlights-public-health-impact-of-serious-harms-from-diagnostic-error-in-us)); **59% of patients juggle multiple portals, only 7% use any app to consolidate** ([Pharmacy Times](https://www.pharmacytimes.com/view/when-records-do-not-connect-medication-safety-risks-hidden-in-ehr-interoperability-gaps)).

5. **Consumer subscriptions don't fund this; other stakeholders do.** The proven models are **data-to-research** (PicnicHealth: free consumer record, sell de-identified RWD to pharma, $100M+ raised), **API infrastructure** (Health Gorilla, 1up, Flexpa), and **B2B2C via payers/employers**. Pure "pay to store your records" has failed every time.

---

## 2. Positioning — the one sentence

> **TraceHealth is the *verifiable, patient-owned* health record — every answer cited to its source — that one record serves the patient, their caregiver, *and* their doctor.**

We do **not** win by being a better general health chatbot than OpenAI/Microsoft. We win on three things they structurally can't or won't credibly do:

- **Verifiability** — provenance on every fact, a citation on every claim, charts drawn from real data (never model-invented). Safety through sourcing.
- **True patient ownership & portability** — cross-platform, export-anything, not white-label, not ad/insurance-driven, not a Big-Tech data-harvest. (Human API drifted to insurance underwriting; b.well/Seqster are sponsor-branded — an *owned* brand position is unclaimed.)
- **Multi-stakeholder by design** — the same consented record is useful at the point of care, to the caregiver, and (with consent) to payers and research. General chatbots optimize for the consumer Q&A moment only.

---

## 3. The lifecycle: who it serves and what to build for each

The strategic through-line: **caregivers are the user wedge, employers are the distribution wedge, payers + pharma/RWD are where the money is — and patient-owned consent is what makes the money legally clean.**

### Patient (the account holder)
*Have:* timeline, trends, evidence drill-down, grounded AI, export/import, share.
*Build:* auto-retrieval so the record is never an empty shell (see §4); the unstructured layer (notes, imaging reports, and the visit conversation); "what changed / what needs attention" proactive surface.

### Caregiver — the real operator *(user wedge)*
**63M US family caregivers in 2025, ~1 in 4 adults; 70% manage medications, 72% say med tracking is the hardest part** ([AARP/NAC](https://www.aarp.org/press/releases/2025-07-24-new-report-reveals-crisis-point-for-americas-63-million-family-caregivers.html)). The person building and carrying the record is usually *not* the patient.
*Build:* **multi-profile accounts** (manage a parent's + a child's record), delegated access with proper consent, medication reconciliation and refill/appointment views, shared caregiver notes.

### Clinician — complement the ambient-scribe wave, don't fight it *(credibility + adoption)*
Visits are **~15–18 min**; **chart review is already the largest EHR sub-task** ([Fierce](https://www.fiercehealthcare.com/practices/for-each-patient-visit-physicians-spend-about-16-minutes-ehrs-study-finds)); physicians do **2 hrs of EHR work per 1 hr of care** ([Sinsky, Annals](https://www.acpjournals.org/doi/10.7326/M16-0961)). Ambient scribes (Abridge — **$5.3B valuation 2025**) capture what happens *in* the room; **nothing fills the missing history *before* it.**
*Build:* a **one-page, AI-synthesized, cited pre-visit summary** (never raw record dumps — no time), delivered by QR/link in the room or written back to the EHR as a FHIR DocumentReference. Position as a **complement** to ambient AI, not a competitor. *(We already have the clinician snapshot + FHIR write-back — this is our nearest real-world beachhead.)*

### Payers / ACOs / value-based care *(highest willingness-to-pay)*
**$40B of Medicare Advantage payments hinge on diagnosis coding; $12.7B in Star quality bonuses (2025); unified data can close up to 90% of HEDIS/Stars gaps** ([MedPAC](https://www.medpac.gov/wp-content/uploads/2025/07/July2025_MedPAC_DataBook_Sec9_SEC.pdf), [Galaxy](https://get-galaxy.ai/resources/blogs/one-platform-to-close-up-to-90-of-hedis-and-stars-gaps)). CMS-0057-F *mandates* payer FHIR APIs by 2027. A **consented, patient-owned record is the cleanest legal path to member-data completeness** for risk adjustment and care-gap closure.
*Build (later):* consented data-completeness feed; care-gap and risk surfacing. *Monetize:* PMPM + performance fees.

### Pharma / research — RWD + trial matching *(most directly monetizable & most defensible)*
**86% of trials miss recruitment targets; recruitment ≈ 40% of trial budget** ([ACRP](https://acrpnet.org/2023/04/18/a-primer-on-the-importance-of-recruitment-and-retention-in-clinical-trials)); **Mayo: 88% of second opinions refine/change the diagnosis** ([Mayo](https://newsnetwork.mayoclinic.org/discussion/mayo-clinic-researchers-demonstrate-value-of-second-opinions/)); RWE market **~$2.6B (2024) → ~$8.9B (2034)**. Institutions *can't* legally aggregate cross-provider data the way a consented patient can — **this is the moat**.
*Build (later):* opt-in de-identified RWD program (PicnicHealth model) and trial-matching from the structured record. *Monetize:* de-identified cohort sales, trial-match referral fees.

### Employer (self-funded) *(distribution wedge)*
**67% of covered workers are self-funded; employers average >12 health point-solutions and 81% are hiring just to manage vendor sprawl** ([GlobeNewswire](https://www.globenewswire.com/news-release/2026/04/07/3269235/0/en/Death-by-a-Thousand-Vendors-81-of-Employers-Are-Hiring-Just-to-Keep-Up-with-Digital-Health-Vendor-Sprawl.html)). They buy on financial impact and want consolidation.
*Build (later):* employer-sponsored deployment; unify labs/pharmacy/telehealth. *Monetize:* **PEPM (~$2–12/employee/mo)** — and this delivers the consented member base that powers the payer + RWD channels.

### Labs · Pharmacies · Telehealth — sources *and* consumers
**6.8–62% of lab results aren't followed up** ([JGIM](https://link.springer.com/article/10.1007/s11606-011-1949-5)); med non-adherence costs **$258–290B/yr**; telehealth **~86M US users** but clinicians often lack full history. These are both **data feeds in** and **consumers of the full picture** (a telehealth doc, a pharmacist reconciling meds). *Build:* data partnerships/integrations; telehealth as an embedded-record distribution partner.

---

## 4. Solving the two things that kill products like this

**(a) The empty-shell problem — make retrieval automatic.** A single sandbox connection is a demo. Real breadth = ride the rails:
- **Aggregator APIs** for immediate coverage: Fasten Connect (50k+ orgs), 1upHealth, Particle, Flexpa (claims + clinical). *(Note the governance risk — the 2024 Epic–Particle dispute shows network access is politically contested; don't depend on one path.)*
- **TEFCA Individual Access Services** via a QHIN (e.g., Health Gorilla) — the emerging *single national query* for a patient's own records, with IAL2 identity.
- **Payer FHIR APIs** (claims/coverage) as they land through 2027.

**(b) The structured-data ceiling — add the unstructured layer.** Apple et al. can't ingest notes or imaging — the most meaningful parts. Our edge:
- **PDF/image → text (OCR + GPT-4o vision)** for scanned records, faxes, imaging reports *(today our upload is text-only — this is the top technical gap).*
- **Ambient visit capture** (the Kin Health wedge): record the appointment, produce a cited plain-language summary + next steps, and fold it into the longitudinal record.

---

## 5. Moats (why we don't get crushed)

1. **Verifiability / citations** — a safety-and-trust position general chatbots can't credibly claim. This is also the clinician-adoption unlock.
2. **Consented patient-owned data** — legally lets us aggregate cross-provider and (with consent) supply RWD/trials in a way no institution can replicate.
3. **Multi-stakeholder graph** — one record that's simultaneously useful to patient, caregiver, clinician, payer, and researcher compounds; a consumer chatbot serves only the Q&A moment.
4. **Trust/compliance stack as a barrier** (see §7) — SOC 2 + HITRUST + CARIN accreditation + IAL2 identity is expensive and slow, which is exactly why it's defensible once cleared.

---

## 6. Business model

**Freemium consumer/caregiver (acquisition + consent) → monetize the stakeholders who actually pay.** Do **not** bet on subscription-for-storage.

- **Free / low-cost consumer & caregiver tier** — the acquisition wedge and the consent-collection mechanism.
- **Data-to-research (PicnicHealth model)** — opt-in de-identified RWD to pharma; trial matching. *Most defensible, most direct revenue.*
- **Payer / ACO PMPM** — data-completeness for risk adjustment, Stars, care-gap closure. *Highest willingness-to-pay.*
- **Employer PEPM** — distribution + the member base that feeds the above.
- **Provider/EHR feed** — cited pre-visit summaries as a quality/data input to ambient-scribe & EHR workflows.

Sequence: **consumer/caregiver → clinician summary (credibility) → employer distribution → payer + RWD (revenue).**

---

## 7. Trust & compliance (a cost *and* a moat)

A patient-directed app usually sits **outside HIPAA** — a double edge: providers *must* send us data and can't block us, but we're **not shielded by HIPAA** and are governed by the **FTC (Sec. 5, Health Breach Notification Rule)** and **state laws (WA My Health My Data, CCPA)**. A breach or sloppy policy is existential. To operate at scale:
- **SOC 2 Type II + HITRUST** (enterprise/provider trust).
- **CARIN Code of Conduct accreditation** (consumer-facing legitimacy; recognized by ONC/CMS/TEFCA).
- **IAL2 identity proofing** (e.g., CLEAR/ID.me) — required for TEFCA IAS.
- **FTC / state-privacy readiness.**

Given we handle health data, **trust is product, not paperwork** — and it's our answer to "why not just use ChatGPT?"

---

## 8. Roadmap — from where we are

**We already have the differentiated kernel:** normalized FHIR ingestion, provenance on every fact, evidence-cited AI with a live reasoning trace, timeline/trends, export (FHIR/JSON/CSV), import + manual entry, and a printable clinician snapshot with FHIR write-back. That maps directly onto the defensible layer. Next:

**Phase 1 — Depth & the clinician beachhead (now → near-term)**
- PDF/image ingestion (OCR + vision) — kill the text-only ceiling.
- Aggregator API integration (Fasten/1up/Particle) — real multi-provider retrieval, not one sandbox.
- Harden the **cited pre-visit clinician summary** (QR-in-room, PDF, EHR write-back) — the wedge that earns clinical credibility.
- Caregiver multi-profile accounts.

**Phase 2 — Trust & distribution**
- IAL2 identity + TEFCA IAS (QHIN) for one-tap national retrieval.
- SOC 2 → HITRUST → CARIN accreditation.
- Employer pilot (PEPM), telehealth embed partner.

**Phase 3 — The money & the flywheel**
- Opt-in de-identified RWD + trial-matching (pharma revenue).
- Payer data-completeness feed (risk adjustment, Stars, care gaps).
- Ambient visit capture folded into the record.

---

## 9. The hard risks

1. **Big Tech (OpenAI/Microsoft) owns consumer distribution.** Mitigation: don't fight on general Q&A; win on verifiability, ownership, and the multi-stakeholder + clinician/RWD channels they aren't focused on.
2. **Outside-HIPAA / FTC exposure.** Trust stack is non-negotiable before scale.
3. **Network-access governance** (Epic–Particle). Don't depend on a single retrieval path; combine aggregators + TEFCA + direct.
4. **TEFCA IAS is early** ("unrealized potential," 2025) and identity-gated — treat as upside, not a dependency.
5. **Uneven real-world API completeness** — data often lands at USCDI level, not full EHI; set expectations and fill gaps with the unstructured layer.

---

### The one-line strategy
**Don't be a better health chatbot — be the *verifiable, patient-owned record* underneath everyone's health decisions: the cited pre-visit summary the doctor trusts, the record the caregiver runs, and the consented data that (only because the patient owns it) powers research — a position Big Tech consumer chatbots and B2B infrastructure players each hold only half of.**
