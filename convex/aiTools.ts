import { metaFor } from "./metrics";

// The grounded tool layer the assistant can call. Tools operate over the
// already-loaded record (no extra DB round-trips) and either (a) return a
// focused, cited slice, or (b) do real computation the model shouldn't guess
// at — trend projection, medication-effect windows, correlations. Adding a
// capability to the product = adding a tool here.

const YEAR = 365 * 24 * 60 * 60 * 1000;
const MONTH = 30 * 24 * 60 * 60 * 1000;
// Rough guideline recheck cadences (months) for the labs/vitals we track.
const CADENCE: Record<string, number> = {
  LDL: 60, CHOL_TOTAL: 60, HDL: 60, TRIG: 60, HBA1C: 36, GLUCOSE: 36,
  BP_SYS: 12, BP_DIA: 12, EGFR: 12, CREATININE: 12, VITD: 24,
};

export type ToolContext = ReturnType<typeof buildToolContext>;

export function buildToolContext(s: any, signals: any[], iso: (t?: number) => string | null) {
  const num = (n: number) => Number(n.toFixed(2));
  const byCode: Record<string, any[]> = {};
  for (const o of s.obs) (byCode[o.code] ??= []).push(o);

  const metricByCode: Record<string, any> = {};
  const metrics = Object.entries(byCode)
    .map(([code, arr]) => {
      arr.sort((a, b) => a.date - b.date);
      const meta = metaFor(code, arr[0].label, arr[0].unit);
      const vals = arr.map((x) => x.value);
      const first = arr[0];
      const last = arr[arr.length - 1];
      const m = {
        code,
        label: meta.label,
        unit: last.unit || meta.unit,
        readings: arr.length,
        first: { value: first.value, date: iso(first.date) },
        latest: { value: last.value, date: iso(last.date), documentId: last.documentId, page: last.page },
        min: num(Math.min(...vals)),
        max: num(Math.max(...vals)),
        trend: last.value > first.value ? "rising" : last.value < first.value ? "falling" : "flat",
        status: meta.refHigh && last.value > meta.refHigh ? "above reference" : meta.refLow && last.value < meta.refLow ? "below reference" : "in range",
        refHigh: meta.refHigh ?? null,
        refLow: meta.refLow ?? null,
        direction: meta.direction,
        points: arr.map((x) => ({ value: x.value, date: iso(x.date) })),
        raw: arr, // {value,date(number),documentId,...}
      };
      metricByCode[code] = m;
      return m;
    })
    .sort((a, b) => b.readings - a.readings);

  const seenC = new Set<string>();
  const conditions = [...s.conds]
    .sort((a: any, b: any) => (b.diagnosedDate ?? 0) - (a.diagnosedDate ?? 0))
    .filter((c: any) => (seenC.has(c.normalizedName) ? false : (seenC.add(c.normalizedName), true)))
    .map((c: any) => ({ name: c.name, status: c.status, diagnosed: iso(c.diagnosedDate), documentId: c.documentId }));

  const medSeen = new Set<string>();
  const meds = [...s.meds]
    .sort((a: any, b: any) => (b.startDate ?? 0) - (a.startDate ?? 0))
    .filter((m: any) => (medSeen.has(m.normalizedName) ? false : (medSeen.add(m.normalizedName), true)))
    .map((m: any) => ({
      name: m.name, normalizedName: m.normalizedName, dose: m.dose ? `${m.dose} ${m.doseUnit ?? ""}`.trim() : null,
      status: m.status, started: iso(m.startDate), startNum: m.startDate ?? null, documentId: m.documentId,
    }));
  const allergies = s.allergies.map((a: any) => ({ substance: a.substance, reaction: a.reaction, documentId: a.documentId }));
  const encounters = [...s.encs].sort((a: any, b: any) => b.date - a.date).map((e: any) => ({ title: e.title, kind: e.kind, org: e.org, date: iso(e.date), dateNum: e.date, documentId: e.documentId }));
  const missing = (s.missing ?? []).map((m: any) => ({ label: m.label, org: m.org, date: iso(m.date), status: m.status, documentId: m.referencedInDocumentId }));
  const conflicts = (s.conflicts ?? []).map((c: any) => ({ type: c.kind, label: c.label, status: c.status, options: (c.options ?? []).map((o: any) => `${o.source}: ${o.value}`) }));
  const docMap = new Map<string, any>(s.docs.map((d: any) => [String(d._id), d]));

  return {
    patient: s.patient ? { name: s.patient.name, age: s.patient.age, sex: s.patient.sex } : null,
    metrics, metricByCode, conditions, meds, allergies, encounters, missing, conflicts, signals, docMap,
    sources: s.docs.map((d: any) => ({ documentId: d._id, org: d.org, date: iso(d.receivedAt) })),
    iso,
  };
}

