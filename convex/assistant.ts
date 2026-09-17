import { query, mutation, action, internalQuery, internalAction, internalMutation } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { canRead, assertWrite } from "./authz";
import { metaFor } from "./metrics";
import { buildToolContext, toolSchemas, executeTool } from "./aiTools";

// ---- conversations & transcript ------------------------------------------

export const listConversations = query({
  args: { patientId: v.id("patients") },
  handler: async (ctx, { patientId }) => {
    if (!(await canRead(ctx, patientId))) return [];
    const rows = await ctx.db
      .query("conversations")
      .withIndex("by_patient", (q) => q.eq("patientId", patientId))
      .collect();
    return rows.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

// Messages for one conversation (RLS via its patient).
export const listMessages = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const conv = await ctx.db.get(conversationId);
    if (!conv || !(await canRead(ctx, conv.patientId))) return [];
    const rows = await ctx.db
      .query("chatMessages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .collect();
    return rows.sort((a, b) => a.createdAt - b.createdAt);
  },
});

export const createConversation = mutation({
  args: { patientId: v.id("patients") },
  handler: async (ctx, { patientId }): Promise<Id<"conversations">> => {
    await assertWrite(ctx, patientId);
    const patient = await ctx.db.get(patientId);
    const now = Date.now();
    return ctx.db.insert("conversations", {
      patientId,
      userId: patient?.userId,
      title: "New chat",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const deleteConversation = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const conv = await ctx.db.get(conversationId);
    if (!conv) return;
    await assertWrite(ctx, conv.patientId);
    const msgs = await ctx.db
      .query("chatMessages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .collect();
    for (const m of msgs) await ctx.db.delete(m._id);
    await ctx.db.delete(conversationId);
  },
});

// The reasoning trace is a list of steps; the action rewrites it as work happens
// and Convex streams each change straight into the open chat.
const stepValidator = v.array(
  v.object({ title: v.string(), detail: v.optional(v.string()), status: v.string() }),
);

export const setSteps = internalMutation({
  args: { messageId: v.id("chatMessages"), steps: stepValidator },
  handler: async (ctx, { messageId, steps }) => {
    await ctx.db.patch(messageId, { steps });
  },
});

// Post a question: the user message appears instantly, an assistant placeholder
// streams in when the model finishes — all via Convex's live queries.
export const ask = mutation({
  args: {
    patientId: v.id("patients"),
    question: v.string(),
    conversationId: v.optional(v.id("conversations")),
    context: v.optional(v.string()),
    attachment: v.optional(v.object({ filename: v.string(), text: v.string() })),
  },
  handler: async (ctx, { patientId, question, conversationId, context, attachment }): Promise<Id<"conversations">> => {
    await assertWrite(ctx, patientId);
    const now = Date.now();

    // Resolve (or create) the conversation, and keep its title/updatedAt fresh.
    let convId = conversationId;
    if (!convId) {
      const patient = await ctx.db.get(patientId);
      convId = await ctx.db.insert("conversations", {
        patientId,
        userId: patient?.userId,
        title: question.slice(0, 48) || "New chat",
        createdAt: now,
        updatedAt: now,
      });
    } else {
      const conv = await ctx.db.get(convId);
      const patch: Record<string, any> = { updatedAt: now };
      if (conv && conv.title === "New chat") patch.title = question.slice(0, 48) || "New chat";
      await ctx.db.patch(convId, patch);
    }

    await ctx.db.insert("chatMessages", {
      patientId,
      conversationId: convId,
      role: "user",
      content: attachment ? `📎 ${attachment.filename}\n\n${question}` : question,
      createdAt: now,
    });
    const assistantId = await ctx.db.insert("chatMessages", {
      patientId,
      conversationId: convId,
      role: "assistant",
      content: "",
      pending: true,
      steps: [{ title: "Reading your health record", status: "running" }],
      createdAt: now + 1,
    });
    await ctx.scheduler.runAfter(0, internal.assistant.answer, {
      patientId,
      question,
      messageId: assistantId,
      context,
      attachment,
    });
    return convId;
  },
});

// ---- structured context the model reasons over ---------------------------

export const aiSnapshot = internalQuery({
  args: { patientId: v.id("patients") },
  handler: async (ctx, { patientId }) => {
    const get = (t: string) =>
      ctx.db
        .query(t as any)
        .withIndex("by_patient", (q: any) => q.eq("patientId", patientId))
        .collect();
    const [patient, docs, obs, meds, conds, encs, allergies, conflicts, missing] = await Promise.all([
      ctx.db.get(patientId),
      get("documents"),
      get("observations"),
      get("medications"),
      get("conditions"),
      get("encounters"),
      get("allergies"),
      get("conflicts"),
      get("missingRecords"),
    ]);
    return { patient, docs, obs, meds, conds, encs, allergies, conflicts, missing };
  },
});

// ---- the AI turn ---------------------------------------------------------

// Shared grounded tool-calling agent core. Used by the persisted patient chat
// AND the ephemeral, share-scoped doctor chat. `emit` streams the step list for
// a live trace; omit it for a one-shot answer. NEVER persists — returns the
// result. Access is decided by the CALLER (owner via assertWrite upstream, or a
// verified share token), so this only ever reads the one patientId it's handed.
async function runAgent(
  ctx: any,
  opts: {
    patientId: Id<"patients">;
    question: string;
    context?: string;
    attachment?: { filename: string; text: string };
    shareToken?: string;
    emit?: (steps: any[]) => Promise<any>;
  },
): Promise<{
  content: string;
  error: boolean;
  citations: { documentId: Id<"documents">; label: string }[];
  charts: string[];
  followups: string[];
  webSources: { title: string; url: string }[];
  steps: any[];
}> {
  const { patientId, question, context, attachment, shareToken, emit } = opts;
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  const steps: { title: string; detail?: string; status: string }[] = [];
  const flush = async () => { if (emit) await emit(steps); };
  const begin = async (title: string, detail?: string) => { steps.push({ title, detail, status: "running" }); await flush(); };
  const done = async (detail?: string) => {
    const last = steps[steps.length - 1];
    if (last) { last.status = "done"; if (detail !== undefined) last.detail = detail; }
    await flush();
  };
  const fail = (content: string) => ({ content, error: true, citations: [], charts: [], followups: [], webSources: [], steps });

  if (!apiKey) return fail("The AI assistant needs an OpenAI key. Run: npx convex env set OPENAI_API_KEY sk-…");

  {
    await begin("Reading your health record");
    const s: any = await ctx.runQuery(internal.assistant.aiSnapshot, { patientId });
    const srcCount = new Set(s.docs.map((d: any) => d.org)).size;
    await done(
      `${s.obs.length} lab values · ${s.meds.length} medications · ${s.conds.length} conditions · ${srcCount} source${srcCount === 1 ? "" : "s"}`,
    );
    const iso = (t?: number) => (t ? new Date(t).toISOString().slice(0, 10) : null);

    // Fold the deterministic "needs attention" signals in, then build the tool
    // layer the model can call to go deep on demand.
    const signals: any[] = await ctx.runQuery(api.signals.getSignals, { patientId, shareToken });
    const tctx = buildToolContext(s, signals, iso);
    const tools = toolSchemas(tctx);
    const allCodes = new Set<string>(tctx.metrics.map((m: any) => m.code));
    const allDocs = new Set<string>(s.docs.map((d: any) => String(d._id)));
    const usedDocs = new Set<string>();
    const usedCodes = new Set<string>();
    const webSources: { title: string; url: string }[] = [];
    let modelSourceUrls: string[] = []; // which sources the model said it actually used
    const hostOf = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return "source"; } };

    // A compact overview so simple questions need no tool call; tools add depth.
    const overview = {
      patient: tctx.patient,
      counts: { labs: s.obs.length, medications: s.meds.length, conditions: tctx.conditions.length, sources: new Set(s.docs.map((d: any) => d.org)).size },
      needsAttention: signals.slice(0, 8).map((g: any) => ({ severity: g.severity, title: g.title })),
      metrics: tctx.metrics.map((m: any) => ({ code: m.code, label: m.label, latest: m.latest.value, unit: m.unit, date: m.latest.date, trend: m.trend, status: m.status, documentId: m.latest.documentId })),
      medications: tctx.meds.map((m: any) => ({ name: m.name, status: m.status, documentId: m.documentId })),
      conditions: tctx.conditions.map((c: any) => ({ name: c.name, status: c.status, documentId: c.documentId })),
      allergies: tctx.allergies,
      sources: tctx.sources,
    };

    const call = async (body: any): Promise<any> => {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, temperature: 0.2, ...body }),
      });
      if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
      return res.json();
    };

    const TOOL_SYSTEM =
      "You are TraceHealth's clinical data assistant for ONE patient. Answer using ONLY this patient's records. " +
      "You are given a RECORD OVERVIEW and a set of TOOLS. For simple questions the overview may be enough; for anything needing specific values, full trends, projections, medication effects, correlations, or a search, CALL THE TOOLS to get grounded numbers — never guess or estimate values. " +
      "Call as many tools as you need, then stop. Answer the question that was asked and FOCUS on what matters most — do not try to cover the entire record. " +
      "GROUNDING RULE: Whenever your answer relies on general medical knowledge rather than only this patient's own numbers — what a term/med/condition means, its risks, lifestyle/diet/prevention guidance, or screening cadence — you MUST call reference_lookup first and base that part of the answer on the cited trusted source. Prefer to cite over answering from memory. " +
      "Never diagnose, prescribe, or advise treatment — present general, source-cited information and defer to a clinician; note temporal associations, not causation. " +
      "If the question is genuinely ambiguous and there is no CURRENT VIEW to anchor it, ask one short clarifying question.";

    const FINAL_SYSTEM =
      "Now answer the user like a calm, knowledgeable health guide — NOT a data dump. Rules: " +
      "(1) ANSWER ONLY WHAT WAS ASKED. Directly address the exact question and nothing else. Do NOT volunteer other metrics, do NOT restate the record, do NOT tack on a general health summary. If the question is narrow — a drug's price, what a term/med means, a single value, a yes/no, an administrative task — answer it in 1–3 sentences and STOP. Only survey multiple metrics when the user actually asks something open-ended (e.g. 'how is my health', 'what should I worry about', 'summarize my record'). " +
      "(2) LEAD with a 1–2 sentence plain-language takeaway that directly answers the question. " +
      "(3) For anything you do raise, explain in plain words what it MEANS and why it matters (the 'so what') — not just the number and 'above reference'. " +
      "(4) Where useful, note what they might do or ask their doctor — never diagnose or prescribe. " +
      "(5) FORMAT for a chat bubble: for a simple/narrow answer, just 1–3 sentences, NO bullets. Only use a bullet list when you are genuinely covering multiple points; then each bullet is a **bold label** + a plain point, max ~5 bullets, no headings, no tables, no nested bullets. Keep sentences short. " +
      "Do NOT include a citations/sources section or any links in the answer text. Non-diagnostic. " +
      'Return STRICT JSON: {"answer": string (markdown), "charts": [metric codes], "citations": [{"documentId": string}], "sources": [web source URLs you relied on], "followups": [2-3 short next questions the user might ask]}. ' +
      "SOURCES RULE: if any web/reference/price tool returned source URLs, put in `sources` the exact URLs you actually relied on for your answer — cite AS MANY as are genuinely relevant and no fixed number (it may be one, or several); omit any you didn't use. If you used no web sources, return []. " +
      "CHARTS RULE: include a metric's chart only when it directly illustrates a point your answer is actually making about THAT metric (e.g. you discuss its trend or where it stands) — a chart must earn its place. Do NOT include charts for metrics you aren't discussing, and return charts: [] for price, definition, medication, safety, or administrative questions where no metric is the subject. When in doubt, prefer fewer or none. " +
      "Only use documentId values and metric codes that appeared in the overview or tool results.";

    const messages: any[] = [
      { role: "system", content: TOOL_SYSTEM },
      {
        role: "user",
        content:
          (context ? `CURRENT VIEW: The user is looking at "${context}". Resolve "this/that/the chart" to it.\n\n` : "") +
          (attachment ? `ATTACHED FILE ("${attachment.filename}") — analyze it and relate it to the record:\n"""\n${attachment.text.slice(0, 12000)}\n"""\n\n` : "") +
          `RECORD OVERVIEW (JSON):\n${JSON.stringify(overview)}\n\nQUESTION: ${question}`,
      },
    ];

    let content = "";
    let citations: { documentId: Id<"documents">; label: string }[] = [];
    let charts: string[] = [];
    let followups: string[] = [];
    try {
      // --- tool phase: the model calls grounded functions until it has enough ---
      const MAX_ROUNDS = 4;
      for (let round = 1; round <= MAX_ROUNDS; round++) {
        await begin(round === 1 ? "Analyzing your question" : "Looking deeper");
        const j = await call({ messages, tools, tool_choice: round === MAX_ROUNDS ? "none" : "auto" });
        const msg = j.choices?.[0]?.message ?? {};
        messages.push(msg);
        const calls = Array.isArray(msg.tool_calls) ? msg.tool_calls : [];
        if (!calls.length) {
          await done();
          break;
        }
        await done(`Using ${calls.length} data tool${calls.length > 1 ? "s" : ""}`);
        for (const tc of calls) {
          let a: any = {};
          try { a = JSON.parse(tc.function?.arguments || "{}"); } catch { a = {}; }
          const name = tc.function?.name ?? "";
          let r: { result: any; label: string; detail?: string };
          if (name === "reference_lookup") {
            // Network tool: Firecrawl over trusted public medical sources.
            const topic = String(a.topic ?? "").slice(0, 120);
            const ref: any = await ctx.runAction(internal.firecrawl.referenceLookup, { topic });
            if (ref && ref.source) {
              const seenUrls = new Set(webSources.map((s) => s.url));
              for (const s of (ref.sources ?? [ref.source]) as any[]) {
                if (s?.url && !seenUrls.has(s.url)) { webSources.push({ title: s.title, url: s.url }); seenUrls.add(s.url); }
              }
              r = { result: { topic, summary: ref.summary, source: ref.source, note: "General info from a trusted public source — not medical advice." }, label: `Looked up “${topic}” from a trusted source`, detail: hostOf(ref.source.url) };
            } else {
              r = { result: { topic, unavailable: ref?.error ? `reference lookup error: ${ref.error}` : "Reference lookup unavailable (Firecrawl not configured)." }, label: `Looked up “${topic}”`, detail: "no source" };
            }
          } else if (name === "drug_price") {
            // Network tool: live pharmacy prices via Firecrawl (public drug name only).
            const drug = String(a.drug ?? "").slice(0, 60);
            const res: any = await ctx.runAction(internal.firecrawl.drugPrice, { drug });
            if (res && Array.isArray(res.prices) && res.prices.length) {
              const seenUrls = new Set(webSources.map((s) => s.url));
              for (const s of (res.sources ?? []) as any[]) {
                if (s?.url && !seenUrls.has(s.url)) { webSources.push({ title: s.title, url: s.url }); seenUrls.add(s.url); }
              }
              r = { result: { drug, prices: res.prices, genericAvailable: res.genericAvailable, sources: res.sources, note: "Live cash/coupon prices — estimates, not insurance." }, label: `Live prices for ${drug}`, detail: `${res.prices.length} pharmacies · from $${Math.min(...res.prices.map((p: any) => p.price))}` };
            } else {
              r = { result: { drug, prices: [], unavailable: res?.error ?? res?.note ?? "No live prices found." }, label: `Live prices for ${drug}`, detail: "unavailable" };
            }
          } else {
            const t = executeTool(name, a, tctx);
            t.docs.forEach((d) => usedDocs.add(String(d)));
            t.codes.forEach((c) => usedCodes.add(String(c)));
            r = { result: t.result, label: t.label, detail: t.detail };
          }
          steps.push({ title: r.label, detail: r.detail, status: "done" });
          await flush();
          messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(r.result).slice(0, 4000) });
        }
      }

      // --- final grounded answer (structured) ---
      await begin("Writing your answer");
      const fj = await call({ messages: [...messages, { role: "system", content: FINAL_SYSTEM }], response_format: { type: "json_object" } });
      const parsed = JSON.parse(fj.choices?.[0]?.message?.content ?? "{}");
      content = String(parsed.answer ?? "").trim() || "I couldn't find an answer in your records.";

      const seen = new Set<string>();
      for (const c of Array.isArray(parsed.citations) ? parsed.citations : []) {
        const id = String(c?.documentId ?? "");
        if (allDocs.has(id) && !seen.has(id)) {
          seen.add(id);
          const doc = tctx.docMap.get(id);
          citations.push({ documentId: id as Id<"documents">, label: doc ? `${doc.org} · ${iso(doc.receivedAt)}` : "Source" });
        }
      }
      charts = (Array.isArray(parsed.charts) ? parsed.charts : [])
        .map((c: any) => String(c))
        .filter((c: string) => allCodes.has(c))
        .filter((c: string, i: number, arr: string[]) => arr.indexOf(c) === i)
        .slice(0, 3);
      followups = (Array.isArray(parsed.followups) ? parsed.followups : [])
        .map((f: any) => String(f).trim())
        .filter(Boolean)
        .slice(0, 3);
      modelSourceUrls = (Array.isArray(parsed.sources) ? parsed.sources : []).map((u: any) => String(u)).filter(Boolean);
      await done();
    } catch (e: any) {
      return fail(`Sorry — I hit an error reaching the model.\n\n\`${String(e?.message ?? e).slice(0, 200)}\``);
    }

    // Dedupe candidate web sources by URL.
    const seenUrl = new Set<string>();
    const candidates = webSources.filter((w) => (seenUrl.has(w.url) ? false : (seenUrl.add(w.url), true)));
    // The model picks which sources it relied on, but we enforce a FLOOR of 5
    // whenever the answer is web-backed: pad the model's picks with the other real
    // gathered sources up to 5 (more is fine). Pure own-record answers stay at 0.
    const norm = (u: string) => u.replace(/\/+$/, "").toLowerCase();
    const chosen = candidates.filter((w) => modelSourceUrls.some((m) => norm(m) === norm(w.url) || norm(w.url).includes(norm(m)) || norm(m).includes(norm(w.url))));
    const out = [...(chosen.length ? chosen : candidates)];
    for (const c of candidates) { if (out.length >= 5) break; if (!out.some((x) => x.url === c.url)) out.push(c); }
    const webOut = candidates.length === 0 ? [] : out.slice(0, 8);
    return { content, error: false, citations, charts, followups, webSources: webOut, steps };
  }
}

