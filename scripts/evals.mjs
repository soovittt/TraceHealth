#!/usr/bin/env node
// Runs the AI answer evals (one Convex action per case), aggregates, and writes
// evals/report.md + evals/report.json. Usage: npm run eval
import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";

const run = (fn, args = "{}") => {
  const out = execSync(`npx convex run ${fn} '${args}'`, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
  const i = out.indexOf("{");
  const j = out.lastIndexOf("}");
  if (i < 0) throw new Error(`no JSON from ${fn}: ${out.slice(0, 200)}`);
  return JSON.parse(out.slice(i, j + 1));
};
const arr = (fn, args = "{}") => {
  const out = execSync(`npx convex run ${fn} '${args}'`, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
  const i = out.indexOf("[");
  const j = out.lastIndexOf("]");
  return JSON.parse(out.slice(i, j + 1));
};

const DIMS = ["accuracy", "groundedness", "relevance", "safety", "clarity"];

console.log("Seeding eval fixture + listing cases…");
const cases = arr("evals:listCases");
console.log(`Running ${cases.length} cases (each runs the real agent + a judge)…\n`);

const results = [];
for (const c of cases) {
  process.stdout.write(`  • ${c.id} … `);
  try {
    const r = run("evals:runCase", JSON.stringify({ caseId: c.id }));
    results.push(r);
    const minScore = r.scores && !r.scores.error ? Math.min(...DIMS.map((d) => r.scores[d] ?? 0)) : 0;
    const ok = r.checksPassed === r.checksTotal && minScore >= 4;
    console.log(`${ok ? "✅" : "⚠️ "} checks ${r.checksPassed}/${r.checksTotal}${r.scores?.error ? "" : ` · min score ${minScore}`}`);
  } catch (e) {
    console.log(`❌ ${String(e.message).slice(0, 80)}`);
    results.push({ id: c.id, question: c.question, error: String(e.message) });
  }
}

// Aggregate
const scored = results.filter((r) => r.scores && !r.scores.error);
const avg = (d) => (scored.length ? +(scored.reduce((s, r) => s + (r.scores[d] ?? 0), 0) / scored.length).toFixed(2) : null);
const checksPassed = results.reduce((s, r) => s + (r.checksPassed ?? 0), 0);
const checksTotal = results.reduce((s, r) => s + (r.checksTotal ?? 0), 0);
const passRate = checksTotal ? Math.round((100 * checksPassed) / checksTotal) : 0;
const avgScores = Object.fromEntries(DIMS.map((d) => [d, avg(d)]));

const stamp = new Date().toISOString().replace("T", " ").slice(0, 16);
mkdirSync("evals", { recursive: true });
writeFileSync("evals/report.json", JSON.stringify({ generatedAt: stamp, summary: { cases: results.length, checks: `${checksPassed}/${checksTotal}`, passRate, avgScores }, results }, null, 2));

// Markdown
const scoreCell = (r) => (r.scores && !r.scores.error ? DIMS.map((d) => r.scores[d]).join(" / ") : "—");
let md = `# TraceHealth — AI Answer Eval Report\n\n_Generated ${stamp}_\n\n`;
md += `## Summary\n\n`;
md += `- **Cases:** ${results.length}\n`;
md += `- **Deterministic checks:** ${checksPassed}/${checksTotal} (${passRate}%)\n`;
md += `- **Avg judge scores (1–5):** accuracy ${avgScores.accuracy} · groundedness ${avgScores.groundedness} · relevance ${avgScores.relevance} · safety ${avgScores.safety} · clarity ${avgScores.clarity}\n\n`;
md += `| Case | Checks | acc / grnd / rel / safe / clr | Sources |\n|---|---|---|---|\n`;
for (const r of results) {
  const ok = r.checksPassed === r.checksTotal;
  md += `| ${ok ? "✅" : "⚠️"} ${r.id} | ${r.checksPassed ?? "?"}/${r.checksTotal ?? "?"} | ${scoreCell(r)} | ${r.sourceCount ?? "—"} |\n`;
}
md += `\n## Details\n\n`;
for (const r of results) {
  md += `### ${r.id} — "${r.question}"\n\n`;
  if (r.error) { md += `> ERROR: ${r.error}\n\n`; continue; }
  const failed = (r.checks ?? []).filter((c) => !c.pass).map((c) => c.name);
  md += `- **Checks:** ${r.checksPassed}/${r.checksTotal}${failed.length ? ` — ❌ ${failed.join("; ")}` : " ✅"}\n`;
  if (r.scores && !r.scores.error) md += `- **Scores:** acc ${r.scores.accuracy} · grnd ${r.scores.groundedness} · rel ${r.scores.relevance} · safe ${r.scores.safety} · clr ${r.scores.clarity} — _${r.scores.rationale}_\n`;
  md += `- **Sources:** ${r.sourceCount} · **Charts:** ${(r.charts ?? []).join(", ") || "none"}\n`;
  md += `- **Answer:** ${String(r.answer ?? "").replace(/\n+/g, " ").slice(0, 400)}\n\n`;
}
writeFileSync("evals/report.md", md);

console.log(`\n──────────────────────────────────────`);
console.log(`Deterministic: ${checksPassed}/${checksTotal} (${passRate}%)`);
console.log(`Avg scores:    acc ${avgScores.accuracy} · grnd ${avgScores.groundedness} · rel ${avgScores.relevance} · safe ${avgScores.safety} · clr ${avgScores.clarity}`);
console.log(`Report → evals/report.md`);
