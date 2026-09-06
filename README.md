# TraceHealth

**Your doctors have records. TraceHealth gives you a history.**

Upload years of scattered medical records from every provider — TraceHealth
reconstructs one interactive, evidence-backed longitudinal health history that
you and your doctor can actually understand.

Built for the **Convex All Gas Hackathon** (Convex · OpenAI · Firecrawl · AgentMail).

## Stack

- **Convex** — realtime data + the evolving health graph (schema, indexes,
  queries, mutations, actions, scheduled functions, file storage)
- **React + Vite + TypeScript + Tailwind** — frontend, hosted on `convex.site`
- **OpenAI** (`gpt-4o-mini`) — extracts structured medical events from raw record text

## Run it locally

Dependencies are already installed. Two steps need you:

```bash
# 1. Start the Convex backend. This opens a browser to log in the first time,
#    then generates convex/_generated/* and writes VITE_CONVEX_URL to .env.local.
npx convex dev

# 2. (Optional, for the upload/paste import) give the backend an OpenAI key:
npx convex env set OPENAI_API_KEY sk-...
```

Then, in a second terminal:

```bash
npm run dev      # start Vite at http://localhost:5173
```

Or run both together:

```bash
npm run dev:all
```

Open the app → **Try the demo patient** → watch 8 years reconstruct live.

## The demo path

1. Load the demo patient (Sarah Williams — 8 years, 4 organizations, 10 documents)
2. Read the timeline
3. Click **LDL** → the relationship graph (the wow moment)
4. Click any data point → trace it to the original record
5. **Compare** 2023 vs 2026
6. **Conflicts** → resolve the Metformin dose discrepancy
7. **Share with Doctor** → the compressed clinical snapshot
8. **Email a new lab** → the graph updates in real time

## Deploy to convex.site

```bash
npm install @convex-dev/static-hosting
npx @convex-dev/static-hosting setup   # follow the printed instructions
npm run deploy
```

The live URL will look like `https://<deployment>.convex.site`.
