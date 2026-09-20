"use client";

// SR-R1-005: Structured response types.
// A minimal, reachable demo authoring all four structured item types so the requirement's
// "authored/rendered/answered/scored" acceptance criteria can be exercised end to end in a real
// browser, independent of the main reading/comprehension flow.

import AssessmentItemView from "../components/AssessmentItemView";
import { AssessmentItem } from "../../lib/item-types";
import styles from "../page.module.css";

const items: AssessmentItem[] = [
  {
    itemId: "demo-single-choice",
    itemType: "single_choice",
    constructId: "detail",
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
    prompt: "In a few words, what did Ravi do when he noticed the mistake?",
    minimumResponseWords: 3,
    requiredKeywords: ["returned"]
  }
];

export default function ItemTypesDemoPage() {
  return (
    <main className={styles.shell} data-testid="item-types-demo">
      <h1>Structured response types</h1>
      <p className={styles.lede}>
        Single choice, ordering, matching and constrained short answer - each authored,
        rendered, answered and scored deterministically.
      </p>
      {items.map((item) => (
        <section className={styles.stageCard} key={item.itemId}>
          <AssessmentItemView item={item} />
        </section>
      ))}
    </main>
  );
}
