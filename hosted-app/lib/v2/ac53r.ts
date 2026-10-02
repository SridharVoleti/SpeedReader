// FR-007 - AC-53R: Progressive stamina-transition validity [FROZEN / SUPERSEDES OLD AC-53]
// Production validation must show learners can step through every World 1 length increment
// (100->125->...->1000) without unacceptable collapse in comprehension, completion burden,
// confidence or engagement. News Reader/oral performance is deliberately not an input.

import { passageWords, staircaseTable } from "./stamina";

export const SUPERSEDED_RULES: Readonly<Record<string, string>> = Object.freeze({
  "AC-53": "Direct 100->200-word transition assumption; replaced by AC-53R (every +25 step)."
});

/** Every consecutive length step in the World 1 staircase: [100,125] ... [975,1000]. */
export const STAMINA_TRANSITIONS: ReadonlyArray<readonly [number, number]> = Object.freeze(
  staircaseTable().slice(1).map((row, i, rows) => [i === 0 ? passageWords(1) : rows[i - 1].words, row.words] as const)
);

export function isValidStaminaTransition(from: number, to: number): boolean {
  return STAMINA_TRANSITIONS.some(([a, b]) => a === from && b === to);
}

export type TransitionObservation = {
  from: number;
  to: number;
  learners: number;
  comprehensionDrop: number;
  completionBurdenIncrease: number;
  confidenceDrop: number;
  engagementDrop: number;
};

/** Pilot-calibrated limits (PROVISIONAL_PILOT): supplied by the caller, never defaulted here. */
export type CollapseThresholds = {
  maxComprehensionDrop: number;
  maxCompletionBurdenIncrease: number;
  maxConfidenceDrop: number;
  maxEngagementDrop: number;
};

export type Ac53rResult = {
  status: "PASS" | "FAIL" | "INSUFFICIENT_EVIDENCE";
  failures: string[];
  unobserved: string[];
};

const CHECKS: Array<[keyof TransitionObservation & string, keyof CollapseThresholds]> = [
  ["comprehensionDrop", "maxComprehensionDrop"],
  ["completionBurdenIncrease", "maxCompletionBurdenIncrease"],
  ["confidenceDrop", "maxConfidenceDrop"],
  ["engagementDrop", "maxEngagementDrop"]
];

export function evaluateStaminaTransitions(
  observations: readonly TransitionObservation[],
  thresholds: CollapseThresholds
): Ac53rResult {
  if (!thresholds) throw new Error("AC-53R requires explicit collapse thresholds");
  const failures: string[] = [];
  const unobserved: string[] = [];
  for (const [from, to] of STAMINA_TRANSITIONS) {
    const obs = observations.find((o) => o.from === from && o.to === to);
    if (!obs || !(obs.learners > 0)) {
      unobserved.push(`${from}->${to}`);
      continue;
    }
    for (const [field, limit] of CHECKS) {
      const value = obs[field] as number;
      if (value > thresholds[limit]) failures.push(`${from}->${to}: ${field} ${value} exceeds ${thresholds[limit]}`);
    }
  }
  const status = failures.length ? "FAIL" : unobserved.length ? "INSUFFICIENT_EVIDENCE" : "PASS";
  return { status, failures, unobserved };
}
