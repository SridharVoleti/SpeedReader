"use client";

// SR-R5-001: RS competency integration.
// A reachable demo proving attribution is purely data-driven: two entirely different content
// sets (different passage/item IDs) both attribute correctly using the same generic function.

import { useState } from "react";
import {
  attributeEvidenceToRs,
  diagnoseBottleneck,
  evaluateReadiness,
  GateState,
  RsAttributedEvidence,
  RsTaggedItem
} from "../../lib/reading-skill-diagnosis";
import styles from "../page.module.css";

const CONTENT_SET_A_TAGS: RsTaggedItem[] = [
  { itemId: "level1_001-i1", rsId: "RS-VOCABULARY", evidenceTag: "keyword-recognition" },
  { itemId: "level1_001-i2", rsId: "RS-INFERENCE", evidenceTag: "cause-effect-reasoning" }
];
const CONTENT_SET_A_RESULTS = [
  { itemId: "level1_001-i1", matched: true },
  { itemId: "level1_001-i2", matched: false }
];

const CONTENT_SET_B_TAGS: RsTaggedItem[] = [
  { itemId: "world3_042-q7", rsId: "RS-FLUENCY", evidenceTag: "phrase-recognition-speed" }
];
const CONTENT_SET_B_RESULTS = [{ itemId: "world3_042-q7", matched: true }];

const MINIMUM_EVIDENCE_COUNT = 5;
const FAILURE_RATE_THRESHOLD = 0.5;

export default function RsDiagnosisDemoPage() {
  const attributedA = attributeEvidenceToRs(CONTENT_SET_A_RESULTS, CONTENT_SET_A_TAGS);
  const attributedB = attributeEvidenceToRs(CONTENT_SET_B_RESULTS, CONTENT_SET_B_TAGS);

  // SR-R5-002: Bottleneck reason codes.
  const [inferenceEvidence, setInferenceEvidence] = useState<RsAttributedEvidence[]>([]);

  function addEvidence(matched: boolean) {
    setInferenceEvidence((previous) => [
      ...previous,
      { rsId: "RS-INFERENCE", evidenceTag: "cause-effect-reasoning", itemId: `attempt-${previous.length}`, matched }
    ]);
  }

  const diagnosis = diagnoseBottleneck(inferenceEvidence, "RS-INFERENCE", MINIMUM_EVIDENCE_COUNT, FAILURE_RATE_THRESHOLD);

  // SR-R5-003: Independent oral/comprehension gates.
  const [oralState, setOralState] = useState<GateState>("PASS");
  const [comprehensionState, setComprehensionState] = useState<GateState>("FAIL");
  const readiness = evaluateReadiness(oralState, comprehensionState, true);

  return (
    <main className={styles.shell} data-testid="rs-diagnosis-demo">
      <h1>RS competency integration</h1>
      <p className={styles.lede}>
        Attempt evidence attributes to its authored Reading Skill (RS) competency purely from
        content-file tag data - the attribution function never hard-codes a specific passage or
        item ID.
      </p>

      <section className={styles.stageCard} data-testid="content-set-a">
        <p className={styles.kicker}>Content set A (level1_001)</p>
        {attributedA.map((evidence) => (
          <p key={evidence.itemId} data-testid={`attribution-${evidence.itemId}`}>
            {evidence.itemId} -&gt; {evidence.rsId} ({evidence.evidenceTag}):{" "}
            {evidence.matched ? "matched" : "not matched"}
          </p>
        ))}
      </section>

      <section className={styles.stageCard} data-testid="content-set-b">
        <p className={styles.kicker}>Content set B (world3_042 - unrelated content)</p>
        {attributedB.map((evidence) => (
          <p key={evidence.itemId} data-testid={`attribution-${evidence.itemId}`}>
            {evidence.itemId} -&gt; {evidence.rsId} ({evidence.evidenceTag}):{" "}
            {evidence.matched ? "matched" : "not matched"}
          </p>
        ))}
      </section>

      <section className={styles.stageCard} data-testid="bottleneck-diagnosis">
        <p className={styles.kicker}>Bottleneck reason codes (SR-R5-002)</p>
        <p className={styles.stageHint}>
          Diagnosis requires at least {MINIMUM_EVIDENCE_COUNT} pieces of evidence for RS-INFERENCE
          before returning anything but INSUFFICIENT_EVIDENCE.
        </p>
        <p data-testid="evidence-count">Evidence count: {diagnosis.evidenceCount}</p>
        <p data-testid="bottleneck-code">Bottleneck code: {diagnosis.bottleneckCode}</p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primaryButton}
            data-testid="add-failed-evidence"
            onClick={() => addEvidence(false)}
          >
            Add failed attempt
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            data-testid="add-matched-evidence"
            onClick={() => addEvidence(true)}
          >
            Add matched attempt
          </button>
        </div>
      </section>

      <section className={styles.stageCard} data-testid="independent-gates">
        <p className={styles.kicker}>Independent oral/comprehension gates (SR-R5-003)</p>
        <p className={styles.stageHint}>
          When both gates are required, neither a passing oral gate nor a passing comprehension
          gate compensates for the other one failing.
        </p>
        <label style={{ display: "block", marginBottom: 6 }}>
          Oral state:{" "}
          <select
            data-testid="oral-state-select"
            value={oralState}
            onChange={(event) => setOralState(event.target.value as GateState)}
          >
            <option value="PASS">PASS</option>
            <option value="FAIL">FAIL</option>
          </select>
        </label>
        <label style={{ display: "block", marginBottom: 12 }}>
          Comprehension state:{" "}
          <select
            data-testid="comprehension-state-select"
            value={comprehensionState}
            onChange={(event) => setComprehensionState(event.target.value as GateState)}
          >
            <option value="PASS">PASS</option>
            <option value="FAIL">FAIL</option>
          </select>
        </label>
        <p data-testid="readiness-result">Ready: {readiness.ready ? "yes" : "no"}</p>
        <p data-testid="readiness-reason">Reason: {readiness.reasonCode}</p>
      </section>
    </main>
  );
}
