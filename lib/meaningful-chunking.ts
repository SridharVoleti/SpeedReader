// SR-R9-001: Meaningful chunk schema.
// "Support authored/validated meaning-group boundaries independent of fixed word count."
// "Rendered chunks concatenate to source exactly; chunk sizes may vary." Chunk boundaries are
// authored token spans - never derived from a fixed word count - and reconstructing the source
// from them must reproduce it exactly, with no omitted or duplicated token.

export type MeaningChunk = {
  meaningChunkId: string;
  tokenStart: number;
  tokenEnd: number;
};

export function chunkTokens(tokens: string[], chunks: MeaningChunk[]): string[][] {
  return chunks
    .slice()
    .sort((a, b) => a.tokenStart - b.tokenStart)
    .map((chunk) => tokens.slice(chunk.tokenStart, chunk.tokenEnd));
}

export function reconstructSourceFromChunks(tokens: string[], chunks: MeaningChunk[]): string[] {
  return chunkTokens(tokens, chunks).flat();
}

export function chunksReproduceSourceExactly(tokens: string[], chunks: MeaningChunk[]): boolean {
  const reconstructed = reconstructSourceFromChunks(tokens, chunks);
  if (reconstructed.length !== tokens.length) return false;
  return reconstructed.every((token, index) => token === tokens[index]);
}
