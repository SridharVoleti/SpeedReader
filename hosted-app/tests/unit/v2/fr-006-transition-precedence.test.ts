import { describe, expect, it } from "vitest";
import { planNextPassage } from "../../../lib/v2/stamina-transition";

// FR-006 - Stamina transition precedence [FROZEN]
describe("FR-006 stamina transition precedence", () => {
  it("length increase wins: no WPM Level Up on the same passage", () => {
    const plan = planNextPassage({ completedSequence: 150, currentWpm: 90, levelUpEligible: true });
    expect(plan).toMatchObject({ nextSequence: 151, nextWords: 125, nextWpm: 90, levelUpApplied: false, levelUpDeferred: true });
  });

  it("the longer passage is first experienced at the current earned WPM", () => {
    expect(planNextPassage({ completedSequence: 175, currentWpm: 101, levelUpEligible: true }).nextWpm).toBe(101);
    expect(planNextPassage({ completedSequence: 1425, currentWpm: 149, levelUpEligible: true }).nextWpm).toBe(149);
  });

  it("applies the Level Up normally when passage length does not change", () => {
    const plan = planNextPassage({ completedSequence: 160, currentWpm: 90, levelUpEligible: true });
    expect(plan).toMatchObject({ nextSequence: 161, nextWords: 125, nextWpm: 91, levelUpApplied: true, levelUpDeferred: false });
  });

  it("does nothing special at a length boundary without eligibility", () => {
    const plan = planNextPassage({ completedSequence: 150, currentWpm: 90, levelUpEligible: false });
    expect(plan).toMatchObject({ nextWords: 125, nextWpm: 90, levelUpApplied: false, levelUpDeferred: false });
  });

  it("never changes both dimensions on the same passage, for every boundary in World 1", () => {
    for (let s = 1; s < 1500; s += 1) {
      const plan = planNextPassage({ completedSequence: s, currentWpm: 100, levelUpEligible: true });
      const lengthChanged = plan.nextWords !== plan.currentWords;
      const speedChanged = plan.nextWpm !== 100;
      expect(lengthChanged && speedChanged).toBe(false);
    }
  });

  it("respects the 150 WPM World 1 ceiling by never exceeding it via Level Up", () => {
    expect(planNextPassage({ completedSequence: 160, currentWpm: 150, levelUpEligible: true }).nextWpm).toBe(150);
  });

  it("rejects passage 1500 (no next passage) and invalid input", () => {
    expect(() => planNextPassage({ completedSequence: 1500, currentWpm: 100, levelUpEligible: false })).toThrow(RangeError);
    expect(() => planNextPassage({ completedSequence: 0, currentWpm: 100, levelUpEligible: false })).toThrow(RangeError);
  });
});
