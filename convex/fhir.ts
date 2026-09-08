import { action, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { assertWrite } from "./authz";
import { rebuildEvents } from "./events";

// SMART on FHIR ingestion. The same mapper serves the open sandbox and any
// OAuth-connected provider (Epic, Cerner, aggregators) — only the base URL +
// auth header change.

const LOINC: Record<string, { code: string; label: string }> = {
  // lipids
  "13457-7": { code: "LDL", label: "LDL Cholesterol" },
  "18262-6": { code: "LDL", label: "LDL Cholesterol" },
  "2089-1": { code: "LDL", label: "LDL Cholesterol" },
  "2085-9": { code: "HDL", label: "HDL Cholesterol" },
  "2093-3": { code: "CHOL_TOTAL", label: "Total Cholesterol" },
  "2571-8": { code: "TRIG", label: "Triglycerides" },
  "3043-7": { code: "TRIG", label: "Triglycerides" },
  // diabetes / glucose
  "4548-4": { code: "HBA1C", label: "HbA1c" },
  "4549-2": { code: "HBA1C", label: "HbA1c" },
  "17856-6": { code: "HBA1C", label: "HbA1c" },
  "2339-0": { code: "GLUCOSE", label: "Glucose" },
  "2345-7": { code: "GLUCOSE", label: "Glucose" },
  // vitals
  "29463-7": { code: "WEIGHT", label: "Weight" },
  "3141-9": { code: "WEIGHT", label: "Weight" },
  "8302-2": { code: "HEIGHT", label: "Height" },
  "39156-5": { code: "BMI", label: "Body Mass Index" },
  "8867-4": { code: "HR", label: "Heart rate" },
  "8480-6": { code: "BP_SYS", label: "Blood pressure (systolic)" },
  "8462-4": { code: "BP_DIA", label: "Blood pressure (diastolic)" },
  "8310-5": { code: "TEMP", label: "Body temperature" },
  "9279-1": { code: "RESP", label: "Respiratory rate" },
  "2708-6": { code: "O2SAT", label: "Oxygen saturation" },
  "59408-5": { code: "O2SAT", label: "Oxygen saturation" },
  // renal / metabolic
  "2160-0": { code: "CREATININE", label: "Creatinine" },
  "33914-3": { code: "EGFR", label: "eGFR" },
  "48642-3": { code: "EGFR", label: "eGFR" },
  "2951-2": { code: "SODIUM", label: "Sodium" },
  "2823-3": { code: "POTASSIUM", label: "Potassium" },
  // CBC
  "718-7": { code: "HGB", label: "Hemoglobin" },
  "4544-3": { code: "HCT", label: "Hematocrit" },
  "6690-2": { code: "WBC", label: "White blood cells" },
  "777-3": { code: "PLT", label: "Platelets" },
  // liver
  "1742-6": { code: "ALT", label: "ALT (SGPT)" },
  "1920-8": { code: "AST", label: "AST (SGOT)" },
  // vitamin D
  "14635-7": { code: "VITD", label: "Vitamin D, 25-OH" },
  "1989-3": { code: "VITD", label: "Vitamin D, 25-OH" },
  "62292-8": { code: "VITD", label: "Vitamin D, 25-OH" },
};

type FObs = { code: string; label: string; value: number; unit: string; date: number; encounterRef?: string };
type FMed = { name: string; normalizedName: string; dose?: number; doseUnit?: string; startDate?: number; encounterRef?: string };
type FCond = { name: string; normalizedName: string; diagnosedDate?: number; encounterRef?: string };
type FEnc = { kind: string; title: string; date: number; summary?: string; fhirId?: string };
type FAllergy = { substance: string; reaction?: string };

function entries(bundle: any): any[] {
  return Array.isArray(bundle?.entry) ? bundle.entry.map((e: any) => e.resource).filter(Boolean) : [];
}
const ms = (s?: string) => (s ? Date.parse(s) || undefined : undefined);
// The FHIR encounter this resource explicitly belongs to (id, prefix stripped).
const encRef = (r: any): string | undefined => {
  const ref = r?.encounter?.reference ?? (Array.isArray(r?.encounter) ? r.encounter[0]?.reference : undefined);
  return ref ? String(ref).split("/").pop() : undefined;
};
const normDrug = (name: string) => name.toLowerCase().replace(/\s*\d.*$/, "").trim();

// A fetcher bound to a base URL and optional bearer token.
function makeGet(base: string, token?: string) {
  return async (path: string) => {
    const res = await fetch(`${base}${path}`, {
      headers: {
        Accept: "application/fhir+json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) throw new Error(`FHIR ${res.status} on ${path}`);
    return res.json();
  };
}

// Pull + normalize a single patient's record. Provider-agnostic.
async function collectPatient(get: (p: string) => Promise<any>, pid: string) {
  const [patient, labB, vitalB, medB, condB, allergyB, encB] = await Promise.all([
    get(`/Patient/${pid}`).catch(() => null),
    get(`/Observation?patient=${pid}&category=laboratory&_count=80&_sort=-date`).catch(() => ({})),
    get(`/Observation?patient=${pid}&category=vital-signs&_count=60&_sort=-date`).catch(() => ({})),
    get(`/MedicationRequest?patient=${pid}&_count=40`).catch(() => ({})),
    get(`/Condition?patient=${pid}&_count=40`).catch(() => ({})),
    get(`/AllergyIntolerance?patient=${pid}&_count=20`).catch(() => ({})),
    get(`/Encounter?patient=${pid}&_count=40&_sort=-date`).catch(() => ({})),
  ]);

  const patientName = (() => {
    const n = patient?.name?.[0];
    if (!n) return "FHIR patient";
    return [Array.isArray(n.given) ? n.given.join(" ") : n.given, n.family].filter(Boolean).join(" ") || "FHIR patient";
  })();

  // Map one FHIR Observation to 0+ normalized points (BP yields systolic+diastolic).
  const mapObs = (r: any): FObs[] => {
    const date = ms(r?.effectiveDateTime ?? r?.issued);
    if (!date) return [];
    const ref = encRef(r);

    // Component observations (e.g. blood pressure) → one point per known component.
    if (Array.isArray(r?.component) && r.component.length) {
      const out: FObs[] = [];
      for (const comp of r.component) {
        const cLoinc = comp?.code?.coding?.find((c: any) => c.system?.includes("loinc"))?.code;
        const m = cLoinc ? LOINC[cLoinc] : undefined;
        const q = comp?.valueQuantity;
        if (m && q?.value != null) out.push({ code: m.code, label: m.label, value: Math.round(q.value), unit: q.unit ?? "mmHg", date, encounterRef: ref });
      }
      if (out.length) return out;
    }

    const q = r?.valueQuantity;
    if (q?.value == null) return [];
    const coding = r?.code?.coding?.find((c: any) => c.system?.includes("loinc")) ?? r?.code?.coding?.[0];
    const loinc = coding?.code;
    const mapped = loinc ? LOINC[loinc] : undefined;
    // Skip noisy unmapped labs so the timeline/charts stay clean and legible.
    if (!mapped) return [];
    return [{ code: mapped.code, label: mapped.label, value: Number(q.value.toFixed?.(1) ?? q.value), unit: q.unit ?? "", date, encounterRef: ref }];
  };

  const observations = [...entries(labB), ...entries(vitalB)].flatMap(mapObs).slice(0, 400);
  const medsRaw: FMed[] = entries(medB)
    .map((r: any): FMed | null => {
      const name = r?.medicationCodeableConcept?.coding?.[0]?.display ?? r?.medicationCodeableConcept?.text;
      return name ? { name, normalizedName: normDrug(name), startDate: ms(r?.authoredOn), encounterRef: encRef(r) } : null;
    })
    .filter((m): m is FMed => !!m);
  // One row per drug — FHIR emits a MedicationRequest per refill/renewal; keep
  // the earliest (the true start) so the record isn't 20× "Simvastatin".
  const medMap = new Map<string, FMed>();
  for (const m of medsRaw) {
    const ex = medMap.get(m.normalizedName);
    if (!ex || (m.startDate ?? Infinity) < (ex.startDate ?? Infinity)) medMap.set(m.normalizedName, m);
  }
  const medications: FMed[] = [...medMap.values()].slice(0, 40);
  const conditions: FCond[] = entries(condB)
    .map((r: any): FCond | null => {
      const name = r?.code?.coding?.[0]?.display ?? r?.code?.text;
      return name ? { name, normalizedName: name.toLowerCase(), diagnosedDate: ms(r?.onsetDateTime ?? r?.recordedDate), encounterRef: encRef(r) } : null;
    })
    .filter((c): c is FCond => !!c)
    .slice(0, 40);
  const allergies: FAllergy[] = entries(allergyB)
    .map((r: any): FAllergy | null => {
      const substance = r?.code?.coding?.[0]?.display ?? r?.code?.text;
      return substance ? { substance, reaction: r?.reaction?.[0]?.manifestation?.[0]?.coding?.[0]?.display } : null;
    })
    .filter((a): a is FAllergy => !!a)
    .slice(0, 20);
  const encounters: FEnc[] = entries(encB)
    .map((r: any): FEnc | null => {
      const date = ms(r?.period?.start);
      if (!date) return null;
      const title = r?.type?.[0]?.coding?.[0]?.display ?? r?.type?.[0]?.text ?? "Encounter";
      const kind = r?.class?.code === "AMB" ? "Visit" : r?.class?.display ?? "Encounter";
      return { kind, title, date, fhirId: r?.id ? String(r.id) : undefined };
    })
    .filter((e): e is FEnc => !!e)
    .slice(0, 40);

  const age = patient?.birthDate
    ? Math.floor((Date.now() - Date.parse(patient.birthDate)) / (365.25 * 24 * 3600 * 1000))
    : undefined;

  return { patientName, age, observations, medications, conditions, allergies, encounters };
}

// ---- persist a pulled bundle --------------------------------------------
export const insertFhirBundle = internalMutation({
  args: {
    patientId: v.id("patients"),
    org: v.string(),
    fhirBaseUrl: v.string(),
    fhirPatientId: v.string(),
    patientName: v.optional(v.string()),
    age: v.optional(v.number()),
    observations: v.array(v.object({ code: v.string(), label: v.string(), value: v.number(), unit: v.string(), date: v.number(), encounterRef: v.optional(v.string()) })),
    medications: v.array(v.object({ name: v.string(), normalizedName: v.string(), dose: v.optional(v.number()), doseUnit: v.optional(v.string()), startDate: v.optional(v.number()), encounterRef: v.optional(v.string()) })),
    conditions: v.array(v.object({ name: v.string(), normalizedName: v.string(), diagnosedDate: v.optional(v.number()), encounterRef: v.optional(v.string()) })),
    encounters: v.array(v.object({ kind: v.string(), title: v.string(), date: v.number(), summary: v.optional(v.string()), fhirId: v.optional(v.string()) })),
    allergies: v.array(v.object({ substance: v.string(), reaction: v.optional(v.string()) })),
    bypassAuth: v.optional(v.boolean()), // true only for trusted internal cron re-sync
  },
  handler: async (ctx, a) => {
    if (!a.bypassAuth) await assertWrite(ctx, a.patientId);

    // Idempotent sync: clear this provider's prior FHIR snapshot + facts first,
    // so re-syncing refreshes rather than duplicating.
    const priorDocs = await ctx.db
      .query("documents")
      .withIndex("by_patient", (q) => q.eq("patientId", a.patientId))
      .collect();
    const staleDocIds = new Set(
      priorDocs.filter((d) => d.kind === "fhir" && d.org === a.org).map((d) => d._id),
    );
    if (staleDocIds.size) {
      for (const t of ["observations", "medications", "conditions", "encounters", "allergies"] as const) {
        const rows = await ctx.db
          .query(t)
          .withIndex("by_patient", (q) => q.eq("patientId", a.patientId))
          .collect();
        for (const r of rows) if ((r as any).documentId && staleDocIds.has((r as any).documentId)) await ctx.db.delete(r._id);
      }
      for (const id of staleDocIds) await ctx.db.delete(id);
    }

    const documentId: Id<"documents"> = await ctx.db.insert("documents", {
      patientId: a.patientId,
      filename: `FHIR_R4_${a.fhirPatientId}.json`,
      org: a.org,
      kind: "fhir",
      pages: 1,
      receivedVia: "fhir",
      receivedAt: Date.now(),
      excerpt:
        `SMART on FHIR (R4) — ${a.org}\n` +
        `Patient resource: Patient/${a.fhirPatientId}\n` +
        `Imported live from ${a.fhirBaseUrl}\n` +
        `${a.observations.length} observations · ${a.medications.length} medications · ` +
        `${a.conditions.length} conditions · ${a.encounters.length} encounters · ${a.allergies.length} allergies.`,
    });

    for (const o of a.observations)
      await ctx.db.insert("observations", { patientId: a.patientId, ...o, documentId, page: 1, provenance: "imported" });
    for (const m of a.medications)
      await ctx.db.insert("medications", { patientId: a.patientId, name: m.name, normalizedName: m.normalizedName, dose: m.dose, doseUnit: m.doseUnit, status: "active", startDate: m.startDate, encounterRef: m.encounterRef, documentId, page: 1, provenance: "imported" });
    for (const c of a.conditions)
      await ctx.db.insert("conditions", { patientId: a.patientId, name: c.name, normalizedName: c.normalizedName, status: "active", diagnosedDate: c.diagnosedDate, encounterRef: c.encounterRef, documentId, page: 1, provenance: "imported" });
    for (const e of a.encounters)
      await ctx.db.insert("encounters", { patientId: a.patientId, kind: e.kind, title: e.title, date: e.date, summary: e.summary, fhirId: e.fhirId, documentId, page: 1, provenance: "imported" });
    for (const al of a.allergies)
      await ctx.db.insert("allergies", { patientId: a.patientId, substance: al.substance, reaction: al.reaction, documentId, page: 1, provenance: "imported" });

    // Adopt the connected patient's identity + record span (only if empty name).
    const patient = await ctx.db.get(a.patientId);
    const years = a.observations.map((o) => new Date(o.date).getUTCFullYear());
    const patch: Record<string, any> = {};
    if (a.patientName && (!patient?.name || patient.name === "My health")) patch.name = a.patientName;
    if (a.age) patch.age = a.age;
    if (years.length) patch.recordsFrom = `${Math.min(...years)}–${Math.max(...years)}`;
    if (Object.keys(patch).length) await ctx.db.patch(a.patientId, patch);

    const counts =
      a.observations.length + a.medications.length + a.conditions.length + a.encounters.length + a.allergies.length;
    await rebuildEvents(ctx, a.patientId);
    return { counts };
  },
});

// ---- connections (OAuth) -------------------------------------------------
export const saveConnection = internalMutation({
  args: {
    patientId: v.id("patients"),
    providerId: v.string(),
    provider: v.string(),
    fhirBaseUrl: v.string(),
    patientFhirId: v.optional(v.string()),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    tokenEndpoint: v.optional(v.string()),
    clientId: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    scope: v.optional(v.string()),
    counts: v.number(),
  },
  handler: async (ctx, a) => {
    await assertWrite(ctx, a.patientId);
    const patient = await ctx.db.get(a.patientId);
    // Replace any prior connection to the same provider.
    const existing = await ctx.db
      .query("connections")
      .withIndex("by_patient", (q) => q.eq("patientId", a.patientId))
      .collect();
    for (const c of existing) if (c.providerId === a.providerId) await ctx.db.delete(c._id);
    return ctx.db.insert("connections", {
      patientId: a.patientId,
      userId: patient?.userId,
      providerId: a.providerId,
      provider: a.provider,
      fhirBaseUrl: a.fhirBaseUrl,
      patientFhirId: a.patientFhirId,
      accessToken: a.accessToken,
      refreshToken: a.refreshToken,
      tokenEndpoint: a.tokenEndpoint,
      clientId: a.clientId,
      expiresAt: a.expiresAt,
      scope: a.scope,
      status: "connected",
      connectedAt: Date.now(),
      lastSyncedAt: Date.now(),
      lastCounts: a.counts,
    });
  },
});

// Exchange an OAuth code (PKCE) for a token, pull the record, store the connection.
export const exchangeAndConnect = action({
  args: {
    patientId: v.id("patients"),
    providerId: v.string(),
    provider: v.string(),
    fhirBaseUrl: v.string(),
    tokenEndpoint: v.string(),
    clientId: v.string(),
    code: v.string(),
    codeVerifier: v.string(),
    redirectUri: v.string(),
  },
  handler: async (ctx, a): Promise<{ patientName: string; counts: number }> => {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code: a.code,
      redirect_uri: a.redirectUri,
      client_id: a.clientId,
      code_verifier: a.codeVerifier,
    });
    const res = await fetch(a.tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body,
    });
    if (!res.ok) throw new Error(`Token exchange failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
    const tok = await res.json();
    const accessToken: string = tok.access_token;
    if (!accessToken) throw new Error("No access token returned by the provider.");

    const get = makeGet(a.fhirBaseUrl, accessToken);
    let pid: string | undefined = tok.patient;
    if (!pid) {
      const me = await get(`/Patient?_count=1`).catch(() => null);
      pid = me?.entry?.[0]?.resource?.id;
    }
    if (!pid) throw new Error("Could not determine the patient from the connection.");

    const data = await collectPatient(get, pid);

    const result = await ctx.runMutation(internal.fhir.insertFhirBundle, {
      patientId: a.patientId,
      org: a.provider,
      fhirBaseUrl: a.fhirBaseUrl,
      fhirPatientId: pid,
      patientName: data.patientName,
      age: data.age,
      observations: data.observations,
      medications: data.medications,
      conditions: data.conditions,
      encounters: data.encounters,
      allergies: data.allergies,
    });

    await ctx.runMutation(internal.fhir.saveConnection, {
      patientId: a.patientId,
      providerId: a.providerId,
      provider: a.provider,
      fhirBaseUrl: a.fhirBaseUrl,
      patientFhirId: pid,
      accessToken,
      refreshToken: tok.refresh_token,
      tokenEndpoint: a.tokenEndpoint,
      clientId: a.clientId,
      expiresAt: tok.expires_in ? Date.now() + tok.expires_in * 1000 : undefined,
      scope: tok.scope,
      counts: result.counts,
    });

    return { patientName: data.patientName, counts: result.counts };
  },
});

export const getConnection = internalQuery({
  args: { connectionId: v.id("connections") },
  handler: async (ctx, { connectionId }) => ctx.db.get(connectionId),
});

export const listAllConnectionIds = internalQuery({
  args: {},
  handler: async (ctx) => (await ctx.db.query("connections").collect()).map((c) => c._id),
});

export const updateConnectionTokens = internalMutation({
  args: {
    connectionId: v.id("connections"),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, a) => {
    const patch: Record<string, any> = { accessToken: a.accessToken };
    if (a.refreshToken) patch.refreshToken = a.refreshToken;
    if (a.expiresAt) patch.expiresAt = a.expiresAt;
    await ctx.db.patch(a.connectionId, patch);
  },
});

export const finishSync = internalMutation({
  args: { connectionId: v.id("connections"), counts: v.number(), status: v.string() },
  handler: async (ctx, a) => {
    await ctx.db.patch(a.connectionId, { lastSyncedAt: Date.now(), lastCounts: a.counts, status: a.status });
  },
});

// Core re-sync: refresh the token if expired, pull, import (idempotent).
// Internal + trusted, so it may write on behalf of the connection's owner.
export const syncOne = internalAction({
  args: { connectionId: v.id("connections") },
  handler: async (ctx, { connectionId }): Promise<{ counts: number }> => {
    const conn: any = await ctx.runQuery(internal.fhir.getConnection, { connectionId });
    if (!conn) return { counts: 0 };

    // Refresh the access token if it's expired/near-expiry and we have a refresh token.
    let accessToken: string = conn.accessToken;
    const needsRefresh = !conn.expiresAt || conn.expiresAt < Date.now() + 60_000;
    if (needsRefresh && conn.refreshToken && conn.tokenEndpoint && conn.clientId) {
      try {
        const body = new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: conn.refreshToken,
          client_id: conn.clientId,
        });
        const res = await fetch(conn.tokenEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
          body,
        });
        if (res.ok) {
          const tok = await res.json();
          if (tok.access_token) {
            accessToken = tok.access_token;
            await ctx.runMutation(internal.fhir.updateConnectionTokens, {
              connectionId,
              accessToken,
              refreshToken: tok.refresh_token,
              expiresAt: tok.expires_in ? Date.now() + tok.expires_in * 1000 : undefined,
            });
          }
        }
      } catch {
        // fall through and try with the existing token
      }
    }

    try {
      const get = makeGet(conn.fhirBaseUrl, accessToken);
      const pid = conn.patientFhirId ?? (await get(`/Patient?_count=1`)).entry?.[0]?.resource?.id;
      if (!pid) throw new Error("No patient for this connection.");
      const data = await collectPatient(get, pid);
      const result = await ctx.runMutation(internal.fhir.insertFhirBundle, {
        patientId: conn.patientId,
        org: conn.provider,
        fhirBaseUrl: conn.fhirBaseUrl,
        fhirPatientId: pid,
        patientName: data.patientName,
        age: data.age,
        observations: data.observations,
        medications: data.medications,
        conditions: data.conditions,
        encounters: data.encounters,
        allergies: data.allergies,
        bypassAuth: true,
      });
      await ctx.runMutation(internal.fhir.finishSync, { connectionId, counts: result.counts, status: "connected" });
      return { counts: result.counts };
    } catch {
      // Token likely fully expired (no refresh) — mark for reconnect.
      await ctx.runMutation(internal.fhir.finishSync, { connectionId, counts: conn.lastCounts ?? 0, status: "error" });
      return { counts: 0 };
    }
  },
});

// Manual re-sync (owner-gated), reused by the UI's "Re-sync" button.
export const syncConnection = action({
  args: { connectionId: v.id("connections") },
  handler: async (ctx, { connectionId }): Promise<{ counts: number }> => {
    const conn: any = await ctx.runQuery(internal.fhir.getConnection, { connectionId });
    if (!conn) throw new Error("Connection not found.");
    const userId = await getAuthUserId(ctx);
    if (conn.userId && conn.userId !== userId) throw new Error("You don't have access to this connection.");
    return ctx.runAction(internal.fhir.syncOne, { connectionId });
  },
});

// Fan-out re-sync for the scheduled cron (every 2 hours).
export const syncAllConnections = internalAction({
  args: {},
  handler: async (ctx): Promise<{ synced: number; total: number }> => {
    const ids: Id<"connections">[] = await ctx.runQuery(internal.fhir.listAllConnectionIds, {});
    let ok = 0;
    for (const id of ids) {
      try {
        await ctx.runAction(internal.fhir.syncOne, { connectionId: id });
        ok++;
      } catch {
        // keep going; a bad connection shouldn't stop the batch
      }
    }
    return { synced: ok, total: ids.length };
  },
});
