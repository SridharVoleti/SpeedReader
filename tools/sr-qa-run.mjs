#!/usr/bin/env node
// Independent executable QA runner for SR-001..048 (issue #15).
// Runs the unit suite, typecheck and production build against the CURRENT commit, stores each full log, and writes a
// run report bound to the exact commit SHA. It never certifies anything: certification is a separate act by a
// different person (see hosted-app/lib/sr/qa/run-report.ts).
//
//   node tools/sr-qa-run.mjs            unit tests + typecheck + build
//   node tools/sr-qa-run.mjs --ui       also run the production V3 learner Playwright suite on every project (needs port 3001)
//   node tools/sr-qa-run.mjs --ui --diagnostics-ui   additionally run the diagnostics-only legacy /explain spec (separate step)

import { spawnSync, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { qaPlan } from "./sr-qa-plan.mjs";

const root = resolve(import.meta.dirname, "..");
const git = (...a) => execFileSync("git", a, { cwd: root, encoding: "utf8" }).trim();
const sha = git("rev-parse", "HEAD");
const dirty = git("status", "--porcelain", "--untracked-files=no").length > 0;
const outDir = join(root, "hosted-app", "requirements", "qa-runs", sha);
mkdirSync(outDir, { recursive: true });

// --ui runs the production V3 learner suite (all Playwright projects); --diagnostics-ui additionally runs the legacy
// /explain spec under its own name. A report without ui-tests-v3 cannot be certified.
const steps = qaPlan({ ui: process.argv.includes("--ui"), diagnosticsUi: process.argv.includes("--diagnostics-ui") });

const report = { schema: "sr-qa-run/1", commitSha: sha, dirtyTree: dirty, node: process.version, startedAt: new Date().toISOString(), steps: [], certification: "NOT_CERTIFIED" };

for (const s of steps) {
  const started = Date.now();
  const r = spawnSync(s.command, { cwd: root, shell: true, encoding: "utf8", maxBuffer: 256 * 1024 * 1024, env: { ...process.env, CI: "1", FORCE_COLOR: "0" } });
  const log = `$ ${s.command}\n# commit ${sha} dirty=${dirty} node ${process.version}\n# exit ${r.status}\n\n${r.stdout ?? ""}\n${r.stderr ?? ""}`;
  const logFile = `${s.name}.log`;
  writeFileSync(join(outDir, logFile), log, "utf8");
  const summary = {};
  const tests = /Tests\s+(?:(\d+) failed \| )?(\d+) passed/.exec(log);
  if (s.name === "unit-tests" && tests) { summary.failed = Number(tests[1] ?? 0); summary.passed = Number(tests[2]); }
  report.steps.push({
    name: s.name, command: s.command, exitCode: r.status ?? 1, logFile: `qa-runs/${sha}/${logFile}`,
    logSha256: createHash("sha256").update(readFileSync(join(outDir, logFile))).digest("hex"), summary, durationMs: Date.now() - started
  });
  console.log(`${s.name}: exit ${r.status} (${Date.now() - started} ms)`);
}

writeFileSync(join(outDir, "report.json"), JSON.stringify(report, null, 2), "utf8");
const failed = report.steps.filter((s) => s.exitCode !== 0);
console.log(`\nrun report: hosted-app/requirements/qa-runs/${sha}/report.json`);
console.log(dirty ? "WARNING: working tree had uncommitted tracked changes - this report cannot be certified." : "tree clean.");
console.log("certification: NOT_CERTIFIED (evidence only; a separate QA must certify)");
process.exit(failed.length ? 1 : 0);
