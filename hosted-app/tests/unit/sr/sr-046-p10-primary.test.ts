import { describe, expect, it } from "vitest";
import { scoreP10, P10_RULE, SCORING_RULES } from "../../../lib/sr/p10-scoring";

const items = (correct: boolean[], primaryIndex = 0) =>
  correct.map((c, i) => ({ itemId: `i${i + 1}`, correct: c, primary: i === primaryIndex, firstAttempt: true }));

describe("SR-046 P10 four-item blueprint with primary-item rule", () => {
  it("the blueprint is 4 items, pass at 3, primary required", () => {
    expect(P10_RULE).toMatchObject({ itemCount: 4, minCorrect: 3, primaryRequired: true });
  });
  it("3/4 with the primary correct passes", () => {
    expect(scoreP10(items([true, true, true, false])).pass).toBe(true);
  });
  it("3/4 with the primary wrong fails", () => {
    const r = scoreP10(items([false, true, true, true]));
    expect(r.pass).toBe(false);
    expect(r.reason).toBe("PRIMARY_ITEM_INCORRECT");
  });
  it("4/4 passes, 2/4 fails on count", () => {
    expect(scoreP10(items([true, true, true, true])).pass).toBe(true);
    expect(scoreP10(items([true, true, false, false]))).toMatchObject({ pass: false, reason: "BELOW_MIN_CORRECT" });
  });
  it("the primary item is read from the approved assessment, wherever it sits", () => {
    expect(scoreP10(items([true, true, true, false], 2)).pass).toBe(true);
    expect(scoreP10(items([true, true, false, true], 2)).pass).toBe(false);
  });
  it("malformed assessments are rejected: wrong count, no primary, two primaries", () => {
    expect(() => scoreP10(items([true, true, true]))).toThrow(/4 items/);
    expect(() => scoreP10(items([true, true, true, true]).map((i) => ({ ...i, primary: false })))).toThrow(/primary/);
    expect(() => scoreP10(items([true, true, true, true]).map((i) => ({ ...i, primary: true })))).toThrow(/primary/);
  });
  it("the rule cites its canonical source and is registered; no percent threshold exists", () => {
    expect(P10_RULE.source).toMatch(/Spec_v0\.25/);
    expect(SCORING_RULES[P10_RULE.id]).toBe(P10_RULE);
    expect(Object.keys(P10_RULE)).not.toContain("passThreshold");
  });
  it("boundary: exactly 3 correct passes, 2 correct fails, for every primary position", () => {
    for (let pi = 0; pi < 4; pi++) {
      const three = [true, true, true, true].map((_c, i) => i !== (pi + 1) % 4);
      expect(scoreP10(items(three, pi)).pass).toBe(true);
      const two = [false, false, false, false].map((_c, i) => i === pi || i === (pi + 1) % 4);
      expect(scoreP10(items(two, pi)).pass).toBe(false);
    }
  });
  it("only first-attempt responses count: a correct answer after a hint/feedback is not credited", () => {
    const base = items([true, true, true, false]);
    const retried = base.map((i, n) => (n === 1 ? { ...i, firstAttempt: false } : i));
    expect(scoreP10(retried)).toMatchObject({ pass: false, correct: 2, reason: "NOT_FIRST_ATTEMPT" });
    const primaryRetried = base.map((i, n) => (n === 0 ? { ...i, firstAttempt: false } : i));
    expect(scoreP10(primaryRetried)).toMatchObject({ pass: false, reason: "NOT_FIRST_ATTEMPT" });
  });
});
