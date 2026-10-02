import { describe, expect, it } from "vitest";
import { classifyDurationBand, measureSustainedPerformance, SustainedAttempt } from "../../lib/sustained-reading";

// SR-R7-001: Duration-band measurement.
// "Measure performance over configured sustained-reading duration bands."
// "Attempt identifies duration band and rate/comprehension over full valid interval."
describe("classifyDurationBand", () => {
  it("classifies a short valid duration into the SHORT band", () => {
    expect(classifyDurationBand(120)).toBe("SHORT");
  });

  it("classifies a mid-length valid duration into the MEDIUM band", () => {
    expect(classifyDurationBand(600)).toBe("MEDIUM");
  });

  it("classifies a long valid duration into the LONG band", () => {
    expect(classifyDurationBand(1200)).toBe("LONG");
  });
});

describe("measureSustainedPerformance", () => {
  it("identifies the duration band and computes rate/comprehension over the full valid interval", () => {
    const attempt: SustainedAttempt = {
      segments: [
        { startSeconds: 0, endSeconds: 125, wordsRead: 250, valid: true, comprehensionCorrect: 4, comprehensionTotal: 5 },
        { startSeconds: 125, endSeconds: 250, wordsRead: 250, valid: true, comprehensionCorrect: 5, comprehensionTotal: 5 }
      ]
    };

    const measurement = measureSustainedPerformance(attempt);

    expect(measurement.durationBand).toBe("SHORT");
    expect(measurement.sustainedWpm).toBe(120);
    expect(measurement.comprehensionRate).toBeCloseTo(0.9, 5);
  });

  it("excludes invalid (interrupted) segments from the valid interval used for measurement", () => {
    const attempt: SustainedAttempt = {
      segments: [
        { startSeconds: 0, endSeconds: 150, wordsRead: 300, valid: true, comprehensionCorrect: 5, comprehensionTotal: 5 },
        // Technical interruption: excluded entirely, despite covering real wall-clock time.
        { startSeconds: 150, endSeconds: 400, wordsRead: 50, valid: false, comprehensionCorrect: 0, comprehensionTotal: 0 }
      ]
    };

    const measurement = measureSustainedPerformance(attempt);

    expect(measurement.durationBand).toBe("SHORT");
    expect(measurement.sustainedWpm).toBe(120);
  });

  it("reports no comprehension rate when no comprehension questions were answered", () => {
    const attempt: SustainedAttempt = {
      segments: [{ startSeconds: 0, endSeconds: 120, wordsRead: 240, valid: true, comprehensionCorrect: 0, comprehensionTotal: 0 }]
    };

    const measurement = measureSustainedPerformance(attempt);

    expect(measurement.comprehensionRate).toBeNull();
  });

  it("reports no duration band and zero rate when there is no valid interval at all", () => {
    const attempt: SustainedAttempt = {
      segments: [{ startSeconds: 0, endSeconds: 300, wordsRead: 500, valid: false, comprehensionCorrect: 0, comprehensionTotal: 0 }]
    };

    const measurement = measureSustainedPerformance(attempt);

    expect(measurement.durationBand).toBeNull();
    expect(measurement.sustainedWpm).toBe(0);
    expect(measurement.comprehensionRate).toBeNull();
  });

  it("is deterministic for identical inputs", () => {
    const attempt: SustainedAttempt = {
      segments: [{ startSeconds: 0, endSeconds: 180, wordsRead: 360, valid: true, comprehensionCorrect: 3, comprehensionTotal: 4 }]
    };

    expect(measureSustainedPerformance(attempt)).toEqual(measureSustainedPerformance(attempt));
  });
});
