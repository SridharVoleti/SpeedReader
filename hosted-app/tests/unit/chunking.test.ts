import { describe, expect, it } from "vitest";
import { chunkWords } from "../../lib/chunking";

// SR-R1-002: Single-word MVP mode.
// "Every source token is presented exactly once and in source order; no omission/duplication."
// Implementation note: "Schema must permit future meaningful chunks" - chunkWords must work for
// any chunk size, not just one word, since later releases group by meaning instead of count.
describe("chunkWords", () => {
  it("presents every source token exactly once, in source order, at one word per chunk", () => {
    const words = ["Ravi", "went", "to", "a", "shop", "."];
    const chunks = chunkWords(words, 1);

    expect(chunks).toEqual([["Ravi"], ["went"], ["to"], ["a"], ["shop"], ["."]]);
    expect(chunks.flat()).toEqual(words);
  });

  it("never omits or duplicates a token, for any chunk size from 1 to 6", () => {
    const words = Array.from({ length: 79 }, (_, i) => `word${i}`);
    for (let wordsPerChunk = 1; wordsPerChunk <= 6; wordsPerChunk += 1) {
      const chunks = chunkWords(words, wordsPerChunk);
      expect(chunks.flat()).toEqual(words);
    }
  });

  it("keeps a trailing partial chunk instead of dropping or padding it", () => {
    // 5 words at 2 words/chunk -> [2, 2, 1], not [2, 2] (dropped) or [2, 2, 2] (padded).
    const chunks = chunkWords(["a", "b", "c", "d", "e"], 2);
    expect(chunks).toEqual([["a", "b"], ["c", "d"], ["e"]]);
  });

  it("is deterministic for identical inputs", () => {
    const words = ["one", "two", "three", "four"];
    expect(chunkWords(words, 3)).toEqual(chunkWords(words, 3));
  });

  it("returns no chunks for an empty passage", () => {
    expect(chunkWords([], 1)).toEqual([]);
  });

  it("rejects a non-positive chunk size", () => {
    expect(() => chunkWords(["a"], 0)).toThrow();
    expect(() => chunkWords(["a"], -1)).toThrow();
  });
});
