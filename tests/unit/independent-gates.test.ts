import { describe, expect, it } from "vitest";
import { evaluateReadiness } from "../../lib/reading-skill-diagnosis";

// SR-R5-003: Independent oral/comprehension gates.
// "Keep oral fluency and comprehension as separate dimensions."
// "Neither strong oral nor strong comprehension compensates for failure of the other when both
//  are required." (TC-R5-003-B: "Oral pass, comprehension fail" - both gates required -> not
//  ready; comprehension gate failed; no compensation.)
describe("evaluateReadiness", () => {
  it("a passing oral gate never compensates for a failing comprehension gate when both are required (TC-R5-003-B)", () => {
    const result = evaluateReadiness("PASS", "FAIL", true);

    expect(result.ready).toBe(false);
    expect(result.reasonCode).toBe("COMPREHENSION_GATE_FAILED");
  });

  it("a passing comprehension gate never compensates for a failing oral gate when both are required", () => {
    const result = evaluateReadiness("FAIL", "PASS", true);

    expect(result.ready).toBe(false);
    expect(result.reasonCode).toBe("ORAL_GATE_FAILED");
  });

  it("is ready only when both gates pass and both are required", () => {
    const result = evaluateReadiness("PASS", "PASS", true);

    expect(result.ready).toBe(true);
    expect(result.reasonCode).toBe("READY");
  });

  it("reports both gates failed distinctly from a single-gate failure", () => {
    const result = evaluateReadiness("FAIL", "FAIL", true);

    expect(result.ready).toBe(false);
    expect(result.reasonCode).toBe("BOTH_GATES_FAILED");
  });

  it("keeps oral_state and comprehension_state reported as independent, separate dimensions", () => {
    const result = evaluateReadiness("PASS", "FAIL", true);

    expect(result.oralState).toBe("PASS");
    expect(result.comprehensionState).toBe("FAIL");
  });

  it("is deterministic for identical inputs", () => {
    expect(evaluateReadiness("PASS", "FAIL", true)).toEqual(evaluateReadiness("PASS", "FAIL", true));
  });
});
