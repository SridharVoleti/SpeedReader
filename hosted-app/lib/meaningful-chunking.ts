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

// SR-R9-003: Semantic pacing.
// "Apply bounded deterministic pacing adjustments for punctuation/meaning boundaries."
// "Same content/rules yield same logged timing schedule within bounds." Pause type is classified
// purely from a token's trailing punctuation - a pure function of the content, so the same
// content and rules always produce the exact same schedule - and every multiplier is clamped
// into the configured [min, max] bound.
export type PauseType = "NONE" | "COMMA" | "SENTENCE_END" | "PARAGRAPH_END";

export type PacingConfig = {
  baseMsPerToken: number;
  pauseMultipliers: Record<PauseType, number>;
  minMultiplier: number;
  maxMultiplier: number;
};

export type PacingScheduleEntry = {
  token: string;
  pauseType: PauseType;
  pacingMultiplier: number;
  durationMs: number;
};

export const DEFAULT_PACING_CONFIG: PacingConfig = {
  baseMsPerToken: 300,
  pauseMultipliers: { NONE: 1, COMMA: 1.3, SENTENCE_END: 1.8, PARAGRAPH_END: 2.2 },
  minMultiplier: 1,
  maxMultiplier: 2.5
};

export function classifyPauseType(token: string): PauseType {
  if (/\n\s*\n$/.test(token)) return "PARAGRAPH_END";
  if (/[.!?]$/.test(token)) return "SENTENCE_END";
  if (/[,;:]$/.test(token)) return "COMMA";
  return "NONE";
}

export function computePacingSchedule(tokens: string[], config: PacingConfig = DEFAULT_PACING_CONFIG): PacingScheduleEntry[] {
  return tokens.map((token) => {
    const pauseType = classifyPauseType(token);
    const rawMultiplier = config.pauseMultipliers[pauseType];
    const pacingMultiplier = Math.min(config.maxMultiplier, Math.max(config.minMultiplier, rawMultiplier));
    return {
      token,
      pauseType,
      pacingMultiplier,
      durationMs: config.baseMsPerToken * pacingMultiplier
    };
  });
}
