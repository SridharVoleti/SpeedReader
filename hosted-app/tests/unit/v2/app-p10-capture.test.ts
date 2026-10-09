import { describe, expect, it } from "vitest";
import type { CountToken } from "../../../lib/sr/pipeline-v2/count100";
import type { SpokenWord } from "../../../lib/v2/oral-telemetry";
import { p10SampleFromOral, type P10Tags } from "../../../lib/v2/p10-capture";
import { RS_KEYS, bandAReadiness, evaluateRs } from "../../../lib/v2/p10-readiness";

// 100-word passage: 20 sentences of 5 words, "tokNNN tokNNN, tokNNN tokNNN tokNNN."
const label = (i: number) => `tok${String(i).padStart(3, "0")}`;
const tokens: CountToken[] = Array.from({ length: 100 }, (_, i) => {
  const pos = i % 5;
  const mark = pos === 1 ? "," : pos === 4 ? "." : "";
  return { index: i + 1, text: `${label(i + 1)}${mark}`, punctuationBefore: [], punctuationAfter: [] };
});
const tags: P10Tags = {
  functionWords: [3, 8, 13, 18, 23],
  inflected: [2, 7, 12, 17, 22, 27, 32, 37, 42, 47],
  longWords: [4, 14, 24, 34, 44, 54, 64, 74, 84, 94],
  challenge: [50]
};
const SAMPLE = { usable: true, speechDetected: true, durationMs: 60_000 };

/** Read the passage at ~150 wpm: 350 ms words, 50 ms gaps, 300 ms after a comma, 500 ms after a full stop. */
function read(opts: { skip?: number[]; sentencePauseMs?: number; inject?: { before: number; word: string }[]; restartAfter?: number } = {}): SpokenWord[] {
  const out: SpokenWord[] = [];
  let t = 0;
  const speak = (word: string, i: number) => {
    out.push({ word, startMs: t, endMs: t + 350, confidence: 0.95 });
    const mark = tokens[i - 1]?.text.slice(-1);
    t += 350 + (mark === "," ? 300 : mark === "." ? opts.sentencePauseMs ?? 500 : 50);
  };
  const run = (upTo: number) => {
    for (let i = 1; i <= upTo; i += 1) {
      const inj = opts.inject?.find((x) => x.before === i);
      if (inj) speak(inj.word, 0);
      if (!opts.skip?.includes(i)) speak(label(i), i);
    }
  };
  if (opts.restartAfter) run(opts.restartAfter);
  run(100);
  return out;
}
const sampleOf = (words: SpokenWord[], rs: (typeof RS_KEYS)[number], t: P10Tags = tags) => p10SampleFromOral(rs, tokens, words, SAMPLE, "tok-v1", t);

describe("P10 measure capture: a clean, well-paced reading", () => {
  const { sample } = sampleOf(read(), "RS01");
  const m = sample.measures;
  it("produces every measure with clean values", () => {
    expect(sample.valid).toBe(true);
    expect(m).toMatchObject({
      finalAccuracy: 1, firstPassAccuracy: 1, sequenceErrors: 0, longestConsecutiveSkip: 0, functionWordAccuracy: 1, repeatedFunctionWordOmissionPattern: false,
      taggedInflectedWords: 10, endingAccuracy: 1, taggedLongWords: 10, longWordFinalCorrectShare: 1, targetCausedFullRestarts: 0, longHesitations: 0,
      eligibleErrors: 0, fullRestarts: 0, sentenceBoundaryCompliance: 1, internalPunctuationCompliance: 1, boundaryLinkedOmittedFirstWords: 0,
      punctuationTriggeredRestarts: 0, taggedChallengeWords: 1, challengeRecoveredShare: 1, maxPostChallengeSequenceErrors: 0
    });
    expect(m.paceSpread).toBeCloseTo(0, 5);
    expect(m.middleThirdAccuracyDeltaPp).toBe(0);
    expect(Math.abs(m.finalThirdWpmDropShare as number)).toBeLessThan(0.05);
  });
  it("makes all 15 competencies ready (RS07 as no-error-opportunity) and Band A ready only with P10 comprehension", () => {
    const samples = RS_KEYS.map((rs) => sampleOf(read(), rs).sample);
    const band = bandAReadiness(samples, true);
    expect(band.vector.RS07).toBe("READY_NO_ERROR_OPPORTUNITY");
    expect(band.reassess).toEqual([]);
    expect(band.notYet).toEqual([]);
    expect(band.bandAReady).toBe(true);
    expect(bandAReadiness(samples, false).bandAReady).toBe(false);
  });
});

