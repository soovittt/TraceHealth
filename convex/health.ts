import { query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { metaFor, PRIMARY_CODES } from "./metrics";
import { canRead } from "./authz";

// ---- helpers -------------------------------------------------------------

async function byPatient(
  ctx: any,
  table: string,
  patientId: Id<"patients">,
  shareToken?: string,
) {
  // Every child-table read is gated by patient access (demo | owner | share).
  // Fail safe: no access → empty, never a thrown error that blanks the UI.
  if (!(await canRead(ctx, patientId, shareToken))) return [];
  return ctx.db
    .query(table)
    .withIndex("by_patient", (q: any) => q.eq("patientId", patientId))
    .collect();
}

function pct(from: number, to: number) {
  if (from === 0) return 0;
  return Math.round(((to - from) / from) * 100);
}

// ---- patient + import ----------------------------------------------------

export const demoPatientId = query({
  args: {},
  handler: async (ctx) => {
    const p = await ctx.db
      .query("patients")
      .withIndex("by_demo", (q) => q.eq("isDemo", true))
      .first();
    return p?._id ?? null;
  },
});

export const getPatient = query({
  args: { patientId: v.id("patients") },
  handler: async (ctx, { patientId }) => {
    if (!(await canRead(ctx, patientId))) return null;
    return ctx.db.get(patientId);
  },
});

export const getProcessingJob = query({
  args: { patientId: v.id("patients") },
  handler: async (ctx, { patientId }) => {
    const jobs = await byPatient(ctx, "processingJobs", patientId);
    return jobs.sort((a: any, b: any) => b.startedAt - a.startedAt)[0] ?? null;
  },
});

// ---- summary counts for the import screen --------------------------------

export const getSummary = query({
  args: { patientId: v.id("patients") },
  handler: async (ctx, { patientId }) => {
    const [docs, obs, meds, conds, encs, provs] = await Promise.all([
      byPatient(ctx, "documents", patientId),
      byPatient(ctx, "observations", patientId),
      byPatient(ctx, "medications", patientId),
      byPatient(ctx, "conditions", patientId),
      byPatient(ctx, "encounters", patientId),
      byPatient(ctx, "providers", patientId),
    ]);
    const years = obs.map((o: any) => new Date(o.date).getUTCFullYear());
    const span = years.length ? Math.max(...years) - Math.min(...years) : 0;
    return {
      documents: docs.length,
      labResults: obs.length,
      medications: meds.length,
      conditions: conds.length,
      encounters: encs.length,
      providers: provs.length,
      years: span,
    };
  },
});

// ---- timeline ------------------------------------------------------------

export const getTimeline = query({
  args: { patientId: v.id("patients") },
  handler: async (ctx, { patientId }) => {
    const [encs, meds, conds] = await Promise.all([
      byPatient(ctx, "encounters", patientId),
      byPatient(ctx, "medications", patientId),
      byPatient(ctx, "conditions", patientId),
    ]);

    type Item = {
      id: string;
      type: string;
      date: number;
      title: string;
      subtitle?: string;
      documentId?: Id<"documents">;
      page?: number;
    };
    const items: Item[] = [];
    for (const e of encs) {
      items.push({
        id: e._id,
        type: "encounter",
        date: e.date,
        title: e.title,
        subtitle: e.org ?? e.provider,
        documentId: e.documentId,
        page: e.page,
      });
    }
    for (const m of meds) {
      if (m.startDate) {
        items.push({
          id: m._id,
          type: "medication",
          date: m.startDate,
          title: `${m.name} started`,
          subtitle: m.dose ? `${m.dose} ${m.doseUnit}` : undefined,
          documentId: m.documentId,
          page: m.page,
        });
      }
    }
    // Only surface the "documented" diagnosis (dedupe by normalized name, latest).
    const seen = new Set<string>();
    for (const c of conds.sort((a: any, b: any) => (b.diagnosedDate ?? 0) - (a.diagnosedDate ?? 0))) {
      if (seen.has(c.normalizedName)) continue;
      seen.add(c.normalizedName);
      if (c.diagnosedDate) {
        items.push({
          id: c._id,
          type: "condition",
          date: c.diagnosedDate,
          title: `${c.name} documented`,
          documentId: c.documentId,
          page: c.page,
        });
      }
    }
    // Canonical order: newest first (what timelines/feeds expect).
    items.sort((a, b) => b.date - a.date);
    return items;
  },
});

// ---- metrics list --------------------------------------------------------

export const listMetrics = query({
  args: { patientId: v.id("patients") },
  handler: async (ctx, { patientId }) => {
    const obs = await byPatient(ctx, "observations", patientId);
    const byCode: Record<string, any[]> = {};
    for (const o of obs) (byCode[o.code] ??= []).push(o);
    const list = Object.entries(byCode).map(([code, series]) => {
      series.sort((a, b) => a.date - b.date);
      const meta = metaFor(code, series[0].label, series[0].unit);
      const first = series[0];
      const last = series[series.length - 1];
      return {
        code,
        label: meta.label,
        unit: first.unit || meta.unit, // trust the record's own unit (kg vs lb, etc.)
        direction: meta.direction,
        primary: PRIMARY_CODES.has(code),
        first: first.value,
        last: last.value,
        firstDate: first.date,
        lastDate: last.date,
        count: series.length,
        changePct: pct(first.value, last.value),
      };
    });
    // Charted canonical metrics first, then the busiest series.
    return list.sort((a, b) => Number(b.primary) - Number(a.primary) || b.count - a.count);
  },
});

export const listObservations = query({
  args: { patientId: v.id("patients") },
  handler: async (ctx, { patientId }) => {
    const obs = await byPatient(ctx, "observations", patientId);
    return obs.sort((a: any, b: any) => a.date - b.date);
  },
});

// ---- one metric + everything around it (the graph) -----------------------

export const getMetric = query({
  args: { patientId: v.id("patients"), code: v.string() },
  handler: async (ctx, { patientId, code }) => {
    const [obs, meds, conds, encs] = await Promise.all([
      byPatient(ctx, "observations", patientId),
      byPatient(ctx, "medications", patientId),
      byPatient(ctx, "conditions", patientId),
      byPatient(ctx, "encounters", patientId),
    ]);
    const series = obs
      .filter((o: any) => o.code === code)
      .sort((a: any, b: any) => a.date - b.date)
      .map((o: any) => ({
        id: o._id,
        value: o.value,
        unit: o.unit,
        date: o.date,
        provider: o.provider,
        provenance: o.provenance,
        documentId: o.documentId,
        page: o.page,
      }));
    if (series.length === 0) return null;

    const meta = metaFor(code, series[0].unit ? series[0].unit : code, series[0].unit);
    const spanStart = series[0].date;
    const spanEnd = series[series.length - 1].date;

    // Co-metrics: other charted (primary) series for quick switching.
    const others: Record<string, { code: string; label: string; unit: string; points: any[] }> = {};
    for (const o of obs) {
      if (o.code === code || !PRIMARY_CODES.has(o.code)) continue;
      const m = metaFor(o.code, o.label, o.unit);
      (others[o.code] ??= { code: o.code, label: m.label, unit: o.unit, points: [] }).points.push({
        value: o.value,
        date: o.date,
      });
    }
    Object.values(others).forEach((s) => s.points.sort((a, b) => a.date - b.date));

    // Related meds within the timespan — deduped by name (earliest start), capped.
    const medSeen = new Set<string>();
    const relatedMeds = meds
      .filter((m: any) => (m.startDate ?? spanEnd) <= spanEnd)
      .sort((a: any, b: any) => (a.startDate ?? 0) - (b.startDate ?? 0))
      .filter((m: any) => {
        const k = m.name.toLowerCase();
        if (medSeen.has(k)) return false;
        medSeen.add(k);
        return true;
      })
      .slice(0, 12)
      .map((m: any) => ({
        id: m._id,
        name: m.name,
        dose: m.dose,
        doseUnit: m.doseUnit,
        startDate: m.startDate,
        documentId: m.documentId,
        page: m.page,
      }));
    const seen = new Set<string>();
    const relatedConds = conds
      .sort((a: any, b: any) => (a.diagnosedDate ?? 0) - (b.diagnosedDate ?? 0))
      .filter((c: any) => {
        if (seen.has(c.normalizedName)) return false;
        seen.add(c.normalizedName);
        return true;
      })
      .slice(0, 12)
      .map((c: any) => ({
        id: c._id,
        name: c.name,
        diagnosedDate: c.diagnosedDate,
        documentId: c.documentId,
        page: c.page,
      }));

    // A defensible narrative sentence about the most recent movement.
    const last = series[series.length - 1];
    const prevPeak = series.reduce((mx: any, p: any) => (p.value > mx.value ? p : mx), series[0]);
    let insight: string | null = null;
    if (meta.direction === "high_bad" && last.value < prevPeak.value) {
      const drop = pct(prevPeak.value, last.value);
      const statin = relatedMeds.find((m: any) => m.startDate && m.startDate < last.date && m.startDate > prevPeak.date);
      if (statin) {
        insight = `${meta.label} decreased ${Math.abs(drop)}% in the months following the recorded ${statin.name} start.`;
      }
    }

    // Ordered event list for "timeline around this change".
    const around = [
      ...series.map((s: any) => ({
        date: s.date,
        label: `${meta.label} reaches ${s.value} ${s.unit}`,
        kind: "measurement",
      })),
      ...relatedMeds
        .filter((m: any) => m.startDate)
        .map((m: any) => ({ date: m.startDate, label: `${m.name} started`, kind: "medication" })),
      ...relatedConds
        .filter((c: any) => c.diagnosedDate)
        .map((c: any) => ({ date: c.diagnosedDate, label: `${c.name} documented`, kind: "condition" })),
    ].sort((a, b) => a.date - b.date);

    return {
      code,
      label: meta.label,
      unit: series[0].unit || meta.unit,
      direction: meta.direction,
      refHigh: meta.refHigh,
      refLow: meta.refLow,
      series,
      others: Object.values(others),
      relatedMeds,
      relatedConds,
      insight,
      around,
      first: series[0].value,
      last: last.value,
      peak: prevPeak.value,
    };
  },
});

// ---- documents / evidence ------------------------------------------------

export const getDocument = query({
  // shareToken lets the public doctor view resolve evidence without an account.
  args: { documentId: v.id("documents"), shareToken: v.optional(v.string()) },
  handler: async (ctx, { documentId, shareToken }) => {
    const doc = await ctx.db.get(documentId);
    if (!doc) return null;
    if (!(await canRead(ctx, doc.patientId, shareToken))) return null;
    let url: string | null = null;
    if (doc.storageId) url = await ctx.storage.getUrl(doc.storageId);
    return { ...doc, url };
  },
});

export const listDocuments = query({
  args: { patientId: v.id("patients") },
  handler: async (ctx, { patientId }) => {
    const docs = await byPatient(ctx, "documents", patientId);
    return docs.sort((a: any, b: any) => a.receivedAt - b.receivedAt);
  },
});

// ---- clinical lists ------------------------------------------------------

export const listMedications = query({
  args: { patientId: v.id("patients") },
  handler: async (ctx, { patientId }) =>
    (await byPatient(ctx, "medications", patientId)).sort(
      (a: any, b: any) => (b.startDate ?? 0) - (a.startDate ?? 0),
    ),
});

export const listConditions = query({
  args: { patientId: v.id("patients") },
  handler: async (ctx, { patientId }) =>
    (await byPatient(ctx, "conditions", patientId)).sort(
      (a: any, b: any) => (b.diagnosedDate ?? 0) - (a.diagnosedDate ?? 0),
    ),
});

export const listAllergies = query({
  args: { patientId: v.id("patients") },
  handler: async (ctx, { patientId }) => byPatient(ctx, "allergies", patientId),
});

export const listProviders = query({
  args: { patientId: v.id("patients") },
  handler: async (ctx, { patientId }) => byPatient(ctx, "providers", patientId),
});

export const listConflicts = query({
  args: { patientId: v.id("patients") },
  handler: async (ctx, { patientId }) => byPatient(ctx, "conflicts", patientId),
});

export const listMissing = query({
  args: { patientId: v.id("patients") },
  handler: async (ctx, { patientId }) => byPatient(ctx, "missingRecords", patientId),
});

// ---- compare two periods -------------------------------------------------

export const compare = query({
  args: { patientId: v.id("patients"), yearA: v.number(), yearB: v.number() },
  handler: async (ctx, { patientId, yearA, yearB }) => {
    const [obs, meds, conds, provs, encs] = await Promise.all([
      byPatient(ctx, "observations", patientId),
      byPatient(ctx, "medications", patientId),
      byPatient(ctx, "conditions", patientId),
      byPatient(ctx, "providers", patientId),
      byPatient(ctx, "encounters", patientId),
    ]);
    const yr = (t: number) => new Date(t).getUTCFullYear();

    // For each metric, value nearest each year (<= year end).
    const near = (code: string, year: number) => {
      const cand = obs
        .filter((o: any) => o.code === code && yr(o.date) <= year)
        .sort((a: any, b: any) => b.date - a.date);
      return cand[0];
    };
    const codes = Array.from(new Set(obs.map((o: any) => o.code))) as string[];
    const measurements = codes
      .map((code: string) => {
        const a = near(code, yearA);
        const b = near(code, yearB);
        if (!a || !b) return null;
        const meta = metaFor(code, a.label, a.unit);
        return {
          code,
          label: meta.label,
          unit: a.unit,
          from: a.value,
          to: b.value,
          changePct: pct(a.value, b.value),
          direction: meta.direction,
        };
      })
      .filter(Boolean);

    const between = (t: number | undefined) => t !== undefined && yr(t) > yearA && yr(t) <= yearB;
    const seenC = new Set<string>();
    const newConditions = conds
      .filter((c: any) => between(c.diagnosedDate))
      .filter((c: any) => (seenC.has(c.normalizedName) ? false : (seenC.add(c.normalizedName), true)))
      .map((c: any) => c.name);
    const newMeds = meds.filter((m: any) => between(m.startDate)).map((m: any) => m.name);
    // New providers/orgs seen in the later window.
    const orgsA = new Set(
      encs.filter((e: any) => yr(e.date) <= yearA).map((e: any) => e.org).filter(Boolean),
    );
    const newProviders = Array.from(
      new Set(
        encs
          .filter((e: any) => between(e.date))
          .map((e: any) => e.org)
          .filter((o: any) => o && !orgsA.has(o)),
      ),
    ) as string[];
    const majorEvents = encs
      .filter((e: any) => between(e.date) && (e.kind === "ER visit" || e.kind === "Specialist visit"))
      .map((e: any) => e.title);

    return { yearA, yearB, measurements, newConditions, newMeds, newProviders, majorEvents };
  },
});

// ---- doctor snapshot -----------------------------------------------------

export const doctorSnapshot = query({
  args: { patientId: v.id("patients"), shareToken: v.optional(v.string()) },
  handler: async (ctx, { patientId, shareToken }) => {
    if (!(await canRead(ctx, patientId, shareToken))) return null;
    const [patient, meds, conds, allergies, obs, encs, conflicts, docs] = await Promise.all([
      ctx.db.get(patientId),
      byPatient(ctx, "medications", patientId, shareToken),
      byPatient(ctx, "conditions", patientId, shareToken),
      byPatient(ctx, "allergies", patientId, shareToken),
      byPatient(ctx, "observations", patientId, shareToken),
      byPatient(ctx, "encounters", patientId, shareToken),
      byPatient(ctx, "conflicts", patientId, shareToken),
      byPatient(ctx, "documents", patientId, shareToken),
    ]);
    if (!patient) return null;

    const activeMeds = meds
      .filter((m: any) => m.status === "active")
      .map((m: any) => ({ name: m.name, dose: m.dose, doseUnit: m.doseUnit, documentId: m.documentId, page: m.page }));
    const seen = new Set<string>();
    const activeConds = conds
      .filter((c: any) => c.status === "active")
      .sort((a: any, b: any) => (b.diagnosedDate ?? 0) - (a.diagnosedDate ?? 0))
      .filter((c: any) => (seen.has(c.normalizedName) ? false : (seen.add(c.normalizedName), true)))
      .map((c: any) => ({ name: c.name, documentId: c.documentId, page: c.page }));

    // Trends: metrics with >= 3 points.
    const byCode: Record<string, any[]> = {};
    for (const o of obs) (byCode[o.code] ??= []).push(o);
    const trends = Object.entries(byCode)
      .filter(([, s]) => s.length >= 3)
      .map(([code, s]) => {
        s.sort((a, b) => a.date - b.date);
        const meta = metaFor(code, s[0].label, s[0].unit);
        const peak = s.reduce((mx, p) => (p.value > mx.value ? p : mx), s[0]);
        return {
          code,
          label: meta.label,
          first: s[0].value,
          peak: peak.value,
          last: s[s.length - 1].value,
          unit: s[0].unit,
        };
      });

    const recent = [...encs]
      .map((e: any) => ({ date: e.date, label: e.summary ?? e.title, documentId: e.documentId, page: e.page }))
      .sort((a, b) => b.date - a.date)
      .slice(0, 6);

    const orgs = Array.from(new Set(docs.map((d: any) => d.org))) as string[];

    return {
      patient: { name: patient.name, age: patient.age, recordsFrom: patient.recordsFrom },
      orgs,
      activeMeds,
      activeConds,
      allergies: allergies.map((a: any) => ({ substance: a.substance, documentId: a.documentId, page: a.page })),
      trends,
      recent,
      conflicts: conflicts.filter((c: any) => c.status === "open"),
    };
  },
});

export const getShare = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const share = await ctx.db
      .query("shares")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();
    if (!share) return null;
    if (share.expiresAt < Date.now()) return { expired: true, patientId: null };
    return { expired: false, patientId: share.patientId };
  },
});

