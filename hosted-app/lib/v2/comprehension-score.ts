// FR-020 - Hybrid evidence model [FROZEN]
// Every new canonical passage has two separately stored sources of comprehension evidence -
// structured questions and spoken free-text expression - and both contribute to ONE auditable
// internal comprehension score. Structured questions carry the larger weight. The weights come
// from the versioned calibration (never hard-coded here) and the version used is stored.

import { classifyComprehension, type Classification } from "./comprehension-threshold";
import { CURRENT_CALIBRATION, type CalibrationConfig } from "./calibration";

export type StructuredEvidence = { items: { itemId: string; score: number }[]; score: number };
export type SpokenEvidence = { score: number };

export type ComprehensionResult =
  | {
      status: "SCORED";
      structured: StructuredEvidence;
      spoken: SpokenEvidence;
      weights: { structured: number; spoken: number };
      calibrationVersion: string;
      score: number;
      classification: Classification;
    }
  | {
      status: "AWAITING_SPOKEN_EVIDENCE";
      structured: StructuredEvidence;
      calibrationVersion: string;
      score: null;
      classification: null;
    };

function assertUnit(value: number, name: string): void {
  if (!(value >= 0 && value <= 1)) throw new RangeError(`${name} must be 0..1`);
}

/** Item-level structured evidence; the structured score is the mean of the item scores. */
export function structuredEvidence(items: { itemId: string; score: number }[]): StructuredEvidence {
  if (items.length === 0) throw new Error("structured evidence needs at least one item");
  items.forEach((i) => assertUnit(i.score, `item ${i.itemId} score`));
  const score = items.reduce((sum, i) => sum + i.score, 0) / items.length;
  return { items: items.map((i) => ({ ...i })), score };
}

export function scoreComprehension(
  structured: StructuredEvidence,
  spoken: SpokenEvidence | null,
  calibration: CalibrationConfig = CURRENT_CALIBRATION
): ComprehensionResult {
  assertUnit(structured.score, "structured score");
  if (spoken === null) {
    return { status: "AWAITING_SPOKEN_EVIDENCE", structured, calibrationVersion: calibration.version, score: null, classification: null };
  }
  assertUnit(spoken.score, "spoken score");
  const weights = { ...calibration.comprehensionWeights };
  const score = weights.structured * structured.score + weights.spoken * spoken.score;
  return {
    status: "SCORED", structured, spoken, weights, calibrationVersion: calibration.version,
    score, classification: classifyComprehension(score)
  };
}
