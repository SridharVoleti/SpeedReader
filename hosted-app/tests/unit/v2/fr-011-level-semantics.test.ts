import { describe, expect, it } from "vitest";
import {
  LEVEL_UP_MESSAGE, levelUpCount, levelUpsForWpmChange, levelUpAchievement, dimensionCelebration,
  CELEBRATED_DIMENSIONS, usesForbiddenLevelTerm
} from "../../../lib/v2/level-semantics";

// FR-011 - Level semantics [FROZEN]
describe("FR-011 level semantics", () => {
  it("+1 WPM is exactly one Level Up (one Babystep)", () => {
    expect(levelUpsForWpmChange(90, 91)).toBe(1);
    expect(levelUpsForWpmChange(90, 90)).toBe(0);
    expect(levelUpCount(60, 75)).toBe(15);
    expect(levelUpCount(60, 60)).toBe(0);
  });

  it("never counts a decrement", () => {
    expect(() => levelUpsForWpmChange(91, 90)).toThrow(RangeError);
    expect(() => levelUpCount(60, 59)).toThrow(RangeError);
  });

  it("uses the canonical wording 'You Levelled Up!'", () => {
    expect(LEVEL_UP_MESSAGE).toBe("You Levelled Up!");
    expect(levelUpAchievement()).toEqual({ kind: "LEVEL_UP", numbered: true, message: "You Levelled Up!" });
  });

  it("never uses 'graduated' terminology", () => {
    expect(LEVEL_UP_MESSAGE).not.toMatch(/graduat/i);
    expect(usesForbiddenLevelTerm("You graduated!")).toBe(true);
    expect(usesForbiddenLevelTerm("Graduation day")).toBe(true);
    expect(usesForbiddenLevelTerm("You Levelled Up!")).toBe(false);
  });

  it("celebrates other dimensions without creating numbered Level Ups", () => {
    expect(CELEBRATED_DIMENSIONS).toEqual(["comprehension", "expression", "stamina", "fluency", "independence"]);
    for (const dimension of CELEBRATED_DIMENSIONS) {
      expect(dimensionCelebration(dimension)).toEqual({ kind: "CELEBRATION", numbered: false, dimension });
    }
  });

  it("rejects fractional WPM", () => {
    expect(() => levelUpCount(60.5, 70)).toThrow(RangeError);
  });
});
