import { describe, expect, it } from "vitest";
import { WORLD1_MAX_WPM, isSchedulableWpm, clampToCeiling, atCeiling, ceilingIsCompletionRequirement, developmentContinuesAtCeiling } from "../../../lib/v2/speed-ceiling";
import { planNextPassage } from "../../../lib/v2/stamina-transition";
import { runAssessment } from "../../../lib/v2/initial-assessment";

// FR-010 - World 1 speed ceiling [FROZEN]
describe("FR-010 World 1 speed ceiling", () => {
  it("is 150 WPM", () => expect(WORLD1_MAX_WPM).toBe(150));

  it("schedules nothing above 150 WPM", () => {
    expect(isSchedulableWpm(150)).toBe(true);
    expect(isSchedulableWpm(151)).toBe(false);
    expect(isSchedulableWpm(0)).toBe(false);
    expect(isSchedulableWpm(Number.NaN)).toBe(false);
    expect(clampToCeiling(180)).toBe(150);
    expect(clampToCeiling(90)).toBe(90);
  });

  it("is a ceiling, not a completion target", () => {
    expect(ceilingIsCompletionRequirement()).toBe(false);
  });

  it("reaching 150 does not terminate other development", () => {
    expect(atCeiling(150)).toBe(true);
    expect(developmentContinuesAtCeiling(150)).toEqual({ wpmCanIncrease: false, otherDevelopmentContinues: true });
    expect(developmentContinuesAtCeiling(149).wpmCanIncrease).toBe(true);
  });

  it("the progression plan never raises WPM past the ceiling", () => {
    expect(planNextPassage({ completedSequence: 160, currentWpm: 150, levelUpEligible: true }).nextWpm).toBe(150);
  });

  it("the initial assessment never schedules above the ceiling", () => {
    const result = runAssessment((wpm) => ({ wpm, comprehensionScore: 1, durationSec: 1 }), undefined);
    expect(result.attempts.every((a) => isSchedulableWpm(a.wpm))).toBe(true);
    expect(result.startingWpm).toBe(150);
  });
});
