// FR-014 - First-five rule [FROZEN]
// At the current earned WPM, evaluate the first five NEW canonical passages attempted at that WPM:
// 4/5 or 5/5 GREEN -> +1 WPM Level Up; 0-3 GREEN -> HOLD (post-five rule, FR-015, takes over).
// One NOT_GREEN passage is therefore tolerated as an outlier when the other four are GREEN.

import type { Classification } from "./comprehension-threshold";

export const FIRST_FIVE_WINDOW = 5;
export const FIRST_FIVE_GREENS_REQUIRED = 4;

export type FirstFiveResult = {
  decision: "PENDING" | "LEVEL_UP" | "HOLD";
  attempts: number;
  greens: number;
};

/** `newAttempts` must be NEW_PROGRESSION classifications at the current WPM, oldest first. */
export function evaluateFirstFive(newAttempts: readonly Classification[]): FirstFiveResult {
  const window = newAttempts.slice(0, FIRST_FIVE_WINDOW);
  const greens = window.filter((c) => c === "GREEN").length;
  if (window.length < FIRST_FIVE_WINDOW) return { decision: "PENDING", attempts: window.length, greens };
  return { decision: greens >= FIRST_FIVE_GREENS_REQUIRED ? "LEVEL_UP" : "HOLD", attempts: FIRST_FIVE_WINDOW, greens };
}
