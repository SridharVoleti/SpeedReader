// SR-R1-002: Single-word MVP mode.
// A single, tested primitive for splitting a passage into presentation chunks so every source
// token is guaranteed to be shown exactly once, in source order, regardless of chunk size.
// Kept size-agnostic (not hardcoded to one word) so a future release can chunk by meaning
// instead of a fixed count without changing this contract.

export function chunkWords(words: string[], wordsPerChunk: number): string[][] {
  if (wordsPerChunk <= 0) throw new Error("wordsPerChunk must be greater than zero");

  const chunks: string[][] = [];
  for (let index = 0; index < words.length; index += wordsPerChunk) {
    chunks.push(words.slice(index, index + wordsPerChunk));
  }
  return chunks;
}
