// SR-R4-001: Adaptive speed governor.
// "Choose next WPM deterministically from CRR, challenge and comprehension evidence." The next
// target WPM is a pure function of the learner's Certified Reading Rate, the WPM they just
// attempted, and the comprehension outcome of that attempt - never randomized, never dependent
// on anything else.

// Bump whenever the governor's decision rule changes, so a stored decision always identifies
// exactly which rule produced it (mirrors SCORER_VERSION/ITEM_SCORER_VERSION elsewhere).
export const DECISION_RULE_VERSION = "1.0";

export type AttemptOutcome = "PASS" | "HOLD" | "INVALID";

export type SpeedDecisionInput = {
  certifiedWpm: number;
  challengeWpm: number;
  attemptOutcome: AttemptOutcome;
  incrementWpm: number;
};

export type SpeedDecision = {
  nextTargetWpm: number;
  reasonCode: string;
  decisionRuleVersion: string;
};

export function decideNextTargetWpm(input: SpeedDecisionInput): SpeedDecision {
  // SR-R4-003: an INVALID attempt never penalizes - it retries the same target, unchanged.
  if (input.attemptOutcome === "INVALID") {
    return {
      nextTargetWpm: input.challengeWpm,
      reasonCode: "INVALID_RETRY",
      decisionRuleVersion: DECISION_RULE_VERSION
    };
  }
  if (input.attemptOutcome === "PASS") {
    return {
      nextTargetWpm: input.challengeWpm + input.incrementWpm,
      reasonCode: "COMPREHENSION_PASSED_ADVANCE",
      decisionRuleVersion: DECISION_RULE_VERSION
    };
  }
  // HOLD: comprehension failed - retreat to the last proven-safe rate.
  return {
    nextTargetWpm: input.certifiedWpm,
    reasonCode: "COMPREHENSION_FAILED_RETREAT",
    decisionRuleVersion: DECISION_RULE_VERSION
  };
}
