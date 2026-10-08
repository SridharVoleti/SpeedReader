// SR-044 - Per-fact semantic evidence states. Paraphrase is credited; contradiction and omission are
// distinct; inference-only facts are never P1 recall; low ASR confidence leaves unmatched facts UNRESOLVED
// rather than turning speech-recognition noise into a learner error.

import { normalize } from "./free-explanation";

export type FactSpec = { factId: string; phrases: readonly string[]; contradictions: readonly string[]; inferenceOnly: boolean };
export type FactState = "CREDITED" | "OMITTED" | "CONTRADICTED" | "UNSUPPORTED_INFERENCE" | "UNRESOLVED_ASR";

export const ASR_CONFIDENCE_FLOOR = 0.6;

export function classifyFacts(text: string, facts: readonly FactSpec[], ctx: { asrConfidence: number }): Record<string, FactState> {
  const t = ` ${normalize(text)} `;
  const has = (p: string) => t.includes(` ${normalize(p)} `);
  const out: Record<string, FactState> = {};
  for (const f of facts) {
    if (f.contradictions.some(has)) out[f.factId] = "CONTRADICTED";
    else if (f.phrases.some(has)) out[f.factId] = f.inferenceOnly ? "UNSUPPORTED_INFERENCE" : "CREDITED";
    else out[f.factId] = ctx.asrConfidence < ASR_CONFIDENCE_FLOOR ? "UNRESOLVED_ASR" : "OMITTED";
  }
  return out;
}
