import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { certify, certificateMatches, validateReport, type RunReport } from "../../../lib/sr/qa/run-report";

// Issue #15: unit tests alone do not certify. These tests pin the evidence/certification rules and the
// blocker -> regression-test coverage map.
const SHA = "a".repeat(40);
const h = "b".repeat(64);
const report = (over: Partial<RunReport> = {}): RunReport => ({
  schema: "sr-qa-run/1", commitSha: SHA, dirtyTree: false, node: "v22", startedAt: "2026-10-08T00:00:00Z", certification: "NOT_CERTIFIED",
  steps: ["unit-tests", "typecheck", "build"].map((name) => ({ name: name as "build", command: `run ${name}`, exitCode: 0, logFile: `qa-runs/${SHA}/${name}.log`, logSha256: h })),
  ...over
});
const args = (r = report(), over = {}) => ({ report: r, currentCommitSha: SHA, certifier: "qa-reviewer", authors: ["builder"], now: () => new Date("2026-10-08T01:00:00Z"), ...over });

describe("run report validation", () => {
  it("accepts a complete report", () => expect(validateReport(report())).toEqual([]));
  it("requires test, typecheck and build steps, each with a command and a hashed log", () => {
    for (const missing of ["unit-tests", "typecheck", "build"]) {
      expect(validateReport(report({ steps: report().steps.filter((s) => s.name !== missing) })).join()).toMatch(new RegExp(`${missing} was not run`));
    }
    const noHash = report(); noHash.steps[0] = { ...noHash.steps[0], logSha256: "x" };
    expect(validateReport(noHash).join()).toMatch(/hashed log/);
  });
  it("requires a full commit SHA and refuses reports that already claim certification", () => {
    expect(validateReport(report({ commitSha: "abc123" })).join()).toMatch(/40-hex/);
    expect(validateReport({ ...report(), certification: "PASS" }).join()).toMatch(/must not carry a certification/);
  });
});

describe("certification is separate, independent and bound to the exact commit", () => {
  it("issues a certificate bound to the report hash", () => {
    const c = certify(args());
    expect(c).toMatchObject({ verdict: "PASS", commitSha: SHA, certifier: "qa-reviewer" });
    expect(certificateMatches(c, report())).toBe(true);
    expect(certificateMatches(c, report({ node: "v24" }))).toBe(false); // any change to the evidence voids it
  });
  it("refuses a certifier who authored the change (case-insensitive)", () => {
    expect(() => certify(args(report(), { certifier: "Builder" }))).toThrow(/independent/);
  });
  it("refuses a missing certifier, a different commit, a dirty tree, and any failed step", () => {
    expect(() => certify(args(report(), { certifier: " " }))).toThrow(/certifier/);
    expect(() => certify(args(report(), { currentCommitSha: "c".repeat(40) }))).toThrow(/different commit/);
    expect(() => certify(args(report({ dirtyTree: true })))).toThrow(/dirty/);
    const failing = report(); failing.steps[1] = { ...failing.steps[1], exitCode: 2 };
    expect(() => certify(args(failing))).toThrow(/typecheck/);
  });
});

describe("blocker coverage map", () => {
  const map = JSON.parse(readFileSync(resolve(__dirname, "../../../requirements/sr-blocker-coverage.json"), "utf8")) as { blockers: { issue: number; tests: string[] }[] };
  it("covers every blocker issue #6..#15", () => {
    expect(map.blockers.map((b) => b.issue).sort((a, b) => a - b)).toEqual([6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  });
  it("every listed regression test file exists", () => {
    const repo = resolve(__dirname, "../../../..");
    for (const b of map.blockers) for (const t of b.tests) expect(existsSync(resolve(repo, t)), `#${b.issue} ${t}`).toBe(true);
  });
});
