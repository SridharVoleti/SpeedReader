"use client";

// SR-R5-001: RS competency integration.
// A reachable demo proving attribution is purely data-driven: two entirely different content
// sets (different passage/item IDs) both attribute correctly using the same generic function.

import { attributeEvidenceToRs, RsTaggedItem } from "../../lib/reading-skill-diagnosis";
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

export default function RsDiagnosisDemoPage() {
  const attributedA = attributeEvidenceToRs(CONTENT_SET_A_RESULTS, CONTENT_SET_A_TAGS);
  const attributedB = attributeEvidenceToRs(CONTENT_SET_B_RESULTS, CONTENT_SET_B_TAGS);

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
    </main>
  );
}
