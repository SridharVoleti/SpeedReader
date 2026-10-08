import { describe, expect, it } from "vitest";
import { calibrationReport } from "../../../lib/sr/calibration-report";

const rows = [
  { learnerId: "a", passageId: "p1", rsId: "RS01", score: 50 },
  { learnerId: "b", passageId: "p1", rsId: "RS01", score: 70 },
  { learnerId: "a", passageId: "p2", rsId: "RS02", score: 90 },
  { learnerId: "c", passageId: "p2", rsId: "RS02", score: 60 }
];
describe("SR-007 population calibration report", () => {
  const r = calibrationReport(rows, { currentThreshold: 60, effectiveDate: "2026-11-05" });
  it("reports cohort size and overall distribution", () => {
    expect(r.cohortSize).toBe(3);
    expect(r.attempts).toBe(4);
    expect(r.mean).toBe(67.5);
    expect(r.distribution.min).toBe(50);
    expect(r.distribution.max).toBe(90);
    expect(r.distribution.median).toBe(65);
  });
  it("splits by passage and by RS", () => {
    expect(r.byPassage.p1.mean).toBe(60);
    expect(r.byPassage.p2.n).toBe(2);
    expect(r.byRs.RS02.mean).toBe(75);
  });
  it("shows the pass rate at the current threshold", () => {
    expect(r.passRateAtCurrent).toBe(0.75);
  });
  it("is versioned with an effective date and never auto-deploys a change", () => {
    expect(r.effectiveDate).toBe("2026-11-05");
    expect(r.autoDeploy).toBe(false);
    expect(r.requiresExplicitApproval).toBe(true);
  });
  it("handles an empty cohort", () => {
    const e = calibrationReport([], { currentThreshold: 60, effectiveDate: "d" });
    expect(e.cohortSize).toBe(0);
    expect(e.mean).toBeNull();
  });
});
