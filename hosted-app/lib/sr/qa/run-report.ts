// Issue #15 - independent executable QA evidence for SR-001..048.
// `tools/sr-qa-run.mjs` executes the suite/typecheck/build and writes a run report bound to the exact commit.
// This module validates that report and enforces the certification rules:
//  * evidence is not certification: a run report alone is never a PASS;
//  * a certificate needs a certifier who is not an author of the change;
//  * the report must be for the current commit, from a clean tree, with every required step green.

import { canonicalHash } from "../pipeline/hash";

/** ui-tests-v3 = the production V3 learner suite (issue #28). The diagnostics-only /explain run can never replace it. */
export const REQUIRED_STEPS = Object.freeze(["unit-tests", "typecheck", "build", "ui-tests-v3"] as const);
export type StepName = (typeof REQUIRED_STEPS)[number] | "ui-tests-diagnostics-explain";

export type RunStep = { name: StepName; command: string; exitCode: number; logFile: string; logSha256: string; summary?: Record<string, number> };
export type RunReport = {
  schema: "sr-qa-run/1";
  commitSha: string;
  dirtyTree: boolean;
  node: string;
  startedAt: string;
  steps: RunStep[];
  /** Always "NOT_CERTIFIED" when written by the runner. */
  certification: "NOT_CERTIFIED";
};
export type Certificate = { commitSha: string; certifier: string; certifiedAt: string; reportHash: string; verdict: "PASS" };

export function validateReport(r: unknown): string[] {
  const out: string[] = [];
  const x = r as Partial<RunReport> | null;
  if (!x || typeof x !== "object") return ["report is not an object"];
  if (x.schema !== "sr-qa-run/1") out.push("unknown report schema");
  if (!/^[0-9a-f]{40}$/.test(String(x.commitSha))) out.push("commitSha must be a full 40-hex commit SHA");
  if (typeof x.dirtyTree !== "boolean") out.push("dirtyTree flag missing");
  if (x.certification !== "NOT_CERTIFIED") out.push("a run report must not carry a certification");
  if (!Array.isArray(x.steps)) return [...out, "steps missing"];
  for (const name of REQUIRED_STEPS) {
    const s = x.steps.find((st) => st.name === name);
    if (!s) { out.push(`required step ${name} was not run`); continue; }
    if (!s.command) out.push(`step ${name} has no recorded command`);
    if (!/^[0-9a-f]{64}$/.test(String(s.logSha256)) || !s.logFile) out.push(`step ${name} has no hashed log`);
  }
  return out;
}

export function certify(args: {
  report: RunReport; currentCommitSha: string; certifier: string; authors: readonly string[]; now?: () => Date;
}): Certificate {
  const { report, currentCommitSha, certifier, authors } = args;
  const problems = validateReport(report);
  if (problems.length) throw new Error(`report invalid: ${problems.join("; ")}`);
  if (!certifier.trim()) throw new Error("a named certifier is required");
  if (authors.some((a) => a.toLowerCase() === certifier.toLowerCase())) throw new Error("certifier must be independent of the change authors");
  if (report.commitSha !== currentCommitSha) throw new Error("report is for a different commit than the one being certified");
  if (report.dirtyTree) throw new Error("report was produced from a dirty working tree");
  const failed = report.steps.filter((s) => s.exitCode !== 0).map((s) => s.name);
  if (failed.length) throw new Error(`steps failed: ${failed.join(", ")}`);
  return {
    commitSha: report.commitSha, certifier, certifiedAt: (args.now?.() ?? new Date()).toISOString(),
    reportHash: canonicalHash(report), verdict: "PASS"
  };
}

/** A certificate is valid only for the exact report it was issued against. */
export const certificateMatches = (c: Certificate, r: RunReport): boolean => c.verdict === "PASS" && c.commitSha === r.commitSha && c.reportHash === canonicalHash(r);
