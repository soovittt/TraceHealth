# PRD 04 — AI Agent Write-Actions ("the agent that *does*")

**The differentiator.** Today the chat agent is read-only — it answers from the record. This PRD gives it **hands**: add a medication, log a symptom, correct a value, request records, look up + price a drug — all through the same grounded tool loop, with **user confirmation** on anything that mutates the record.

## Problem
Users don't want to *navigate* to add a med or fix a wrong dose — they want to say it. "I started metformin 500 twice a day." "That LDL should be 131, not 113." "Where can I get my atorvastatin cheapest near me?" "Ask my old clinic for my records." Right now every one of those is a manual, multi-click journey. The AI already understands the record; it should be able to change and act on it.

## Goals
- The agent can **create, update, and verify** records (medications, observations/labs, conditions, allergies, symptoms/notes).
- The agent can **look up medicine** (what it is, safety, interactions with the user's current meds) and **price / locate** it.
- The agent can **trigger flows** (request records from a provider, generate a report, set a report schedule).
- **Every mutation is confirmed** by the user before it commits — the agent proposes a structured action; the UI renders a confirm card; nothing writes silently.
- Every created record still carries **provenance** (`ai_assisted` → becomes `patient_verified` on confirm) and traces to the conversation that created it.

## Non-goals
- Autonomous action without confirmation. No auto-prescribing, no clinical decisions. The agent proposes; the human commits.
- e-prescribing / sending scripts to a pharmacy (needs credentialed prescribers — separate, later).

## How it fits the current architecture
- `convex/aiTools.ts` — `toolSchemas` + `executeTool` (currently read tools: list_metrics, get_metric, needs_attention, …). We **add write tools** and **lookup tools** here.
- `convex/assistant.ts` — `runAgent` tool-calling loop (`MAX_ROUNDS`). Write tools return a **proposed action** object, not a DB change.
- `convex/ingest.ts` — `addManualRecord` mutation already inserts a single record with `provenance: "patient_verified"`. Write-actions call this (and siblings) **only after user confirmation**.

## The confirmation pattern (core design)
Writes are consequential, so the agent **never mutates directly**. Two-step:

1. **Propose.** A write tool (e.g. `propose_add_medication`) validates + normalizes (RxNorm) and **returns a structured `proposedAction`** into the assistant message: `{ kind, summary, payload, mutation }`. It does **not** touch the DB.
2. **Confirm.** The chat message renders an **action card** — "Add **Metformin 500 mg**, twice daily, active? [Confirm] [Edit] [Cancel]". On **Confirm**, the client calls the real mutation (`api.ingest.addManualRecord` or a new `api.agentActions.commit`) with the payload. Provenance is stamped `patient_verified`; the record links back to `conversationId` + `messageId` so History shows "added via AI on <date>".

This keeps the agent expressive but the user in control, and it's honest for the demo ("watch it propose, I confirm").

## Tool catalog

### Write / record tools (each returns a `proposedAction`)
| Tool | Args | Commits to |
|---|---|---|
| `propose_add_medication` | name, dose?, unit?, frequency?, status? | `medications` (via addManualRecord); RxNorm-normalized (PRD 03) |
| `propose_update_medication` | medicationId, patch (dose/status/…) | patch `medications` |
| `propose_add_observation` | code/label, value, unit, date? | `observations` |
| `propose_add_condition` | name, status?, date? | `conditions` |
| `propose_add_allergy` | substance, reaction? | `allergies` |
| `propose_log_symptom` | text, severity?, date? | `symptoms` (new lightweight table; see PRD 05) |
| `propose_verify_medication` | medicationId, active | flips provenance → patient_verified |
| `propose_correct_record` | table, id, field, value | targeted patch (for "that lab is wrong") |

### Lookup / action tools (read-only or side-effecting flows)
| Tool | What it does |
|---|---|
| `drug_lookup` | RxNorm + openFDA + MedlinePlus: what it is, boxed warning, key warnings, patient-info link (PRD 03) |
| `drug_interactions` | Checks a candidate/existing drug against the user's active meds (ONCHigh/CredibleMeds subset, disclaimered) |
| `drug_price` | Cost Plus + GoodRx cash/coupon prices; optional ZIP → pharmacy locator (PRD 03) |
| `find_pharmacy` | Google Places nearby pharmacies for a drug/chain |
| `request_records` | Proposes a records-request (Fasten connect flow / a `missingRecords` entry / an AgentMail email to a provider) |
| `generate_report` | Kicks the existing summary report action |
| `set_report_schedule` | Turns on a daily/weekly/… schedule (existing cron) |

> **Sponsor tie-in:** `request_records` and "email my records to Dr. X" are a natural home for **AgentMail** (give the agent an inbox to send/receive records-request emails) — currently the one sponsor we don't use. Small, real, and on-theme.

## System-prompt additions
Extend `TOOL_SYSTEM`: "You can propose changes to the record and look up medications. For anything that adds or edits a record, ALWAYS use a `propose_*` tool — never claim you changed something; the user confirms. Normalize medications to their generic + strength. For drug questions, use `drug_lookup`/`drug_interactions` and cite. Never give a dose recommendation or diagnosis; you surface information and propose the user's own entries."

## Example conversations
- **"I started metformin 500 twice a day last week."** → `propose_add_medication{name:"metformin", dose:500, unit:"mg", frequency:"twice daily", status:"active"}` → confirm card → committed as `patient_verified`, appears in meds + timeline.
- **"Is it safe with what I already take?"** → `drug_interactions{candidate:"metformin"}` vs active meds → "No high-severity interactions with your atorvastatin or lisinopril (informational — confirm with your pharmacist). [source]".
- **"Where's it cheapest near 94105?"** → `drug_price{rxcui, zip:"94105"}` → Cost Plus $X, GoodRx $Y at CVS/Walgreens → `find_pharmacy` list + coupon link.
- **"My last LDL was wrong, it's 131."** → `propose_correct_record{table:"observations", …}` → confirm.
- **"Get my records from Stanford."** → `request_records{org:"Stanford"}` → proposes a Fasten connect or an AgentMail request.

## UX
- **Action card** component in the chat stream: title, human summary, the exact fields (editable inline), Confirm / Edit / Cancel. On confirm → optimistic insert + toast "Added to your record."
- **Undo**: confirmed AI actions are reversible for a short window (soft-delete) — trust matters.
- **Audit**: History (Source page) shows "AI-assisted · <conversation>" as a source; the record links back to the message.

## Data-model touches (detail in PRD 05)
- `symptoms` table (new, lightweight).
- `provenance` union gains `ai_assisted`.
- Records created via agent store `createdBy: "agent"`, `conversationId`, `messageId`.
- Med enrichment (`medicationEnrichment`, `drugInteractions`, `drugPrices`) tables from PRD 03 power the lookup tools.

## Risks & mitigations
- **Hallucinated writes** → confirmation card + normalization + validation before commit; agent literally cannot write without the user clicking.
- **Wrong drug match** → show the RxNorm-resolved canonical name in the confirm card ("Did you mean **atorvastatin (Lipitor)**?").
- **Perceived as medical advice** → strict prompt (no doses/diagnoses), disclaimers on interactions/pricing, "propose *your* entry" framing.
- **Tool-loop cost/latency** → keep `MAX_ROUNDS` bounded; lookup tools cached (enrichment tables).

## Success metrics
- % of record edits initiated via chat vs manual nav.
- Confirm rate on proposed actions (proxy for proposal quality).
- Drug-lookup / price queries per active user.
- Time-to-add a medication (chat vs form).

## Phasing
- **P1 (hackathon):** `propose_add_medication`, `propose_add_observation`, `propose_add_condition`, `propose_add_allergy`, `propose_log_symptom`, `drug_lookup`, `drug_interactions`, confirmation card. (Reuses `addManualRecord` + PRD 03 enrichment.)
- **P2:** `propose_update/correct/verify`, `drug_price` + `find_pharmacy`, `generate_report` / `set_report_schedule`.
- **P3:** `request_records` via Fasten + **AgentMail** inbox; undo/audit polish.
