// APP-NR-002/009/010 + APP-ORAL-003/004/005 - honest News Reader metrics from browser speech recognition.
//
// Browser recognition gives a transcript and one overall confidence, but no per-word timing, so only what can be
// measured is reported: `pronunciation` (word accuracy against the canonical tokens, via the same alignment as the
// oral telemetry) and `clarity` (recognition confidence). Pauses, emphasis, intonation, phrasing, confidence and
// expressiveness are NOT estimated - a metric we cannot measure is omitted, never faked. Low confidence or an unusable
// capture is a technical condition, never a poor reading, and nothing here touches core progression.

import type { CountToken } from "../sr/pipeline-v2/count100";
import { NEWS_READER_TTS } from "./reference-audio";
import { captureOralTelemetry, type SpokenWord } from "./oral-telemetry";
import type { OralMetrics } from "./news-reader";

export type ReadCapture = {
  micState: "OK" | "MIC_UNAVAILABLE" | "CAPTURE_FAILED";
  transcript?: string | null;
  /** Overall recognition confidence 0..1, or null when the engine gave none. */
  confidence?: number | null;
};

export type MetricsResult =
  | { technicalState: "OK"; metrics: OralMetrics }
  | { technicalState: "MIC_UNAVAILABLE" | "CAPTURE_FAILED"; metrics: Record<string, never> };

/** Minimum overall confidence for the transcript to be assessed (below it the capture is technical, not a poor read). */
export const MIN_CAPTURE_CONFIDENCE = 0.5;

export function metricsFromCapture(tokens: readonly CountToken[], tokenizerVersion: string, capture: ReadCapture, acceptedVariants?: Readonly<Record<string, readonly string[]>>): MetricsResult {
  if (capture.micState !== "OK") return { technicalState: capture.micState, metrics: {} };
  const text = (capture.transcript ?? "").trim();
  const confidence = capture.confidence ?? null;
  if (!text || confidence === null || !(confidence >= MIN_CAPTURE_CONFIDENCE)) return { technicalState: "CAPTURE_FAILED", metrics: {} };

  // nominal, evenly spaced word times at the reference pace: timing metrics are deliberately not derived from them
  const perWordMs = 60_000 / NEWS_READER_TTS.wpm;
  const words: SpokenWord[] = text.split(/\s+/).filter(Boolean).map((word, i) => ({ word, startMs: i * perWordMs, endMs: i * perWordMs + perWordMs * 0.8, confidence }));
  const durationMs = Math.max(words.length * perWordMs, 2000);
  const result = captureOralTelemetry(tokens, words, { usable: true, speechDetected: words.length > 0, durationMs }, tokenizerVersion, { acceptedVariants });
  if (result.status !== "ASSESSED") return { technicalState: "CAPTURE_FAILED", metrics: {} };

  const accuracy = result.telemetry.accuracy.final.accuracy;
  if (accuracy === null) return { technicalState: "CAPTURE_FAILED", metrics: {} };
  return { technicalState: "OK", metrics: { pronunciation: round(accuracy), clarity: round(Math.max(0, Math.min(1, confidence))) } };
}

const round = (n: number) => Math.round(n * 1000) / 1000;
