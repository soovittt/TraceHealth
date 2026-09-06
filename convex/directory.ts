import { action } from "./_generated/server";
import { v } from "convex/values";

// "Find your provider" — real health systems come from EHR vendor endpoint
// directories. Hospitals (Kaiser, UCSF, Stanford…) run on Epic/Cerner, so each
// maps to that vendor's FHIR base URL. We search Epic's public directory.
const SOURCES = [
  { portal: "epic", url: "https://open.epic.com/Endpoints/R4" },
];

// Cache per isolate so we don't refetch the ~600KB directory every search.
let CACHE: { name: string; fhirBaseUrl: string; portal: string }[] | null = null;

async function loadDirectory() {
  if (CACHE) return CACHE;
  const all: { name: string; fhirBaseUrl: string; portal: string }[] = [];
  for (const s of SOURCES) {
    try {
      const res = await fetch(s.url, { headers: { Accept: "application/json" } });
      if (!res.ok) continue;
      const bundle = await res.json();
      for (const e of bundle.entry ?? []) {
        const r = e.resource ?? {};
        const name: string | undefined = r.name;
        const fhirBaseUrl: string | undefined = r.address;
        if (name && fhirBaseUrl) all.push({ name, fhirBaseUrl, portal: s.portal });
      }
    } catch {
      // skip a failing source
    }
  }
  CACHE = all;
  return all;
}

export const searchProviders = action({
  args: { query: v.string() },
  handler: async (_ctx, { query }): Promise<{ name: string; fhirBaseUrl: string; portal: string }[]> => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const orgs = await loadDirectory();
    const seen = new Set<string>();
    const out: { name: string; fhirBaseUrl: string; portal: string }[] = [];
    for (const o of orgs) {
      if (!o.name.toLowerCase().includes(q)) continue;
      const key = o.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(o);
      if (out.length >= 20) break;
    }
    return out;
  },
});