// What actually happened at a visit: every record dated the same day — labs
// measured, meds started, diagnoses made. Turns a bare "Follow-up" into content.
export const visitRecords = query({
  args: { patientId: v.id("patients"), date: v.number(), shareToken: v.optional(v.string()) },
  handler: async (ctx, { patientId, date, shareToken }) => {
    if (!(await canRead(ctx, patientId, shareToken))) return null;
    const d = new Date(date);
    const start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    const end = start + 24 * 3600 * 1000;
    const inDay = (t?: number) => t != null && t >= start && t < end;
    const [obs, meds, conds] = await Promise.all([
      byPatient(ctx, "observations", patientId, shareToken),
      byPatient(ctx, "medications", patientId, shareToken),
      byPatient(ctx, "conditions", patientId, shareToken),
    ]);
    const labs = obs
      .filter((o: any) => inDay(o.date))
      .map((o: any) => {
        const meta = metaFor(o.code, o.label, o.unit);
        const abnormal = (meta.refHigh != null && o.value > meta.refHigh) || (meta.refLow != null && o.value < meta.refLow);
        return { code: o.code, label: o.label, value: o.value, unit: o.unit, abnormal, documentId: o.documentId, page: o.page };
      });
    const seen = new Set<string>();
    return {
      labs,
      meds: meds.filter((m: any) => inDay(m.startDate)).map((m: any) => ({ name: m.name, dose: m.dose ? `${m.dose} ${m.doseUnit ?? ""}`.trim() : null, documentId: m.documentId, page: m.page })),
      conditions: conds
        .filter((c: any) => inDay(c.diagnosedDate) && (seen.has(c.normalizedName) ? false : (seen.add(c.normalizedName), true)))
        .map((c: any) => ({ name: c.name, documentId: c.documentId, page: c.page })),
    };
  },
});

