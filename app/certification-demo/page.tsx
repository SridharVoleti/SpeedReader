"use client";

// SR-R2-001: Certified Reading Rate.
// SR-R2-002: Independent confirmation.
// SR-R2-003: Certification gate composition.
// A reachable demo composing all three: a submitted form only counts toward independent
// confirmation once exposure validity, comprehension PASS and evidence sufficiency all pass -
// any one gate failing (including a technically invalid exposure) blocks that confirmation, and
// the CRR only moves once enough distinct forms have cleared every gate.

import { useState } from "react";
import {
  allGatesPassed,
  CertificationRateState,
  ConfirmationTracker,
  GateResults,
  isReadyToCertify,
  recordChallengeAttempt,
  recordConfirmationWithGates,
  startConfirmationTracker
} from "../../lib/certification";
import styles from "../page.module.css";

const REQUIRED_CONFIRMATIONS = 3;
const CHALLENGE_WPM = 150;

export default function CertificationDemoPage() {
  const [crr, setCrr] = useState<CertificationRateState>({ certifiedWpm: 100, challengeWpm: null });
  const [tracker, setTracker] = useState<ConfirmationTracker>(
    startConfirmationTracker(CHALLENGE_WPM, REQUIRED_CONFIRMATIONS)
  );
  const [formId, setFormId] = useState("form-a");
  const [gates, setGates] = useState<GateResults>({
    exposureValid: true,
    comprehensionPassed: true,
    evidenceSufficient: true
  });

  function submitConfirmation() {
    const nextTracker = recordConfirmationWithGates(tracker, formId, gates);
    setTracker(nextTracker);

    if (isReadyToCertify(nextTracker) && !isReadyToCertify(tracker)) {
      setCrr((previous) => recordChallengeAttempt(previous, nextTracker.challengeWpm, true));
    }
  }

  return (
    <main className={styles.shell} data-testid="certification-demo">
      <h1>Certified Reading Rate</h1>
      <p className={styles.lede}>
        Certifying {CHALLENGE_WPM} WPM requires {REQUIRED_CONFIRMATIONS} independent confirming
        forms (SR-R2-002), and every confirmation must itself clear all three gates - exposure
        validity, comprehension PASS and evidence sufficiency (SR-R2-003). Any one gate failing
        blocks that confirmation; a passing attempt on the same form repeatedly still only
        counts once, and the CRR never moves until certification genuinely completes (SR-R2-001).
      </p>

      <section className={styles.stageCard} data-testid="certification-state">
        <p data-testid="certified-wpm">Certified Reading Rate: {crr.certifiedWpm} WPM</p>
        <p data-testid="confirmation-count">
          Confirmations: {tracker.confirmedFormIds.length}/{tracker.requiredConfirmations}
        </p>
        <p data-testid="confirmed-forms">Confirmed forms: {tracker.confirmedFormIds.join(", ") || "none"}</p>
      </section>

      <section className={styles.stageCard}>
        <label style={{ display: "block", marginBottom: 12 }}>
          Form ID:{" "}
          <input
            type="text"
            data-testid="form-id-input"
            value={formId}
            onChange={(event) => setFormId(event.target.value)}
          />
        </label>

        <label style={{ display: "block", marginBottom: 6 }}>
          <input
            type="checkbox"
            data-testid="gate-exposure-valid"
            checked={gates.exposureValid}
            onChange={(event) => setGates({ ...gates, exposureValid: event.target.checked })}
          />{" "}
          Exposure valid (not a technical interruption)
        </label>
        <label style={{ display: "block", marginBottom: 6 }}>
          <input
            type="checkbox"
            data-testid="gate-comprehension-passed"
            checked={gates.comprehensionPassed}
            onChange={(event) => setGates({ ...gates, comprehensionPassed: event.target.checked })}
          />{" "}
          Comprehension PASS
        </label>
        <label style={{ display: "block", marginBottom: 12 }}>
          <input
            type="checkbox"
            data-testid="gate-evidence-sufficient"
            checked={gates.evidenceSufficient}
            onChange={(event) => setGates({ ...gates, evidenceSufficient: event.target.checked })}
          />{" "}
          Evidence sufficient
        </label>

        <p data-testid="gates-summary" className={styles.stageHint}>
          {allGatesPassed(gates) ? "All gates pass" : "At least one gate fails"}
        </p>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primaryButton}
            data-testid="submit-confirmation"
            onClick={submitConfirmation}
          >
            Submit confirmation attempt
          </button>
        </div>
      </section>
    </main>
  );
}
