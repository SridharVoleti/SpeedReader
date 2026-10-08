// Phase-A infrastructure demonstration as a regression test: 5 representative rows, simulated Cowork results,
// real touchback / invalidation / escalation / stale rejection / restart, and Role 8 routing a defect to its owner.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runPhaseADemo } from "../../../../lib/sr/pipeline-v2/demo";
import { findArchitectureDir } from "../../../../lib/sr/pipeline-v2/config";
import { buildCanonicalFixture } from "./helpers/canonical-fixture";

let base: string;
beforeEach(() => { base = mkdtempSync(join(tmpdir(), "sr-demo-")); });
afterEach(() => rmSync(base, { recursive: true, force: true, maxRetries: 3 }));
const arch = findArchitectureDir(join(__dirname, "..", "..", "..", "..", ".."));

function expectReport(r: Awaited<ReturnType<typeof runPhaseADemo>>) {
  expect(r.passages.map((p) => p.coordinate)).toHaveLength(5);
  expect(r.disclaimer).toMatch(/SIMULATED/);
  // A: full chain; B: rebuilt after touchback; E: Role 8 final after a routed Role 6 defect
  for (const id of ["W1-0001", "W1-0043", "W1-0150"]) expect(r.passages.find((p) => p.id === id)!.finalState[8], id).toBe("FINAL_APPROVED");
  expect(r.touchbacks).toBeGreaterThanOrEqual(3); // R4 (from R6 QA), R2 (from R4 QA), R6 (from R8 validation)
  expect(r.invalidations).toBeGreaterThanOrEqual(2); // B: Role 5; E: Role 7
  expect(r.escalations.map((e) => e.passage).sort()).toEqual(["W1-0075", "W1-0100"]);
  expect(r.escalations.find((e) => e.passage === "W1-0075")!.reason).toMatch(/RETRY_LIMIT/);
  expect(r.escalations.find((e) => e.passage === "W1-0100")).toMatchObject({ resolved: true });
  expect(r.escalations.find((e) => e.passage === "W1-0100")!.reason).toMatch(/REPEATED_BLOCKER/);
  expect(r.passages.find((p) => p.id === "W1-0075")!.finalState[2]).toBe("ESCALATED_HUMAN_REVIEW");
  expect(r.staleRejections).toBe(1);
  expect(r.machineRejections).toBe(1);
  expect(r.restarts).toBe(1);
  expect(r.qaSimulations).toBeGreaterThan(20);
  expect(r.jobs.byType.CREATOR).toBeGreaterThan(20);
  expect(r.jobs.byType.QA).toBeGreaterThanOrEqual(r.qaSimulations);
  expect(r.caveats.join("\n")).toMatch(/INTERIM_ENVELOPE|G-R8/);
}

describe("Phase-A infrastructure demonstration", () => {
  it("runs end to end on the synthetic canonical fixture", async () => {
    buildCanonicalFixture(join(base, "canonical"));
    const r = await runPhaseADemo({ canonicalDir: join(base, "canonical"), root: join(base, "demo"), architectureDir: arch });
    expectReport(r);
    expect(existsSync(join(base, "demo", "demo-report.json"))).toBe(true);
    expect(existsSync(join(base, "demo", "approved", "role2", "W1-0001", "v1.json"))).toBe(true);
  });

  const real = process.env.SR_CANONICAL_DIR ?? "D:\\Sridhar\\Projects\\SpeedReader_CC\\SpeedReader_W1_BandA_v0.56_FINAL_FREEZE_CANDIDATE_FULL_PACKAGE";
  it.skipIf(!existsSync(real))("runs on the real v0.56 candidate package rows and reports its freeze status", async () => {
    const r = await runPhaseADemo({ canonicalDir: real, root: join(base, "demo-real"), architectureDir: arch });
    expectReport(r);
    expect(r.canonical).toMatchObject({ version: "v0.56", freeze: "FREEZE_CANDIDATE_UNCERTIFIED" });
    expect(r.passages.map((p) => p.coordinate)).toEqual(["RS01-P1", "RS05-P3", "RS08-P5", "RS10-P10", "RS15-P10"]);
  }, 120000);
});
