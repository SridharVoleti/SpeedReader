"use client";

// SR-R7-001: Duration-band measurement.
// A reachable demo proving the measurement only ever counts the full valid interval: adding a
// technical-interruption segment (invalid) never changes the duration band, sustained WPM or
// comprehension rate.

import { useState } from "react";
import { recordChallengeAttempt, CertificationRateState } from "../../lib/certification";
import {
  detectFatigueSignals,
  measureSustainedPerformance,
  ReadingSegment,
  recordSustainedAttempt,
  SegmentMetric,
  startSustainableRate,
  SustainedEvidenceGates
} from "../../lib/sustained-reading";
import styles from "../page.module.css";

const VALID_SEGMENTS: ReadingSegment[] = [
  { startSeconds: 0, endSeconds: 140, wordsRead: 280, valid: true, comprehensionCorrect: 4, comprehensionTotal: 5 },
  { startSeconds: 140, endSeconds: 260, wordsRead: 240, valid: true, comprehensionCorrect: 5, comprehensionTotal: 5 }
];

const INTERRUPTION_SEGMENT: ReadingSegment = {
  startSeconds: 260,
  endSeconds: 500,
  wordsRead: 100,
  valid: false,
  comprehensionCorrect: 0,
  comprehensionTotal: 0
};

const PASSING_SUSTAINED_GATES: SustainedEvidenceGates = { durationBandMet: true, comprehensionPassed: true };

// SR-R7-003: Fatigue/stability indicators.
const STABLE_SEGMENT_HISTORY: SegmentMetric[] = [
  { segmentIndex: 0, wpm: 200, comprehensionRate: 0.9 },
  { segmentIndex: 1, wpm: 195, comprehensionRate: 0.9 },
  { segmentIndex: 2, wpm: 198, comprehensionRate: 0.85 }
];

const DEGRADING_SEGMENT_HISTORY: SegmentMetric[] = [
  { segmentIndex: 0, wpm: 240, comprehensionRate: 0.95 },
  { segmentIndex: 1, wpm: 180, comprehensionRate: 0.7 },
  { segmentIndex: 2, wpm: 140, comprehensionRate: 0.55 }
];

export default function SustainedReadingDemoPage() {
  const [hasInterruption, setHasInterruption] = useState(false);

  const measurement = measureSustainedPerformance({
    segments: hasInterruption ? [...VALID_SEGMENTS, INTERRUPTION_SEGMENT] : VALID_SEGMENTS
  });

  // SR-R7-002: Sustainable Reading Rate.
  const [crrState, setCrrState] = useState<CertificationRateState>({ certifiedWpm: 240, challengeWpm: null });
  const [sustainableState, setSustainableState] = useState(() =>
    recordSustainedAttempt(startSustainableRate(), 240, PASSING_SUSTAINED_GATES)
  );

  // SR-R7-003: Fatigue/stability indicators.
  const [historyIsDegrading, setHistoryIsDegrading] = useState(false);
  const fatigueState = detectFatigueSignals(historyIsDegrading ? DEGRADING_SEGMENT_HISTORY : STABLE_SEGMENT_HISTORY);

  return (
    <main className={styles.shell} data-testid="sustained-reading-demo">
      <h1>Duration-band measurement</h1>
      <p className={styles.lede}>
        Duration band, sustained WPM and comprehension rate are computed purely over the full
        valid interval - a technical interruption segment never counts toward or against the
        measurement.
      </p>

      <section className={styles.stageCard} data-testid="duration-band-measurement">
        <p data-testid="duration-band">Duration band: {measurement.durationBand ?? "none"}</p>
        <p data-testid="sustained-wpm">Sustained WPM: {measurement.sustainedWpm}</p>
        <p data-testid="comprehension-rate">
          Comprehension rate: {measurement.comprehensionRate === null ? "none" : `${Math.round(measurement.comprehensionRate * 100)}%`}
        </p>
        <p data-testid="interruption-state">
          Interruption segment: {hasInterruption ? "present" : "absent"}
        </p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primaryButton}
            data-testid="toggle-interruption"
            onClick={() => setHasInterruption((previous) => !previous)}
          >
            {hasInterruption ? "Remove interruption segment" : "Add technical interruption segment"}
          </button>
        </div>
      </section>

      <section className={styles.stageCard} data-testid="sustainable-reading-rate">
        <p className={styles.kicker}>Sustainable Reading Rate (SR-R7-002)</p>
        <p className={styles.stageHint}>
          The sustainable rate is maintained separately from the short-passage Certified Reading
          Rate (CRR) - certifying a higher short-passage CRR never raises it on its own; it only
          moves through its own passing sustained-reading evidence.
        </p>
        <p data-testid="crr-value">Short-passage CRR: {crrState.certifiedWpm}</p>
        <p data-testid="sustainable-wpm-value">Sustainable rate: {sustainableState.sustainableWpm}</p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primaryButton}
            data-testid="certify-short-crr"
            onClick={() => setCrrState((previous) => recordChallengeAttempt(previous, 300, true))}
          >
            Certify short-passage CRR to 300
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            data-testid="record-sustained-attempt"
            onClick={() => setSustainableState((previous) => recordSustainedAttempt(previous, 260, PASSING_SUSTAINED_GATES))}
          >
            Record passing sustained attempt at 260
          </button>
        </div>
      </section>

      <section className={styles.stageCard} data-testid="fatigue-stability-indicators">
        <p className={styles.kicker}>Fatigue/stability indicators (SR-R7-003)</p>
        <p className={styles.stageHint}>
          Within-session degradation is detected by comparing each comparable segment's peak
          value in the session to its final segment - a stable history produces no signals.
        </p>
        <p data-testid="fatigue-risk">Fatigue risk: {fatigueState.fatigueRisk ? "FATIGUE_RISK" : "none"}</p>
        <p data-testid="stability-drop">Stability drop: {fatigueState.stabilityDrop ? "STABILITY_DROP" : "none"}</p>
        <p data-testid="fatigue-signals">Signals: {fatigueState.signals.join(", ") || "none"}</p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primaryButton}
            data-testid="toggle-degrading-history"
            onClick={() => setHistoryIsDegrading((previous) => !previous)}
          >
            {historyIsDegrading ? "Use stable history" : "Use degrading history"}
          </button>
        </div>
      </section>
    </main>
  );
}
