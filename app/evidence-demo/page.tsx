"use client";

// SR-R3-001: Evidence proposition schema.
// A reachable demo of Comprehension Engine v2's proposition-based scoring: a mandatory
// proposition is authored with several accepted expression variants and explicit contradiction
// expressions, and a free-text response is matched against it deterministically.

import { useState } from "react";
import { matchProposition, normalizeEvidenceText, Proposition } from "../../lib/evidence-scoring";
import styles from "../page.module.css";

const PROPOSITION: Proposition = {
  propositionId: "p-honesty",
  canonicalText: "Ravi returned the extra change",
  mandatory: true,
  acceptedExpressions: ["returned the extra change", "gave back the extra money", "returned the coins"],
  contradictionExpressions: ["kept the extra change", "did not return", "never returned"]
};

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
    </main>
  );
}
