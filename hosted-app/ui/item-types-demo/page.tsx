"use client";

// SR-R1-005: Structured response types.
// A minimal, reachable demo authoring all four structured item types so the requirement's
// "authored/rendered/answered/scored" acceptance criteria can be exercised end to end in a real
// browser, independent of the main reading/comprehension flow.

import { useEffect, useMemo, useState } from "react";
import AssessmentItemView from "../components/AssessmentItemView";
import {
  appendAttemptLedgerEntry,
  AttemptLedgerEntry,
  buildAttemptLedgerEntry,
  loadAttemptLedger
} from "../../lib/attempt-ledger";
import {
  AssessmentItem,
  deriveAttemptOutcome,
  evaluateComprehension,
  ItemScoreResult,
  validateItemSequence
} from "../../lib/item-types";
import styles from "../page.module.css";

const PASS_THRESHOLD_PERCENT = 70;

// SR-R1-010: Question non-contamination.
// A deliberately contaminated authoring example - "reveals-answer" comes before the item whose
// evidence it reveals - shown alongside the same pair reordered so validation passes. These are
// static authoring examples only, never rendered/answered like the main demo items above.
const contaminatedSequence: AssessmentItem[] = [
  {
    itemId: "reveals-the-twist",
    itemType: "single_choice",
    constructId: "detail",
    mandatory: false,
    revealRisk: ["what-happens-next"],
    prompt: "The ending reveals that the coins were returned - true or false?",
    options: [{ id: "a", label: "True" }],
    correctOptionId: "a"
  },
  {
    itemId: "what-happens-next",
    itemType: "single_choice",
    constructId: "sequence_relationship",
    mandatory: false,
    prompt: "What do you predict happens next?",
    options: [{ id: "a", label: "The coins get returned" }],
    correctOptionId: "a"
  }
];
const correctedSequence: AssessmentItem[] = [contaminatedSequence[1], contaminatedSequence[0]];

const items: AssessmentItem[] = [
  {
    itemId: "demo-single-choice",
    itemType: "single_choice",
    constructId: "detail",
    mandatory: false,
    prompt: "Who returned the extra change in the story?",
    options: [
      { id: "a", label: "Ravi" },
      { id: "b", label: "The shopkeeper" },
      { id: "c", label: "Meera" }
    ],
    correctOptionId: "a"
  },
  {
    itemId: "demo-ordering",
    itemType: "ordering",
    constructId: "sequence_relationship",
    mandatory: false,
    prompt: "Put these events in the order they happened.",
    items: [
      { id: "1", label: "Ravi buys items at the shop" },
      { id: "2", label: "The shopkeeper gives extra change by mistake" },
      { id: "3", label: "Ravi returns the extra coins" }
    ],
    correctOrderIds: ["1", "2", "3"]
  },
  {
    itemId: "demo-matching",
    itemType: "matching",
    constructId: "detail",
    mandatory: false,
    prompt: "Match each character to their role.",
    left: [
      { id: "l1", label: "Ravi" },
      { id: "l2", label: "Shopkeeper" }
    ],
    right: [
      { id: "r1", label: "Customer" },
      { id: "r2", label: "Shop owner" }
    ],
    correctPairs: { l1: "r1", l2: "r2" }
  },
  {
    itemId: "demo-short-answer",
    itemType: "constrained_short_answer",
    constructId: "main_idea",
    // SR-R1-007: mandatory gate - this main-idea item is non-compensable, matching TC-R1-007-B
    // ("mandatory main idea; easy details available").
    mandatory: true,
    prompt: "In a few words, what did Ravi do when he noticed the mistake?",
    minimumResponseWords: 3,
    requiredKeywords: ["returned"]
  }
];

