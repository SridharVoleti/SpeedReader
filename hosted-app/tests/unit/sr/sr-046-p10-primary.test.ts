import { describe, expect, it } from "vitest";
import { scoreP10, P10_RULE } from "../../../lib/sr/p10-scoring";

const items = (correct: boolean[], primaryIndex = 0) =>
  correct.map((c, i) => ({ itemId: `i${i + 1}`, correct: c, primary: i === primaryIndex }));

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
});
