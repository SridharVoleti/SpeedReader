"use client";

// SR-R3-001: Evidence proposition schema.
// A reachable demo of Comprehension Engine v2's proposition-based scoring: a mandatory
// proposition is authored with several accepted expression variants and explicit contradiction
// expressions, and a free-text response is matched against it deterministically.

import { useState } from "react";
import {
  EquivalenceGroup,
  matchProposition,
  matchPropositionWithGroups,
  normalizeEvidenceText,
  Proposition
} from "../../lib/evidence-scoring";
import styles from "../page.module.css";

const PROPOSITION: Proposition = {
  propositionId: "p-honesty",
  canonicalText: "Ravi returned the extra change",
  mandatory: true,
  acceptedExpressions: ["returned the extra change", "gave back the extra money", "returned the coins"],
  contradictionExpressions: ["kept the extra change", "did not return", "never returned"]
};

// SR-R3-002: File-based semantic equivalence.
const HONESTY_GROUP: EquivalenceGroup = {
  equivalenceGroupId: "eq-honesty",
  expressions: ["returned the extra change he had been given by mistake", "gave back the money", "gave it back"]
};
const GROUPED_PROPOSITION = {
  propositionId: PROPOSITION.propositionId,
  canonicalText: PROPOSITION.canonicalText,
  mandatory: PROPOSITION.mandatory,
  equivalenceGroups: [HONESTY_GROUP],
  contradictionExpressions: PROPOSITION.contradictionExpressions
};
const GOLD_RESPONSE = "He politely returned the extra change he had been given by mistake.";
const CHILD_RESPONSE = "he gave it back";

export default function EvidenceDemoPage() {
  const [responseText, setResponseText] = useState("");

  const words = normalizeEvidenceText(responseText);
  const result = matchProposition(PROPOSITION, words);

  return (
    <main className={styles.shell} data-testid="evidence-demo">
      <h1>Evidence proposition schema</h1>
      <p className={styles.lede}>
        Comprehension Engine v2 (R3) scores against authored propositions - a canonical
        statement with several accepted expression variants and explicit contradiction phrases -
        instead of a flat keyword list.
      </p>

      <section className={styles.stageCard} data-testid="proposition-card">
        <p data-testid="proposition-text">Proposition: {PROPOSITION.canonicalText}</p>
        <p data-testid="proposition-mandatory">{PROPOSITION.mandatory ? "Mandatory" : "Optional"}</p>
        <p data-testid="accepted-expressions">
          Accepted expressions: {PROPOSITION.acceptedExpressions.join(" | ")}
        </p>
      </section>

      <section className={styles.stageCard}>
        <textarea
          data-testid="response-text"
          rows={3}
          value={responseText}
          onChange={(event) => setResponseText(event.target.value)}
          placeholder="Type a response..."
        />
        <p data-testid="match-result">
          {result.matched ? "matched" : result.contradicted ? "contradicted" : "no evidence"}
        </p>
      </section>

      <section className={styles.stageCard} data-testid="equivalence-demo">
        <p className={styles.kicker}>Semantic equivalence (SR-R3-002)</p>
        <p className={styles.stageHint}>
          A polished gold paraphrase and a short child-level response in the same authored
          equivalence group receive the identical result.
        </p>
        {(() => {
          const goldResult = matchPropositionWithGroups(GROUPED_PROPOSITION, normalizeEvidenceText(GOLD_RESPONSE));
          const childResult = matchPropositionWithGroups(GROUPED_PROPOSITION, normalizeEvidenceText(CHILD_RESPONSE));
          return (
            <>
              <p data-testid="gold-response-result">
                Gold: &quot;{GOLD_RESPONSE}&quot; -&gt; {goldResult.matched ? "matched" : "no match"} (group{" "}
                {goldResult.matchedGroupId ?? "none"})
              </p>
              <p data-testid="child-response-result">
                Child: &quot;{CHILD_RESPONSE}&quot; -&gt; {childResult.matched ? "matched" : "no match"} (group{" "}
                {childResult.matchedGroupId ?? "none"})
              </p>
              <p data-testid="equivalence-outcome">
                {goldResult.matched === childResult.matched && goldResult.matchedGroupId === childResult.matchedGroupId
                  ? "equivalent credit"
                  : "different credit"}
              </p>
            </>
          );
        })()}
      </section>
    </main>
  );
}
