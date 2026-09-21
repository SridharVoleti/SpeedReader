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

// SR-R4-002: Frontier search.
// "Allow configurable increments that shrink near comprehension frontier." Binary-search-like
// convergence: the step size doubles (bounded) while comfortably below the frontier, and halves
// (bounded) the moment evidence turns borderline or fails, so search narrows in on the true
// frontier instead of overshooting it repeatedly at a fixed increment.
export type FrontierState = {
  stepSize: number;
  minStepSize: number;
  maxStepSize: number;
};

export type FrontierEvidence = "comfortable_pass" | "borderline_pass" | "fail" | "invalid";

export function nextFrontierState(state: FrontierState, evidence: FrontierEvidence): FrontierState {
  if (evidence === "invalid") return state;

  if (evidence === "comfortable_pass") {
    return { ...state, stepSize: Math.min(state.maxStepSize, state.stepSize * 2) };
  }

  // borderline_pass or fail: shrink toward the frontier.
  return { ...state, stepSize: Math.max(state.minStepSize, Math.floor(state.stepSize / 2)) };
}
