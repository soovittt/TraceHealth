import { query, mutation, internalQuery, internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { canRead, assertWrite } from "./authz";
import { metaFor } from "./metrics";

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

    // AI-friendly context: per-metric TREND SUMMARIES (not a raw row dump), plus
    // deduped problem/med lists. High signal, low tokens, easy to reason over.
    const docMap = new Map<string, any>(s.docs.map((d: any) => [d._id, d]));
    const num = (n: number) => Number(n.toFixed(2));

    const byCode: Record<string, any[]> = {};
    for (const o of s.obs) (byCode[o.code] ??= []).push(o);
    const metrics = Object.entries(byCode)
      .map(([code, arr]) => {
        arr.sort((a, b) => a.date - b.date);
        const meta = metaFor(code, arr[0].label, arr[0].unit);
        const vals = arr.map((x) => x.value);
        const first = arr[0];
        const last = arr[arr.length - 1];
        const dir = last.value > first.value ? "rising" : last.value < first.value ? "falling" : "flat";
        const flag =
          meta.refHigh && last.value > meta.refHigh ? "above reference" : meta.refLow && last.value < meta.refLow ? "below reference" : "in range";
        return {
          metric: code,
          label: meta.label,
          unit: last.unit || meta.unit,
          readings: arr.length,
          first: { value: first.value, date: iso(first.date) },
          latest: { value: last.value, date: iso(last.date), documentId: last.documentId },
          min: num(Math.min(...vals)),
          max: num(Math.max(...vals)),
          trend: dir,
          status: flag,
          referenceHigh: meta.refHigh ?? null,
          referenceLow: meta.refLow ?? null,
          recent: arr.slice(-5).map((x) => ({ value: x.value, date: iso(x.date) })),
        };
      })
      .sort((a, b) => b.readings - a.readings);

    // Which records is this question actually about? Real keyword/synonym match
    // over the metric catalog — shown to the user as the "focus" step.
    const SYNONYMS: Record<string, string[]> = {
      cholesterol: ["LDL", "HDL", "CHOL_TOTAL", "TRIG"],
      lipid: ["LDL", "HDL", "CHOL_TOTAL", "TRIG"],
      triglyceride: ["TRIG"],
      diabetes: ["HBA1C", "GLUCOSE"],
      sugar: ["GLUCOSE", "HBA1C"],
      a1c: ["HBA1C"],
      glucose: ["GLUCOSE"],
      "blood pressure": ["BP_SYS", "BP_DIA"],
      bp: ["BP_SYS", "BP_DIA"],
      hypertension: ["BP_SYS", "BP_DIA"],
      weight: ["WEIGHT", "BMI"],
      bmi: ["BMI"],
      kidney: ["EGFR", "CREATININE"],
      renal: ["EGFR", "CREATININE"],
      "vitamin d": ["VITD"],
      "heart rate": ["HR"],
      pulse: ["HR"],
    };
    const ql = question.toLowerCase();
    const focusCodes = new Set<string>();
    for (const [word, codes] of Object.entries(SYNONYMS)) {
      if (ql.includes(word)) codes.forEach((c) => focusCodes.add(c));
    }
    for (const m of metrics) {
      if (ql.includes(m.metric.toLowerCase()) || ql.includes(m.label.toLowerCase())) focusCodes.add(m.metric);
    }
    const focusLabels = metrics.filter((m: any) => focusCodes.has(m.metric)).map((m: any) => m.label);
    await begin("Finding the relevant records");
    await done(
      focusLabels.length
        ? `Focused on ${focusLabels.slice(0, 4).join(", ")}${focusLabels.length > 4 ? ` +${focusLabels.length - 4} more` : ""}`
        : attachment
          ? `Reading the attached file against your full record`
          : `Scanning your full record — ${metrics.length} tracked metrics`,
    );

    // Dedupe conditions by concept; keep active first.
    const seenC = new Set<string>();
    const conditions = [...s.conds]
      .sort((a: any, b: any) => (b.diagnosedDate ?? 0) - (a.diagnosedDate ?? 0))
      .filter((c: any) => (seenC.has(c.normalizedName) ? false : (seenC.add(c.normalizedName), true)))
      .map((c: any) => ({ name: c.name, status: c.status, diagnosed: iso(c.diagnosedDate), documentId: c.documentId }));

    const record = {
      patient: s.patient ? { name: s.patient.name, age: s.patient.age, recordsFrom: s.patient.recordsFrom } : null,
      sources: s.docs.map((d: any) => ({ documentId: d._id, org: d.org, date: iso(d.receivedAt) })),
      metricTrends: metrics,
      medications: s.meds.map((m: any) => ({ name: m.name, dose: m.dose ? `${m.dose} ${m.doseUnit}` : null, status: m.status, started: iso(m.startDate), documentId: m.documentId })),
      conditions,
      encounters: [...s.encs]
        .sort((a: any, b: any) => b.date - a.date)
        .slice(0, 25)
        .map((e: any) => ({ title: e.title, kind: e.kind, org: e.org, date: iso(e.date), documentId: e.documentId })),
      allergies: s.allergies.map((a: any) => ({ substance: a.substance, reaction: a.reaction, documentId: a.documentId })),
      conflicts: s.conflicts.map((c: any) => ({ type: c.kind, label: c.label, options: c.options.map((o: any) => `${o.source}: ${o.value}`), status: c.status })),
      missingRecords: s.missing.map((m: any) => ({ label: m.label, org: m.org, date: iso(m.date) })),
    };

    const system =
      "You are TraceHealth's clinical data assistant. You answer questions about ONE patient using ONLY the structured records provided as JSON. " +
      "The `metricTrends` array is the labs/vitals summarized per metric (first, latest, min, max, trend, reference status, recent points) — use it for anything about values, trends, or ranges. " +
      "Rules: (1) Use only facts present in the data; if the answer is not in the records, say so plainly. " +
      "(2) Never diagnose, prescribe, or give treatment advice. Describe what the records show and note temporal associations, not causation. " +
      "(3) Be concise and specific — cite concrete values, dates, and trends. Prefer short paragraphs or tight bullet lists. " +
      "(4) For every claim, attach the source by including the relevant documentId(s) in the citations array. " +
      "(5) Frame as 'your records show', never 'the AI thinks'. " +
      "(5b) If the question is genuinely ambiguous and there is no CURRENT VIEW to anchor it (e.g. a bare 'is this normal?' on the full-page chat), ask one short clarifying question instead of guessing. " +
      "(6) Do NOT write a 'Citations'/'Sources' section, footnotes, or any URLs/links inside the answer text — the app renders citations separately from the citations array. Never invent links. " +
      "(7) When the answer is about one or more measurements or their trends, list the relevant metric codes (the `metric` field from metricTrends) in `charts` (max 3) — the app draws the real chart from the data, so never put numbers in the answer that contradict the record. " +
      "(8) Also return `steps`: 2–4 SHORT, concrete phrases describing the analysis you performed over the records — what you looked at and compared (e.g. 'Isolated 8 LDL readings from 2019–2026', 'Compared latest 96 mg/dL against the 130 target', 'Checked for a statin start in that window'). These are shown to the user as a reasoning trace, so keep them factual and health-framed — NOT your internal monologue, NOT restatements of the question. " +
      'Return STRICT JSON: {"answer": string (concise markdown, no links, no citations section), "citations": [{"documentId": string}], "charts": [string], "steps": [string]}. ' +
      "Only use documentId values and metric codes that appear in the provided data.";

    let content = "";
    let citations: { documentId: Id<"documents">; label: string }[] = [];
    let charts: string[] = [];
    try {
      await begin(
        "Reasoning over the data",
        focusLabels.length ? `Analyzing ${focusLabels.slice(0, 3).join(", ")}` : undefined,
      );
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            {
              role: "user",
              content:
                (context ? `CURRENT VIEW: The user is looking at "${context}". If they say "this", "here", "that", or "the chart", resolve it to what this view is about.\n\n` : "") +
                (attachment ? `ATTACHED FILE the user uploaded ("${attachment.filename}") — analyze it, and relate it to their records where relevant:\n"""\n${attachment.text.slice(0, 12000)}\n"""\n\n` : "") +
                `PATIENT RECORDS (JSON):\n${JSON.stringify(record)}\n\nQUESTION: ${question}`,
            },
          ],
        }),
      });
      if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const json = await res.json();
      const parsed = JSON.parse(json.choices?.[0]?.message?.content ?? "{}");
      content = String(parsed.answer ?? "").trim() || "I couldn't find an answer in your records.";

      // Validate citations against real documents (drop hallucinated ids).
      const validIds = new Set<string>(s.docs.map((d: any) => d._id));
      const seen = new Set<string>();
      for (const c of Array.isArray(parsed.citations) ? parsed.citations : []) {
        const id = String(c?.documentId ?? "");
        if (validIds.has(id) && !seen.has(id)) {
          seen.add(id);
          const doc = docMap.get(id);
          // Build the label from the real document — never trust the model's.
          citations.push({
            documentId: id as Id<"documents">,
            label: doc ? `${doc.org} · ${iso(doc.receivedAt)}` : "Source",
          });
        }
      }

      // Validate chart codes against metrics that actually exist (no fabrication).
      const validCodes = new Set<string>(metrics.map((m: any) => m.metric));
      charts = (Array.isArray(parsed.charts) ? parsed.charts : [])
        .map((c: any) => String(c))
        .filter((c: string) => validCodes.has(c))
        .filter((c: string, i: number, arr: string[]) => arr.indexOf(c) === i)
        .slice(0, 3);

      // Fold the model's own articulated analysis into the trace as done steps.
      await done();
      const modelSteps = (Array.isArray(parsed.steps) ? parsed.steps : [])
        .map((x: any) => String(x).trim())
        .filter(Boolean)
        .slice(0, 4);
      for (const t of modelSteps) steps.push({ title: t, status: "done" });
      if (modelSteps.length) await flush();
    } catch (e: any) {
      await ctx.runMutation(internal.assistant.finalize, {
        messageId,
        content: `Sorry — I hit an error reaching the model.\n\n\`${String(e?.message ?? e).slice(0, 200)}\``,
        error: true,
        citations: [],
      });
      return;
    }

    await ctx.runMutation(internal.assistant.finalize, { messageId, content, citations, charts, error: false });
  },
});

export const finalize = internalMutation({
  args: {
    messageId: v.id("chatMessages"),
    content: v.string(),
    error: v.boolean(),
    citations: v.array(v.object({ documentId: v.id("documents"), label: v.string(), page: v.optional(v.number()) })),
    charts: v.optional(v.array(v.string())),
  },
  handler: async (ctx, a) => {
    await ctx.db.patch(a.messageId, {
      content: a.content,
      pending: false,
      error: a.error,
      citations: a.citations,
      charts: a.charts ?? [],
    });
  },
});
