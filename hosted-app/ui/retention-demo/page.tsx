"use client";

// SR-R8-001: Delayed recall evidence.
// A reachable demo proving the delayed item links to its source passage and is scored purely
// from its own correct/total - a perfect immediate score never influences the retention score.

import { useState } from "react";
import {
  classifyDelayBucket,
  classifyRetentionState,
  evaluateAdvancedCertification,
  recordRetentionEvidence,
  RetentionState,
  selectTransferEvidence,
  TransferCandidateContent
} from "../../lib/retention";
import styles from "../page.module.css";

const RETENTION_PASS_THRESHOLD = 0.7;

// SR-R8-003: Unfamiliar-content transfer.
const TRANSFER_CANDIDATES: TransferCandidateContent[] = [
  { contentId: "passage-trained-1", topicFamily: "animals" },
  { contentId: "passage-novel-1", topicFamily: "space" }
];

export default function RetentionDemoPage() {
  const [delayedCorrect, setDelayedCorrect] = useState(2);
  const delayed = { correct: delayedCorrect, total: 5 };
  const immediate = { correct: 5, total: 5 };
  const delaySeconds = 50000;

  const evidence = recordRetentionEvidence("level1_001", delaySeconds, immediate, delayed);

  // SR-R8-002: Retained comprehension.
  const [retentionRequired, setRetentionRequired] = useState(true);
  const retentionState: RetentionState = classifyRetentionState(evidence.retentionScore, RETENTION_PASS_THRESHOLD);
  const certification = evaluateAdvancedCertification({
    immediatePassed: true,
    retentionState,
    retentionRequired
  });

  // SR-R8-003: Unfamiliar-content transfer.
  const [allTopicsRecentlyTrained, setAllTopicsRecentlyTrained] = useState(false);
  const recentlyTrainedTopicFamilies = allTopicsRecentlyTrained ? ["animals", "space"] : ["animals"];
  const transferSelection = selectTransferEvidence(TRANSFER_CANDIDATES, recentlyTrainedTopicFamilies);

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

      <section className={styles.stageCard} data-testid="retained-comprehension">
        <p className={styles.kicker}>Retained comprehension (SR-R8-002)</p>
        <p className={styles.stageHint}>
          Immediate comprehension and retention are reported as distinct outcomes - a passing
          immediate result never compensates for a failing retention result when retention is
          configured as mandatory for advanced certification.
        </p>
        <p data-testid="immediate-result">Immediate: PASS</p>
        <p data-testid="retention-state">Retention: {retentionState}</p>
        <p data-testid="retention-required-state">Retention required: {retentionRequired ? "yes" : "no"}</p>
        <p data-testid="advanced-certification-result">
          Advanced certification: {certification.eligible ? "ELIGIBLE" : "WITHHELD"} ({certification.reasonCode})
        </p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primaryButton}
            data-testid="toggle-retention-required"
            onClick={() => setRetentionRequired((previous) => !previous)}
          >
            {retentionRequired ? "Make retention optional" : "Make retention mandatory"}
          </button>
        </div>
      </section>

      <section className={styles.stageCard} data-testid="unfamiliar-content-transfer">
        <p className={styles.kicker}>Unfamiliar-content transfer (SR-R8-003)</p>
        <p className={styles.stageHint}>
          A candidate whose topic family was recently trained cannot satisfy the transfer
          requirement - even when it's the only candidate left, it is excluded rather than
          reused.
        </p>
        <p data-testid="recently-trained-topics">
          Recently trained topics: {recentlyTrainedTopicFamilies.join(", ")}
        </p>
        <p data-testid="transfer-content">Transfer content: {transferSelection.contentId ?? "none"}</p>
        <p data-testid="transfer-reason">Reason: {transferSelection.reasonCode}</p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primaryButton}
            data-testid="toggle-all-topics-trained"
            onClick={() => setAllTopicsRecentlyTrained((previous) => !previous)}
          >
            {allTopicsRecentlyTrained ? "Untrain the space topic family" : "Also recently train the space topic family"}
          </button>
        </div>
      </section>
    </main>
  );
}
