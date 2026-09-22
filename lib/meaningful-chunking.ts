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

// SR-R9-002: Flexible span progression.
// "Progress from word-level to larger meaning groups using comprehension-qualified evidence."
// "Failed comprehension at larger span cannot raise certified span." (TC-R9-002-B) Mirrors the
// CRR pattern in lib/certification.ts (recordChallengeAttempt) applied to span level instead of
// WPM: the certified span only ever moves via a passing comprehension gate on the challenge.
export type SpanLevel = number;

export type SpanCertificationState = {
  certifiedSpanLevel: SpanLevel;
  challengeSpanLevel: SpanLevel | null;
};

export function recordSpanChallengeAttempt(
  state: SpanCertificationState,
  challengeSpanLevel: SpanLevel,
  comprehensionPassed: boolean
): SpanCertificationState {
  if (!comprehensionPassed) {
    return { certifiedSpanLevel: state.certifiedSpanLevel, challengeSpanLevel };
  }
  return { certifiedSpanLevel: Math.max(state.certifiedSpanLevel, challengeSpanLevel), challengeSpanLevel };
}
