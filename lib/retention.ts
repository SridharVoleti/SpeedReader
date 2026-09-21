// SR-R8-001: Delayed recall evidence.
// "Support delayed comprehension tied to original passage without revealing prior answers."
// "Delayed item links to source and scores separately from immediate comprehension." The
// retention score is computed purely from the delayed attempt's own correct/total - the
// immediate result is carried alongside for reporting only and never feeds the computation.

export type DelayBandConfig = { bandId: string; minSeconds: number; maxSeconds: number }[];

export const DEFAULT_DELAY_BANDS: DelayBandConfig = [
  { bandId: "SAME_SESSION", minSeconds: 0, maxSeconds: 3600 },
  { bandId: "NEXT_DAY", minSeconds: 3600, maxSeconds: 172800 },
  { bandId: "LONG_TERM", minSeconds: 172800, maxSeconds: Infinity }
];

export function classifyDelayBucket(delaySeconds: number, bands: DelayBandConfig = DEFAULT_DELAY_BANDS): string | null {
  if (delaySeconds < 0) return null;
  const band = bands.find((candidate) => delaySeconds >= candidate.minSeconds && delaySeconds < candidate.maxSeconds);
  return band ? band.bandId : null;
}

export type ComprehensionResult = {
  correct: number;
  total: number;
};

export type RetentionEvidence = {
  sourcePassageId: string;
  delayBucket: string | null;
  immediateScore: number | null;
  retentionScore: number | null;
};

export function recordRetentionEvidence(
  sourcePassageId: string,
  delaySeconds: number,
  immediate: ComprehensionResult,
  delayed: ComprehensionResult,
  bands: DelayBandConfig = DEFAULT_DELAY_BANDS
): RetentionEvidence {
  return {
    sourcePassageId,
    delayBucket: classifyDelayBucket(delaySeconds, bands),
    immediateScore: immediate.total > 0 ? immediate.correct / immediate.total : null,
    retentionScore: delayed.total > 0 ? delayed.correct / delayed.total : null
  };
}

// SR-R8-002: Retained comprehension.
// "Report retention separately and optionally require it for advanced certification."
// "Immediate PASS + delayed FAIL remain distinct; advanced certification withheld when
//  retention mandatory." (TC-R8-002-B) Immediate comprehension and retention are two separate
// gates - a passing immediate result never compensates for a failing retention result when
// retention is configured as mandatory, and retention never blocks anything when it isn't.
export type RetentionState = "PASS" | "FAIL" | "NOT_ASSESSED";

export function classifyRetentionState(retentionScore: number | null, passThreshold: number): RetentionState {
  if (retentionScore === null) return "NOT_ASSESSED";
  return retentionScore >= passThreshold ? "PASS" : "FAIL";
}

export type AdvancedCertificationInputs = {
  immediatePassed: boolean;
  retentionState: RetentionState;
  retentionRequired: boolean;
};

export type AdvancedCertificationResult = {
  eligible: boolean;
  reasonCode: string;
};

export function evaluateAdvancedCertification(inputs: AdvancedCertificationInputs): AdvancedCertificationResult {
  if (!inputs.immediatePassed) {
    return { eligible: false, reasonCode: "IMMEDIATE_COMPREHENSION_NOT_PASSED" };
  }
  if (inputs.retentionRequired && inputs.retentionState !== "PASS") {
    return { eligible: false, reasonCode: "RETENTION_REQUIRED_NOT_MET" };
  }
  return { eligible: true, reasonCode: "ELIGIBLE" };
}
