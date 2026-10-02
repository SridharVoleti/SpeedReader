// CODEX-06 / CODEX-11 / AC-C07 - Single versioned calibration source for PROVISIONAL_PILOT values.
// The 75% GREEN threshold is a frozen product rule and is NOT part of calibration: it lives in
// comprehension-threshold.ts and can only change by an explicit product change.

export type CalibrationConfig = {
  /** Identifies this exact calibration; stored with every scored attempt. */
  version: string;
  status: "PROVISIONAL_PILOT";
  comprehensionWeights: { structured: number; spoken: number };
};

export const CALIBRATION_V1: CalibrationConfig = Object.freeze({
  version: "calibration-2026-10-pilot-1",
  status: "PROVISIONAL_PILOT",
  comprehensionWeights: Object.freeze({ structured: 0.7, spoken: 0.3 })
});

/** Every calibration ever published; historical attempts keep resolving the version they used. */
export const CALIBRATION_HISTORY: readonly CalibrationConfig[] = Object.freeze([CALIBRATION_V1]);

export const CURRENT_CALIBRATION: CalibrationConfig = CALIBRATION_V1;

export function calibrationByVersion(version: string, history: readonly CalibrationConfig[] = CALIBRATION_HISTORY): CalibrationConfig {
  const found = history.find((c) => c.version === version);
  if (!found) throw new Error(`unknown calibration version ${version}`);
  return found;
}
