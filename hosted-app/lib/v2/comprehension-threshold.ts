// FR-013 - Passage GREEN threshold [FROZEN]
// Each new canonical passage gets an internal comprehension score: >=75% is GREEN, <75% NOT_GREEN.
// The exact score and classification are internal and never displayed to the learner. Passage
// percentages are never averaged: GREEN is decided per passage, so one very high score can never
// compensate for a passage below 75% (first-five rule).

export const GREEN_THRESHOLD = 0.75;
export type Classification = "GREEN" | "NOT_GREEN";

export function classifyComprehension(score: number): Classification {
  if (!(score >= 0 && score <= 1)) throw new RangeError("comprehension score must be 0..1");
  return score >= GREEN_THRESHOLD ? "GREEN" : "NOT_GREEN";
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
