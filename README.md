<p align="center">
  <img src="docs/logo.svg" width="88" alt="TraceHealth logo" />
</p>

<h1 align="center">TraceHealth</h1>

<p align="center">
  <strong>Your doctors have records. TraceHealth gives you a history.</strong>
</p>

<p align="center">
  One longitudinal, evidence-cited health record — reconstructed from the scattered<br/>
  documents every provider keeps to themselves, with an AI that reasons over your data.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Convex-All%20Gas%20Hackathon-0B0F17" alt="Convex All Gas Hackathon" />
  <img src="https://img.shields.io/badge/Convex-realtime-EE342F" alt="Convex" />
  <img src="https://img.shields.io/badge/OpenAI-gpt--4o--mini-412991" alt="OpenAI" />
  <img src="https://img.shields.io/badge/React%20%2B%20Vite%20%2B%20TS-000" alt="React + Vite + TypeScript" />
</p>

> 🏆 **Built for the [Convex All Gas Hackathon](https://convex.dev)** — sponsors: Convex · OpenAI · Firecrawl · AgentMail.

---

## What it does

Your medical history lives in fragments — a lab here, a visit note there, each provider's
portal a walled garden. TraceHealth pulls those records together and turns them into
**one health history you actually own**:

- 🔗 **Connect a provider** over real SMART on FHIR OAuth (the SMART Health IT sandbox comes pre-populated).
- 📇 **Normalize** labs, meds, conditions, visits & allergies into one clean data model — different lab codes for the same test collapse into one metric.
- 📈 **See the story** — a newest-first timeline, trend charts with reference lines, and side-by-side period comparisons.
- 🔍 **Trust every number** — click any value to trace it back to the source document.
- 🤖 **Ask the AI** — grounded, cited answers with inline charts and a live, health-framed reasoning trace. Never invents numbers.
- 📝 **Generate & share** — AI health summaries you can write back to the provider (FHIR) or share with a clinician via a read-only link.

---

## Quick start

> Dependencies are already installed (`npm install` if not).

```bash
# 1. Start the Convex backend (first run logs you in, generates convex/_generated/*,
#    and writes VITE_CONVEX_URL to .env.local).
npx convex dev

# 2. Give the backend an OpenAI key so the assistant can reason over your data.
npx convex env set OPENAI_API_KEY sk-...
```

In a second terminal:

```bash
npm run dev        # Vite dev server → http://localhost:5173
```

…or run both at once:

```bash
npm run dev:all
```

---

## How you use it

1. **Create an account** (email + password) — you get a private, isolated record.
2. **Connections → SMART Health IT Sandbox → Connect** — complete the OAuth consent. Your record syncs in seconds (and re-syncs automatically every 2 hours).
3. **Timeline / Trends** — read your history newest-first; open a metric (e.g. LDL) to chart it against its reference range.
4. **Click any value** — drill down to the exact source document.
5. **Ask AI** (`⌘J`) — "how is my cholesterol trending?" Watch the reasoning steps stream, get a cited answer with a real chart.
6. **Reports** — generate a summary, then write it back to the provider or share a read-only snapshot with a clinician.

📋 Full, testable walkthrough of every feature: **[USE_CASES.md](USE_CASES.md)** · UI test guide: **[TESTING.md](TESTING.md)**

---

## Stack

| Layer | What |
|---|---|
| **Backend** | [Convex](https://convex.dev) — schema, queries/mutations/actions, scheduled crons, file storage, realtime `useQuery` |
| **Frontend** | React + Vite + TypeScript + Tailwind (CSS-variable design tokens, dark mode) |
| **Auth** | Convex Auth (email/password) with row-level security |
| **Ingestion** | SMART on FHIR OAuth 2.0 + PKCE → FHIR R4 → LOINC-normalized health graph |
| **AI** | OpenAI `gpt-4o-mini` — grounded extraction, cited chat answers, report generation |

---

## Deploy

```bash
npm run deploy     # builds, deploys Convex functions, and static-hosts the web app
```

The live URL looks like `https://<deployment>.convex.site`.

---

## Docs

- **[USE_CASES.md](USE_CASES.md)** — every real use case as a testable scenario
- **[TESTING.md](TESTING.md)** — step-by-step UI test guide
- **[PRODUCT.md](PRODUCT.md)** — product thesis & design decisions

---

<p align="center"><sub>A hackathon prototype — not a medical device. No diagnosis, prescription, or treatment advice.</sub></p>
