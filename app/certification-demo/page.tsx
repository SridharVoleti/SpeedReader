"use client";

// SR-R2-001: Certified Reading Rate.
// A minimal, reachable demo of the CRR/challenge-WPM distinction: attempting a higher WPM alone
// never moves the Certified Reading Rate - only an explicit passing certification does.

import { useState } from "react";
import { CertificationRateState, recordChallengeAttempt } from "../../lib/certification";
import styles from "../page.module.css";

const INITIAL_STATE: CertificationRateState = { certifiedWpm: 100, challengeWpm: null };

export default function CertificationDemoPage() {
  const [state, setState] = useState<CertificationRateState>(INITIAL_STATE);
  const [challengeInput, setChallengeInput] = useState(150);

  function attempt(certificationPassed: boolean) {
    setState((previous) => recordChallengeAttempt(previous, challengeInput, certificationPassed));
  }

  return (
    <main className={styles.shell} data-testid="certification-demo">
      <h1>Certified Reading Rate</h1>
      <p className={styles.lede}>
        The Certified Reading Rate (CRR) is tracked separately from whatever WPM a learner is
        currently attempting (the challenge WPM). Attempting - even scoring well at - a higher
        WPM never moves the CRR by itself; only a passing certification does (SR-R2-001).
      </p>

      <section className={styles.stageCard} data-testid="certification-state">
        <p data-testid="certified-wpm">Certified Reading Rate: {state.certifiedWpm} WPM</p>
        <p data-testid="challenge-wpm">
          Challenge WPM: {state.challengeWpm ?? "none attempted yet"}
        </p>
      </section>

      <section className={styles.stageCard}>
        <label style={{ display: "block", marginBottom: 12 }}>
          Challenge WPM to attempt:{" "}
          <input
            type="number"
            data-testid="challenge-input"
            value={challengeInput}
            onChange={(event) => setChallengeInput(Number(event.target.value))}
          />
        </label>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondaryButton}
            data-testid="attempt-fail"
            onClick={() => attempt(false)}
          >
            Attempt without passing certification
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            data-testid="attempt-pass"
            onClick={() => attempt(true)}
          >
            Attempt and pass certification
          </button>
        </div>
      </section>
    </main>
  );
}