// OpenAI tool (function) schemas — the metric-code enum is filled from the record.
export function toolSchemas(ctx: ToolContext) {
  const codes = ctx.metrics.map((m: any) => m.code);
  const codeParam = { type: "string", enum: codes.length ? codes : ["LDL"] };
  const fn = (name: string, description: string, properties: any = {}, required: string[] = []) => ({
    type: "function",
    function: { name, description, parameters: { type: "object", properties, required } },
  });
  return [
    fn("list_metrics", "List every lab/vital tracked for this patient with its latest value, trend, and in/out-of-range status."),
    fn("get_metric", "Get the full time-series, min/max, reference range and every reading for one metric.", { code: codeParam }, ["code"]),
    fn("project_trend", "Compute the slope of a metric and, if it's worsening, roughly how long until it crosses its reference threshold (non-diagnostic projection).", { code: codeParam }, ["code"]),
    fn("medication_effect", "For a medication, compare each relevant lab BEFORE vs AFTER the medication's start date to see what changed in the window afterward.", { medication: { type: "string", description: "medication name or generic" } }, ["medication"]),
    fn("correlations", "Find metrics whose trends move together over the record (both rising or both falling)."),
    fn("needs_attention", "The app's flagged signals: out-of-range labs, worsening trends, overdue rechecks, allergy/med conflicts."),
    fn("list_medications", "List current and past medications with status and dose."),
    fn("list_conditions", "List diagnosed conditions with status and date."),
    fn("list_allergies", "List recorded allergies and reactions."),
    fn("search_records", "Search the whole record (labs, meds, conditions, visits) by keyword.", { query: { type: "string" } }, ["query"]),
    fn("reference_lookup", "Look up general medical knowledge from trusted public sources (MedlinePlus, FDA, CDC, Mayo Clinic, AHA, ADA) and cite the page URL. Use it whenever the answer relies on general facts rather than only the patient's own numbers: what a term/med/condition MEANS, its RISKS, LIFESTYLE / DIET / PREVENTION guidance, or SCREENING cadence. General info, not personalized advice.", { topic: { type: "string", description: "the topic to look up, e.g. 'lifestyle changes to lower blood pressure', 'risks of high LDL', or 'atorvastatin'" } }, ["topic"]),
    fn("screening_status", "Which tracked labs/vitals are overdue for a recheck vs typical guideline cadence."),
    fn("find_open_loops", "Abnormal results that were never rechecked, or monitoring that's overdue for a condition — dropped threads."),
    fn("recent_activity", "What's new in the record recently: labs and visits within the last N months (default 6).", { months: { type: "number" } }),
    fn("list_missing_records", "Records referenced in the notes but not present in the record (e.g. an imaging study mentioned but not imported)."),
    fn("list_conflicts", "Cross-source conflicts where providers disagree (e.g. a medication dose recorded two ways)."),
    fn("data_completeness", "How complete the record is: sources connected, data classes present, and gaps."),
  ];
}

type ToolResult = { result: any; docs: string[]; codes: string[]; label: string; detail?: string };
const D = (id: any) => (id ? [String(id)] : []);

