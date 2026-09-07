import { query, mutation, internalQuery, internalAction, internalMutation } from "./_generated/server";
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

export const answer = internalAction({
  args: {
    patientId: v.id("patients"),
    question: v.string(),
    messageId: v.id("chatMessages"),
    context: v.optional(v.string()),
    attachment: v.optional(v.object({ filename: v.string(), text: v.string() })),
  },
  handler: async (ctx, { patientId, question, messageId, context, attachment }) => {
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
    if (!apiKey) {
      await ctx.runMutation(internal.assistant.finalize, {
        messageId,
        content: "The AI assistant needs an OpenAI key. Run: npx convex env set OPENAI_API_KEY sk-…",
        error: true,
        citations: [],
      });
      return;
    }

    // --- live reasoning trace: rewrite the step list as real work happens ----
    const steps: { title: string; detail?: string; status: string }[] = [];
    const flush = () => ctx.runMutation(internal.assistant.setSteps, { messageId, steps });
    const begin = async (title: string, detail?: string) => {
      steps.push({ title, detail, status: "running" });
      await flush();
    };
    const done = async (detail?: string) => {
      const last = steps[steps.length - 1];
      if (last) {
        last.status = "done";
        if (detail !== undefined) last.detail = detail;
      }
      await flush();
    };

    await begin("Reading your health record");
    const s: any = await ctx.runQuery(internal.assistant.aiSnapshot, { patientId });
    const srcCount = new Set(s.docs.map((d: any) => d.org)).size;
    await done(
      `${s.obs.length} lab values · ${s.meds.length} medications · ${s.conds.length} conditions · ${srcCount} source${srcCount === 1 ? "" : "s"}`,
    );
    const iso = (t?: number) => (t ? new Date(t).toISOString().slice(0, 10) : null);

    // Fold the deterministic "needs attention" signals in, then build the tool
    // layer the model can call to go deep on demand.
    const signals: any[] = await ctx.runQuery(api.signals.getSignals, { patientId });
    const tctx = buildToolContext(s, signals, iso);
    const tools = toolSchemas(tctx);
    const allCodes = new Set<string>(tctx.metrics.map((m: any) => m.code));
    const allDocs = new Set<string>(s.docs.map((d: any) => String(d._id)));
    const usedDocs = new Set<string>();
    const usedCodes = new Set<string>();
    const webSources: { title: string; url: string }[] = [];
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
      "Never diagnose, prescribe, or advise treatment — describe what the records show and note temporal associations, not causation. " +
      "If the question is genuinely ambiguous and there is no CURRENT VIEW to anchor it, ask one short clarifying question.";

    const FINAL_SYSTEM =
      "Now answer the user like a calm, knowledgeable health guide — NOT a data dump. Rules: " +
      "(1) LEAD with a 1–2 sentence plain-language takeaway that directly answers the question. " +
      "(2) PRIORITIZE — focus on the few things that matter most (especially anything out-of-range or trending the wrong way). Do NOT enumerate every metric or restate the whole record. " +
      "(3) For each thing you raise, explain in plain words what it MEANS and why it matters to this person (the 'so what') — not just the number and 'above reference'. " +
      "(4) Where useful, note what they might do or ask their doctor — never diagnose or prescribe. " +
      "(5) Warm, concrete, and concise: a short intro then a few tight bullets, not a long catalog. Numbers are supporting evidence, not the point. " +
      "(6) FORMAT CLEANLY for a chat bubble: at most one short intro sentence, then a tight bullet list where each bullet starts with a **bold label** followed by a plain-language point. No section headings, no tables, no nested sub-bullets, and no more than ~5 bullets. Keep sentences short. " +
      "Do NOT include a citations/sources section or any links in the answer text. Non-diagnostic. " +
      'Return STRICT JSON: {"answer": string (markdown), "charts": [up to 3 relevant metric codes], "citations": [{"documentId": string}], "followups": [2-3 short next questions the user might ask]}. ' +
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
              webSources.push({ title: ref.source.title, url: ref.source.url });
              r = { result: { topic, summary: ref.summary, source: ref.source, note: "General info from a trusted public source — not medical advice." }, label: `Looked up “${topic}” from a trusted source`, detail: hostOf(ref.source.url) };
            } else {
              r = { result: { topic, unavailable: ref?.error ? `reference lookup error: ${ref.error}` : "Reference lookup unavailable (Firecrawl not configured)." }, label: `Looked up “${topic}”`, detail: "no source" };
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
      await done();
    } catch (e: any) {
      await ctx.runMutation(internal.assistant.finalize, {
        messageId,
        content: `Sorry — I hit an error reaching the model.\n\n\`${String(e?.message ?? e).slice(0, 200)}\``,
        error: true,
        citations: [],
      });
      return;
    }

    // Dedupe web sources by URL.
    const seenUrl = new Set<string>();
    const webOut = webSources.filter((w) => (seenUrl.has(w.url) ? false : (seenUrl.add(w.url), true))).slice(0, 4);
    await ctx.runMutation(internal.assistant.finalize, { messageId, content, citations, charts, followups, webSources: webOut, error: false });
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
