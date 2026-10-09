import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Issues #29/#31: one pinned Node runtime and a required CI release gate covering the V3 acceptance stack.
const root = resolve(__dirname, "../../../..");
const read = (rel: string) => readFileSync(resolve(root, rel), "utf8");
const pkg = JSON.parse(read("package.json")) as { engines?: { node?: string }; scripts: Record<string, string> };

describe("pinned runtime (#29)", () => {
  it("package.json declares the Node engine required by Pipeline V2 (>=22.13)", () => {
    expect(pkg.engines?.node).toBe(">=22.13.0");
  });
  it(".nvmrc pins the same runtime for local tooling and CI", () => {
    expect(existsSync(resolve(root, ".nvmrc"))).toBe(true);
    expect(read(".nvmrc").trim()).toMatch(/^22\.(1[3-9]|[2-9]\d)\.\d+$/);
  });
  it("the README names the supported runtime", () => {
    expect(read("hosted-app/README.md")).toMatch(/Node(\.js)? 22\.13/);
  });
});

describe("required CI release gate (#29)", () => {
  const wf = existsSync(resolve(root, ".github/workflows/ci.yml")) ? read(".github/workflows/ci.yml") : "";
  it("exists and runs on pull requests and the protected/release branches", () => {
    expect(wf).not.toBe("");
    expect(wf).toMatch(/pull_request:/);
    expect(wf).toMatch(/push:[\s\S]*branches:[\s\S]*main/);
    expect(wf).toMatch(/feature\/app-v3-acceptance/);
  });
  it("uses the pinned runtime file and a lockfile-verifying install", () => {
    expect(wf).toMatch(/node-version-file:\s*\.nvmrc/);
    expect(wf).toMatch(/npm ci/);
  });
  it("runs the evidence-producing QA runner with the production V3 UI suite (one source of truth for the commands)", () => {
    expect(wf).toMatch(/npm run qa:sr -- --ui/);
    const runner = read("tools/sr-qa-plan.mjs");
    for (const cmd of ["npx vitest run", "npx tsc --noEmit", "npx next build", "npx playwright test"]) expect(runner).toContain(cmd);
  });
  it.each([
    ["pipeline-v2 tests", /npm run test:pipeline-v2/],
    ["backend tests", /npm run test:backend/],
    ["QA evidence artifact upload", /actions\/upload-artifact/],
  ])("runs %s", (_n, re) => { expect(wf).toMatch(re); });
  it("covers database migration/schema tests through the unit run (PGlite) without skipping", () => {
    expect(wf).not.toMatch(/continue-on-error:\s*true/);
    expect(wf).not.toMatch(/--passWithNoTests/);
  });
  it("has a release gate that REQUIRES canonical authority instead of silently skipping", () => {
    expect(wf).toMatch(/SR_REQUIRE_CANONICAL:\s*"?1"?/);
    expect(wf).toMatch(/SR_CANONICAL_DIR/);
  });
  it("retains logs/report for the exact commit SHA", () => {
    expect(wf).toMatch(/github\.sha/);
    expect(wf).toMatch(/qa-runs/);
  });
});
