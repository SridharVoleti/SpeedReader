import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { qaPlan, V3_UI_SPECS } from "../../../../tools/sr-qa-plan.mjs";
import { certify, validateReport, REQUIRED_STEPS, type RunReport } from "../../../lib/sr/qa/run-report";

// Issue #28: the QA runner exercises the real production V3 learner journey, not only the legacy /explain page.
const SHA = "c".repeat(40);
const h = "d".repeat(64);
const step = (name: string, exitCode = 0) => ({ name: name as "build", command: `run ${name}`, exitCode, logFile: `qa-runs/${SHA}/${name}.log`, logSha256: h });
const report = (names: string[], over: Partial<RunReport> = {}): RunReport => ({
  schema: "sr-qa-run/1", commitSha: SHA, dirtyTree: false, node: "v22", startedAt: "2026-10-09T00:00:00Z", certification: "NOT_CERTIFIED",
  steps: names.map((n) => step(n)), ...over
});
const ALL = ["unit-tests", "typecheck", "build", "ui-tests-v3"];
const args = (r: RunReport) => ({ report: r, currentCommitSha: SHA, certifier: "qa-reviewer", authors: ["builder"] });

describe("the --ui plan runs the production V3 learner suite", () => {
  const ui = qaPlan({ ui: true });
  const v3 = ui.find((s) => s.name === "ui-tests-v3")!;

  it("includes a ui-tests-v3 step that runs every V3 learner and API spec, plus the container launch specs", () => {
    expect(v3).toBeTruthy();
    for (const spec of V3_UI_SPECS) expect(v3.command, spec).toContain(spec);
    expect(V3_UI_SPECS).toEqual(expect.arrayContaining([
      "hosted-app/tests/ui/learner-v3.spec.ts", "hosted-app/tests/ui/learner-v3-speech.spec.ts", "hosted-app/tests/ui/learner-v3-news-reader.spec.ts",
      "hosted-app/tests/ui/learner-v3-retention.spec.ts", "hosted-app/tests/ui/learner-v3-a11y.spec.ts", "hosted-app/tests/ui/learner-v3-outcome.spec.ts",
      "hosted-app/tests/ui/api-v3.spec.ts"
    ]));
  });

  it("every listed spec exists, and the run is not narrowed to one browser project, so mobile and desktop both run", () => {
    for (const spec of V3_UI_SPECS) expect(existsSync(spec), spec).toBe(true);
    expect(v3.command).not.toMatch(/--project/);
    const cfg = readFileSync("playwright.config.ts", "utf8");
    for (const p of ['name: "mobile"', 'name: "desktop"']) expect(cfg).toContain(p);
  });

  it("covers every V3 learner spec in the repository (a new learner-v3 spec cannot be silently left out)", async () => {
    const { readdirSync } = await import("node:fs");
    const onDisk = readdirSync("hosted-app/tests/ui").filter((f) => /^(learner-v3.*|api-v3)\.spec\.ts$/.test(f)).map((f) => `hosted-app/tests/ui/${f}`);
    expect([...V3_UI_SPECS].filter((s) => s.includes("learner-v3") || s.includes("api-v3")).sort()).toEqual(onDisk.sort());
  });

  it("the legacy /explain suite is not part of --ui; it only runs, under a clearly separate name, on request", () => {
    expect(ui.some((s) => /sr-explain/.test(s.command))).toBe(false);
    const diag = qaPlan({ ui: true, diagnosticsUi: true }).find((s) => /sr-explain/.test(s.command))!;
    expect(diag.name).toBe("ui-tests-diagnostics-explain");
    expect(diag.name).not.toBe("ui-tests-v3");
  });

  it("without --ui only the non-browser steps run (and such a report cannot be certified)", () => {
    expect(qaPlan({}).map((s) => s.name)).toEqual(["unit-tests", "typecheck", "build"]);
  });
});

describe("certification needs the V3 UI evidence", () => {
  it("V3 UI is a required step", () => expect(REQUIRED_STEPS).toContain("ui-tests-v3"));

  it("a complete report validates and certifies", () => {
    expect(validateReport(report(ALL))).toEqual([]);
    expect(certify(args(report(ALL)))).toMatchObject({ verdict: "PASS", commitSha: SHA });
  });

  it("a report without the V3 UI step is invalid", () => {
    expect(validateReport(report(["unit-tests", "typecheck", "build"])).join()).toMatch(/ui-tests-v3 was not run/);
    expect(() => certify(args(report(["unit-tests", "typecheck", "build"])))).toThrow(/ui-tests-v3/);
  });

  it("the diagnostics /explain run cannot substitute for the V3 UI run", () => {
    const r = report(["unit-tests", "typecheck", "build", "ui-tests-diagnostics-explain"]);
    expect(validateReport(r).join()).toMatch(/ui-tests-v3 was not run/);
    expect(() => certify(args(r))).toThrow();
  });

  it("a failure in the V3 UI run (any project) fails certification", () => {
    const r = report(ALL); r.steps = r.steps.map((s) => (s.name === ("ui-tests-v3" as string) ? { ...s, exitCode: 1 } : s));
    expect(() => certify(args(r))).toThrow(/ui-tests-v3/);
  });

  it("a dirty-tree report can never be certified", () => {
    expect(() => certify(args(report(ALL, { dirtyTree: true })))).toThrow(/dirty/);
  });

  it("the runner stays evidence-only: it always writes NOT_CERTIFIED", () => {
    const src = readFileSync("tools/sr-qa-run.mjs", "utf8");
    expect(src).toMatch(/certification: "NOT_CERTIFIED"/);
    expect(src).not.toMatch(/certification: "PASS"/);
    expect(src).toMatch(/qaPlan/);
  });
});
