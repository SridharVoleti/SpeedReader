// FR-024 / CODEX-12 - ASR uncertainty [FROZEN]
// Speech-recognition uncertainty is never converted into learner error. Unusable or uncertain spoken
// evidence is marked unresolved/technical, a natural retry is requested when appropriate, no low
// comprehension score is fabricated from a recognition failure, and audit data explains why the
// evidence was not scored normally.

import { evaluateSpokenExpression, type SpokenEvaluation, type SpokenPassageMeta } from "./spoken-expression";
import { scoreComprehension, type ComprehensionResult, type StructuredEvidence } from "./comprehension-score";
import { CURRENT_CALIBRATION, type CalibrationConfig } from "./calibration";

export type AsrReport = { usable: boolean; confidence: number | null; speechDetected: boolean };

export type AsrPolicy = {
  version: string;
  /** Below this recognition confidence the transcript is treated as uncertain (PROVISIONAL_PILOT). */
  minConfidence: number;
  /** Natural retries offered before continuing without spoken evidence (documented assumption). */
  maxRetries: number;
};

export const ASR_POLICY: AsrPolicy = Object.freeze({ version: "asr-policy-pilot-1", minConfidence: 0.6, maxRetries: 2 });

export type TechnicalReason = "ASR_UNUSABLE" | "ASR_LOW_CONFIDENCE" | "NO_SPEECH_DETECTED" | "ASR_CONFIDENCE_MISSING";

export type SpokenEvidenceOutcome =
  | { status: "SCORED"; evaluation: SpokenEvaluation; audit: { policyVersion: string; confidence: number } }
  | {
      status: "UNRESOLVED_TECHNICAL";
      evaluation: null;
      retryRecommended: boolean;
      audit: { policyVersion: string; reason: TechnicalReason; confidence: number | null; threshold: number; explanation: string };
    };

export function resolveSpokenEvidence(
  transcript: string,
  asr: AsrReport,
  meta: SpokenPassageMeta,
  policy: AsrPolicy = ASR_POLICY
): SpokenEvidenceOutcome {
  const unresolved = (reason: TechnicalReason, explanation: string): SpokenEvidenceOutcome => ({
    status: "UNRESOLVED_TECHNICAL",
    evaluation: null,
    retryRecommended: true,
    audit: { policyVersion: policy.version, reason, confidence: asr.confidence, threshold: policy.minConfidence, explanation }
  });

  if (!asr.usable) return unresolved("ASR_UNUSABLE", "speech recognition returned no usable transcript");
  if (!asr.speechDetected || transcript.trim() === "") return unresolved("NO_SPEECH_DETECTED", "no speech was detected; this is a recording issue, not a learner answer");
  if (asr.confidence === null) return unresolved("ASR_CONFIDENCE_MISSING", "recognition confidence was unavailable, so the transcript cannot be trusted");
  if (asr.confidence < policy.minConfidence) {
    return unresolved("ASR_LOW_CONFIDENCE", `recognition confidence ${asr.confidence} is below ${policy.minConfidence}`);
  }
  return { status: "SCORED", evaluation: evaluateSpokenExpression(transcript, meta), audit: { policyVersion: policy.version, confidence: asr.confidence } };
}

/** Combine structured evidence with a resolved spoken outcome; unresolved evidence yields no score. */
export function comprehensionFromOutcome(
  structured: StructuredEvidence,
  outcome: SpokenEvidenceOutcome,
  calibration: CalibrationConfig = CURRENT_CALIBRATION
): ComprehensionResult {
  return scoreComprehension(structured, outcome.status === "SCORED" ? { score: outcome.evaluation.score } : null, calibration);
}

export type RecoveryAction = "RETRY" | "CONTINUE_WITHOUT_PROGRESSION_EVIDENCE";

/** Natural retry while allowed, then continue; never a penalty and never a Level Up from missing evidence. */
export function technicalRecoveryAction(retriesUsed: number, policy: AsrPolicy = ASR_POLICY): RecoveryAction {
  return retriesUsed < policy.maxRetries ? "RETRY" : "CONTINUE_WITHOUT_PROGRESSION_EVIDENCE";
}
