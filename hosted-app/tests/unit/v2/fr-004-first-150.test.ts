import { describe, expect, it } from "vitest";
import { foundationSpec, isFoundationPassage, validateFoundationPassageText, presentationChunks } from "../../../lib/v2/foundation";

const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(" ");

// FR-004 - First 150 passages [FROZEN]
describe("FR-004 first 150 passages", () => {
  it("makes P1-P150 exactly 100 words, shown one word at a time, with the KM coordinate", () => {
    for (const seq of [1, 75, 150]) {
      const spec = foundationSpec(seq);
      expect(spec.words).toBe(100);
      expect(spec.display).toBe("ONE_WORD_AT_A_TIME");
      expect(spec.coordinate.deliverySequence).toBe(seq);
    }
    expect(foundationSpec(150).coordinate.rsId).toBe("RS15");
    expect(foundationSpec(150).coordinate.pLevel).toBe(10);
  });

  it("is defined only for 1..150", () => {
    expect(isFoundationPassage(150)).toBe(true);
    expect(isFoundationPassage(151)).toBe(false);
    expect(isFoundationPassage(0)).toBe(false);
    expect(() => foundationSpec(151)).toThrow(RangeError);
  });

  it("accepts exactly 100 words and rejects 99 or 101", () => {
    expect(validateFoundationPassageText(words(100))).toEqual([]);
    expect(validateFoundationPassageText(words(99))).toEqual(["passage must be exactly 100 words, got 99"]);
    expect(validateFoundationPassageText(words(101))).toEqual(["passage must be exactly 100 words, got 101"]);
  });

  it("presents exactly 100 single-word chunks", () => {
    const chunks = presentationChunks(words(100));
    expect(chunks).toHaveLength(100);
    expect(chunks.every((c) => c.length === 1)).toBe(true);
  });
});
