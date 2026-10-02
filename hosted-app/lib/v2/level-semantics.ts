// FR-011 - Level semantics [FROZEN]
// For the core reading track: +1 WPM = one Level Up = one Babystep. Only a WPM increase is a numbered
// Level Up; comprehension, expression, stamina, fluency and independence may be celebrated but never
// produce numbered Level Ups. Canonical wording is "You Levelled Up!" - never "graduated".

export const LEVEL_UP_MESSAGE = "You Levelled Up!";
export const FORBIDDEN_LEVEL_TERMS: readonly string[] = ["graduated", "graduate", "graduation"];

export const CELEBRATED_DIMENSIONS = ["comprehension", "expression", "stamina", "fluency", "independence"] as const;
export type CelebratedDimension = (typeof CELEBRATED_DIMENSIONS)[number];

/** Number of Level Ups (Babysteps) a learner has earned: +1 per WPM above their personal baseline. */
export function levelUpCount(baselineWpm: number, earnedWpm: number): number {
  if (!Number.isInteger(baselineWpm) || !Number.isInteger(earnedWpm)) throw new RangeError("WPM values must be integers");
  if (earnedWpm < baselineWpm) throw new RangeError("earned WPM can never be below the baseline");
  return earnedWpm - baselineWpm;
}

/** One WPM increase is exactly one Level Up. */
export function levelUpsForWpmChange(fromWpm: number, toWpm: number): number {
  if (toWpm < fromWpm) throw new RangeError("WPM is never decremented");
  return toWpm - fromWpm;
}

export type Achievement = { kind: "LEVEL_UP"; numbered: true; message: string } | { kind: "CELEBRATION"; numbered: false; dimension: CelebratedDimension };

export function levelUpAchievement(): Achievement {
  return { kind: "LEVEL_UP", numbered: true, message: LEVEL_UP_MESSAGE };
}

/** Non-WPM dimensions can be celebrated but never numbered as Level Ups. */
export function dimensionCelebration(dimension: CelebratedDimension): Achievement {
  return { kind: "CELEBRATION", numbered: false, dimension };
}

export function usesForbiddenLevelTerm(text: string): boolean {
  return FORBIDDEN_LEVEL_TERMS.some((term) => new RegExp("\\b" + term, "i").test(text));
}
