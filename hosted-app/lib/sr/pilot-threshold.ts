// SR-006 - The comprehension pass threshold is a versioned parameter. 60 is only the provisional pilot
// start; a calibrated change is a new version and takes effect only once explicitly approved.

export type ThresholdVersion = {
  version: number;
  value: number;
  status: "PROVISIONAL_PILOT" | "CALIBRATION_REVIEW" | "PRODUCTION_APPROVED";
  approved: boolean;
  audit: { by: string; at: string; reason?: string };
};

export const PILOT_THRESHOLD: ThresholdVersion = Object.freeze({
  version: 1, value: 60, status: "PROVISIONAL_PILOT", approved: false, audit: Object.freeze({ by: "product", at: "2026-10-08", reason: "provisional pilot start" })
});

export const passesComprehension = (score: number, t: ThresholdVersion): boolean => score >= t.value;

export function proposeThreshold(prev: ThresholdVersion, value: number, audit: { by: string; at: string; reason: string }): ThresholdVersion {
  if (!Number.isFinite(value) || value < 0 || value > 100) throw new RangeError("threshold must be within 0..100");
  return { version: prev.version + 1, value, status: "CALIBRATION_REVIEW", approved: false, audit };
}

export function approveThreshold(t: ThresholdVersion, audit: { by: string; at: string }): ThresholdVersion {
  return { ...t, status: "PRODUCTION_APPROVED", approved: true, audit: { ...audit, reason: t.audit.reason } };
}

/** Highest approved version, otherwise the provisional pilot version (version 1) stays in force. */
export function activeThreshold(history: readonly ThresholdVersion[]): ThresholdVersion {
  const approved = history.filter((t) => t.approved).sort((a, b) => b.version - a.version)[0];
  return approved ?? history.slice().sort((a, b) => a.version - b.version)[0];
}
