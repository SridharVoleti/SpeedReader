// "Read along like a news reader": a voice speaks the passage while the highlight follows it.
// Pure helpers - the browser wiring lives in LevelPlayer and lib/narrator.ts.

import { toSpokenText } from "./narrator";
import { NEWS_READER_TTS } from "./v2/reference-audio";

/** Target newsreader pace (FR-037 Amendment A1) for every passage, regardless of the level's training WPM. */
export const READ_ALONG_WPM: number = NEWS_READER_TTS.wpm;

// Browser voices speak roughly 160-175 words per minute at rate 1.0; the pace is then calibrated.
const TYPICAL_VOICE_WPM_AT_RATE_1 = 165;
export const MIN_RATE = 0.6;
export const MAX_RATE = 1.5;

export type ReadAlongSegment = {
  text: string;
  startWord: number;
  endWord: number;
  /** Exactly what the engine is given (acronyms etc. expanded word by word). */
  speech: string;
  /** Character offset of each word inside `speech`, so a boundary event maps back to a word. */
  wordOffsets: number[];
};

/** One speech unit per sentence; startWord/endWord are inclusive indexes into `words`. */
export function sentenceSegments(words: string[]): ReadAlongSegment[] {
  const segments: ReadAlongSegment[] = [];
  let start = 0;
  words.forEach((word, index) => {
    const last = index === words.length - 1;
    const wordsSoFar = index - start + 1;
    if (/[.!?]["')\]]*$/.test(word) || last || wordsSoFar >= 28) {
      const slice = words.slice(start, index + 1);
      const spokenWords = slice.map((w) => toSpokenText(w) || w);
      const wordOffsets: number[] = [];
      let at = 0;
      spokenWords.forEach((w) => { wordOffsets.push(at); at += w.length + 1; });
      segments.push({ text: slice.join(" "), startWord: start, endWord: index, speech: spokenWords.join(" "), wordOffsets });
      start = index + 1;
    }
  });
  return segments;
}

export function initialRate(targetWpm = READ_ALONG_WPM): number {
  return clampRate(targetWpm / TYPICAL_VOICE_WPM_AT_RATE_1);
}

export function clampRate(rate: number): number {
  return Math.min(MAX_RATE, Math.max(MIN_RATE, rate));
}

/** Time a segment should take at the target pace (used for word timing and the stall watchdog). */
export function expectedMs(wordCount: number, targetWpm = READ_ALONG_WPM): number {
  return (wordCount * 60000) / targetWpm;
}

/**
 * After a sentence has been spoken, nudge the engine rate so the measured pace converges on the
 * target. Very short sentences are too noisy to learn from, so they leave the rate unchanged.
 * Smoothing (half-step) avoids oscillation.
 */
export function adaptRate(currentRate: number, wordCount: number, elapsedMs: number, targetWpm = READ_ALONG_WPM): number {
  if (wordCount < 4 || elapsedMs < 400) return currentRate;
  const measuredWpm = (wordCount * 60000) / elapsedMs;
  const ideal = currentRate * (targetWpm / measuredWpm);
  return clampRate(currentRate + (ideal - currentRate) * 0.5);
}

/** Index (within the segment) of the word being spoken at `charIndex` of the spoken text. */
export function wordIndexAtChar(wordOffsets: readonly number[], charIndex: number): number {
  let found = 0;
  for (let i = 0; i < wordOffsets.length; i++) {
    if (wordOffsets[i] <= charIndex) found = i;
    else break;
  }
  return found;
}

/**
 * When a voice sends no word-boundary events, estimate when each word starts. Longer words take
 * longer to say and punctuation adds a pause after the word. Returns start offsets (ms) from the
 * moment the voice really began, scaled so the last word ends at `durationMs`.
 */
export function wordSchedule(words: readonly string[], durationMs: number): number[] {
  const weights = words.map((w) => w.replace(/[^\p{L}\p{N}]/gu, "").length + 2 + (/[.!?]["')\]]*$/.test(w) ? 5 : /[,;:]$/.test(w) ? 3 : 0));
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  let acc = 0;
  return weights.map((w) => {
    const start = (acc / total) * durationMs;
    acc += w;
    return start;
  });
}

/** Number of words whose scheduled start has passed after `elapsedMs` of speech. */
export function wordsStartedBy(schedule: readonly number[], elapsedMs: number): number {
  let count = 0;
  for (const start of schedule) {
    if (start <= elapsedMs) count++;
    else break;
  }
  return count;
}

/** Smooth ms-per-word estimate from measured speech, used to size the next sentence's schedule. */
export function updateMsPerWord(current: number, wordCount: number, speechMs: number): number {
  if (wordCount < 4 || speechMs < 400) return current;
  return current * 0.5 + (speechMs / wordCount) * 0.5;
}
