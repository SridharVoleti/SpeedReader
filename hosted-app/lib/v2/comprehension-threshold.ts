// FR-013 - Passage GREEN threshold [FROZEN]
// Each new canonical passage gets an internal comprehension score: >=75% is GREEN, <75% NOT_GREEN.
// The exact score and classification are internal and never displayed to the learner. Passage
// percentages are never averaged: GREEN is decided per passage, so one very high score can never
// compensate for a passage below 75% (first-five rule).

export const GREEN_THRESHOLD = 0.75;
export type Classification = "GREEN" | "NOT_GREEN";

/** Round a score to 1e-9 so stored/compared scores are free of floating-point noise. */
export function roundScore(score: number): number {
  return Math.round(score * 1e9) / 1e9;
}

export function classifyComprehension(score: number): Classification {
  if (!(score >= 0 && score <= 1)) throw new RangeError("comprehension score must be 0..1");
  // Scores are compared at 1e-9 precision so a blend that is exactly 75% in decimal arithmetic is
  // never pushed below the threshold by binary floating-point error (e.g. 0.7*0.75 + 0.3*0.75).
  return roundScore(score) >= GREEN_THRESHOLD ? "GREEN" : "NOT_GREEN";
}

/** GREEN passages out of a set, counted passage by passage - never via an average. */
export function greenCount(scores: readonly number[]): number {
  return scores.filter((s) => classifyComprehension(s) === "GREEN").length;
}

/** What the learner may be told about a passage's comprehension: nothing numeric or classified. */
export type LearnerPassageView = { encouragement: string };

export function learnerView(_score: number): LearnerPassageView {
  return { encouragement: "Great reading - keep going!" };
}
