import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COUNT100_VERSION, count100 } from "../../../lib/sr/pipeline-v2/count100";
import {
  ORAL_CONFIG_V1, captureOralTelemetry, competencyTimelines, roundComposite, rsBaseline, rsProgress,
  type OralHistory, type OralHistoryEntry, type SpokenWord
} from "../../../lib/v2/oral-telemetry";
import { RS_IDS } from "../../../lib/world1-framework";

const TEXT = "Mia has a red kite. She runs to the hill, and the wind lifts it high. Then it dips, so she laughs!";
const tokens = count100(TEXT).tokens;
const ok = { usable: true, speechDetected: true, durationMs: 20_000 };

/** Speak words at 400ms each with a 100ms gap, optional per-index overrides. */
function speak(words: readonly string[], over: Record<number, Partial<SpokenWord>> = {}, startAt = 0): SpokenWord[] {
  let t = startAt;
  return words.map((word, i) => {
    const w = { word, startMs: t, endMs: t + 400, confidence: 0.95, ...over[i] };
    t = (w.endMs as number) + 100;
    return w as SpokenWord;
  });
}
const expectedWords = tokens.map((t) => t.text);
const run = (words: SpokenWord[], opts = {}, sample = ok) => captureOralTelemetry(tokens, words, sample, COUNT100_VERSION, opts);
const tele = (words: SpokenWord[], opts = {}) => {
  const r = run(words, opts);
  if (r.status !== "ASSESSED") throw new Error("expected assessed");
  return r.telemetry;
};

describe("APP-ORAL-001/002 telemetry capture and deterministic alignment", () => {
  it("a perfect reading is all aligned-correct, with canonical token count, WPM and versions", () => {
    const t = tele(speak(expectedWords));
    expect(t).toMatchObject({ expectedTokens: tokens.length, alignedCorrect: tokens.length, substitutions: 0, omissions: 0, insertions: 0, repetitions: 0, fullRestarts: 0, tokenizerVersion: COUNT100_VERSION, configVersion: ORAL_CONFIG_V1.version });
    expect(t.accuracy.firstPass.accuracy).toBe(1);
    expect(t.wpm).toBeGreaterThan(0);
  });

  it("classifies a substitution", () => {
    const w = [...expectedWords]; w[3] = "blue";
    const t = tele(speak(w));
    expect(t).toMatchObject({ substitutions: 1, omissions: 0, insertions: 0, alignedCorrect: tokens.length - 1 });
  });

  it("classifies an omission", () => {
    const w = expectedWords.filter((_, i) => i !== 5);
    expect(tele(speak(w))).toMatchObject({ omissions: 1, substitutions: 0, insertions: 0 });
  });

  it("classifies an insertion", () => {
    const w = [...expectedWords]; w.splice(6, 0, "really");
    expect(tele(speak(w))).toMatchObject({ insertions: 1, omissions: 0, repetitions: 0 });
  });

  it("classifies an immediate repeat as a repetition, not an insertion", () => {
    const w = [...expectedWords]; w.splice(4, 0, expectedWords[3]);
    expect(tele(speak(w))).toMatchObject({ repetitions: 1, insertions: 0 });
  });

  it("accepts a quick self-correction, records its latency, and the final accuracy credits it", () => {
    const w = [...expectedWords]; w.splice(3, 0, "rod"); // says "rod" then the correct "red"
    const t = tele(speak(w));
    expect(t.acceptedSelfCorrections).toBe(1);
    expect(t.insertions).toBe(0);
    expect(t.selfCorrectionLatenciesMs).toEqual([500]);
    expect(t.accuracy.final.accuracy).toBe(1);
  });

  it("a late 'correction' beyond the window is just an insertion", () => {
    const w = speak([...expectedWords.slice(0, 3), "rod", ...expectedWords.slice(3)], { 4: { startMs: 60_000, endMs: 60_400 } });
    // later words must stay in time order
    let t0 = 60_500;
    for (let i = 5; i < w.length; i += 1) { w[i] = { ...w[i], startMs: t0, endMs: t0 + 400 }; t0 += 500; }
    expect(tele(w)).toMatchObject({ acceptedSelfCorrections: 0, insertions: 1 });
  });

  it("counts long hesitations", () => {
    const w = speak(expectedWords);
    for (let i = 10; i < w.length; i += 1) w[i] = { ...w[i], startMs: w[i].startMs + 3000, endMs: w[i].endMs + 3000 };
    expect(tele(w).longHesitations).toBe(1);
  });

  it("detects a full restart after real progress and reports first-pass and final accuracy separately", () => {
    const firstTry = [...expectedWords.slice(0, 8), "stuck"]; // stumbles then starts over
    const w = speak([...firstTry, ...expectedWords]);
    const t = tele(w);
    expect(t.fullRestarts).toBe(1);
    expect(t.accuracy.final.accuracy).toBe(1);
    expect(t.accuracy.firstPass.accuracy).toBeLessThan(1);
  });

  it("measures punctuation handling from pauses after punctuated tokens", () => {
    const quick = tele(speak(expectedWords, {}));
    expect(quick.punctuation.opportunities).toBeGreaterThan(0);
    // 100ms gaps are below the 250ms pause: nothing honoured
    expect(quick.punctuation.honoured).toBe(0);
    const w = speak(expectedWords);
    // add 400ms after every word that has trailing punctuation
    let shift = 0;
    const paused = w.map((x, i) => {
      const moved = { ...x, startMs: x.startMs + shift, endMs: x.endMs + shift };
      if (/[.,!?;:]$/.test(tokens[i].text)) shift += 400;
      return moved;
    });
    const t = tele(paused);
    expect(t.punctuation.honoured).toBe(t.punctuation.opportunities);
  });

  it("tracks challenge-word recovery", () => {
    const w = [...expectedWords]; w[2] = "uh"; w.splice(3, 0, expectedWords[2]); // says "uh" then the target word
    const t = tele(speak(w), { challengeTokenIndexes: [3, 8] });
    expect(t.challengeWords).toEqual({ total: 2, recovered: 2 });
    const bad = [...expectedWords]; bad[7] = "blue";
    expect(tele(speak(bad), { challengeTokenIndexes: [8] }).challengeWords).toEqual({ total: 1, recovered: 0 });
  });

  it("is deterministic", () => {
    const w = [...expectedWords]; w[3] = "blue"; w.splice(9, 0, "um");
    expect(run(speak(w))).toEqual(run(speak(w)));
  });
});

