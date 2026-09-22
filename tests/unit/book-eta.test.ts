import { describe, expect, it } from "vitest";
import { estimateBookEta } from "../../lib/book-mode";

// SR-R10-002: Book ETA.
// "Estimate completion from appropriate sustainable/book rate, not peak short CRR."
// "ETA uses configured book-rate source; peak CRR alone cannot override it." (TC-R10-002-B:
//  peak=350, sustainable=250, known words -> uses 250 WPM source.)
describe("estimateBookEta", () => {
  it("uses the sustainable rate, not the higher peak CRR, when configured as the book-rate source (TC-R10-002-B)", () => {
    const result = estimateBookEta({
      remainingWords: 5000,
      peakCrrWpm: 350,
      sustainableWpm: 250,
      rateSource: "sustainable"
    });

    expect(result.rateSource).toBe("sustainable");
    expect(result.wpmUsed).toBe(250);
    expect(result.estimatedMinutes).toBe(20);
  });

  it("uses the peak CRR only when it is the explicitly configured rate source", () => {
    const result = estimateBookEta({
      remainingWords: 5000,
      peakCrrWpm: 350,
      sustainableWpm: 250,
      rateSource: "peak_crr"
    });

    expect(result.rateSource).toBe("peak_crr");
    expect(result.wpmUsed).toBe(350);
  });

  it("a higher peak CRR never overrides the configured sustainable source, regardless of magnitude", () => {
    const result = estimateBookEta({
      remainingWords: 1000,
      peakCrrWpm: 1000,
      sustainableWpm: 200,
      rateSource: "sustainable"
    });

    expect(result.wpmUsed).toBe(200);
  });

  it("is deterministic for identical inputs", () => {
    const inputs = { remainingWords: 5000, peakCrrWpm: 350, sustainableWpm: 250, rateSource: "sustainable" as const };
    expect(estimateBookEta(inputs)).toEqual(estimateBookEta(inputs));
  });
});
