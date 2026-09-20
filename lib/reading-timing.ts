// SR-R1-001: Deterministic target WPM.
// Planned timing is a pure function of word count, target WPM and chunk size, so the same
// passage/WPM/chunks combination always produces identical planned timing. Actual elapsed time
// is captured separately, once the reading phase has really happened, and is never folded back
// into the deterministic plan.

export type ReadingTimingPlan = {
  target_wpm: number;
  words_per_chunk: number;
  word_count: number;
  chunk_count: number;
  ms_per_chunk: number;
  planned_duration_ms: number;
};

export type ReadingTimingRecord = ReadingTimingPlan & {
  actual_duration_ms: number;
};

export function planReadingTiming(
  wordCount: number,
  targetWpm: number,
  wordsPerChunk: number
): ReadingTimingPlan {
  if (wordCount < 0) throw new Error("wordCount cannot be negative");
  if (targetWpm <= 0) throw new Error("targetWpm must be greater than zero");
  if (wordsPerChunk <= 0) throw new Error("wordsPerChunk must be greater than zero");

  const msPerChunk = Math.floor((60_000 / targetWpm) * wordsPerChunk);
  const chunkCount = Math.ceil(wordCount / wordsPerChunk);

  return {
    target_wpm: targetWpm,
    words_per_chunk: wordsPerChunk,
    word_count: wordCount,
    chunk_count: chunkCount,
    ms_per_chunk: msPerChunk,
    planned_duration_ms: msPerChunk * chunkCount
  };
}

export function recordActualDuration(
  plan: ReadingTimingPlan,
  startedAtMs: number,
  finishedAtMs: number
): ReadingTimingRecord {
  return {
    ...plan,
    actual_duration_ms: Math.max(0, finishedAtMs - startedAtMs)
  };
}
