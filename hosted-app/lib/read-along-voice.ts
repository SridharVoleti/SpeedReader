// "Read along like a news reader": a voice speaks the passage while the highlight follows it.
// Pure helpers - the browser wiring lives in LevelPlayer and lib/narrator.ts.

import { NEWS_READER_TTS } from "./v2/reference-audio";

/** Target newsreader pace (FR-037 Amendment A1) for every passage, regardless of the level's training WPM. */
export const READ_ALONG_WPM: number = NEWS_READER_TTS.wpm;

// Browser voices speak roughly 160-175 words per minute at rate 1.0; the pace is then calibrated.
const TYPICAL_VOICE_WPM_AT_RATE_1 = 165;
export const MIN_RATE = 0.6;
export const MAX_RATE = 1.5;

export type ReadAlongSegment = { text: string; startWord: number; endWord: number };

/** One speech unit per sentence; startWord/endWord are inclusive indexes into `words`. */
export function sentenceSegments(words: string[]): ReadAlongSegment[] {
  const segments: ReadAlongSegment[] = [];
  let start = 0;
  words.forEach((word, index) => {
    const last = index === words.length - 1;
    const wordsSoFar = index - start + 1;
    if (/[.!?]["')\]]*$/.test(word) || last || wordsSoFar >= 28) {
      segments.push({ text: words.slice(start, index + 1).join(" "), startWord: start, endWord: index });
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