describe("APP-ORAL-003/004/005 validity, ASR uncertainty and accent fairness", () => {
  it("an unusable, silent or too-short sample is unassessable before any specialist metric, and never a learner error", () => {
    expect(run(speak(expectedWords), {}, { ...ok, usable: false })).toEqual({ status: "UNASSESSABLE", reason: "SAMPLE_UNUSABLE", learnerError: false });
    expect(run([], {}, { ...ok, speechDetected: false })).toMatchObject({ status: "UNASSESSABLE", reason: "NO_SPEECH", learnerError: false });
    expect(run(speak(expectedWords), {}, { ...ok, durationMs: 500 })).toMatchObject({ status: "UNASSESSABLE", reason: "SAMPLE_TOO_SHORT" });
  });

  it("low-confidence words are unassessed, not substitutions or pronunciation errors", () => {
    const w = [...expectedWords]; w[3] = "xqzv";
    const t = tele(speak(w, { 3: { confidence: 0.2 } }));
    expect(t.substitutions).toBe(0);
    expect(t.asr).toMatchObject({ uncertainWords: 1, unassessedTokens: 1 });
    expect(t.accuracy.firstPass).toMatchObject({ correct: tokens.length - 1, assessable: tokens.length - 1, accuracy: 1 });
  });

  it("missing confidence is treated as uncertain, not as a mistake", () => {
    const w = [...expectedWords]; w[3] = "xqzv";
    expect(tele(speak(w, { 3: { confidence: null } })).substitutions).toBe(0);
  });

  it("an approved accepted variant (accent/dialect) is correct; accent alone is never a lexical failure", () => {
    const w = [...expectedWords]; w[3] = "rad";
    const strict = tele(speak(w));
    const fair = tele(speak(w), { acceptedVariants: { red: ["rad"] } });
    expect(strict.substitutions).toBe(1);
    expect(fair.substitutions).toBe(0);
    expect(fair.alignedCorrect).toBe(tokens.length);
  });
});