export default function ItemTypesDemoPage() {
  const [results, setResults] = useState<Record<string, ItemScoreResult>>({});
  const [interrupted, setInterrupted] = useState(false);
  const [ledger, setLedger] = useState<AttemptLedgerEntry[]>([]);

  useEffect(() => {
    setLedger(loadAttemptLedger());
  }, []);

  function handleScored(result: ItemScoreResult) {
    setResults((previous) => ({ ...previous, [result.itemId]: result }));
  }

  const allAnswered = items.every((item) => results[item.itemId]);
  const evaluation = allAnswered
    ? evaluateComprehension(items, Object.values(results), PASS_THRESHOLD_PERCENT)
    : null;
  // SR-R1-012: Outcome separation - a technically interrupted attempt is its own INVALID
  // outcome, never conflated with a genuine PASS/HOLD comprehension result.
  const attemptOutcome = useMemo(
    () =>
      allAnswered
        ? deriveAttemptOutcome(items, Object.values(results), PASS_THRESHOLD_PERCENT, { interrupted })
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allAnswered, results, interrupted]
  );

  // SR-R1-014: Raw attempt ledger - every completed attempt (including invalid ones) is
  // appended as its own immutable entry, never overwriting or summarizing away raw evidence.
  useEffect(() => {
    if (!attemptOutcome) return;
    const entry = buildAttemptLedgerEntry({
      attemptId: typeof crypto !== "undefined" ? crypto.randomUUID() : `demo-${Date.now()}`,
      contentId: "item-types-demo",
      contentVersion: "1.0",
      mode: "structured-items",
      rawResponses: results,
      itemOutcomes: Object.values(results),
      attemptEvaluation: attemptOutcome
    });
    setLedger(appendAttemptLedgerEntry(entry));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptOutcome]);

  return (
    <main className={styles.shell} data-testid="item-types-demo">
      <h1>Structured response types</h1>
      <p className={styles.lede}>
        Single choice, ordering, matching and constrained short answer - each authored,
        rendered, answered and scored deterministically. The short-answer item is a mandatory
        gate: getting it wrong blocks an overall PASS even if the aggregate score clears the
        threshold (SR-R1-007).
      </p>
      <label style={{ display: "block", margin: "12px 0" }}>
        <input
          type="checkbox"
          data-testid="simulate-interruption"
          checked={interrupted}
          onChange={(event) => setInterrupted(event.target.checked)}
        />{" "}
        Simulate a technical interruption (SR-R1-012)
      </label>

      {items.map((item) => (
        <section className={styles.stageCard} key={item.itemId}>
          <AssessmentItemView item={item} onScored={handleScored} />
        </section>
      ))}
      {evaluation && (
        <section className={styles.stageCard} data-testid="comprehension-evaluation">
          <p className={styles.kicker}>Overall comprehension</p>
          <p data-testid="aggregate-score">Aggregate score: {evaluation.aggregateScore}%</p>
          <p data-testid="comprehension-state">{evaluation.comprehensionState}</p>
          <p data-testid="reason-code">{evaluation.reasonCode}</p>
        </section>
      )}
      {attemptOutcome && (
        <section className={styles.stageCard} data-testid="attempt-outcome">
          <p className={styles.kicker}>Attempt outcome (SR-R1-012)</p>
          <p data-testid="attempt-outcome-value">{attemptOutcome.attemptOutcome}</p>
          <p data-testid="attempt-outcome-reason">{attemptOutcome.reasonCode}</p>
        </section>
      )}

      <section className={styles.stageCard} data-testid="attempt-ledger">
        <p className={styles.kicker}>Raw attempt ledger (SR-R1-014)</p>
        <p data-testid="ledger-count">Ledger entries: {ledger.length}</p>
        {ledger.length > 0 && (
          <p data-testid="ledger-latest-decision">Latest decision: {ledger[ledger.length - 1].decision}</p>
        )}
      </section>

      <section className={styles.stageCard} data-testid="sequence-validation">
        <p className={styles.kicker}>Question non-contamination (SR-R1-010)</p>
        <p className={styles.stageHint}>
          An item that reveals another item&apos;s answer must come after it in item_order.
        </p>
        <p data-testid="contaminated-sequence-result">
          {validateItemSequence(contaminatedSequence).valid ? "valid" : "invalid"}
        </p>
        <p data-testid="corrected-sequence-result">
          {validateItemSequence(correctedSequence).valid ? "valid" : "invalid"}
        </p>
      </section>
    </main>
  );
}
