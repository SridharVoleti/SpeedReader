"use client";

// SR-R1-005: Structured response types.
// Renders any of the four authored item types and reports the learner's answer as a
// ResponsePayload once they've filled in enough of the control to form a complete response.

import { useState } from "react";
import {
  AssessmentItem,
  ItemScoreResult,
  ResponsePayload,
  scoreItem
} from "../../lib/item-types";
import styles from "../page.module.css";

type Props = {
  item: AssessmentItem;
  onScored?: (result: ItemScoreResult) => void;
};

export default function AssessmentItemView({ item, onScored }: Props) {
  const [response, setResponse] = useState<ResponsePayload | null>(null);
  const [result, setResult] = useState<ItemScoreResult | null>(null);

  function checkAnswer() {
    if (!response) return;
    const scored = scoreItem(item, response);
    setResult(scored);
    onScored?.(scored);
  }

  return (
    <div data-testid={`item-${item.itemId}`} data-item-type={item.itemType}>
      <p className={styles.stageHint}>{item.prompt}</p>

      {item.itemType === "single_choice" && (
        <fieldset data-testid="single-choice-options">
          {item.options.map((option) => (
            <label key={option.id} style={{ display: "block", marginBottom: 6 }}>
              <input
                type="radio"
                name={item.itemId}
                data-testid={`option-${option.id}`}
                checked={response?.type === "single_choice" && response.selectedOptionId === option.id}
                onChange={() => setResponse({ type: "single_choice", selectedOptionId: option.id })}
              />{" "}
              {option.label}
            </label>
          ))}
        </fieldset>
      )}

      {item.itemType === "ordering" && (
        <div data-testid="ordering-items">
          {item.items.map((entry) => {
            const current = response?.type === "ordering" ? response.orderedItemIds : [];
            const position = current.indexOf(entry.id);
            return (
              <label key={entry.id} style={{ display: "block", marginBottom: 6 }}>
                <select
                  data-testid={`order-select-${entry.id}`}
                  value={position >= 0 ? position + 1 : ""}
                  onChange={(event) => {
                    const nextPosition = Number(event.target.value) - 1;
                    const next = current.filter((id) => id !== entry.id);
                    next.splice(nextPosition, 0, entry.id);
                    setResponse({ type: "ordering", orderedItemIds: next });
                  }}
                >
                  <option value="" disabled>
                    #
                  </option>
                  {item.items.map((_, index) => (
                    <option key={index} value={index + 1}>
                      {index + 1}
                    </option>
                  ))}
                </select>{" "}
                {entry.label}
              </label>
            );
          })}
        </div>
      )}

      {item.itemType === "matching" && (
        <div data-testid="matching-pairs">
          {item.left.map((leftEntry) => {
            const pairs = response?.type === "matching" ? response.pairs : {};
            return (
              <label key={leftEntry.id} style={{ display: "block", marginBottom: 6 }}>
                {leftEntry.label}{" "}
                <select
                  data-testid={`match-select-${leftEntry.id}`}
                  value={pairs[leftEntry.id] ?? ""}
                  onChange={(event) =>
                    setResponse({
                      type: "matching",
                      pairs: { ...pairs, [leftEntry.id]: event.target.value }
                    })
                  }
                >
                  <option value="" disabled>
                    Choose a match
                  </option>
                  {item.right.map((rightEntry) => (
                    <option key={rightEntry.id} value={rightEntry.id}>
                      {rightEntry.label}
                    </option>
                  ))}
                </select>
              </label>
            );
          })}
        </div>
      )}

      {item.itemType === "constrained_short_answer" && (
        <textarea
          data-testid="short-answer-text"
          rows={3}
          value={response?.type === "constrained_short_answer" ? response.text : ""}
          onChange={(event) => setResponse({ type: "constrained_short_answer", text: event.target.value })}
        />
      )}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primaryButton}
          data-testid={`check-${item.itemId}`}
          disabled={!response}
          onClick={checkAnswer}
        >
          Check answer
        </button>
      </div>

      {result && (
        <p data-testid={`result-${item.itemId}`} className={styles.stageHint}>
          {result.itemResult}
        </p>
      )}
    </div>
  );
}