// ---- search --------------------------------------------------------------

// Levenshtein edit distance — used for typo-tolerant search (e.g. a user types
// "simvastatin" but the record has the variant "Simvistatin").
function editDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 3) return 99;
  const d = new Array(n + 1);
  for (let j = 0; j <= n; j++) d[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = d[0];
    d[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = d[j];
      d[j] = a[i - 1] === b[j - 1] ? prev : Math.min(prev, d[j], d[j - 1]) + 1;
      prev = tmp;
    }
  }
  return d[n];
}
// True if any word in `text` is a near-match (small edit distance) of `term`.
function fuzzyHit(text: string, term: string): boolean {
  if (term.length < 4) return false;
  const thresh = term.length <= 6 ? 1 : 2;
  return text.split(/[^a-z0-9]+/).some((w) => w.length >= 4 && editDistance(w, term) <= thresh);
}

// A short highlighted window around the matched term in a document excerpt.
function snippetOf(text: string | undefined, term: string): string {
  if (!text) return "";
  const i = text.toLowerCase().indexOf(term);
  if (i < 0) return text.slice(0, 100).trim();
  const start = Math.max(0, i - 40);
  return (start > 0 ? "…" : "") + text.slice(start, i + term.length + 60).replace(/\s+/g, " ").trim() + "…";
}

