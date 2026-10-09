// FR-046 / AC-C07 - Threshold lifecycle [FROZEN GOVERNANCE]
// Numerical thresholds that product has not explicitly frozen move through lifecycle states:
//   PROVISIONAL_PILOT -> CALIBRATION_REVIEW -> PRODUCTION_APPROVED -> SUSPENDED_RECALIBRATE -> ...
// Calibration may adjust empirical numbers but may never silently change frozen semantics or
// architecture. This registry is the single versioned source of every threshold's state, and
// changeThreshold is the only sanctioned way to alter a value.

import { GREEN_THRESHOLD } from "./comprehension-threshold";
import { WORLD1_MAX_WPM } from "./speed-ceiling";
import { CURRENT_CALIBRATION } from "./calibration";
import { RECENCY_POLICY_V1 } from "./evidence-recency";
import { ASR_POLICY } from "./spoken-evidence";
import { ASSESSMENT_CONFIG } from "./initial-assessment";
import { REFERENCE_BOOK_WORDS } from "./book-time";
import { FIRST_FIVE_GREENS_REQUIRED, FIRST_FIVE_WINDOW } from "./first-five";
import { POST_FIVE_STREAK_REQUIRED } from "./core-wpm";

export const LIFECYCLE_STATES = ["PROVISIONAL_PILOT", "CALIBRATION_REVIEW", "PRODUCTION_APPROVED", "SUSPENDED_RECALIBRATE"] as const;
export type LifecycleState = (typeof LIFECYCLE_STATES)[number];

export type ThresholdEntry = {
  key: string;
  value: number;
  /** FROZEN product rules are not subject to calibration at all. */
  frozen: boolean;
  state: LifecycleState | "FROZEN";
};

/** The one place thresholds are catalogued (AC-C07). Values are read from the live constants. */
export const THRESHOLD_REGISTRY: readonly ThresholdEntry[] = Object.freeze([
  // FROZEN product rules
  { key: "green-threshold", value: GREEN_THRESHOLD, frozen: true, state: "FROZEN" },
  { key: "world1-max-wpm", value: WORLD1_MAX_WPM, frozen: true, state: "FROZEN" },
  { key: "first-five-window", value: FIRST_FIVE_WINDOW, frozen: true, state: "FROZEN" },
  { key: "first-five-greens-required", value: FIRST_FIVE_GREENS_REQUIRED, frozen: true, state: "FROZEN" },
  { key: "post-five-consecutive-green", value: POST_FIVE_STREAK_REQUIRED, frozen: true, state: "FROZEN" },
  { key: "reference-book-words", value: REFERENCE_BOOK_WORDS, frozen: true, state: "FROZEN" },
  // Calibratable parameters (all currently PROVISIONAL_PILOT)
  { key: "weight-structured", value: CURRENT_CALIBRATION.comprehensionWeights.structured, frozen: false, state: "PROVISIONAL_PILOT" },
  { key: "weight-spoken", value: CURRENT_CALIBRATION.comprehensionWeights.spoken, frozen: false, state: "PROVISIONAL_PILOT" },
  { key: "recency-max-age-days", value: RECENCY_POLICY_V1.maxAgeDays, frozen: false, state: "PROVISIONAL_PILOT" },
  { key: "recency-max-sessions", value: RECENCY_POLICY_V1.maxSessionsSince, frozen: false, state: "PROVISIONAL_PILOT" },
  { key: "recency-inactive-days", value: RECENCY_POLICY_V1.inactiveDays, frozen: false, state: "PROVISIONAL_PILOT" },
  { key: "asr-min-confidence", value: ASR_POLICY.minConfidence, frozen: false, state: "PROVISIONAL_PILOT" },
  { key: "asr-max-retries", value: ASR_POLICY.maxRetries, frozen: false, state: "PROVISIONAL_PILOT" },
  { key: "assessment-start-wpm", value: ASSESSMENT_CONFIG.startWpm, frozen: false, state: "PROVISIONAL_PILOT" },
  { key: "assessment-step-wpm", value: ASSESSMENT_CONFIG.stepWpm, frozen: false, state: "PROVISIONAL_PILOT" },
  { key: "assessment-confirmations", value: ASSESSMENT_CONFIG.confirmations, frozen: false, state: "PROVISIONAL_PILOT" },
  { key: "assessment-time-budget-sec", value: ASSESSMENT_CONFIG.timeBudgetSec, frozen: false, state: "PROVISIONAL_PILOT" }
] as ThresholdEntry[]);

const ALLOWED_TRANSITIONS: Readonly<Record<LifecycleState, readonly LifecycleState[]>> = Object.freeze({
  PROVISIONAL_PILOT: ["CALIBRATION_REVIEW"],
  CALIBRATION_REVIEW: ["PRODUCTION_APPROVED", "PROVISIONAL_PILOT"],
  PRODUCTION_APPROVED: ["SUSPENDED_RECALIBRATE"],
  SUSPENDED_RECALIBRATE: ["CALIBRATION_REVIEW"]
});

export function canTransition(from: LifecycleState, to: LifecycleState): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export type ThresholdAudit = { changedAt: string; reason: string; changedBy: string };
export type ThresholdChange = { entry: ThresholdEntry; audit: ThresholdAudit; previous: { value: number; state: ThresholdEntry["state"] } };

/** Move a calibratable threshold to a new lifecycle state (audited). Frozen rules cannot move. */
export function transitionThreshold(entry: ThresholdEntry, to: LifecycleState, audit: ThresholdAudit): ThresholdChange {
  if (entry.frozen || entry.state === "FROZEN") throw new Error(`${entry.key} is FROZEN: it has no lifecycle and cannot be recalibrated`);
  assertAudit(audit);
  if (!canTransition(entry.state as LifecycleState, to)) throw new Error(`illegal lifecycle transition ${entry.state} -> ${to} for ${entry.key}`);
  return { entry: { ...entry, state: to }, audit, previous: { value: entry.value, state: entry.state } };
}

/**
 * Adjust the empirical value of a calibratable threshold. Allowed only while PROVISIONAL_PILOT or in
 * CALIBRATION_REVIEW; a PRODUCTION_APPROVED value must first be suspended for recalibration.
 */
export function changeThreshold(entry: ThresholdEntry, value: number, audit: ThresholdAudit): ThresholdChange {
  if (entry.frozen || entry.state === "FROZEN") throw new Error(`${entry.key} is FROZEN: calibration may not change frozen semantics`);
  assertAudit(audit);
  if (entry.state === "PRODUCTION_APPROVED") throw new Error(`${entry.key} is PRODUCTION_APPROVED: suspend it for recalibration before changing its value`);
  if (!Number.isFinite(value)) throw new RangeError("threshold value must be finite");
  return { entry: { ...entry, value }, audit, previous: { value: entry.value, state: entry.state } };
}

function assertAudit(audit: ThresholdAudit): void {
  if (!audit.changedAt || !audit.reason || !audit.changedBy) throw new Error("threshold change needs changedAt, reason and changedBy");
}
