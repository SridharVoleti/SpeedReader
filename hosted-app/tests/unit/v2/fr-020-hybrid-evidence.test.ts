import { describe, expect, it } from "vitest";
import { scoreComprehension, structuredEvidence } from "../../../lib/v2/comprehension-score";
import { CALIBRATION_V1, CURRENT_CALIBRATION, calibrationByVersion, type CalibrationConfig } from "../../../lib/v2/calibration";

const items = (...scores: number[]) => structuredEvidence(scores.map((score, i) => ({ itemId: `q${i + 1}`, score })));

// FR-020 - Hybrid evidence model [FROZEN]
describe("FR-020 hybrid evidence model", () => {
  it("stores structured and spoken evidence separately and yields one auditable result (AC-P12)", () => {
    const r = scoreComprehension(items(1, 1, 0, 1), { score: 0.8 });
    expect(r.status).toBe("SCORED");
    if (r.status !== "SCORED") throw new Error("unreachable");
    expect(r.structured.items.map((i) => i.itemId)).toEqual(["q1", "q2", "q3", "q4"]);
    expect(r.structured.score).toBeCloseTo(0.75);
    expect(r.spoken.score).toBe(0.8);
    expect(r.score).toBeCloseTo(0.7 * 0.75 + 0.3 * 0.8);
    expect(r.weights).toEqual({ structured: 0.7, spoken: 0.3 });
    expect(r.calibrationVersion).toBe(CALIBRATION_V1.version);
    expect(r.classification).toBe("GREEN");
  });

  it("both sources contribute: either alone cannot determine the outcome", () => {
    const strongStructuredWeakSpoken = scoreComprehension(items(1), { score: 0 });
    const weakStructuredStrongSpoken = scoreComprehension(items(0), { score: 1 });
    if (strongStructuredWeakSpoken.status !== "SCORED" || weakStructuredStrongSpoken.status !== "SCORED") throw new Error("unreachable");
    expect(strongStructuredWeakSpoken.score).toBeCloseTo(0.7);
    expect(strongStructuredWeakSpoken.classification).toBe("NOT_GREEN"); // spoken weight is consequential
    expect(weakStructuredStrongSpoken.score).toBeCloseTo(0.3);
    expect(strongStructuredWeakSpoken.score).toBeGreaterThan(weakStructuredStrongSpoken.score); // structured weighs more
  });

  it("does not score before spoken evidence arrives", () => {
    const r = scoreComprehension(items(1, 1), null);
    expect(r).toMatchObject({ status: "AWAITING_SPOKEN_EVIDENCE", score: null, classification: null });
  });

  it("takes weights from versioned calibration, not hard-coded values", () => {
    const alt: CalibrationConfig = { ...CURRENT_CALIBRATION, version: "alt-60-40", comprehensionWeights: { structured: 0.6, spoken: 0.4 } };
    const r = scoreComprehension(items(1), { score: 0 }, alt);
    if (r.status !== "SCORED") throw new Error("unreachable");
    expect(r.score).toBeCloseTo(0.6);
    expect(r.calibrationVersion).toBe("alt-60-40");
  });

  it("resolves historical calibration versions", () => {
    expect(calibrationByVersion(CALIBRATION_V1.version)).toBe(CALIBRATION_V1);
    expect(() => calibrationByVersion("nope")).toThrow(/unknown/);
  });

  it("structured weight is larger than spoken weight in the current calibration", () => {
    expect(CURRENT_CALIBRATION.comprehensionWeights.structured).toBeGreaterThan(CURRENT_CALIBRATION.comprehensionWeights.spoken);
    expect(CURRENT_CALIBRATION.comprehensionWeights.structured + CURRENT_CALIBRATION.comprehensionWeights.spoken).toBeCloseTo(1);
  });

  it("validates inputs", () => {
    expect(() => structuredEvidence([])).toThrow();
    expect(() => structuredEvidence([{ itemId: "q", score: 1.5 }])).toThrow(RangeError);
    expect(() => scoreComprehension(items(1), { score: -0.1 })).toThrow(RangeError);
  });
});
