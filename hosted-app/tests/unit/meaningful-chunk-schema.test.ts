import { describe, expect, it } from "vitest";
import { chunksReproduceSourceExactly, chunkTokens, MeaningChunk, reconstructSourceFromChunks } from "../../lib/meaningful-chunking";

// SR-R9-001: Meaningful chunk schema.
// "Support authored/validated meaning-group boundaries independent of fixed word count."
// "Rendered chunks concatenate to source exactly; chunk sizes may vary." (TC-R9-001-B: "Chunks
//  reproduce source" - exact source token sequence, no omission/duplication.)
const SOURCE_TOKENS = ["The", "quick", "brown", "fox", "jumps", "over", "the", "lazy", "dog"];

const VARIABLE_SIZE_CHUNKS: MeaningChunk[] = [
  { meaningChunkId: "c1", tokenStart: 0, tokenEnd: 2 }, // "The quick" (2 words)
  { meaningChunkId: "c2", tokenStart: 2, tokenEnd: 3 }, // "brown" (1 word)
  { meaningChunkId: "c3", tokenStart: 3, tokenEnd: 6 }, // "fox jumps over" (3 words)
  { meaningChunkId: "c4", tokenStart: 6, tokenEnd: 9 } // "the lazy dog" (3 words)
];

describe("chunkTokens", () => {
  it("renders each authored chunk as its own variable-size token span, independent of fixed word count", () => {
    const chunks = chunkTokens(SOURCE_TOKENS, VARIABLE_SIZE_CHUNKS);

    expect(chunks).toEqual([["The", "quick"], ["brown"], ["fox", "jumps", "over"], ["the", "lazy", "dog"]]);
    // Confirms chunk sizes genuinely vary (not all the same fixed word count).
    const sizes = chunks.map((chunk) => chunk.length);
    expect(new Set(sizes).size).toBeGreaterThan(1);
  });
});

describe("reconstructSourceFromChunks / chunksReproduceSourceExactly", () => {
  it("concatenates variable-size chunks back to the exact source token sequence", () => {
    expect(reconstructSourceFromChunks(SOURCE_TOKENS, VARIABLE_SIZE_CHUNKS)).toEqual(SOURCE_TOKENS);
    expect(chunksReproduceSourceExactly(SOURCE_TOKENS, VARIABLE_SIZE_CHUNKS)).toBe(true);
  });

  it("detects omission when a chunk boundary skips a token range", () => {
    const chunksWithGap: MeaningChunk[] = [
      { meaningChunkId: "c1", tokenStart: 0, tokenEnd: 2 },
      { meaningChunkId: "c2", tokenStart: 3, tokenEnd: 9 } // skips index 2 ("brown")
    ];

    expect(chunksReproduceSourceExactly(SOURCE_TOKENS, chunksWithGap)).toBe(false);
  });

  it("detects duplication when chunk boundaries overlap", () => {
    const overlappingChunks: MeaningChunk[] = [
      { meaningChunkId: "c1", tokenStart: 0, tokenEnd: 3 },
      { meaningChunkId: "c2", tokenStart: 2, tokenEnd: 9 } // re-includes index 2 ("brown")
    ];

    expect(chunksReproduceSourceExactly(SOURCE_TOKENS, overlappingChunks)).toBe(false);
  });

  it("is deterministic for identical inputs", () => {
    expect(reconstructSourceFromChunks(SOURCE_TOKENS, VARIABLE_SIZE_CHUNKS)).toEqual(
      reconstructSourceFromChunks(SOURCE_TOKENS, VARIABLE_SIZE_CHUNKS)
    );
  });
});
