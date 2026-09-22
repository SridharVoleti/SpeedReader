"use client";

// SR-R9-001: Meaningful chunk schema.
// A reachable demo proving variable-size, authored meaning-group chunks concatenate back to the
// exact source token sequence - and that a broken chunk schema (an omitted token range) is
// detectably invalid.

import { useState } from "react";
import {
  chunksReproduceSourceExactly,
  chunkTokens,
  MeaningChunk,
  recordSpanChallengeAttempt,
  SpanCertificationState
} from "../../lib/meaningful-chunking";
import styles from "../page.module.css";

const SOURCE_TOKENS = ["The", "quick", "brown", "fox", "jumps", "over", "the", "lazy", "dog"];

const VALID_CHUNKS: MeaningChunk[] = [
  { meaningChunkId: "c1", tokenStart: 0, tokenEnd: 2 },
  { meaningChunkId: "c2", tokenStart: 2, tokenEnd: 3 },
  { meaningChunkId: "c3", tokenStart: 3, tokenEnd: 6 },
  { meaningChunkId: "c4", tokenStart: 6, tokenEnd: 9 }
];

const INVALID_CHUNKS_WITH_GAP: MeaningChunk[] = [
  { meaningChunkId: "c1", tokenStart: 0, tokenEnd: 2 },
  { meaningChunkId: "c2", tokenStart: 3, tokenEnd: 9 }
];

export default function MeaningfulChunkingDemoPage() {
  const [useInvalidSchema, setUseInvalidSchema] = useState(false);
  const activeChunks = useInvalidSchema ? INVALID_CHUNKS_WITH_GAP : VALID_CHUNKS;
  const rendered = chunkTokens(SOURCE_TOKENS, activeChunks);
  const reproducesSource = chunksReproduceSourceExactly(SOURCE_TOKENS, activeChunks);

  // SR-R9-002: Flexible span progression.
  const [spanState, setSpanState] = useState<SpanCertificationState>({ certifiedSpanLevel: 2, challengeSpanLevel: null });

  return (
    <main className={styles.shell} data-testid="meaningful-chunking-demo">
      <h1>Meaningful chunk schema</h1>
      <p className={styles.lede}>
        Authored meaning-group chunks vary in size - never a fixed word count - and rendered
        chunks always concatenate back to the exact source, with no omitted or duplicated token.
      </p>

      <section className={styles.stageCard} data-testid="chunk-schema">
        <p data-testid="rendered-chunks">Rendered chunks: {rendered.map((chunk) => chunk.join(" ")).join(" | ")}</p>
        <p data-testid="chunk-sizes">Chunk sizes: {rendered.map((chunk) => chunk.length).join(", ")}</p>
        <p data-testid="reproduces-source">Reproduces source exactly: {reproducesSource ? "yes" : "no"}</p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primaryButton}
            data-testid="toggle-invalid-schema"
            onClick={() => setUseInvalidSchema((previous) => !previous)}
          >
            {useInvalidSchema ? "Use valid chunk schema" : "Use chunk schema with a gap"}
          </button>
        </div>
      </section>

      <section className={styles.stageCard} data-testid="flexible-span-progression">
        <p className={styles.kicker}>Flexible span progression (SR-R9-002)</p>
        <p className={styles.stageHint}>
          Progressing to a larger meaning-group span requires passing comprehension at that
          span - a failed comprehension check at the challenge span can never raise the
          certified span.
        </p>
        <p data-testid="certified-span">Certified span: L{spanState.certifiedSpanLevel}</p>
        <p data-testid="challenge-span">Challenge span: {spanState.challengeSpanLevel === null ? "none" : `L${spanState.challengeSpanLevel}`}</p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondaryButton}
            data-testid="fail-span-challenge"
            onClick={() => setSpanState((previous) => recordSpanChallengeAttempt(previous, 3, false))}
          >
            Attempt L3 challenge - fail comprehension
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            data-testid="pass-span-challenge"
            onClick={() => setSpanState((previous) => recordSpanChallengeAttempt(previous, 3, true))}
          >
            Attempt L3 challenge - pass comprehension
          </button>
        </div>
      </section>
    </main>
  );
}
