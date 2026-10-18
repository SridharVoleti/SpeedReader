import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const browser = (process.argv[2] || "edge").toLowerCase();
if (!["edge", "chrome", "safari"].includes(browser)) throw new Error("Unknown browser");
const folder = resolve(root, "watch-results", browser);
mkdirSync(folder, { recursive: true });
const source = readFileSync(resolve(root, "requirements/SpeedReader_Final_Frozen_Requirements_Codex_Acceptance_v2.0.md"), "utf8");
const requirements = [...source.matchAll(/^##\s+(FR-\d{3})\s+[—-]\s+(.+?)(?:\s+\[.*)?$/gm)]
  .map((match) => ({ id: match[1], title: match[2].trim() }));
const resultsPath = resolve(folder, "results.json");
const recorded = [];
if (existsSync(resultsPath)) {
  const report = JSON.parse(readFileSync(resultsPath, "utf8"));
  function walk(suite) {
    for (const spec of suite.specs || []) {
      for (const attempt of spec.tests || []) {
        recorded.push({
          title: spec.title, outcome: attempt.results?.at(-1)?.status || "unknown"
        });
      }
    }
    for (const child of suite.suites || []) walk(child);
  }
  for (const suite of report.suites || []) walk(suite);
}
const rows = requirements.map((r) => {
  const matching = recorded.filter((record) => record.title.includes(r.id));
  const domain = matching.filter((r) => r.title.startsWith("[DOMAIN]"));
  const live = matching.filter((r) => r.title.startsWith("[LIVE]"));
  let status = "NOT AUTOMATED";
  if (matching.length) {
    if (matching.some((r) => r.outcome !== "passed")) status = "FAILED / BLOCKED";
    else if (live.length) status = "LIVE UI CHECK PASSED (limited scope)";
    else if (domain.length) status = "DOMAIN DEMO CHECK PASSED (not learner validation)";
    else status = "UNCLASSIFIED";
  }
  return { ...r, status, executed: matching.length };
});
const all = recorded.filter((r) => r.title.startsWith("[LIVE]") && r.title.includes("SR-E2E-"));
const markdown = [
  `# Speed Reader narrated QA — ${browser.toUpperCase()}`,
  "",
  "Source: frozen v2.0 requirements. Generated from actual Playwright JSON results.",
  "A domain demonstration PASS does NOT mean the live learner experience passes.",
  "Requirements without executable tests are NOT AUTOMATED, not PASS.",
  "",
  "| Requirement | Frozen requirement | Coverage / result |",
  "|---|---|---|",
  ...rows.map((r) => `| ${r.id} | ${r.title.replaceAll("|", "/")} | ${r.status} |`),
  "",
  "## Additional learner journeys",
  ...all.map((r) => `- ${r.title}: ${r.outcome}`),
  "",
  `Total frozen FRs: ${rows.length}; checked by this watch suite: ${rows.filter((r) => r.executed).length}; not automated: ${rows.filter((r) => !r.executed).length}.`,
  "Independent content QA, child usability pilots, and native Safari on macOS remain separate gates."
].join("\n");
writeFileSync(resolve(folder, "coverage.md"), markdown + "\n");
writeFileSync(resolve(folder, "coverage.json"), JSON.stringify({ browser, requirements: rows, journeys: all }, null, 2));
console.log(markdown.split("\n").slice(-2).join("\n"));
