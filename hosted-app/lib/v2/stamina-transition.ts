// FR-006 - Stamina transition precedence [FROZEN]
// One meaningful challenge increase at a time: when the next canonical passage is longer, the
// length increase takes priority and an eligible +1 WPM Level Up is not applied on that
// passage. The learner first meets the longer passage at the current earned WPM; WPM
// progression resumes from subsequent valid new-passage evidence.

import { passageWords, WORLD1_LAST_PASSAGE } from "./stamina";

import { WORLD1_MAX_WPM } from "./speed-ceiling";
export const WORLD1_SPEED_CEILING_WPM = WORLD1_MAX_WPM; // FR-010

export type TransitionInput = { completedSequence: number; currentWpm: number; levelUpEligible: boolean };

export type TransitionPlan = {
  nextSequence: number;
  currentWords: number;
  nextWords: number;
  nextWpm: number;
  levelUpApplied: boolean;
  /** An eligible Level Up was held back because the passage length increased. */
  levelUpDeferred: boolean;
};

export function planNextPassage(input: TransitionInput): TransitionPlan {
  const { completedSequence, currentWpm, levelUpEligible } = input;
  if (!Number.isInteger(completedSequence) || completedSequence < 1 || completedSequence >= WORLD1_LAST_PASSAGE) {
    throw new RangeError("completedSequence must be an integer 1..1499");
  }
  const currentWords = passageWords(completedSequence);
  const nextWords = passageWords(completedSequence + 1);
  const lengthIncreases = nextWords > currentWords;

  const levelUpApplied = levelUpEligible && !lengthIncreases && currentWpm < WORLD1_SPEED_CEILING_WPM;
  return {
    nextSequence: completedSequence + 1,
    currentWords,
    nextWords,
    nextWpm: levelUpApplied ? currentWpm + 1 : currentWpm,
    levelUpApplied,
    levelUpDeferred: levelUpEligible && lengthIncreases
  };
}
