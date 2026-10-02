import { describe, expect, it } from "vitest";
import { evaluateFirstFive } from "../../../lib/v2/first-five";
import type { Classification } from "../../../lib/v2/comprehension-threshold";

const G: Classification = "GREEN";
const N: Classification = "NOT_GREEN";

// every 5-length G/N pattern
const patterns = Array.from({ length: 32 }, (_, i) => Array.from({ length: 5 }, (_, b) => ((i >> b) & 1 ? G : N)));

// FR-014 - First-five rule [FROZEN]
describe("FR-014 first-five rule", () => {
  it("5/5 GREEN levels up", () => expect(evaluateFirstFive([G, G, G, G, G]).decision).toBe("LEVEL_UP"));

  it("4/5 GREEN levels up wherever the one NOT_GREEN falls (outlier tolerated)", () => {
    for (let miss = 0; miss < 5; miss += 1) {
      const attempts = [G, G, G, G, G].map((c, i) => (i === miss ? N : c));
      expect(evaluateFirstFive(attempts)).toEqual({ decision: "LEVEL_UP", attempts: 5, greens: 4 });
    }
  });

  it("0/5, 1/5, 2/5 and 3/5 GREEN hold the current WPM", () => {
    for (const p of patterns) {
      const greens = p.filter((c) => c === G).length;
      if (greens <= 3) expect(evaluateFirstFive(p)).toEqual({ decision: "HOLD", attempts: 5, greens });
    }
  });

  it("covers all 32 patterns: level up iff at least four are GREEN", () => {
    for (const p of patterns) {
      const greens = p.filter((c) => c === G).length;
      expect(evaluateFirstFive(p).decision).toBe(greens >= 4 ? "LEVEL_UP" : "HOLD");
    }
  });

  it("is pending until five new passages exist - fewer never levels up", () => {
    expect(evaluateFirstFive([])).toEqual({ decision: "PENDING", attempts: 0, greens: 0 });
    expect(evaluateFirstFive([G, G, G, G])).toEqual({ decision: "PENDING", attempts: 4, greens: 4 });
  });

  it("evaluates only the first five: later passages do not change the first-five outcome", () => {
    expect(evaluateFirstFive([G, N, N, N, N, G, G, G, G]).decision).toBe("HOLD");
    expect(evaluateFirstFive([G, G, G, G, N, N, N, N]).decision).toBe("LEVEL_UP");
  });

  it("matches AC-P04 and AC-P05 exactly", () => {
    expect(evaluateFirstFive([G, G, N, G, G]).decision).toBe("LEVEL_UP"); // AC-P04
    expect(evaluateFirstFive([G, N, G, N, G]).decision).toBe("HOLD"); // AC-P05: 3/5
  });
});
