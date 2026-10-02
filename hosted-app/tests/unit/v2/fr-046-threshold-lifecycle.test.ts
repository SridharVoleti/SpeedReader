import { describe, expect, it } from "vitest";
import {
  LIFECYCLE_STATES, THRESHOLD_REGISTRY, canTransition, changeThreshold, transitionThreshold, type ThresholdEntry
} from "../../../lib/v2/threshold-lifecycle";
import { GREEN_THRESHOLD } from "../../../lib/v2/comprehension-threshold";

const audit = { changedAt: "2026-11-01", reason: "pilot evidence", changedBy: "calibration-board" };
const entry = (key: string): ThresholdEntry => THRESHOLD_REGISTRY.find((e) => e.key === key)!;

// FR-046 - Threshold lifecycle [FROZEN GOVERNANCE]
describe("FR-046 threshold lifecycle", () => {
  it("defines the four lifecycle states", () => {
    expect([...LIFECYCLE_STATES]).toEqual(["PROVISIONAL_PILOT", "CALIBRATION_REVIEW", "PRODUCTION_APPROVED", "SUSPENDED_RECALIBRATE"]);
  });

  it("catalogues every threshold in one registry, reading the live constants", () => {
    expect(entry("green-threshold").value).toBe(GREEN_THRESHOLD);
    expect(entry("world1-max-wpm").value).toBe(150);
    expect(entry("first-five-greens-required").value).toBe(4);
    expect(entry("post-five-consecutive-green").value).toBe(3);
    expect(entry("reference-book-words").value).toBe(50000);
    expect(entry("weight-structured").value).toBe(0.7);
    expect(new Set(THRESHOLD_REGISTRY.map((e) => e.key)).size).toBe(THRESHOLD_REGISTRY.length);
  });

  it("every explicitly frozen product rule is marked FROZEN and every other threshold starts PROVISIONAL_PILOT", () => {
    for (const e of THRESHOLD_REGISTRY) {
      if (e.frozen) expect(e.state).toBe("FROZEN");
      else expect(e.state).toBe("PROVISIONAL_PILOT");
    }
  });

  it("allows only the lifecycle transitions PROVISIONAL -> REVIEW -> APPROVED <-> SUSPENDED -> REVIEW", () => {
    expect(canTransition("PROVISIONAL_PILOT", "CALIBRATION_REVIEW")).toBe(true);
    expect(canTransition("CALIBRATION_REVIEW", "PRODUCTION_APPROVED")).toBe(true);
    expect(canTransition("CALIBRATION_REVIEW", "PROVISIONAL_PILOT")).toBe(true);
    expect(canTransition("PRODUCTION_APPROVED", "SUSPENDED_RECALIBRATE")).toBe(true);
    expect(canTransition("SUSPENDED_RECALIBRATE", "CALIBRATION_REVIEW")).toBe(true);
    expect(canTransition("PROVISIONAL_PILOT", "PRODUCTION_APPROVED")).toBe(false);
    expect(canTransition("PRODUCTION_APPROVED", "PROVISIONAL_PILOT")).toBe(false);
    expect(canTransition("SUSPENDED_RECALIBRATE", "PRODUCTION_APPROVED")).toBe(false);
  });

  it("walks a calibratable threshold through its lifecycle with audit", () => {
    const e0 = entry("weight-spoken");
    const e1 = transitionThreshold(e0, "CALIBRATION_REVIEW", audit);
    const e2 = transitionThreshold(e1.entry, "PRODUCTION_APPROVED", audit);
    expect(e2.entry.state).toBe("PRODUCTION_APPROVED");
    expect(e2.previous.state).toBe("CALIBRATION_REVIEW");
    expect(() => transitionThreshold(e0, "PRODUCTION_APPROVED", audit)).toThrow(/illegal lifecycle transition/);
  });

  it("calibration may adjust empirical numbers (audited)", () => {
    const changed = changeThreshold(entry("asr-min-confidence"), 0.65, audit);
    expect(changed.entry.value).toBe(0.65);
    expect(changed.previous.value).toBe(0.6);
    expect(() => changeThreshold(entry("asr-min-confidence"), 0.65, { ...audit, reason: "" })).toThrow(/reason/);
    expect(() => changeThreshold(entry("asr-min-confidence"), Number.NaN, audit)).toThrow(RangeError);
  });

  it("calibration cannot silently change frozen semantics: frozen rules reject any change or transition", () => {
    for (const key of ["green-threshold", "world1-max-wpm", "first-five-greens-required", "post-five-consecutive-green", "reference-book-words"]) {
      expect(() => changeThreshold(entry(key), 1, audit), key).toThrow(/FROZEN/);
      expect(() => transitionThreshold(entry(key), "CALIBRATION_REVIEW", audit), key).toThrow(/FROZEN/);
    }
  });

  it("a PRODUCTION_APPROVED value cannot be edited until it is suspended for recalibration", () => {
    const approved = transitionThreshold(transitionThreshold(entry("recency-max-age-days"), "CALIBRATION_REVIEW", audit).entry, "PRODUCTION_APPROVED", audit).entry;
    expect(() => changeThreshold(approved, 200, audit)).toThrow(/suspend/);
    const suspended = transitionThreshold(approved, "SUSPENDED_RECALIBRATE", audit).entry;
    expect(changeThreshold(suspended, 200, audit).entry.value).toBe(200);
  });
});
