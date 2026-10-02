// FR-019 / CODEX-09 - Support is invisible; confidence-first learner language [FROZEN]
// Internal support/practice state is never exposed to the learner. The learner experiences continued
// reading and encouragement. This module owns (a) the prohibited learner-facing terms and (b) the
// learner copy for every internal state, so no screen has to invent wording for an internal state.

export const PROHIBITED_LEARNER_TERMS: readonly string[] = Object.freeze([
  // FR-019
  "support mode", "remedial", "remediation", "failed", "failure", "struggling", "downgraded", "downgrade",
  "moved back", "demoted", "regress",
  // CODEX-09
  "not_green", "green", "pass", "fail", "failed to level up", "peer rank", "leaderboard"
]);

const NUMERIC_COMPREHENSION = /\b\d{1,3}\s?%/;
/** Two or more ALL-CAPS segments joined by underscores, e.g. LEARNER_NOT_GREEN. */
const INTERNAL_IDENTIFIER = /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/;

/** Returns the prohibited terms (or percentage pattern) found in learner-facing text. */
export function learnerLanguageViolations(text: string): string[] {
  const lower = text.toLowerCase();
  const hits = PROHIBITED_LEARNER_TERMS.filter((term) => new RegExp(`(^|[^a-z_])${term.replace(/ /g, "\\s+")}([^a-z_]|$)`).test(lower));
  if (NUMERIC_COMPREHENSION.test(text)) hits.push("numeric percentage");
  // Internal identifiers (LEARNER_NOT_GREEN, ASR_LOW_CONFIDENCE, ...) must never reach a learner.
  if (INTERNAL_IDENTIFIER.test(text)) hits.push("internal identifier");
  return hits;
}

export function assertLearnerSafe(text: string): string {
  const violations = learnerLanguageViolations(text);
  if (violations.length) throw new Error(`learner-facing text violates confidence-first rules: ${violations.join(", ")}`);
  return text;
}

/** Internal states that must never leak by name. */
export type InternalState =
  | "NEW_PASSAGE_NEXT"
  | "PRACTICE_ELIGIBLE"
  | "FAMILIAR_PRACTICE_ACTIVE"
  | "HOLD_AFTER_FIVE"
  | "NOT_GREEN"
  | "GREEN"
  | "ASR_UNCERTAIN"
  | "TECHNICAL_RETRY";

const LEARNER_COPY: Readonly<Record<InternalState, string>> = Object.freeze({
  NEW_PASSAGE_NEXT: "Ready for your next story?",
  PRACTICE_ELIGIBLE: "Let's read another story together.",
  FAMILIAR_PRACTICE_ACTIVE: "Here's a story you know. Enjoy reading it again!",
  HOLD_AFTER_FIVE: "Nice reading today. Let's keep going!",
  NOT_GREEN: "Thanks for reading. Take a look at how a strong reader might explain it.",
  GREEN: "Great reading! You explained the story well.",
  ASR_UNCERTAIN: "Let's try that once more.",
  TECHNICAL_RETRY: "Let's give that one more go."
});

/** What the learner sees for an internal state - never the state itself. */
export function learnerCopyFor(state: InternalState): string {
  return assertLearnerSafe(LEARNER_COPY[state]);
}

export const ALL_INTERNAL_STATES = Object.keys(LEARNER_COPY) as InternalState[];