describe("APP-ORAL-006..009 same-RS personal history", () => {
  const e = (rsId: (typeof RS_IDS)[number], p: number, round: number, finalAccuracy: number | null, wpm: number | null = 80, learnerId = "kid"): OralHistoryEntry => ({ learnerId, rsId, p, round, finalAccuracy, wpm });

  it("each RS has its own P1 baseline: Session 1 is never the global baseline", () => {
    const h: OralHistory = [e("RS01", 1, 1, 0.9)];
    expect(rsBaseline(h, "kid", "RS01")?.finalAccuracy).toBe(0.9);
    expect(rsBaseline(h, "kid", "RS02")).toBeNull();
    expect(rsProgress(h, "kid", "RS02")).toEqual({ state: "NO_BASELINE" });
  });

  it("progress is same learner + same RS + later P, never cross-RS or cross-learner", () => {
    const h: OralHistory = [e("RS01", 1, 1, 0.7, 60), e("RS02", 1, 1, 0.95, 90), e("RS01", 4, 1, 0.85, 75), e("RS01", 3, 1, 0.1, 10, "someone-else")];
    const p = rsProgress(h, "kid", "RS01");
    expect(p).toMatchObject({ state: "COMPARED", baselineStrong: false, wpmDelta: 15 });
    expect((p as { accuracyDelta: number }).accuracyDelta).toBeCloseTo(0.15);
    expect(rsProgress(h, "kid", "RS02")).toEqual({ state: "BASELINE_ONLY", baselineStrong: true }); // 0.95 meets the strong-baseline pilot value
  });

  it("a baseline-strong learner is recognised and is not required to numerically improve", () => {
    const h: OralHistory = [e("RS03", 1, 1, 0.97), e("RS03", 5, 1, 0.97)];
    const p = rsProgress(h, "kid", "RS03");
    expect(p).toMatchObject({ state: "COMPARED", baselineStrong: true, accuracyDelta: 0 });
    expect(rsProgress([e("RS03", 1, 1, 0.97)], "kid", "RS03")).toEqual({ state: "BASELINE_ONLY", baselineStrong: true });
  });

  it("keeps the 15 competency timelines separate and ordered", () => {
    const h: OralHistory = [e("RS02", 3, 1, 0.8), e("RS01", 1, 1, 0.7), e("RS02", 1, 1, 0.6), e("RS01", 2, 1, 0.75)];
    const t = competencyTimelines(h, "kid");
    expect(Object.keys(t)).toHaveLength(15);
    expect(t.RS01.map((x) => x.p)).toEqual([1, 2]);
    expect(t.RS02.map((x) => x.p)).toEqual([1, 3]);
    expect(t.RS05).toEqual([]);
  });

  it("a composite exists only at a complete round boundary and averages per-RS deltas, not raw metrics", () => {
    const round1 = RS_IDS.map((rs) => e(rs, 1, 1, 0.6));
    const round2 = RS_IDS.map((rs, i) => e(rs, 1, 2, 0.6 + (i % 2 ? 0.1 : 0.2)));
    expect(roundComposite([...round1, ...round2.slice(0, 14)], "kid", 2)).toBeNull(); // one RS missing
    const full = roundComposite([...round1, ...round2], "kid", 2)!;
    expect(full.round).toBe(2);
    expect(full.meanAccuracyDelta).toBeCloseTo((8 * 0.2 + 7 * 0.1) / 15);
    expect(Object.keys(full.perRs)).toHaveLength(15);
  });
});

describe("isolation from core progression (APP-READY-008 / APP-NR-003)", () => {
  it("imports nothing from core WPM progression and is not imported by it", () => {
    const src = readFileSync("hosted-app/lib/v2/oral-telemetry.ts", "utf8");
    expect([...src.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]).sort()).toEqual(["../sr/pipeline-v2/count100", "../world1-framework"]);
    for (const core of ["core-wpm.ts", "first-five.ts", "learner-aggregate.ts", "passage-completion.ts"]) {
      expect(readFileSync(`hosted-app/lib/v2/${core}`, "utf8")).not.toMatch(/oral-telemetry/);
    }
  });
});
