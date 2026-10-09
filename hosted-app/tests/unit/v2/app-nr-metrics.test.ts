import { describe, expect, it } from "vitest";
import { COUNT100_VERSION, count100 } from "../../../lib/sr/pipeline-v2/count100";
import { MIN_CAPTURE_CONFIDENCE, metricsFromCapture } from "../../../lib/v2/news-reader-metrics";
import { FIXTURE_STORY } from "../../../lib/v2/content-provider";
import { recordNewsReaderAttempt, newNewsReaderState } from "../../../lib/v2/news-reader";

const tokens = count100(FIXTURE_STORY).tokens;
const same = tokens.map((t) => t.text).join(" ");
const run = (capture: Parameters<typeof metricsFromCapture>[2], variants?: Record<string, string[]>) => metricsFromCapture(tokens, COUNT100_VERSION, capture, variants);

describe("News Reader metrics are honest and technical problems are never poor reading", () => {
  it("a faithful reading scores full pronunciation and reports recognition clarity", () => {
    expect(run({ micState: "OK", transcript: same, confidence: 0.9 })).toEqual({ technicalState: "OK", metrics: { pronunciation: 1, clarity: 0.9 } });
  });

  it("only measurable metrics are reported: no timing, pauses, emphasis or intonation are invented", () => {
    const r = run({ micState: "OK", transcript: same, confidence: 0.9 });
    expect(Object.keys(r.metrics).sort()).toEqual(["clarity", "pronunciation"]);
  });

  it("misreading lowers pronunciation proportionally, never below zero and never into a block", () => {
    const words = same.split(" ");
    const half = words.map((w, i) => (i % 2 ? "zzz" : w)).join(" ");
    const r = run({ micState: "OK", transcript: half, confidence: 0.9 });
    expect(r.technicalState).toBe("OK");
    const p = (r.metrics as { pronunciation: number }).pronunciation;
    expect(p).toBeGreaterThan(0.3);
    expect(p).toBeLessThan(0.7);
    const none = run({ micState: "OK", transcript: "completely different words here", confidence: 0.9 });
    expect((none.metrics as { pronunciation: number }).pronunciation).toBeGreaterThanOrEqual(0);
  });

  it("approved accepted variants keep an accent or dialect from counting as a mistake", () => {
    const withAccent = same.replace("red", "rad");
    const strict = run({ micState: "OK", transcript: withAccent, confidence: 0.9 }).metrics as { pronunciation: number };
    const fair = run({ micState: "OK", transcript: withAccent, confidence: 0.9 }, { red: ["rad"] }).metrics as { pronunciation: number };
    expect(fair.pronunciation).toBeGreaterThan(strict.pronunciation);
    expect(fair.pronunciation).toBe(1);
  });

  it.each([
    [{ micState: "MIC_UNAVAILABLE" as const }, "MIC_UNAVAILABLE"],
    [{ micState: "CAPTURE_FAILED" as const }, "CAPTURE_FAILED"],
    [{ micState: "OK" as const, transcript: "", confidence: 0.9 }, "CAPTURE_FAILED"],
    [{ micState: "OK" as const, transcript: same, confidence: null }, "CAPTURE_FAILED"],
    [{ micState: "OK" as const, transcript: same, confidence: MIN_CAPTURE_CONFIDENCE - 0.01 }, "CAPTURE_FAILED"]
  ])("%# an unusable capture is a technical state with no metrics at all", (capture, state) => {
    expect(run(capture)).toEqual({ technicalState: state, metrics: {} });
  });

  it("the result is accepted by the News Reader state and is idempotent per attempt", () => {
    const r = run({ micState: "OK", transcript: same, confidence: 0.9 });
    const attempt = { attemptId: "n1", passageId: "FX-0001", readNumber: 1 as const, metrics: r.metrics, technicalState: r.technicalState, recordedAt: "2026-10-09T10:00:00Z" };
    const once = recordNewsReaderAttempt(newNewsReaderState(), attempt);
    expect(recordNewsReaderAttempt(once, attempt)).toBe(once);
    expect(once.attempts[0].metrics).toEqual({ pronunciation: 1, clarity: 0.9 });
  });
});