export function executeTool(name: string, args: any, ctx: ToolContext): ToolResult {
  const metric = (code: string) => ctx.metricByCode[String(code || "").toUpperCase()];
  switch (name) {
    case "list_metrics":
      return {
        result: ctx.metrics.map((m: any) => ({ code: m.code, label: m.label, latest: m.latest.value, unit: m.unit, trend: m.trend, status: m.status, readings: m.readings })),
        docs: [], codes: ctx.metrics.map((m: any) => m.code), label: "Reviewed tracked metrics", detail: `${ctx.metrics.length} metrics`,
      };

    case "get_metric": {
      const m = metric(args.code);
      if (!m) return { result: { error: "No such metric" }, docs: [], codes: [], label: `No data for ${args.code}` };
      const { raw, ...clean } = m;
      return { result: clean, docs: D(m.latest.documentId), codes: [m.code], label: `Pulled ${m.label}`, detail: `${m.readings} readings, latest ${m.latest.value} ${m.unit}` };
    }

    case "project_trend": {
      const m = metric(args.code);
      if (!m || m.raw.length < 3) return { result: { error: "Not enough readings to project" }, docs: [], codes: [], label: `Projected ${args?.code}` };
      const pts = m.raw.map((r: any) => ({ x: r.date, y: r.value }));
      const n = pts.length;
      const mx = pts.reduce((a: number, p: any) => a + p.x, 0) / n;
      const my = pts.reduce((a: number, p: any) => a + p.y, 0) / n;
      let sxy = 0, sxx = 0;
      for (const p of pts) { sxy += (p.x - mx) * (p.y - my); sxx += (p.x - mx) ** 2; }
      const slope = sxx ? sxy / sxx : 0; // value per ms
      const perYear = Number((slope * YEAR).toFixed(2));
      const current = m.latest.value;
      const threshold = m.direction === "high_bad" ? m.refHigh : m.direction === "low_bad" ? m.refLow : null;
      let monthsToThreshold: number | null = null;
      if (threshold != null && slope !== 0) {
        const ms = (threshold - current) / slope;
        if (ms > 0) monthsToThreshold = Number((ms / (YEAR / 12)).toFixed(0));
      }
      // acceleration: slope of the recent half vs earlier half
      const half = Math.floor(n / 2);
      const early = pts.slice(0, half), late = pts.slice(half);
      const seg = (ps: any[]) => (ps.length > 1 ? (ps[ps.length - 1].y - ps[0].y) / ((ps[ps.length - 1].x - ps[0].x) || 1) : 0);
      const accelerating = Math.abs(seg(late)) > Math.abs(seg(early)) * 1.3;
      return {
        result: { code: m.code, label: m.label, current, unit: m.unit, changePerYear: perYear, direction: m.trend, threshold, monthsToThreshold, accelerating, note: "Trend projection only — not a prediction or diagnosis." },
        docs: D(m.latest.documentId), codes: [m.code], label: `Projected ${m.label} trend`, detail: monthsToThreshold != null ? `~${monthsToThreshold} mo to threshold` : `${perYear}/yr`,
      };
    }

    case "medication_effect": {
      const q = String(args.medication || "").toLowerCase();
      const med = ctx.meds.find((m: any) => `${m.name} ${m.normalizedName}`.toLowerCase().includes(q));
      if (!med || !med.startNum) return { result: { error: "Medication or its start date not found" }, docs: [], codes: [], label: `Checked effect of ${args.medication}` };
      const effects: any[] = [];
      const docs: string[] = D(med.documentId);
      for (const m of ctx.metrics) {
        if (m.direction === "neutral") continue;
        const before = [...m.raw].filter((r: any) => r.date <= med.startNum).pop();
        const after = m.raw[m.raw.length - 1];
        if (!before || !after || after.date <= med.startNum) continue;
        effects.push({ metric: m.code, label: m.label, unit: m.unit, before: before.value, after: after.value, change: Number((after.value - before.value).toFixed(2)) });
        docs.push(String(after.documentId));
      }
      effects.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
      return { result: { medication: med.name, started: med.started, effects: effects.slice(0, 6) }, docs, codes: effects.map((e) => e.metric), label: `Checked labs after ${med.name} started`, detail: `${effects.length} metrics in the window` };
    }

    case "correlations": {
      const dir = ctx.metrics.filter((m: any) => m.readings >= 3 && m.trend !== "flat");
      const rising = dir.filter((m: any) => m.trend === "rising").map((m: any) => m.label);
      const falling = dir.filter((m: any) => m.trend === "falling").map((m: any) => m.label);
      return { result: { risingTogether: rising, fallingTogether: falling, note: "Association over the record, not causation." }, docs: [], codes: dir.map((m: any) => m.code), label: "Looked for trends moving together", detail: `${rising.length} up, ${falling.length} down` };
    }

    case "needs_attention":
      return { result: ctx.signals.map((g: any) => ({ severity: g.severity, title: g.title, detail: g.detail })), docs: ctx.signals.map((g: any) => String(g.documentId)).filter(Boolean), codes: ctx.signals.map((g: any) => g.code).filter(Boolean), label: "Reviewed flagged signals", detail: `${ctx.signals.length} flag${ctx.signals.length === 1 ? "" : "s"}` };

    case "list_medications":
      return { result: ctx.meds.map(({ startNum, normalizedName, ...m }: any) => m), docs: ctx.meds.map((m: any) => String(m.documentId)), codes: [], label: "Listed medications", detail: `${ctx.meds.length}` };

    case "list_conditions":
      return { result: ctx.conditions, docs: ctx.conditions.map((c: any) => String(c.documentId)), codes: [], label: "Listed conditions", detail: `${ctx.conditions.length}` };

    case "list_allergies":
      return { result: ctx.allergies, docs: ctx.allergies.map((a: any) => String(a.documentId)), codes: [], label: "Checked allergies", detail: `${ctx.allergies.length}` };

    case "search_records": {
      const q = String(args.query || "").toLowerCase();
      const hits: any[] = [];
      for (const m of ctx.meds) if (`${m.name} ${m.normalizedName}`.toLowerCase().includes(q)) hits.push({ type: "medication", label: m.name, documentId: m.documentId });
      for (const c of ctx.conditions) if (c.name.toLowerCase().includes(q)) hits.push({ type: "condition", label: c.name, documentId: c.documentId });
      for (const e of ctx.encounters) if (`${e.title} ${e.org ?? ""}`.toLowerCase().includes(q)) hits.push({ type: "visit", label: e.title, date: e.date, documentId: e.documentId });
      for (const m of ctx.metrics) if (m.label.toLowerCase().includes(q)) hits.push({ type: "lab", label: m.label, code: m.code });
      return { result: hits.slice(0, 12), docs: hits.map((h) => String(h.documentId)).filter((x) => x !== "undefined"), codes: hits.filter((h) => h.code).map((h) => h.code), label: `Searched for “${args.query}”`, detail: `${hits.length} match${hits.length === 1 ? "" : "es"}` };
    }

    case "screening_status": {
      const now = Date.now();
      const rows = ctx.metrics
        .filter((m: any) => CADENCE[m.code])
        .map((m: any) => {
          const monthsOld = (now - m.raw[m.raw.length - 1].date) / MONTH;
          return { metric: m.code, label: m.label, lastDone: m.latest.date, monthsAgo: Math.round(monthsOld), cadenceMonths: CADENCE[m.code], overdue: monthsOld > CADENCE[m.code] };
        });
      return { result: { note: "General guideline cadences — confirm with a clinician.", items: rows.filter((r: any) => r.overdue), upToDate: rows.filter((r: any) => !r.overdue).map((r: any) => r.label) }, docs: [], codes: rows.filter((r: any) => r.overdue).map((r: any) => r.metric), label: "Checked screening cadence", detail: `${rows.filter((r: any) => r.overdue).length} overdue` };
    }

    case "find_open_loops": {
      const now = Date.now();
      const loops = ctx.metrics
        .filter((m: any) => m.status !== "in range" && CADENCE[m.code] && (now - m.raw[m.raw.length - 1].date) / MONTH > CADENCE[m.code] / 2)
        .map((m: any) => ({ metric: m.code, label: m.label, lastValue: m.latest.value, unit: m.unit, status: m.status, monthsAgo: Math.round((now - m.raw[m.raw.length - 1].date) / MONTH), documentId: m.latest.documentId }));
      return { result: loops, docs: loops.map((l: any) => String(l.documentId)), codes: loops.map((l: any) => l.metric), label: "Looked for dropped follow-ups", detail: `${loops.length} open loop${loops.length === 1 ? "" : "s"}` };
    }

    case "recent_activity": {
      const months = typeof args.months === "number" && args.months > 0 ? args.months : 6;
      const cutoff = Date.now() - months * MONTH;
      const labs: any[] = [];
      for (const m of ctx.metrics) for (const r of m.raw) if (r.date >= cutoff) labs.push({ type: "lab", label: m.label, value: r.value, unit: m.unit, date: ctx.iso(r.date), dateNum: r.date, documentId: r.documentId });
      const visits = ctx.encounters.filter((e: any) => e.dateNum >= cutoff).map((e: any) => ({ type: "visit", label: e.title, org: e.org, date: e.date, dateNum: e.dateNum, documentId: e.documentId }));
      const items = [...labs, ...visits].sort((a, b) => b.dateNum - a.dateNum).slice(0, 20).map(({ dateNum, ...x }) => x);
      return { result: { sinceMonths: months, items }, docs: items.map((x: any) => String(x.documentId)).filter((x) => x !== "undefined"), codes: [], label: `Reviewed the last ${months} months`, detail: `${items.length} item${items.length === 1 ? "" : "s"}` };
    }

    case "list_missing_records":
      return { result: ctx.missing, docs: ctx.missing.map((m: any) => String(m.documentId)), codes: [], label: "Checked for missing records", detail: `${ctx.missing.length}` };

    case "list_conflicts":
      return { result: ctx.conflicts, docs: [], codes: [], label: "Checked for record conflicts", detail: `${ctx.conflicts.length}` };

    case "data_completeness": {
      const orgs = new Set(ctx.sources.map((x: any) => x.org));
      const gaps: string[] = [];
      const codes = new Set(ctx.metrics.map((m: any) => m.code));
      if (!codes.has("LDL")) gaps.push("No cholesterol panel");
      if (!codes.has("BP_SYS")) gaps.push("No blood pressure");
      if (ctx.allergies.length === 0) gaps.push("No allergies recorded");
      if (orgs.size < 2) gaps.push("Only one source connected");
      return { result: { sources: orgs.size, metricsTracked: codes.size, medications: ctx.meds.length, conditions: ctx.conditions.length, allergies: ctx.allergies.length, gaps }, docs: [], codes: [], label: "Checked record completeness", detail: `${orgs.size} source${orgs.size === 1 ? "" : "s"}` };
    }

    default:
      return { result: { error: `Unknown tool ${name}` }, docs: [], codes: [], label: `Unknown tool` };
  }
}
