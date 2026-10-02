// FR-034 / FR-036 / CODEX-10 - News Reader: a separate, parallel oral-communication track [FROZEN]
// News Reader is NOT a gate for core WPM progression. It has its own state/metrics namespace and this
// module deliberately imports nothing from the core WPM engine (a test scans this file to keep it so).
// A News Reader failure, low score, missing attempt or unavailable microphone cannot touch core WPM,
// Level-Up evidence, canonical progression or World completion, because none of those are reachable here.

export const NEWS_READER_PURPOSES = [
  "oral-reading", "pronunciation", "clarity", "phrasing", "meaningful-pauses", "emphasis", "intonation", "confidence", "expressive-oral-communication"
] as const;

/** Oral communication dimensions, each 0..1 and independently optional. */
export type OralMetrics = {
  pronunciation?: number;
  clarity?: number;
  phrasing?: number;
  pauses?: number;
  emphasis?: number;
  intonation?: number;
  confidence?: number;
  expressiveness?: number;
};

export type NewsReaderAttempt = {
  attemptId: string;
  /** May reuse a canonical passage; shares content, never evidence (FR-036). */
  passageId: string;
  /** 1 = first read, 2 = second read (FR-038). */
  readNumber: 1 | 2;
  metrics: OralMetrics;
  /** Missing microphone / failed capture: recorded, never scored, never penalised. */
  technicalState: "OK" | "MIC_UNAVAILABLE" | "CAPTURE_FAILED";
  recordedAt: string;
};

export type NewsReaderState = { attempts: readonly NewsReaderAttempt[] };

export function newNewsReaderState(): NewsReaderState {
  return { attempts: [] };
}

export function recordNewsReaderAttempt(state: NewsReaderState, attempt: NewsReaderAttempt): NewsReaderState {
  for (const [name, value] of Object.entries(attempt.metrics)) {
    if (value !== undefined && !(value >= 0 && value <= 1)) throw new RangeError(`oral metric ${name} must be 0..1`);
  }
  if (state.attempts.some((a) => a.attemptId === attempt.attemptId)) return state; // idempotent
  return { attempts: [...state.attempts, Object.freeze({ ...attempt, metrics: Object.freeze({ ...attempt.metrics }) })] };
}

/** The track's relationship to core progression is constant and explicit. */
export function newsReaderGatesCoreProgression(): false {
  return false;
}
