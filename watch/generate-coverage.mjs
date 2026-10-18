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
const verdict = (items) => {
  if (!items.length) return "NOT TESTED";
  if (items.some((item) => item.outcome === "failed" || item.outcome === "timedOut" || item.outcome === "interrupted")) return "FAIL";
  if (items.every((item) => item.outcome === "passed")) return "PASS";
  return "SKIPPED / UNKNOWN";
};
const rows = requirements.map((r) => {
  const matching = recorded.filter((item) => item.title.startsWith("[DOMAIN] " + r.id + " ") || item.title.startsWith("[LIVE] " + r.id + " "));
  const domain = matching.filter((item) => item.title.startsWith("[DOMAIN]"));
  const live = matching.filter((item) => item.title.startsWith("[LIVE]"));
  const domainStatus = verdict(domain);
  const liveStatus = verdict(live);
  const status = liveStatus === "FAIL" ? "LIVE UI FAIL" : liveStatus === "PASS" ? "LIMITED LIVE UI PASS" : domainStatus === "PASS" ? "DOMAIN ONLY — NOT UI VALIDATED" : domainStatus === "FAIL" ? "DOMAIN DEMO FAIL" : "NOT AUTOMATED";
  return { ...r, status, domainStatus, liveStatus, executed: matching.length };
});
const all = recorded.filter((r) => r.title.startsWith("[LIVE]") && r.title.includes("SR-E2E-"));
const markdown = [
  "# Speed Reader narrated QA — " + browser.toUpperCase(),
  "",
  "Source: frozen v2.0 requirements. Generated from actual Playwright JSON test results.",
  "**Domain demonstration PASS is not equivalent to real learner acceptance.**",
  "Independent child, curriculum and content QA are separate requirements.",
  "",
  "| Requirement | Frozen requirement | Domain demo | Real learner UI | Overall classification |",
  "|---|---|---|---|---|",
  ...rows.map((r) => "| " + r.id + " | " + r.title.replaceAll("|", "/") + " | " + r.domainStatus + " | " + r.liveStatus + " | " + r.status + " |"),
  "",
  "## Additional learner journeys",
  ...all.map((r) => "- " + r.title + ": " + r.outcome),
  "",
  "Frozen FRs: " + rows.length + "; domain demos PASS: " + rows.filter((r) => r.domainStatus === "PASS").length + "; real learner UI PASS: " + rows.filter((r) => r.liveStatus === "PASS").length + "; live UI FAIL: " + rows.filter((r) => r.liveStatus === "FAIL").length + "; no executable evidence: " + rows.filter((r) => !r.executed).length + ".",
  "Native Safari on macOS, real-child usability, content quality and independent certification remain separate gates."
].join("\n");
writeFileSync(resolve(folder, "coverage.md"), markdown + "\n");
writeFileSync(resolve(folder, "coverage.json"), JSON.stringify({ browser, requirements: rows, journeys: all }, null, 2));

const esc = (s) => String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const count = (predicate) => rows.filter(predicate).length;
const cells = rows.map((r) => {
  const klass = r.liveStatus === "FAIL" || r.domainStatus === "FAIL" ? "fail" : r.liveStatus === "PASS" ? "pass" : r.domainStatus === "PASS" ? "domain" : "pending";
  return '<tr class="' + klass + '"><td><b>' + esc(r.id) + '</b></td><td>' + esc(r.title) + '</td><td>' + esc(r.domainStatus) + '</td><td>' + esc(r.liveStatus) + '</td></tr>';
}).join("\n");
const movie = [
  "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><title>Speed Reader QA — " + esc(browser.toUpperCase()) + "</title>",
  "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><style>",
  "body{margin:0;background:#0a1729;color:#f1f6fe;font:16px/1.6 Segoe UI,Arial,sans-serif}header{padding:46px max(24px,5vw);background:linear-gradient(125deg,#132f52,#071120)}h1{font-size:42px;margin:0}h2{font-size:21px}p{color:#b5c8df;max-width:800px}a{color:#8ccfff}main{padding:24px max(24px,5vw)}.stats{display:flex;gap:14px;flex-wrap:wrap}.stat{background:#172c46;border-radius:14px;padding:18px 26px;min-width:140px}.stat strong{display:block;font-size:30px}.stat small{color:#adbed3}.warn{padding:18px 22px;border-left:5px solid #f5be53;background:#1a2d42;margin:24px 0}table{width:100%;border-collapse:collapse}th,td{text-align:left;border-bottom:1px solid #2a425b;padding:12px}th{background:#14283e}.pass{background:#0b2e29}.fail{background:#42252b}.domain{background:#252d40}.pending{background:#142031}.muted{color:#aabbd1}footer{padding:24px max(24px,5vw)}",
  "</style></head><body><header><div class=\"muted\">BABYSTEPS / SPEED READER / NARRATED TESTING</div><h1>" + esc(browser.toUpperCase()) + " QA movie — requirement scorecard</h1><p>Based only on recorded browser executions. No untested requirement is presented as passing.</p><a href=\"./html/index.html\">Open Playwright movie clips and full traces →</a></header>",
  "<main><div class=\"stats\"><div class=\"stat\"><strong>" + rows.length + "</strong><small>Frozen requirements</small></div><div class=\"stat\"><strong>" + count((r) => r.domainStatus === "PASS") + "</strong><small>Domain demonstrations passed</small></div><div class=\"stat\"><strong>" + count((r) => r.liveStatus === "PASS") + "</strong><small>Limited live UI passes</small></div><div class=\"stat\"><strong>" + count((r) => r.liveStatus === "FAIL") + "</strong><small>Live UI failures</small></div></div>",
  "<div class=\"warn\">Domain demonstrations validate output from a separate internal demo, not full learner functionality. Safari launcher on Windows uses WebKit, not native Apple Safari. Videos do not embed narrated audio.</div><h2>All frozen requirements</h2><table><thead><tr><th>ID</th><th>Requirement</th><th>Domain demonstration</th><th>Actual learner UI</th></tr></thead><tbody>" + cells + "</tbody></table>",
  "<h2>Additional learner journeys</h2><ul>" + all.map((r) => "<li>" + esc(r.title) + ": " + esc(r.outcome) + "</li>").join("") + "</ul></main><footer>Generated from Playwright results; unavailable evidence is not silently treated as PASS.</footer></body></html>"
].join("\n");
writeFileSync(resolve(folder, "scorecard.html"), movie);
console.log(markdown.split("\n").slice(-2).join("\n"));
