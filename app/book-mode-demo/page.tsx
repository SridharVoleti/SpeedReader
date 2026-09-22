"use client";

// SR-R10-001: Book Challenge.
// A reachable demo proving a book challenge resumes/completes across multiple reading blocks,
// with total valid time/words always reconciling exactly with the block records (an invalid
// block contributes nothing).

import { useState } from "react";
import {
  addReadingBlock,
  BookCertificationGates,
  BookChallenge,
  BookCompletionReport,
  BookRateSource,
  buildCheckpointContribution,
  CheckpointEvidence,
  estimateBookEta,
  evaluateBookCertification,
  ReadingBlock,
  shouldTriggerCheckpoint,
  summarizeBookChallenge
} from "../../lib/book-mode";
import styles from "../page.module.css";

const BOOK_CERTIFICATION_GATES: BookCertificationGates = {
  comprehensionPassThreshold: 0.7,
  retentionPassThreshold: 0.7,
  retentionRequired: true
};

const CHECKPOINT_INTERVAL_PARAGRAPHS = 5;
const CHECKPOINT_EVIDENCE: CheckpointEvidence = {
  checkpointId: "cp-1",
  sectionId: "chapter-3",
  constructsAssessed: ["main-idea", "cause-effect"],
  correct: 4,
  total: 5
};

const INITIAL_BOOK: BookChallenge = { bookId: "book-1", totalWords: 1000, blocks: [] };

const BLOCKS_TO_ADD: ReadingBlock[] = [
  { blockId: "b1", startSeconds: 0, endSeconds: 300, wordsRead: 400, valid: true },
  { blockId: "b2", startSeconds: 500, endSeconds: 800, wordsRead: 400, valid: true },
  { blockId: "b3", startSeconds: 900, endSeconds: 1000, wordsRead: 200, valid: true }
];

export default function BookModeDemoPage() {
  const [challenge, setChallenge] = useState<BookChallenge>(INITIAL_BOOK);
  const summary = summarizeBookChallenge(challenge);

  function addNextBlock() {
    const nextBlock = BLOCKS_TO_ADD[challenge.blocks.length];
    if (!nextBlock) return;
    setChallenge((previous) => addReadingBlock(previous, nextBlock));
  }

  // SR-R10-002: Book ETA.
  const [rateSource, setRateSource] = useState<BookRateSource>("sustainable");
  const eta = estimateBookEta({
    remainingWords: 5000,
    peakCrrWpm: 350,
    sustainableWpm: 250,
    rateSource
  });

  // SR-R10-003: Section mental-model checks.
  const [paragraphsRead, setParagraphsRead] = useState(0);
  const checkpointTriggered = shouldTriggerCheckpoint(paragraphsRead, CHECKPOINT_INTERVAL_PARAGRAPHS);
  const checkpointContribution = buildCheckpointContribution(CHECKPOINT_EVIDENCE, 320);

  // SR-R10-004: Book-level certification.
  const [comprehensionScore, setComprehensionScore] = useState(0.4);
  const completionReport: BookCompletionReport = {
    actualMinutes: 40,
    effectiveWpm: 500,
    comprehensionScore,
    retentionScore: 0.9
  };
  const certification = evaluateBookCertification(completionReport, BOOK_CERTIFICATION_GATES);

  return (
    <main className={styles.shell} data-testid="book-mode-demo">
      <h1>Book Challenge</h1>
      <p className={styles.lede}>
        A book challenge resumes across reading blocks recorded over time - total valid time and
        words always reconcile exactly with the sum of the valid block records.
      </p>

      <section className={styles.stageCard} data-testid="book-challenge">
        <p data-testid="challenge-status">Status: {summary.status}</p>
        <p data-testid="blocks-recorded">Blocks recorded: {challenge.blocks.length}</p>
        <p data-testid="total-valid-words">Total valid words: {summary.totalValidWordsRead} / {summary.totalWords}</p>
        <p data-testid="total-valid-seconds">Total valid seconds: {summary.totalValidSeconds}</p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primaryButton}
            data-testid="add-reading-block"
            disabled={challenge.blocks.length >= BLOCKS_TO_ADD.length}
            onClick={addNextBlock}
          >
            Record next reading block (resume)
          </button>
        </div>
      </section>

      <section className={styles.stageCard} data-testid="book-eta">
        <p className={styles.kicker}>Book ETA (SR-R10-002)</p>
        <p className={styles.stageHint}>
          The ETA uses the configured book-rate source - a higher peak short-passage CRR never
          overrides it, however large.
        </p>
        <p data-testid="peak-crr-value">Peak CRR: 350 WPM</p>
        <p data-testid="sustainable-value">Sustainable rate: 250 WPM</p>
        <p data-testid="eta-rate-source">Rate source: {eta.rateSource}</p>
        <p data-testid="eta-wpm-used">WPM used: {eta.wpmUsed}</p>
        <p data-testid="eta-minutes">Estimated minutes: {eta.estimatedMinutes}</p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primaryButton}
            data-testid="toggle-rate-source"
            onClick={() => setRateSource((previous) => (previous === "sustainable" ? "peak_crr" : "sustainable"))}
          >
            {rateSource === "sustainable" ? "Configure book-rate source: peak CRR" : "Configure book-rate source: sustainable"}
          </button>
        </div>
      </section>

      <section className={styles.stageCard} data-testid="section-checkpoint">
        <p className={styles.kicker}>Section mental-model checks (SR-R10-003)</p>
        <p className={styles.stageHint}>
          A checkpoint only triggers at the configured section-level paragraph interval - never
          on every paragraph - and links to section-level constructs/evidence, contributing a
          comprehension score independent of reading speed.
        </p>
        <p data-testid="paragraphs-read">Paragraphs read: {paragraphsRead}</p>
        <p data-testid="checkpoint-triggered">Checkpoint triggered: {checkpointTriggered ? "yes" : "no"}</p>
        <p data-testid="checkpoint-section">Checkpoint section: {checkpointContribution.sectionId}</p>
        <p data-testid="checkpoint-constructs">Constructs assessed: {checkpointContribution.constructsAssessed.join(", ")}</p>
        <p data-testid="checkpoint-score">Comprehension score: {Math.round(checkpointContribution.comprehensionScore * 100)}%</p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primaryButton}
            data-testid="advance-paragraph"
            onClick={() => setParagraphsRead((previous) => previous + 1)}
          >
            Read next paragraph
          </button>
        </div>
      </section>

      <section className={styles.stageCard} data-testid="book-level-certification">
        <p className={styles.kicker}>Book-level certification (SR-R10-004)</p>
        <p className={styles.stageHint}>
          Actual time, effective rate, comprehension and retention are reported separately -
          a fast completion never buys its way past a failing comprehension gate.
        </p>
        <p data-testid="report-actual-minutes">Actual minutes: {certification.actualMinutes}</p>
        <p data-testid="report-effective-wpm">Effective rate: {certification.effectiveWpm} WPM</p>
        <p data-testid="report-comprehension">Comprehension: {Math.round(certification.comprehensionScore * 100)}%</p>
        <p data-testid="report-retention">Retention: {certification.retentionScore === null ? "none" : `${Math.round(certification.retentionScore * 100)}%`}</p>
        <p data-testid="certification-result">
          Book-level certification: {certification.certified ? "CERTIFIED" : "WITHHELD"} ({certification.reasonCode})
        </p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primaryButton}
            data-testid="raise-comprehension-score"
            onClick={() => setComprehensionScore(0.9)}
          >
            Raise comprehension to 90%
          </button>
        </div>
      </section>
    </main>
  );
}
