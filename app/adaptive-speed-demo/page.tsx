"use client";

// SR-R4-001: Adaptive speed governor.
// A reachable demo of the deterministic next-WPM decision: pick a comprehension outcome for the
// current challenge attempt and watch the governor choose the next target WPM and reason code.

import { useState } from "react";
import {
  AttemptOutcome,
  decideNextTargetWpm,
  FrontierEvidence,
  FrontierState,
  nextFrontierState,
  resolveChallengeAttempt,
  SpeedDecisionInput
} from "../../lib/adaptive-speed";
import { CertificationRateState } from "../../lib/certification";
import styles from "../page.module.css";

const CERTIFIED_WPM = 150;
const CHALLENGE_WPM = 200;
const INCREMENT_WPM = 20;
const INITIAL_FRONTIER_STATE: FrontierState = { stepSize: 10, minStepSize: 5, maxStepSize: 80 };

export default function AdaptiveSpeedDemoPage() {
  const [attemptOutcome, setAttemptOutcome] = useState<AttemptOutcome>("PASS");
  const [frontierState, setFrontierState] = useState<FrontierState>(INITIAL_FRONTIER_STATE);
  const [stepHistory, setStepHistory] = useState<number[]>([INITIAL_FRONTIER_STATE.stepSize]);

  function submitEvidence(evidence: FrontierEvidence) {
    setFrontierState((previous) => {
      const next = nextFrontierState(previous, evidence);
      setStepHistory((history) => [...history, next.stepSize]);
      return next;
    });
  }

  // SR-R4-003: Invalid attempts do not penalize (TC-R4-003-B: CRR=200, challenge=220).
  const [invalidDemoCrr, setInvalidDemoCrr] = useState<CertificationRateState>({
    certifiedWpm: 200,
    challengeWpm: 220
  });
  const [invalidDemoReasonCode, setInvalidDemoReasonCode] = useState<string | null>(null);

  function submitInvalidDemoAttempt(outcome: AttemptOutcome) {
    const result = resolveChallengeAttempt(invalidDemoCrr, outcome, 20);
    setInvalidDemoCrr(result.crrState);
    setInvalidDemoReasonCode(result.decision.reasonCode);
  }

  const input: SpeedDecisionInput = {
    certifiedWpm: CERTIFIED_WPM,
    challengeWpm: CHALLENGE_WPM,
    attemptOutcome,
    incrementWpm: INCREMENT_WPM
  };
  const decision = decideNextTargetWpm(input);

  return (
    <main className={styles.shell} data-testid="adaptive-speed-demo">
      <h1>Adaptive speed governor</h1>
      <p className={styles.lede}>
        The next target WPM is chosen deterministically from the Certified Reading Rate, the
        challenge WPM just attempted, and the comprehension outcome - never randomized.
      </p>

      <section className={styles.stageCard} data-testid="governor-state">
        <p data-testid="certified-wpm">Certified Reading Rate: {CERTIFIED_WPM} WPM</p>
        <p data-testid="challenge-wpm">Challenge WPM attempted: {CHALLENGE_WPM} WPM</p>
      </section>

      <section className={styles.stageCard}>
        <label style={{ display: "block", marginBottom: 12 }}>
          Comprehension outcome:{" "}
          <select
            data-testid="outcome-select"
            value={attemptOutcome}
            onChange={(event) => setAttemptOutcome(event.target.value as AttemptOutcome)}
          >
            <option value="PASS">PASS</option>
            <option value="HOLD">HOLD</option>
            <option value="INVALID">INVALID</option>
          </select>
        </label>
        <p data-testid="next-target-wpm">Next target WPM: {decision.nextTargetWpm}</p>
        <p data-testid="reason-code">Reason code: {decision.reasonCode}</p>
      </section>

      <section className={styles.stageCard} data-testid="frontier-search">
        <p className={styles.kicker}>Frontier search (SR-R4-002)</p>
        <p className={styles.stageHint}>
          The step size doubles on a comfortable pass and halves on borderline/failure evidence,
          converging on the comprehension frontier instead of overshooting at a fixed increment.
        </p>
        <p data-testid="step-size">Current step size: {frontierState.stepSize}</p>
        <p data-testid="step-history">History: {stepHistory.join(" -> ")}</p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primaryButton}
            data-testid="evidence-comfortable-pass"
            onClick={() => submitEvidence("comfortable_pass")}
          >
            Comfortable pass
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            data-testid="evidence-borderline-pass"
            onClick={() => submitEvidence("borderline_pass")}
          >
            Borderline pass
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            data-testid="evidence-fail"
            onClick={() => submitEvidence("fail")}
          >
            Fail
          </button>
        </div>
      </section>

      <section className={styles.stageCard} data-testid="invalid-attempts-demo">
        <p className={styles.kicker}>Invalid attempts do not penalize (SR-R4-003)</p>
        <p className={styles.stageHint}>
          An injected technical interruption never lowers the CRR and is never treated as a
          comprehension failure - it selects a retry instead.
        </p>
        <p data-testid="invalid-demo-crr">Certified Reading Rate: {invalidDemoCrr.certifiedWpm} WPM</p>
        {invalidDemoReasonCode && (
          <p data-testid="invalid-demo-reason">Last decision reason: {invalidDemoReasonCode}</p>
        )}
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondaryButton}
            data-testid="invalid-demo-submit-invalid"
            onClick={() => submitInvalidDemoAttempt("INVALID")}
          >
            Inject technical interruption
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            data-testid="invalid-demo-submit-pass"
            onClick={() => submitInvalidDemoAttempt("PASS")}
          >
            Submit a genuine PASS
          </button>
        </div>
      </section>
    </main>
  );
}
