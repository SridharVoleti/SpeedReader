// FR-008 - Ten-minute initial assessment [FROZEN]
// Finds the learner's personal starting WPM today: not age-based, no peer comparison, comprehension
// is the only evidence (no News Reader/oral input). The search mechanics are a
// PROVISIONAL_PILOT calibration but are deterministic, auditable and bounded: a WPM only becomes the
// baseline after `confirmations` GREEN attempts at that speed, so one lucky fast attempt never counts.

import { classifyComprehension, type Classification } from "./comprehension-threshold";
import { WORLD1_SPEED_CEILING_WPM } from "./stamina-transition";

export type AssessmentConfig = {
  algorithmVersion: string;
  startWpm: number;
  stepWpm: number;
  minWpm: number;
  ceilingWpm: number;
  confirmations: number;
  failuresToStop: number;
  timeBudgetSec: number;
};

export const ASSESSMENT_CONFIG: AssessmentConfig = Object.freeze({
  algorithmVersion: "initial-assessment-pilot-1",
  startWpm: 60,
  stepWpm: 10,
  minWpm: 30,
  ceilingWpm: WORLD1_SPEED_CEILING_WPM,
  confirmations: 2,
  failuresToStop: 2,
  timeBudgetSec: 600
});

export type AssessmentAttempt = { wpm: number; comprehensionScore: number; durationSec: number };

export type RecordedAttempt = AssessmentAttempt & { index: number; classification: Classification; reason: string };

export type AssessmentState = {
  config: AssessmentConfig;
  algorithmVersion: string;
  status: "IN_PROGRESS" | "COMPLETE";
  currentWpm: number;
  greensAtCurrent: number;
  failuresAtCurrent: number;
  confirmedWpm: number | null;
  elapsedSec: number;
  attempts: RecordedAttempt[];
  startingWpm: number | null;
  baseline: { startingWpm: number; source: "INITIAL_ASSESSMENT"; algorithmVersion: string } | null;
  firstPassageWpm: number | null;
};

export function newAssessment(config: AssessmentConfig = ASSESSMENT_CONFIG): AssessmentState {
  return {
    config, algorithmVersion: config.algorithmVersion, status: "IN_PROGRESS",
    currentWpm: Math.min(config.startWpm, config.ceilingWpm), greensAtCurrent: 0, failuresAtCurrent: 0,
    confirmedWpm: null, elapsedSec: 0, attempts: [], startingWpm: null, baseline: null, firstPassageWpm: null
  };
}

function complete(state: AssessmentState, wpm: number): AssessmentState {
  return {
    ...state, status: "COMPLETE", startingWpm: wpm,
    baseline: { startingWpm: wpm, source: "INITIAL_ASSESSMENT", algorithmVersion: state.algorithmVersion },
    firstPassageWpm: wpm
  };
}

export function recordAssessmentAttempt(state: AssessmentState, input: AssessmentAttempt): AssessmentState {
  if (state.status === "COMPLETE") throw new Error("assessment is complete");
  if (!(input.comprehensionScore >= 0 && input.comprehensionScore <= 1)) throw new RangeError("comprehensionScore must be 0..1");
  if (!(input.durationSec >= 0)) throw new RangeError("durationSec must be >= 0");
  if (input.wpm !== state.currentWpm) throw new Error(`expected attempt at ${state.currentWpm} WPM, got ${input.wpm}`);

  const cfg = state.config;
  const classification = classifyComprehension(input.comprehensionScore);
  const elapsedSec = state.elapsedSec + input.durationSec;
  let next: AssessmentState = { ...state, elapsedSec };
  let reason: string;

  if (classification === "GREEN") {
    const greens = state.greensAtCurrent + 1;
    if (greens >= cfg.confirmations) {
      next = { ...next, confirmedWpm: input.wpm, greensAtCurrent: 0, failuresAtCurrent: 0 };
      if (input.wpm >= cfg.ceilingWpm) {
        reason = "confirmed at ceiling";
        next = complete(next, input.wpm);
      } else {
        reason = "confirmed; trying next step";
        next = { ...next, currentWpm: Math.min(input.wpm + cfg.stepWpm, cfg.ceilingWpm) };
      }
    } else {
      reason = "GREEN; awaiting confirmation";
      next = { ...next, greensAtCurrent: greens };
    }
  } else {
    // A NOT_GREEN resets the confirmation streak; repeated misses end the upward search.
    const failures = state.failuresAtCurrent + 1;
    next = { ...next, greensAtCurrent: 0, failuresAtCurrent: failures };
    if (failures >= cfg.failuresToStop) {
      if (next.confirmedWpm !== null) {
        reason = "limit found";
        next = complete(next, next.confirmedWpm);
      } else if (input.wpm > cfg.minWpm) {
        reason = "searching downward";
        next = { ...next, currentWpm: Math.max(input.wpm - cfg.stepWpm, cfg.minWpm), greensAtCurrent: 0, failuresAtCurrent: 0 };
      } else {
        reason = "floor reached";
        next = complete(next, cfg.minWpm);
      }
    } else {
      reason = "NOT_GREEN; retry";
    }
  }

  const recorded: RecordedAttempt = {
    index: state.attempts.length + 1, wpm: input.wpm, comprehensionScore: input.comprehensionScore,
    durationSec: input.durationSec, classification, reason
  };
  next = { ...next, attempts: [...state.attempts, recorded] };

  // Time budget: stop starting new attempts; fall back to the confirmed WPM, else the floor.
  if (next.status === "IN_PROGRESS" && elapsedSec >= cfg.timeBudgetSec) {
    next = complete(next, next.confirmedWpm ?? cfg.minWpm);
  }
  return next;
}

/** Drive a whole assessment from a learner-response function (used by tests and the live check). */
export function runAssessment(
  respond: (wpm: number) => AssessmentAttempt,
  config: AssessmentConfig = ASSESSMENT_CONFIG
): AssessmentState {
  let state = newAssessment(config);
  while (state.status === "IN_PROGRESS") state = recordAssessmentAttempt(state, respond(state.currentWpm));
  return state;
}
