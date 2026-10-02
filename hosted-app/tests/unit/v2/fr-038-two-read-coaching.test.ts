import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { twoReadCoaching } from "../../../lib/v2/news-reader-coaching";
import { newNewsReaderState, recordNewsReaderAttempt, type NewsReaderAttempt, type NewsReaderState } from "../../../lib/v2/news-reader";
import { learnerLanguageViolations } from "../../../lib/v2/learner-language";
import { applyNewPassage, newLearnerAggregate } from "../../../lib/v2/learner-aggregate";
import { scoreComprehension, structuredEvidence } from "../../../lib/v2/comprehension-score";

const read = (id: string, readNumber: 1 | 2, clarity: number, extra: Partial<NewsReaderAttempt> = {}): NewsReaderAttempt => ({
  attemptId: id, passageId: "P001", readNumber, metrics: { clarity, pronunciation: clarity, intonation: clarity }, technicalState: "OK", recordedAt: "2026-10-03T10:00:00Z", ...extra
});
const stateOf = (...attempts: NewsReaderAttempt[]): NewsReaderState => attempts.reduce((s, a) => recordNewsReaderAttempt(s, a), newNewsReaderState());

// FR-038 - Oral two-read coaching [FROZEN]
describe("FR-038 oral two-read coaching", () => {
  it("stores the two reads as independent attempts", () => {
    const s = stateOf(read("r1", 1, 0.4), read("r2", 2, 0.7));
    expect(s.attempts.map((a) => [a.attemptId, a.readNumber])).toEqual([["r1", 1], ["r2", 2]]);
    expect(s.attempts[0].metrics.clarity).toBe(0.4);
    expect(s.attempts[1].metrics.clarity).toBe(0.7);
  });

  it("calculates the improvement delta per metric and overall", () => {
    const r = twoReadCoaching(stateOf(read("r1", 1, 0.4), read("r2", 2, 0.7)), "P001");
    expect(r.status).toBe("COMPLETE");
    if (r.status !== "COMPLETE") throw new Error("unreachable");
    expect(r.deltas.map((d) => d.metric)).toEqual(["clarity", "pronunciation", "intonation"]);
    expect(r.deltas.every((d) => Math.abs(d.delta - 0.3) < 1e-9)).toBe(true);
    expect(r.meanDelta).toBeCloseTo(0.3);
    expect(r.improved).toBe(true);
  });

  it("frames the second read as practice, never punishment, whether it improved or not", () => {
    for (const second of [0.9, 0.4, 0.1]) {
      const r = twoReadCoaching(stateOf(read("r1", 1, 0.4), read("r2", 2, second)), "P001");
      if (r.status !== "COMPLETE") throw new Error("unreachable");
      expect(learnerLanguageViolations(r.coaching)).toEqual([]);
      expect(r.coaching).not.toMatch(/worse|wrong|bad|fail|again!|should have|mistake/i);
      expect(r.coaching).toMatch(/practice/i);
    }
  });

  it("reports an incomplete pair without scoring anything", () => {
    expect(twoReadCoaching(stateOf(read("r1", 1, 0.4)), "P001")).toEqual({ status: "INCOMPLETE", reads: 1 });
    expect(twoReadCoaching(newNewsReaderState(), "P001")).toEqual({ status: "INCOMPLETE", reads: 0 });
  });

  it("never scores a pair with a technical problem (mic unavailable)", () => {
    const r = twoReadCoaching(stateOf(read("r1", 1, 0.4), read("r2", 2, 0, { technicalState: "MIC_UNAVAILABLE", metrics: {} })), "P001");
    expect(r).toEqual({ status: "UNSCORED", reason: "TECHNICAL_STATE_NOT_OK" });
  });

  it("only compares the same passage's reads", () => {
    const s = stateOf(read("r1", 1, 0.4), read("x2", 2, 0.9, { passageId: "P002" }));
    expect(twoReadCoaching(s, "P001")).toEqual({ status: "INCOMPLETE", reads: 1 });
  });

  it("does not alter the core WPM state machine (coaching has no path into core)", () => {
    const scored = scoreComprehension(structuredEvidence([{ itemId: "q", score: 0.9 }]), { score: 0.9 });
    const learner = newLearnerAggregate("l1", 90);
    const before = JSON.stringify(applyNewPassage(learner, "a1", scored).learner.core);
    twoReadCoaching(stateOf(read("r1", 1, 0), read("r2", 2, 1)), "P001");
    expect(JSON.stringify(applyNewPassage(learner, "a1", scored).learner.core)).toBe(before);
    const source = readFileSync(resolve(__dirname, "../../../lib/v2/news-reader-coaching.ts"), "utf8");
    expect(source.split("\n").filter((l) => /^import/.test(l))).toEqual(['import type { NewsReaderAttempt, NewsReaderState, OralMetrics } from "./news-reader";']);
  });
});
