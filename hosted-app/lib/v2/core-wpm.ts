// FR-014/FR-015 (CODEX-03) - Core WPM state machine, NEW_PROGRESSION evidence only.
//
// At the current earned WPM the first five new canonical passages are judged by the first-five rule
// (FR-014). If that does not level the learner up they HOLD at the current WPM and, from passage six
// onward, three consecutive GREEN new passages trigger +1 WPM (FR-015); a NOT_GREEN resets the streak.
// Evidence is only ever counted per WPM level: after a Level Up the counters start afresh.
// Assumption (documented): the post-five streak counts passages 6+ only, as FR-015 says "from passage
// six onward"; passages 1-5 are consumed by the first-five window.

import type { Classification } from "./comprehension-threshold";
import { evaluateFirstFive } from "./first-five";
import { WORLD1_MAX_WPM } from "./speed-ceiling";

export const POST_FIVE_STREAK_REQUIRED = 3;

export type CoreWpmState = {
  wpm: number;
  /** NEW_PROGRESSION classifications attempted at the current WPM, oldest first. */
  newAttempts: Classification[];
  /** Consecutive GREEN new passages counted from passage six onward. */
  postFiveStreak: number;
  /** Internal only: familiar practice may be offered. Never shown to the learner (FR-019). */
  practiceEligible: boolean;
};

export type CoreWpmEvent = "NONE" | "LEVEL_UP" | "HOLD_AFTER_FIVE";

export function newCoreWpmState(startingWpm: number): CoreWpmState {
  return { wpm: startingWpm, newAttempts: [], postFiveStreak: 0, practiceEligible: false };
}

export function recordNewPassage(state: CoreWpmState, result: Classification): { state: CoreWpmState; event: CoreWpmEvent } {
  const newAttempts = [...state.newAttempts, result];

  if (state.wpm >= WORLD1_MAX_WPM) {
    // At the ceiling nothing can raise WPM; other development continues elsewhere.
    return { state: { ...state, newAttempts }, event: "NONE" };
  }

  const levelUp = (): { state: CoreWpmState; event: CoreWpmEvent } => ({
    state: { wpm: state.wpm + 1, newAttempts: [], postFiveStreak: 0, practiceEligible: false },
    event: "LEVEL_UP"
  });

  if (newAttempts.length < 5) {
    return { state: { ...state, newAttempts }, event: "NONE" };
  }
  if (newAttempts.length === 5) {
    return evaluateFirstFive(newAttempts).decision === "LEVEL_UP"
      ? levelUp()
      : { state: { ...state, newAttempts, practiceEligible: true }, event: "HOLD_AFTER_FIVE" };
  }

  const postFiveStreak = result === "GREEN" ? state.postFiveStreak + 1 : 0;
  if (postFiveStreak >= POST_FIVE_STREAK_REQUIRED) return levelUp();
  return { state: { ...state, newAttempts, postFiveStreak, practiceEligible: true }, event: "NONE" };
}
