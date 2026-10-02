import { describe, expect, it } from "vitest";
import { detectFatigueSignals, SegmentMetric } from "../../lib/sustained-reading";

// SR-R7-003: Fatigue/stability indicators.
// "Detect configured within-session degradation across comparable segments."
// "Synthetic histories crossing thresholds produce FATIGUE_RISK/STABILITY_DROP; stable
//  histories do not."
describe("detectFatigueSignals", () => {
  it("reports no signals for a stable history (comparable wpm/comprehension across segments)", () => {
    const segments: SegmentMetric[] = [
      { segmentIndex: 0, wpm: 200, comprehensionRate: 0.9 },
      { segmentIndex: 1, wpm: 195, comprehensionRate: 0.9 },
      { segmentIndex: 2, wpm: 198, comprehensionRate: 0.85 }
    ];

    const state = detectFatigueSignals(segments);

    expect(state.fatigueRisk).toBe(false);
    expect(state.stabilityDrop).toBe(false);
    expect(state.signals).toEqual([]);
  });

  it("reports FATIGUE_RISK when WPM drops past the configured threshold from its peak", () => {
    const segments: SegmentMetric[] = [
      { segmentIndex: 0, wpm: 240, comprehensionRate: 0.9 },
      { segmentIndex: 1, wpm: 220, comprehensionRate: 0.9 },
      { segmentIndex: 2, wpm: 150, comprehensionRate: 0.88 }
    ];

    const state = detectFatigueSignals(segments);

    expect(state.fatigueRisk).toBe(true);
    expect(state.stabilityDrop).toBe(false);
    expect(state.signals).toEqual(["FATIGUE_RISK"]);
  });

  it("reports STABILITY_DROP when comprehension drops past the configured threshold from its peak", () => {
    const segments: SegmentMetric[] = [
      { segmentIndex: 0, wpm: 200, comprehensionRate: 0.95 },
      { segmentIndex: 1, wpm: 205, comprehensionRate: 0.8 },
      { segmentIndex: 2, wpm: 198, comprehensionRate: 0.6 }
    ];

    const state = detectFatigueSignals(segments);

    expect(state.fatigueRisk).toBe(false);
    expect(state.stabilityDrop).toBe(true);
    expect(state.signals).toEqual(["STABILITY_DROP"]);
  });

  it("reports both signals when both thresholds are crossed in the same history", () => {
    const segments: SegmentMetric[] = [
      { segmentIndex: 0, wpm: 240, comprehensionRate: 0.95 },
      { segmentIndex: 1, wpm: 180, comprehensionRate: 0.7 },
      { segmentIndex: 2, wpm: 140, comprehensionRate: 0.55 }
    ];

    const state = detectFatigueSignals(segments);

    expect(state.fatigueRisk).toBe(true);
    expect(state.stabilityDrop).toBe(true);
    expect(state.signals).toEqual(["FATIGUE_RISK", "STABILITY_DROP"]);
  });

  it("reports no signals when there are fewer than two comparable segments", () => {
    const state = detectFatigueSignals([{ segmentIndex: 0, wpm: 200, comprehensionRate: 0.9 }]);

    expect(state.fatigueRisk).toBe(false);
    expect(state.stabilityDrop).toBe(false);
    expect(state.signals).toEqual([]);
  });

  it("is deterministic for identical inputs", () => {
    const segments: SegmentMetric[] = [
      { segmentIndex: 0, wpm: 240, comprehensionRate: 0.9 },
      { segmentIndex: 1, wpm: 150, comprehensionRate: 0.6 }
    ];

    expect(detectFatigueSignals(segments)).toEqual(detectFatigueSignals(segments));
  });
});
