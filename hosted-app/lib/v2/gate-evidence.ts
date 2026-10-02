// FR-012 - Comprehension is the only WPM gate [FROZEN]
// Core WPM progression sees nothing but the passage's comprehension classification. News Reader/oral
// performance, pronunciation, delivery, intonation or confidence can never block, reduce or delay a
// Level Up, so they are structurally unable to reach the progression engine: every raw attempt
// passes through toGateEvidence, which keeps only the whitelisted fields below.

import { classifyComprehension, type Classification } from "./comprehension-threshold";

export type GateEvidence = {
  attemptId: string;
  wpm: number;
  /** Exact internal score (never shown to the learner). */
  comprehensionScore: number;
  classification: Classification;
};

/** Signals that may be measured and coached but must never gate WPM. */
export const NON_GATE_SIGNALS: readonly string[] = Object.freeze([
  "oralQuality", "newsReaderScore", "pronunciation", "delivery", "intonation", "confidence", "fluency", "oralFluency"
]);

export type RawPassageAttempt = {
  attemptId: string;
  wpm: number;
  comprehensionScore: number;
  [extra: string]: unknown;
};

export function toGateEvidence(raw: RawPassageAttempt): GateEvidence {
  if (!(raw.comprehensionScore >= 0 && raw.comprehensionScore <= 1)) {
    throw new RangeError("comprehensionScore must be 0..1");
  }
  return {
    attemptId: raw.attemptId,
    wpm: raw.wpm,
    comprehensionScore: raw.comprehensionScore,
    classification: classifyComprehension(raw.comprehensionScore)
  };
}