export const answer = internalAction({
  args: {
    patientId: v.id("patients"),
    question: v.string(),
    messageId: v.id("chatMessages"),
    context: v.optional(v.string()),
    attachment: v.optional(v.object({ filename: v.string(), text: v.string() })),
  },
  handler: async (ctx, { patientId, question, messageId, context, attachment }) => {
    const res = await runAgent(ctx, {
      patientId, question, context, attachment,
      emit: (steps) => ctx.runMutation(internal.assistant.setSteps, { messageId, steps }),
    });
    await ctx.runMutation(internal.assistant.finalize, {
      messageId, content: res.content, error: res.error, citations: res.citations, charts: res.charts, followups: res.followups, webSources: res.webSources,
    });
  },
});

// Read-only, share-scoped doctor chat. The guest supplies ONLY a share token;
// it resolves to exactly one patient server-side, so no other record can be
// reached. Ephemeral — nothing is written to the patient's chat history.
export const askShared = action({
  args: { shareToken: v.string(), question: v.string() },
  handler: async (ctx, { shareToken, question }): Promise<any> => {
    const share: any = await ctx.runQuery(api.health.getShare, { token: shareToken });
    if (!share || share.expired) throw new Error("This share link is invalid or has expired.");
    const res = await runAgent(ctx, { patientId: share.patientId, question, shareToken });
    return { content: res.content, error: res.error, citations: res.citations, charts: res.charts, followups: res.followups, webSources: res.webSources, steps: res.steps };
  },
});

export const finalize = internalMutation({
  args: {
    messageId: v.id("chatMessages"),
    content: v.string(),
    error: v.boolean(),
    citations: v.array(v.object({ documentId: v.id("documents"), label: v.string(), page: v.optional(v.number()) })),
    charts: v.optional(v.array(v.string())),
    followups: v.optional(v.array(v.string())),
    webSources: v.optional(v.array(v.object({ title: v.string(), url: v.string() }))),
  },
  handler: async (ctx, a) => {
    await ctx.db.patch(a.messageId, {
      content: a.content,
      pending: false,
      error: a.error,
      citations: a.citations,
      charts: a.charts ?? [],
      followups: a.followups ?? [],
      webSources: a.webSources ?? [],
    });
  },
});
