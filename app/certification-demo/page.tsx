"use client";

// SR-R2-001: Certified Reading Rate.
// SR-R2-002: Independent confirmation.
// A reachable demo composing both: a challenge WPM only certifies once enough distinct forms
// have each independently passed - the same form/version passed repeatedly never counts twice,
// and the CRR only moves once that independent-confirmation bar is actually cleared.

import { useState } from "react";
import {
  CertificationRateState,
  ConfirmationTracker,
  isReadyToCertify,
  recordChallengeAttempt,
  recordConfirmation,
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

  function submitConfirmation(passed: boolean) {
    const nextTracker = recordConfirmation(tracker, formId, passed);
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
        forms (SR-R2-002). Attempting - even passing - never certifies the CRR by itself, and
        passing the same form repeatedly never counts as more than one confirmation (SR-R2-001).
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
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondaryButton}
            data-testid="confirmation-fail"
            onClick={() => submitConfirmation(false)}
          >
            Submit failing attempt on this form
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            data-testid="confirmation-pass"
            onClick={() => submitConfirmation(true)}
          >
            Submit passing attempt on this form
          </button>
        </div>
      </section>
    </main>
  );
}
