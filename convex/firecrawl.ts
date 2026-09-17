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

// Live cash/retail drug prices from TWO public sources in parallel: GoodRx
// (pharmacy comparison) + Cost Plus Drugs (transparent flat price). Public drug
// name only — never patient data. Returns
// { drug, prices:[{pharmacy, price, quantity?, sourceUrl}], sources:[{title,url}] } | { error } | null.
export const drugPrice = internalAction({
  args: { drug: v.string(), strength: v.optional(v.string()), zip: v.optional(v.string()) },
  handler: async (ctx, { drug }) => {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) return null;
    const base = slugify(drug.replace(/\b\d+\s*(mg|mcg|ml|units?)\b/gi, ""));
    const goodrxUrl = `https://www.goodrx.com/${base}`;

    const goodrxSchema = {
      type: "object",
      properties: {
        genericAvailable: { type: "boolean" },
        prices: { type: "array", items: { type: "object", properties: { pharmacy: { type: "string" }, price: { type: "number" }, quantity: { type: "string" } }, required: ["pharmacy", "price"] } },
      },
      required: ["prices"],
    };
    const costPlusSchema = { type: "object", properties: { price: { type: "number" }, quantity: { type: "string" } }, required: ["price"] };

    // Run both sources concurrently; either can fail without killing the other.
    const [goodrx, costPlus] = await Promise.all([
      fcScrapeJson(apiKey, goodrxUrl, `Extract current cash/coupon prices for ${drug} on this GoodRx page: for each pharmacy, its name, the price in USD as a plain number, and the quantity it covers. Also whether a generic is available. Only real listed prices.`, goodrxSchema).catch(() => null),
      (async () => {
        try {
          // Cost Plus product slugs are unpredictable — find the page via search, then scrape it.
          const results = await fcSearch(apiKey, `${drug} price costplusdrugs.com`, 5);
          const hit = results.find((r: any) => /costplusdrugs\.com\/medications\//.test(String(r.url || "")));
          if (!hit) return null;
          const cpUrl = String(hit.url);
          const d = await fcScrapeJson(apiKey, cpUrl, `Extract the Cost Plus Drugs total price for ${drug}: the price in USD as a plain number and the quantity/supply it covers. Only the real listed price.`, costPlusSchema);
          return d && typeof d.price === "number" && d.price > 0 ? { price: Number(d.price), quantity: d.quantity ? String(d.quantity) : undefined, url: cpUrl } : null;
        } catch { return null; }
      })(),
    ]);

    const prices: any[] = [];
    const sources: { title: string; url: string }[] = [];
    if (goodrx && Array.isArray(goodrx.prices)) {
      const gp = goodrx.prices.filter((p: any) => typeof p?.price === "number" && p.price > 0)
        .map((p: any) => ({ pharmacy: String(p.pharmacy ?? "Pharmacy"), price: Number(p.price), quantity: p.quantity ? String(p.quantity) : undefined, sourceUrl: goodrxUrl }));
      if (gp.length) { prices.push(...gp); sources.push({ title: "GoodRx", url: goodrxUrl }); }
    }
    if (costPlus) {
      prices.push({ pharmacy: "Cost Plus Drugs", price: costPlus.price, quantity: costPlus.quantity, sourceUrl: costPlus.url });
      sources.push({ title: "Cost Plus Drugs", url: costPlus.url });
    }
    if (!prices.length) return { drug, prices: [], sources: [], note: "No public prices found for that name." };
    prices.sort((a, b) => a.price - b.price);
    return { drug, prices: prices.slice(0, 8), genericAvailable: !!goodrx?.genericAvailable, sources };
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
  ): Promise<{ summary: string; source: { title: string; url: string }; sources: { title: string; url: string }[] } | { error: string } | null> => {
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
    // Prefer trusted domains; summarize the best one but cite the top few.
    const trusted = results.filter((r) => TRUSTED.some((d) => String(r.url || "").includes(d)));
    const pool = trusted.length ? trusted : results;
    const pick = pool.find((r) => r.markdown) || pool[0];
    if (!pick) return null;

    const source = { title: String(pick.title || pick.url), url: String(pick.url) };
    // Up to 3 distinct-domain sources, primary first.
    const seen = new Set<string>();
    const sources: { title: string; url: string }[] = [];
    for (const r of [pick, ...pool]) {
      const url = String(r.url || "");
      const host = url.replace(/^https?:\/\//, "").split("/")[0];
      if (!url || seen.has(host)) continue;
      seen.add(host);
      sources.push({ title: String(r.title || url), url });
      if (sources.length >= 5) break;
    }
    const summary = openaiKey ? await summarize(openaiKey, model, topic, String(pick.markdown)) : String(pick.description || "").slice(0, 400);
    return { summary: summary || String(pick.description || "").slice(0, 400), source, sources };
  },
});
