import { describe, expect, it } from "vitest";
import { PILOT_THRESHOLD, passesComprehension, proposeThreshold, approveThreshold, activeThreshold } from "../../../lib/sr/pilot-threshold";

describe("SR-006 provisional, parameterized pass threshold", () => {
  it("starts at 60 and is clearly provisional, not approved", () => {
    expect(PILOT_THRESHOLD).toMatchObject({ value: 60, status: "PROVISIONAL_PILOT", approved: false, version: 1 });
  });
  it("scoring takes the threshold as a parameter (not hard-coded)", () => {
    expect(passesComprehension(60, PILOT_THRESHOLD)).toBe(true);
    expect(passesComprehension(59, PILOT_THRESHOLD)).toBe(false);
    expect(passesComprehension(65, { ...PILOT_THRESHOLD, value: 70 })).toBe(false);
  });
  it("a calibrated change is a new version and is not active until approved", () => {
    const proposed = proposeThreshold(PILOT_THRESHOLD, 68, { by: "analyst", reason: "week-4 distribution", at: "2026-11-05" });
    expect(proposed.version).toBe(2);
    expect(proposed.approved).toBe(false);
    expect(activeThreshold([PILOT_THRESHOLD, proposed]).version).toBe(1);
  });
  it("approval activates it and keeps the earlier version in history", () => {
    const proposed = proposeThreshold(PILOT_THRESHOLD, 68, { by: "analyst", reason: "r", at: "2026-11-05" });
    const approved = approveThreshold(proposed, { by: "product", at: "2026-11-06" });
    expect(approved).toMatchObject({ approved: true, status: "PRODUCTION_APPROVED", value: 68 });
    expect(activeThreshold([PILOT_THRESHOLD, approved]).value).toBe(68);
  });
  it("the shipped pilot value is never treated as final", () => {
    expect(activeThreshold([PILOT_THRESHOLD]).approved).toBe(false);
  });
  it("rejects invalid values", () => {
    expect(() => proposeThreshold(PILOT_THRESHOLD, 101, { by: "a", reason: "r", at: "d" })).toThrow();
    expect(() => proposeThreshold(PILOT_THRESHOLD, -1, { by: "a", reason: "r", at: "d" })).toThrow();
  });
});
