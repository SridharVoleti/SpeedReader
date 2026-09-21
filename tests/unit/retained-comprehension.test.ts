import { describe, expect, it } from "vitest";
import { classifyRetentionState, evaluateAdvancedCertification } from "../../lib/retention";

// SR-R8-002: Retained comprehension.
// "Report retention separately and optionally require it for advanced certification."
// "Immediate PASS + delayed FAIL remain distinct; advanced certification withheld when
//  retention mandatory." (TC-R8-002-B: "Immediate pass, delayed fail")
const RETENTION_PASS_THRESHOLD = 0.7;

describe("classifyRetentionState", () => {
  it("classifies a retention score at/above the threshold as PASS", () => {
    expect(classifyRetentionState(0.8, RETENTION_PASS_THRESHOLD)).toBe("PASS");
  });

  it("classifies a retention score below the threshold as FAIL", () => {
    expect(classifyRetentionState(0.4, RETENTION_PASS_THRESHOLD)).toBe("FAIL");
  });

  it("classifies a null retention score as NOT_ASSESSED", () => {
    expect(classifyRetentionState(null, RETENTION_PASS_THRESHOLD)).toBe("NOT_ASSESSED");
  });
});

describe("evaluateAdvancedCertification (TC-R8-002-B: immediate pass, delayed fail)", () => {
  it("keeps immediate PASS and delayed FAIL distinct, and withholds certification when retention is mandatory", () => {
    const result = evaluateAdvancedCertification({
      immediatePassed: true,
      retentionState: "FAIL",
      retentionRequired: true
    });

    expect(result.eligible).toBe(false);
    expect(result.reasonCode).toBe("RETENTION_REQUIRED_NOT_MET");
  });

  it("does not withhold certification on a delayed FAIL when retention is optional", () => {
    const result = evaluateAdvancedCertification({
      immediatePassed: true,
      retentionState: "FAIL",
      retentionRequired: false
    });

    expect(result.eligible).toBe(true);
    expect(result.reasonCode).toBe("ELIGIBLE");
  });

  it("withholds certification regardless of retention when the immediate comprehension itself did not pass", () => {
    const result = evaluateAdvancedCertification({
      immediatePassed: false,
      retentionState: "PASS",
      retentionRequired: true
    });

    expect(result.eligible).toBe(false);
    expect(result.reasonCode).toBe("IMMEDIATE_COMPREHENSION_NOT_PASSED");
  });

  it("certifies when immediate passes and retention passes while mandatory", () => {
    const result = evaluateAdvancedCertification({
      immediatePassed: true,
      retentionState: "PASS",
      retentionRequired: true
    });

    expect(result.eligible).toBe(true);
    expect(result.reasonCode).toBe("ELIGIBLE");
  });

  it("is deterministic for identical inputs", () => {
    const inputs = { immediatePassed: true, retentionState: "FAIL" as const, retentionRequired: true };
    expect(evaluateAdvancedCertification(inputs)).toEqual(evaluateAdvancedCertification(inputs));
  });
});
