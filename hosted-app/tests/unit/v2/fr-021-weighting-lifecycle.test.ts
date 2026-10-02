import { describe, expect, it } from "vitest";
import {
  MIN_MEANINGFUL_SPOKEN_WEIGHT, greenThresholdForCalibration, publishCalibration, validateCalibration, type PublishedCalibration
} from "../../../lib/v2/calibration-lifecycle";
import { CALIBRATION_V1, type CalibrationConfig } from "../../../lib/v2/calibration";
import { scoreComprehension, structuredEvidence } from "../../../lib/v2/comprehension-score";

const v1: PublishedCalibration = { ...CALIBRATION_V1, audit: { changedAt: "2026-10-02", reason: "initial pilot", changedBy: "product" } };
const candidate = (structured: number, spoken: number, version = "cal-2"): CalibrationConfig => ({
  version, status: "PROVISIONAL_PILOT", comprehensionWeights: { structured, spoken }
});
const audit = { changedAt: "2026-11-01", reason: "pilot evidence", changedBy: "calibration-board" };

// FR-021 - Weighting lifecycle [FROZEN PRINCIPLE / PROVISIONAL_PILOT PARAMETER]
describe("FR-021 weighting lifecycle", () => {
  it("accepts 70/30 and other recalibrations that keep the principle", () => {
    expect(validateCalibration(candidate(0.7, 0.3))).toEqual([]);
    expect(validateCalibration(candidate(0.65, 0.35))).toEqual([]);
    expect(validateCalibration(candidate(0.8, 0.2))).toEqual([]);
  });

  it("structured questions must retain the larger weight", () => {
    expect(validateCalibration(candidate(0.5, 0.5))).toContain("structured weight must stay larger than spoken weight");
    expect(validateCalibration(candidate(0.4, 0.6))).toContain("structured weight must stay larger than spoken weight");
  });

  it("spoken expression must remain meaningful (AC-P14: not a zero-weight decorative feature)", () => {
    expect(MIN_MEANINGFUL_SPOKEN_WEIGHT).toBeGreaterThan(0);
    expect(validateCalibration(candidate(1, 0)).join()).toMatch(/meaningful/);
    expect(validateCalibration(candidate(0.9, 0.1)).join()).toMatch(/meaningful/);
  });

  it("weights must sum to 1", () => {
    expect(validateCalibration(candidate(0.7, 0.2)).join()).toMatch(/sum to 1/);
  });

  it("cannot silently redefine the 75% GREEN threshold", () => {
    const sneaky = { ...candidate(0.7, 0.3), greenThreshold: 0.6 } as unknown as CalibrationConfig;
    expect(validateCalibration(sneaky).join()).toMatch(/GREEN threshold/);
    expect(greenThresholdForCalibration("any")).toBe(0.75);
  });

  it("publishes changes as new, audited versions and never mutates history", () => {
    const history = publishCalibration([v1], candidate(0.65, 0.35), audit);
    expect(history).toHaveLength(2);
    expect(history[0]).toBe(v1);
    expect(history[1].audit).toEqual(audit);
    expect(v1.comprehensionWeights).toEqual({ structured: 0.7, spoken: 0.3 });
  });

  it("rejects duplicate versions and unaudited changes", () => {
    expect(() => publishCalibration([v1], candidate(0.65, 0.35, v1.version), audit)).toThrow(/already exists/);
    expect(() => publishCalibration([v1], candidate(0.65, 0.35), { ...audit, reason: "" })).toThrow(/reason/);
  });

  it("rejects an invalid candidate", () => {
    expect(() => publishCalibration([v1], candidate(0.5, 0.5), audit)).toThrow(/invalid calibration/);
  });

  it("historical attempts keep the version they were scored with; a later calibration does not rewrite them", () => {
    const structured = structuredEvidence([{ itemId: "q1", score: 1 }, { itemId: "q2", score: 0.5 }]);
    const historic = scoreComprehension(structured, { score: 0.6 }, v1);
    const history = publishCalibration([v1], candidate(0.8, 0.2), audit);
    const later = scoreComprehension(structured, { score: 0.6 }, history[1]);
    if (historic.status !== "SCORED" || later.status !== "SCORED") throw new Error("unreachable");
    expect(historic.calibrationVersion).toBe(v1.version);
    expect(historic.score).toBeCloseTo(0.7 * 0.75 + 0.3 * 0.6);
    expect(later.calibrationVersion).toBe("cal-2");
    expect(later.score).not.toBeCloseTo(historic.score);
  });
});
