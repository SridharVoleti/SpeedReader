#!/usr/bin/env node
// Runs the hosted Supabase verification (issue #37) and writes a secret-free report bound to the current commit.
//   SR_HOSTED_SUPABASE_URL, SR_HOSTED_SERVICE_ROLE_KEY, SR_HOSTED_ANON_KEY, SR_HOSTED_EXPECTED_REGION   (required)
//   SR_HOSTED_ACCESS_TOKEN                                                                                 (optional: verifies the region)
// Exit codes: 0 = PASS, 1 = FAIL, 2 = BLOCKED_EXTERNAL (credentials missing/invalid) or INCOMPLETE. It never reports success unless everything was verified.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { buildReport, loadHostedConfig, overallStatus, runHostedChecks } from "./hosted-verification.mjs";

const loaded = loadHostedConfig(process.env);
if (!loaded.ok) {
  console.error("BLOCKED_EXTERNAL: hosted Supabase credentials are not available to this run.");
  for (const problem of loaded.problems) console.error(`  - ${problem}`);
  console.error("Required: SR_HOSTED_SUPABASE_URL, SR_HOSTED_SERVICE_ROLE_KEY, SR_HOSTED_ANON_KEY, SR_HOSTED_EXPECTED_REGION (optional SR_HOSTED_ACCESS_TOKEN).");
  process.exit(2);
}

const root = resolve(import.meta.dirname, "..");
let sha = "0".repeat(40);
try { sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(); } catch { /* not a git checkout */ }
const results = await runHostedChecks(loaded.config);
const report = buildReport({ commitSha: sha, results, config: loaded.config, now: new Date() });
const outDir = join(root, "hosted-app", "requirements", "hosted-supabase-runs");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, `${sha}.json`), JSON.stringify(report, null, 2), "utf8");
for (const check of report.checks) console.log(`${check.status.padEnd(12)} ${check.name}: ${check.detail}`);
console.log(`\noverall: ${report.overall} (report: hosted-app/requirements/hosted-supabase-runs/${sha}.json)`);
process.exit(overallStatus(results) === "PASS" ? 0 : overallStatus(results) === "FAIL" ? 1 : 2);
