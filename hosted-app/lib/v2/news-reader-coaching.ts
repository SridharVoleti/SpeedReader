// FR-038 - Oral two-read coaching [FROZEN]
// In the two-read pattern the child reads the same passage aloud twice; the two attempts are stored
// independently, the improvement/delta is calculated, and the second read is framed as practice, not
// punishment. This track can have its own coaching and future achievements, none of which touch the core
// WPM state machine - so this module imports only News Reader types.

import type { NewsReaderAttempt, NewsReaderState, OralMetrics } from "./news-reader";

export type MetricDelta = { metric: keyof OralMetrics; first: number; second: number; delta: number };

export type TwoReadResult =
  | { status: "INCOMPLETE"; reads: number }
  | { status: "UNSCORED"; reason: "TECHNICAL_STATE_NOT_OK" }
  | { status: "COMPLETE"; deltas: MetricDelta[]; meanDelta: number; improved: boolean; coaching: string };

function latestRead(attempts: readonly NewsReaderAttempt[], readNumber: 1 | 2): NewsReaderAttempt | undefined {
  return [...attempts].reverse().find((a) => a.readNumber === readNumber);
}

export function twoReadCoaching(state: NewsReaderState, passageId: string): TwoReadResult {
  const forPassage = state.attempts.filter((a) => a.passageId === passageId);
  const first = latestRead(forPassage, 1);
  const second = latestRead(forPassage, 2);
  if (!first || !second) return { status: "INCOMPLETE", reads: [first, second].filter(Boolean).length };
  if (first.technicalState !== "OK" || second.technicalState !== "OK") return { status: "UNSCORED", reason: "TECHNICAL_STATE_NOT_OK" };

  const deltas: MetricDelta[] = [];
  for (const metric of Object.keys(first.metrics) as (keyof OralMetrics)[]) {
    const a = first.metrics[metric];
    const b = second.metrics[metric];
    if (a !== undefined && b !== undefined) deltas.push({ metric, first: a, second: b, delta: Math.round((b - a) * 1e9) / 1e9 });
  }
  const meanDelta = deltas.length ? deltas.reduce((s, d) => s + d.delta, 0) / deltas.length : 0;
  const improved = meanDelta > 0;
  return { status: "COMPLETE", deltas, meanDelta, improved, coaching: improved ? IMPROVED : PRACTICE };
}

// Practice framing, never punishment: no "worse", "failed", "wrong", "again" scolding.
const IMPROVED = "Your second read sounded even clearer - that is what practice does! Try it once more any time you like.";
const PRACTICE = "Reading it twice is great practice. Next time, try a small pause after each idea and lean on the important words.";
