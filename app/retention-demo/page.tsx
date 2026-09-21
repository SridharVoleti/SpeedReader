"use client";

// SR-R8-001: Delayed recall evidence.
// A reachable demo proving the delayed item links to its source passage and is scored purely
// from its own correct/total - a perfect immediate score never influences the retention score.

import { useState } from "react";
import { classifyDelayBucket, recordRetentionEvidence } from "../../lib/retention";
import styles from "../page.module.css";

export default function RetentionDemoPage() {
  const [delayedCorrect, setDelayedCorrect] = useState(2);
  const delayed = { correct: delayedCorrect, total: 5 };
  const immediate = { correct: 5, total: 5 };
  const delaySeconds = 50000;

  const evidence = recordRetentionEvidence("level1_001", delaySeconds, immediate, delayed);

  return (
    <main className={styles.shell} data-testid="retention-demo">
      <h1>Delayed recall evidence</h1>
      <p className={styles.lede}>
        The delayed item links to its source passage and scores strictly from its own
        correct/total - a perfect immediate comprehension score never inflates the separately
        computed retention score.
      </p>

      <section className={styles.stageCard} data-testid="delayed-recall-evidence">
        <p data-testid="source-passage">Source passage: {evidence.sourcePassageId}</p>
        <p data-testid="delay-bucket">Delay bucket: {evidence.delayBucket ?? "none"}</p>
        <p data-testid="immediate-score">
          Immediate score: {evidence.immediateScore === null ? "none" : `${Math.round(evidence.immediateScore * 100)}%`}
        </p>
        <p data-testid="retention-score">
          Retention score: {evidence.retentionScore === null ? "none" : `${Math.round(evidence.retentionScore * 100)}%`}
        </p>
        <p data-testid="delay-seconds-bucket-check">Classified bucket for {delaySeconds}s: {classifyDelayBucket(delaySeconds)}</p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primaryButton}
            data-testid="lower-delayed-score"
            disabled={delayedCorrect === 0}
            onClick={() => setDelayedCorrect((previous) => Math.max(0, previous - 1))}
          >
            Record a missed delayed item
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            data-testid="raise-delayed-score"
            disabled={delayedCorrect === 5}
            onClick={() => setDelayedCorrect((previous) => Math.min(5, previous + 1))}
          >
            Record a correct delayed item
          </button>
        </div>
      </section>
    </main>
  );
}
