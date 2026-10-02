import { describe, expect, it } from "vitest";
import { computePacingSchedule, DEFAULT_PACING_CONFIG } from "../../lib/meaningful-chunking";

// SR-R9-003: Semantic pacing.
// "Apply bounded deterministic pacing adjustments for punctuation/meaning boundaries."
// "Same content/rules yield same logged timing schedule within bounds."
const TOKENS = ["First,", "second.", "third"];

describe("computePacingSchedule", () => {
  it("classifies pause type from trailing punctuation and applies a larger multiplier for stronger boundaries", () => {
    const schedule = computePacingSchedule(TOKENS);

    expect(schedule[0].pauseType).toBe("COMMA");
    expect(schedule[1].pauseType).toBe("SENTENCE_END");
    expect(schedule[2].pauseType).toBe("NONE");

    // A sentence-ending pause is a stronger boundary than a comma, which is stronger than none.
    expect(schedule[1].pacingMultiplier).toBeGreaterThan(schedule[0].pacingMultiplier);
    expect(schedule[0].pacingMultiplier).toBeGreaterThan(schedule[2].pacingMultiplier);
  });

  it("keeps every pacing multiplier within the configured bounds", () => {
    const schedule = computePacingSchedule(TOKENS);

    for (const entry of schedule) {
      expect(entry.pacingMultiplier).toBeGreaterThanOrEqual(DEFAULT_PACING_CONFIG.minMultiplier);
      expect(entry.pacingMultiplier).toBeLessThanOrEqual(DEFAULT_PACING_CONFIG.maxMultiplier);
    }
  });

  it("yields the exact same logged timing schedule for the same content and rules", () => {
    expect(computePacingSchedule(TOKENS)).toEqual(computePacingSchedule(TOKENS));
  });

  it("derives duration in ms from the base pace and the pacing multiplier", () => {
    const schedule = computePacingSchedule(["plain"], { ...DEFAULT_PACING_CONFIG, baseMsPerToken: 300 });
    expect(schedule[0].durationMs).toBe(300 * schedule[0].pacingMultiplier);
  });
});
