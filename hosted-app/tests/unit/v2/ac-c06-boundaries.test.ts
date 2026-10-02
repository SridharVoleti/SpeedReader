import { describe, expect, it } from "vitest";
import { runBoundaryMatrix } from "../../../lib/v2/boundary-matrix";

// AC-C06 - Boundary tests: the engineering gate lists thirteen scenarios; every one must PASS.
describe("AC-C06 boundary matrix", () => {
  const rows = runBoundaryMatrix();

  it("covers exactly the thirteen required boundary scenarios, in order", () => {
    expect(rows.map((r) => r.scenario)).toEqual([
      "exactly 75%",
      "just below 75%",
      "4/5 GREEN",
      "3/5 GREEN",
      "post-five G-G-G",
      "post-five G-G-N-G-G-G",
      "current WPM 149 -> 150",
      "current WPM 150",
      "stamina-boundary passage",
      "familiar practice inserted between new attempts",
      "ASR unresolved",
      "News Reader missing/low/high",
      "reassessment form version mismatch"
    ]);
  });

  for (const r of runBoundaryMatrix()) {
    it(`${r.id} ${r.scenario}`, () => {
      expect(r.pass, `observed: ${r.observed}`).toBe(true);
    });
  }

  it("is deterministic", () => {
    expect(runBoundaryMatrix()).toEqual(rows);
  });
});
