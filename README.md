<p align="center">
  <img src="docs/banner.svg" alt="TraceHealth" width="100%" />
</p>

<p align="center">
  <strong>Your doctors have records. TraceHealth gives you a history.</strong>
</p>

<p align="center">
  One longitudinal, evidence-cited health record — reconstructed from the scattered<br/>
  documents every provider keeps to itself, with an AI that reasons over your data and cites every claim.
</p>

<p align="center">
  <a href="https://ideal-swan-48.convex.site"><img src="https://img.shields.io/badge/Live_demo-ideal--swan--48.convex.site-2383E2?style=for-the-badge&logo=convex&logoColor=white" alt="Live demo" /></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Convex-realtime_backend-EE342F" alt="Convex" />
  <img src="https://img.shields.io/badge/OpenAI-gpt--4o-412991" alt="OpenAI" />
  <img src="https://img.shields.io/badge/Firecrawl-live_web-FF6B35" alt="Firecrawl" />
  <img src="https://img.shields.io/badge/React_·_Vite_·_TypeScript-000" alt="React + Vite + TypeScript" />
  <img src="https://img.shields.io/badge/Convex_Auth-guest_or_email-0B0F17" alt="Convex Auth" />
</p>

> 🏆 Built for the **Convex All Gas Hackathon** — Convex · OpenAI · Firecrawl.
>
> 👉 **Try it in 5 seconds:** open the [live demo](https://ideal-swan-48.convex.site) → **“Try it — no signup”** → the first-run tour walks you through connecting a provider.

---

## What it does

Your medical history lives in fragments — a lab here, a visit note there, every provider's
portal a walled garden. TraceHealth pulls those records together into **one health history you actually own**:

- 🔗 **Connect a provider** over real **SMART on FHIR** OAuth + PKCE (the SMART Health IT sandbox comes pre-populated). Records re-sync automatically.
- 🧩 **Normalize** labs, meds, conditions, visits & allergies into one clean model — different lab codes for the same test collapse into a single metric.
- 📈 **See the story** — a newest-first timeline, trend charts with reference lines, and side-by-side period comparisons.
- 🔍 **Trust every number** — click any value to trace it back to the exact source document.
- 🤖 **Ask the AI** (`⌘J`) — grounded, cited answers with inline charts and a live reasoning trace. It never invents numbers, and it pulls **live drug prices and medical references from the web via Firecrawl** (min. 5 cited sources).
- 📎 **Drop a lab report into chat** — GPT-4o vision reads the image/PDF, extracts the records **into your data layer**, then explains them.
- 📝 **Generate a summary** — pick the sections and the **trend graphs** to embed; it runs as a **background job** and pings you when ready. Export it to **PDF** (graphs included), or share a read-only snapshot with a clinician.
- 🔔 **Live notifications** — a reactive bell + toast, powered end-to-end by Convex.

---

## Why it's a real Convex app

Not a thin CRUD wrapper — Convex does the heavy lifting across the stack:

| Convex capability | Where it's used |
|---|---|
| **Schema, indexes, full-text search** | `convex/schema.ts`, health search over meds/conditions/visits (`convex/health.ts`) |
| **Reactive queries** (`useQuery`) | the whole UI updates live — no refetching, no polling |
| **Background jobs** (`ctx.scheduler`) | ingestion pipeline, data export, and summary generation run off the request path (`convex/ingest.ts`, `convex/export.ts`, `convex/reports.ts`) |
| **Crons** | scheduled daily/weekly/monthly/yearly reports (`convex/crons.ts`) |
| **Actions + internal functions** | OpenAI + Firecrawl calls, FHIR sync (`convex/assistant.ts`, `convex/firecrawl.ts`, `convex/fhir.ts`) |
| **File storage** | uploaded PDFs/images and generated exports |
| **HTTP actions** | auth routes + static hosting on `*.convex.site` (`convex/http.ts`) |
| **Registered component** | [`@convex-dev/static-hosting`](https://github.com/get-convex/static-hosting) serves the SPA (`convex/convex.config.ts`) |
| **Convex Auth** | email/password **and** anonymous guest, with row-level security (`convex/auth.ts`, `convex/authz.ts`) |

## Sponsor stack, doing real work

- **Convex** — database, functions, realtime sync, crons, file storage, auth, and the frontend host. The reactive backbone of the whole app.
- **OpenAI** — `gpt-4o` vision reads scanned/text medical PDFs into structured records; a tool-calling assistant reasons over the record; `gpt-4o-mini` writes summaries.
- **Firecrawl** — the assistant's `drug_price` tool scrapes **live** GoodRx + Cost Plus Drugs prices, and `reference_lookup` cites current medical references — degrading gracefully when offline.
- **AgentMail** — _roadmap:_ deliver scheduled/summary reports straight to your inbox.

---

## Quick start

```bash
npm install

# 1) Start the Convex backend. First run logs you in, generates convex/_generated/*,
#    and writes VITE_CONVEX_URL into .env.local.
npx convex dev

# 2) Give the backend its API keys (server-side only — never in the client).
npx convex env set OPENAI_API_KEY    sk-...
npx convex env set FIRECRAWL_API_KEY fc-...
```

In a second terminal:

```bash
npm run dev        # Vite dev server → http://localhost:5173
# or run backend + frontend together:
npm run dev:all
```

## Deploy (Convex static hosting → `*.convex.site`)

```bash
# backend (functions, schema, crons, components)
npx convex deploy --yes

# frontend: build with the prod URL and upload to Convex static hosting
npx @convex-dev/static-hosting upload --build --prod
```

The app is served at `https://<deployment>.convex.site` alongside the backend — no separate host.

---

## Repo structure

```
convex/            Convex backend
  schema.ts          data model — tables, indexes, full-text search
  auth.ts            Convex Auth (password + anonymous guest)
  fhir.ts            SMART on FHIR OAuth/PKCE + R4 → normalized graph
  ingest.ts          background extraction pipeline (GPT-4o vision)
  assistant.ts       tool-calling AI over the record
  aiTools.ts         the assistant's tools (trends, projections, screening…)
  firecrawl.ts       live drug prices + medical reference lookup
  reports.ts         configurable summaries + scheduled reports (crons)
  notifications.ts   reactive in-app notifications
  export.ts          background, multi-format record export
  convex.config.ts   registers @convex-dev/static-hosting
src/
  components/        React UI (dashboard, trends, chat, reports, share…)
  lib/               store + client helpers
docs/                PRDs, product notes, testing + demo scripts, brand
sample-records/      real-format lab reports / FHIR bundles to test ingestion
evals/               AI-answer eval harness output
```

## Sample data

`sample-records/` has real-format files (Quest/LabCorp lab reports, a FHIR bundle, a TraceHealth export, and test PDFs) to exercise upload, paste, and chat extraction.

## Docs

- **[docs/USE_CASES.md](docs/USE_CASES.md)** — every real use case as a testable scenario
- **[docs/TESTING.md](docs/TESTING.md)** — step-by-step UI test guide
- **[docs/PRODUCT.md](docs/PRODUCT.md)** — product thesis & design decisions
- **[docs/prd/](docs/prd/)** — integration & platform PRDs
- **[hackathon.md](hackathon.md)** — the evidence-based build log

---

<p align="center"><sub>A hackathon prototype — not a medical device. No diagnosis, prescription, or treatment advice.</sub></p>
