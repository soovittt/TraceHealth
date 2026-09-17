import { internalAction } from "./_generated/server";
import { v } from "convex/values";

// ---- Firecrawl v2 Scrape: structured JSON from ONE public page (synchronous) --
async function fcScrapeJson(apiKey: string, url: string, prompt: string, schema: any): Promise<any> {
  const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ url, onlyMainContent: true, formats: [{ type: "json", prompt, schema }] }),
  });
  if (!res.ok) throw new Error(`Firecrawl scrape ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const j = await res.json();
  return j?.data?.json ?? null;
}

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

// Live cash/retail drug prices from GoodRx's public drug page as typed JSON.
// Public drug name only — never patient data. Returns
// { drug, prices:[{pharmacy, price, quantity?, sourceUrl}], genericAvailable } | { error } | null.
export const drugPrice = internalAction({
  args: { drug: v.string(), strength: v.optional(v.string()), zip: v.optional(v.string()) },
  handler: async (ctx, { drug }) => {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) return null;
    // GoodRx generic-drug pages are at a predictable slug (e.g. /atorvastatin).
    const slug = slugify(drug.replace(/\b\d+\s*(mg|mcg|ml|units?)\b/gi, ""));
    const url = `https://www.goodrx.com/${slug}`;
    const schema = {
      type: "object",
      properties: {
        drug: { type: "string" },
        genericAvailable: { type: "boolean" },
        prices: {
          type: "array",
          items: {
            type: "object",
            properties: {
              pharmacy: { type: "string" },
              price: { type: "number" },
              quantity: { type: "string" },
            },
            required: ["pharmacy", "price"],
          },
        },
      },
      required: ["prices"],
    };
    try {
      const data = await fcScrapeJson(apiKey, url, `Extract the current cash/coupon prices for ${drug} shown on this GoodRx page. For each pharmacy listed give its name, the price in USD as a plain number, and the quantity it covers. Also whether a generic is available. Only real listed prices.`, schema);
      const prices = (Array.isArray(data?.prices) ? data.prices : [])
        .filter((p: any) => typeof p?.price === "number" && p.price > 0)
        .map((p: any) => ({ pharmacy: String(p.pharmacy ?? "Pharmacy"), price: Number(p.price), quantity: p.quantity ? String(p.quantity) : undefined, sourceUrl: url }))
        .sort((a: any, b: any) => a.price - b.price)
        .slice(0, 6);
      if (!prices.length) return { drug, prices: [], note: "No public prices found for that name.", source: url };
      return { drug, prices, genericAvailable: !!data?.genericAvailable, source: url };
    } catch (e: any) {
      return { error: String(e?.message ?? e).slice(0, 150) };
    }
  },
});

// Firecrawl-powered grounded reference enrichment. We ONLY ever send a public
// topic term (e.g. "LDL cholesterol", "atorvastatin") — never any patient data —
// crawl trusted public medical sources, and cite the page URL. Reference info is
// general education, never medical advice. Degrades to null if no key is set.

const TRUSTED = [
  "medlineplus.gov", "ncbi.nlm.nih.gov", "labtestsonline.org", "testing.com",
  "fda.gov", "cdc.gov", "uspreventiveservicestaskforce.org", "mayoclinic.org", "nih.gov",
  "heart.org", "diabetes.org", "kidney.org",
];

async function fcSearch(apiKey: string, query: string, limit = 5): Promise<any[]> {
  const res = await fetch("https://api.firecrawl.dev/v1/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ query, limit, scrapeOptions: { formats: ["markdown"] } }),
  });
  if (!res.ok) throw new Error(`Firecrawl ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  return Array.isArray(j.data) ? j.data : [];
}

async function summarize(openaiKey: string, model: string, topic: string, pageText: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Summarize this trusted medical reference page for a patient in 2-3 short, plain-language sentences. General education only — never diagnose or advise. Use ONLY the page content. Return JSON {\"summary\": string}." },
        { role: "user", content: `TOPIC: ${topic}\n\nPAGE:\n${pageText.slice(0, 6000)}` },
      ],
    }),
  });
  if (!res.ok) return "";
  const j = await res.json();
  try { return String(JSON.parse(j.choices?.[0]?.message?.content ?? "{}").summary ?? "").trim(); } catch { return ""; }
}

// Look up a topic on trusted public medical sources; return a grounded,
// cited summary. Returns null when Firecrawl isn't configured.
export const referenceLookup = internalAction({
  args: { topic: v.string(), hint: v.optional(v.string()) },
  handler: async (
    ctx,
    { topic, hint },
  ): Promise<{ summary: string; source: { title: string; url: string } } | { error: string } | null> => {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) return null;
    const openaiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

    let results: any[] = [];
    try {
      results = await fcSearch(apiKey, `${topic} ${hint ?? "patient information"} medlineplus OR mayo clinic OR fda`, 6);
    } catch (e: any) {
      return { error: String(e?.message ?? e).slice(0, 150) };
    }
    const pick =
      results.find((r) => r.markdown && TRUSTED.some((d) => String(r.url || "").includes(d))) ||
      results.find((r) => r.markdown);
    if (!pick) return null;

    const source = { title: String(pick.title || pick.url), url: String(pick.url) };
    const summary = openaiKey ? await summarize(openaiKey, model, topic, String(pick.markdown)) : String(pick.description || "").slice(0, 400);
    return { summary: summary || String(pick.description || "").slice(0, 400), source };
  },
});