export const search = query({
  args: { patientId: v.id("patients"), q: v.string() },
  handler: async (ctx, { patientId, q }) => {
    const query = q.trim();
    const lc = query.toLowerCase();
    if (!lc) return { kind: "empty" as const };
    if (!(await canRead(ctx, patientId))) return { kind: "empty" as const };

    // Year search reconstructs a year (needs the full per-patient sets).
    if (/^(19|20)\d{2}$/.test(lc)) {
      const year = parseInt(lc, 10);
      const yr = (t: number) => new Date(t).getUTCFullYear();
      const [obs, encs, meds] = await Promise.all([
        byPatient(ctx, "observations", patientId),
        byPatient(ctx, "encounters", patientId),
        byPatient(ctx, "medications", patientId),
      ]);
      return {
        kind: "year" as const,
        year,
        encounters: encs.filter((e: any) => yr(e.date) === year),
        observations: obs.filter((o: any) => yr(o.date) === year),
        medications: meds.filter((m: any) => m.startDate && yr(m.startDate) === year),
      };
    }

    // Metric shortcut → jump to the graph (verified via the by_patient_code index).
    const codeByWord: Record<string, string> = { cholesterol: "LDL", ldl: "LDL", hba1c: "HBA1C", a1c: "HBA1C", sugar: "HBA1C", weight: "WEIGHT", "vitamin d": "VITD" };
    for (const [word, code] of Object.entries(codeByWord)) {
      if (lc.includes(word)) {
        const has = await ctx.db
          .query("observations")
          .withIndex("by_patient_code", (x) => x.eq("patientId", patientId).eq("code", code))
          .first();
        if (has) return { kind: "metric" as const, code };
      }
    }

    // Native full-text search — relevance-ranked, per-patient, no table scan.
    const run = (table: string, field: string, idx: string) =>
      (ctx.db.query(table as any) as any)
        .withSearchIndex(idx, (s: any) => s.search(field, query).eq("patientId", patientId))
        .take(8);
    let [medications, conditions, encounters, missing, docs] = await Promise.all([
      run("medications", "name", "search_name"),
      run("conditions", "name", "search_name"),
      run("encounters", "title", "search_title"),
      run("missingRecords", "label", "search_label"),
      run("documents", "excerpt", "search_excerpt"),
    ]);

    // Forgiving fallback: the search index is token-based, so a substring inside
    // a word ("statin" in "Atorvastatin") won't match. If no STRUCTURED record
    // hit (documents aside), fall back to a per-patient substring scan.
    if (medications.length + conditions.length + encounters.length + missing.length === 0) {
      // Substring OR typo-tolerant (fuzzy) match.
      const hit = (s?: string) => { const t = (s ?? "").toLowerCase(); return t.includes(lc) || fuzzyHit(t, lc); };
      const [meds, conds, encs, miss] = await Promise.all([
        byPatient(ctx, "medications", patientId),
        byPatient(ctx, "conditions", patientId),
        byPatient(ctx, "encounters", patientId),
        byPatient(ctx, "missingRecords", patientId),
      ]);
      medications = meds.filter((m: any) => hit(m.name) || hit(m.normalizedName)).slice(0, 8);
      conditions = conds.filter((c: any) => hit(c.name) || hit(c.normalizedName)).slice(0, 8);
      encounters = encs.filter((e: any) => hit(e.title) || hit(e.org)).slice(0, 8);
      missing = miss.filter((m: any) => hit(m.label) || hit(m.org)).slice(0, 8);
    }

    return {
      kind: "results" as const,
      query: lc,
      medications,
      conditions,
      encounters,
      missing,
      documents: (docs as any[]).map((d: any) => ({ _id: d._id, org: d.org, filename: d.filename, receivedAt: d.receivedAt, snippet: snippetOf(d.excerpt, lc) })),
    };
  },
});