describe("P10 measure capture: reading problems surface as the specified measures", () => {
  it("a 2-word skip is a sequence error run and fails RS02 (coaching, NOT_YET)", () => {
    const m = sampleOf(read({ skip: [40, 41] }), "RS02").sample.measures;
    expect(m).toMatchObject({ sequenceErrors: 2, longestConsecutiveSkip: 2, finalAccuracy: 0.98 });
    expect(evaluateRs(sampleOf(read({ skip: [40, 41] }), "RS02").sample, "RS02")).toMatchObject({ status: "NOT_YET", failedCriteria: ["no_2plus_word_skip"] });
  });
  it("a skipped sentence-first word is a boundary-linked omission", () => {
    expect(sampleOf(read({ skip: [31] }), "RS09").sample.measures.boundaryLinkedOmittedFirstWords).toBe(1);
  });
  it("omitting the same function word twice is a repeated omission pattern", () => {
    const t: P10Tags = { ...tags, functionWords: [3, 8] };
    // two different words omitted: no pattern; the pattern needs the same normalized word
    expect(sampleOf(read({ skip: [3, 8] }), "RS03", t).sample.measures.repeatedFunctionWordOmissionPattern).toBe(false);
    expect(sampleOf(read({ skip: [3, 8] }), "RS03", t).sample.measures.functionWordAccuracy).toBe(0);
  });
  it("a prompt self-correction is counted as timely and the final accuracy accepts it", () => {
    const { sample } = sampleOf(read({ inject: [{ before: 62, word: "tok06" }] }), "RS07");
    expect(sample.measures).toMatchObject({ eligibleErrors: 1, timelySelfCorrectedShare: 1, finalAccuracy: 1 });
    expect(sample.measures.firstPassAccuracy).toBeCloseTo(0.99, 5);
    expect(evaluateRs(sample, "RS07").status).toBe("READY");
  });
  it("a full restart after stopping on a tagged longer word is a target-caused restart", () => {
    const { sample } = sampleOf(read({ restartAfter: 34 }), "RS05");
    expect(sample.measures).toMatchObject({ fullRestarts: 1, targetCausedFullRestarts: 1, correctionTriggeredFullRestarts: 0 });
    expect(evaluateRs(sample, "RS05").status).toBe("NOT_YET");
  });
  it("a restart that stops right after a punctuated word is punctuation-triggered", () => {
    expect(sampleOf(read({ restartAfter: 30 }), "RS10").sample.measures.punctuationTriggeredRestarts).toBe(1);
  });
  it("running through full stops (pause under 150 ms) fails sentence-boundary compliance", () => {
    const m = sampleOf(read({ sentencePauseMs: 40 }), "RS09").sample.measures;
    expect(m.sentenceBoundaryCompliance).toBe(0);
    expect(evaluateRs(sampleOf(read({ sentencePauseMs: 40 }), "RS09").sample, "RS09").status).toBe("NOT_YET");
  });
  it("a silent stall inside a sentence is a long hesitation and an unexplained silence; before a tagged longer word it is explained", () => {
    const words = read();
    const stalled = (idx: number) => words.map((w, i) => (i >= idx ? { ...w, startMs: w.startMs + 7000, endMs: w.endMs + 7000 } : w));
    const plain = sampleOf(stalled(21), "RS06").sample.measures; // before tok022 (no tag)
    expect(plain.longHesitations).toBe(1);
    expect(plain.unexplainedSilenceMaxSec).toBeGreaterThan(6);
    const beforeLong = sampleOf(stalled(23), "RS06").sample.measures; // before tok024 (tagged longer word)
    expect(beforeLong.longHesitations).toBe(1);
    expect(beforeLong.unexplainedSilenceMaxSec).toBeLessThan(1);
  });
  it("a slowed final third shows in the WPM drop", () => {
    const slow = read().map((w, i) => (i >= 70 ? { ...w, startMs: w.startMs + (i - 70) * 250 + 250, endMs: w.endMs + (i - 70) * 250 + 400 } : w));
    expect(sampleOf(slow, "RS14").sample.measures.finalThirdWpmDropShare).toBeGreaterThan(0.15);
  });
});

describe("P10 measure capture: missing evidence is never guessed", () => {
  it("without writer tags the tag-driven rules cannot be judged (REASSESS), the rest still can", () => {
    const rs03 = sampleOf(read(), "RS03", {}).sample;
    expect(rs03.measures.functionWordAccuracy).toBeUndefined();
    expect(evaluateRs(rs03, "RS03")).toMatchObject({ status: "REASSESS" });
    expect(evaluateRs(sampleOf(read(), "RS12", {}).sample, "RS12").status).toBe("REASSESS");
    expect(evaluateRs(sampleOf(read(), "RS01", {}).sample, "RS01").status).toBe("READY");
  });
  it("an unusable recording is an invalid sample (REASSESS), not a child error", () => {
    const r = p10SampleFromOral("RS01", tokens, read(), { usable: false, speechDetected: true, durationMs: 60_000 }, "tok-v1", tags);
    expect(r.sample.valid).toBe(false);
    expect(evaluateRs(r.sample, "RS01")).toMatchObject({ status: "REASSESS", reassessReason: "INVALID_SAMPLE" });
  });
  it("a passage with no full stops has no sentence-boundary measure", () => {
    const flat = tokens.map((t) => ({ ...t, text: t.text.replace(/[.,]$/, "") }));
    const r = p10SampleFromOral("RS09", flat, read(), SAMPLE, "tok-v1", tags);
    expect(r.sample.measures.sentenceBoundaryCompliance).toBeUndefined();
    expect(evaluateRs(r.sample, "RS09").status).toBe("REASSESS");
  });
});
