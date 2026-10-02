// FR-013 - Passage GREEN threshold [FROZEN] (shared by the initial assessment and progression).
// >=75% is GREEN, <75% NOT_GREEN. The score and classification are internal and never displayed.

export const GREEN_THRESHOLD = 0.75;
export type Classification = "GREEN" | "NOT_GREEN";

export function classifyComprehension(score: number): Classification {
  return score >= GREEN_THRESHOLD ? "GREEN" : "NOT_GREEN";
}
