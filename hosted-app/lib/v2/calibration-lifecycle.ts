// FR-021 - Weighting lifecycle [FROZEN PRINCIPLE / PROVISIONAL_PILOT PARAMETER]
// FROZEN: structured-question evidence > spoken-expression evidence, while spoken expression stays
// materially consequential. The 70/30 split is PROVISIONAL_PILOT and may be recalibrated from learner
// evidence, but only through publishCalibration: the larger weight must stay with structured questions,
// spoken must remain meaningful, every change is versioned + audited, and calibration can never
// redefine the >=75% GREEN threshold (that needs a separate product approval).

import { calibrationByVersion, type CalibrationConfig } from "./calibration";
import { GREEN_THRESHOLD } from "./comprehension-threshold";

/** Floor below which spoken expression would stop being "materially consequential" (documented assumption). */
export const MIN_MEANINGFUL_SPOKEN_WEIGHT = 0.2;

export type CalibrationAudit = { changedAt: string; reason: string; changedBy: string };

export type PublishedCalibration = CalibrationConfig & { audit: CalibrationAudit };

export function validateCalibration(candidate: CalibrationConfig): string[] {
  const errors: string[] = [];
  const { structured, spoken } = candidate.comprehensionWeights;
  if (!(structured > spoken)) errors.push("structured weight must stay larger than spoken weight");
  if (!(spoken >= MIN_MEANINGFUL_SPOKEN_WEIGHT)) errors.push(`spoken weight must stay meaningful (>= ${MIN_MEANINGFUL_SPOKEN_WEIGHT})`);
  if (Math.abs(structured + spoken - 1) > 1e-9) errors.push("weights must sum to 1");
  if (!candidate.version) errors.push("calibration needs a version");
  if ("greenThreshold" in (candidate as object)) errors.push("calibration cannot redefine the GREEN threshold");
  return errors;
}

/**
 * Append a new calibration to the history. Never mutates earlier entries, so attempts already scored
 * under an older version keep resolving that exact version.
 */
export function publishCalibration(
  history: readonly PublishedCalibration[],
  candidate: CalibrationConfig,
  audit: CalibrationAudit
): PublishedCalibration[] {
  const errors = validateCalibration(candidate);
  if (history.some((c) => c.version === candidate.version)) errors.push(`version ${candidate.version} already exists`);
  if (!audit.reason || !audit.changedBy || !audit.changedAt) errors.push("calibration change needs reason, changedBy and changedAt");
  if (errors.length) throw new Error(`invalid calibration: ${errors.join("; ")}`);
  return [...history, { ...candidate, audit }];
}

/** The product-level threshold is read-only for calibration. */
export function greenThresholdForCalibration(_calibrationVersion: string): number {
  return GREEN_THRESHOLD;
}

export { calibrationByVersion };
