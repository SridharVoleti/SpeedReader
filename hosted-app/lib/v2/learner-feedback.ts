// FR-029 / FR-030 / FR-031 / CODEX-09 - Learner-facing feedback [FROZEN]
// The learner never sees their numeric comprehension score, the 75% threshold, GREEN/NOT_GREEN or
// PASS/FAIL. Those are stored internally for progression and analytics only. buildLearnerFeedback is
// the ONLY way internal results become learner-visible data: its output type has no numeric or
// classification fields, and assertNoInternalLeak guards any object about to be rendered.

import type { Classification } from "./comprehension-threshold";

/** Internal-only facts about a scored passage. Never passed to UI code. */
export type InternalPassageResult = {
  attemptId: string;
  score: number | null;
  classification: Classification | null;
};

export type LearnerFeedback = {
  /** Warm, non-numeric message. */
  message: string;
  /** Larger/smaller celebration level; never labelled with a result state. */
  celebration: "NONE" | "SMALL" | "LARGE";
  /** Best Possible Comprehension is offered after every scored passage (FR-025). */
  showBestPossibleComprehension: boolean;
};

const GREEN_MESSAGES = ["Great reading! You explained the story well.", "Wonderful job telling the story!"];
const NEUTRAL_MESSAGES = ["Thanks for reading. Take a look at how a strong reader might explain it.", "Nice effort. Here is one way to tell this story."];

/** Ordering used to prove a Level Up is celebrated more than an individual GREEN passage (FR-032). */
export const CELEBRATION_RANK: Readonly<Record<LearnerFeedback["celebration"], number>> = Object.freeze({ NONE: 0, SMALL: 1, LARGE: 2 });

/** Canonical Level Up message (FR-011/FR-032). Shows the new WPM, which is not a comprehension score. */
export function buildLevelUpFeedback(newWpm: number): LearnerFeedback & { newWpm: number } {
  return { message: "You Levelled Up!", celebration: "LARGE", showBestPossibleComprehension: true, newWpm };
}

export function buildLearnerFeedback(result: InternalPassageResult): LearnerFeedback {
  if (result.classification === "GREEN") {
    return { message: pick(GREEN_MESSAGES, result.attemptId), celebration: "SMALL", showBestPossibleComprehension: true };
  }
  // NOT_GREEN and technically-unresolved attempts both get neutral, encouraging feedback.
  return { message: pick(NEUTRAL_MESSAGES, result.attemptId), celebration: "NONE", showBestPossibleComprehension: true };
}

/** Deterministic variety without randomness (same attempt -> same message). */
function pick(options: readonly string[], seed: string): string {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return options[h % options.length];
}

const INTERNAL_KEYS = new Set([
  "score", "comprehensionScore", "classification", "threshold", "greenThreshold", "percent", "percentage",
  "pass", "passed", "fail", "failed", "result", "isGreen", "green", "notGreen"
]);
const INTERNAL_VALUES = /\b(NOT_GREEN|GREEN|PASS|FAIL)\b|\b\d{1,3}\s?%/;

/** Throws if learner-bound data carries an internal key or an internal-looking value. */
export function assertNoInternalLeak(value: unknown, path = "learnerView"): void {
  if (typeof value === "string") {
    if (INTERNAL_VALUES.test(value)) throw new Error(`internal value leaked at ${path}: "${value}"`);
    return;
  }
  if (value === null || typeof value !== "object") return;
  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    if (INTERNAL_KEYS.has(key)) throw new Error(`internal field "${key}" leaked at ${path}`);
    assertNoInternalLeak(inner, `${path}.${key}`);
  }
}
