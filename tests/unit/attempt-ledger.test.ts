import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  appendAttemptLedgerEntry,
  buildAttemptLedgerEntry,
  ITEM_SCORER_VERSION,
  loadAttemptLedger
} from "../../lib/attempt-ledger";
import { AssessmentItem, deriveAttemptOutcome, scoreItem } from "../../lib/item-types";

// SR-R1-014: Raw attempt ledger.
// "Store raw evidence required for future re-evaluation, not only final scores."
// "Record content/version, WPM, word count, timing, mode, item IDs, raw responses/outcomes,
//  validity, decision, scorer version and timestamps."
const item: AssessmentItem = {
  itemId: "sc1",
  itemType: "single_choice",
  constructId: "detail",
  mandatory: false,
  prompt: "Prompt",
  options: [
    { id: "a", label: "A" },
    { id: "b", label: "B" }
  ],
  correctOptionId: "a"
};

function createMemoryLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => (store.has(key) ? (store.get(key) as string) : null),
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear()
  };
}

beforeEach(() => {
  vi.stubGlobal("window", { localStorage: createMemoryLocalStorage() });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("buildAttemptLedgerEntry", () => {
  it("captures every required raw-evidence field", () => {
    const response = { type: "single_choice", selectedOptionId: "a" } as const;
    const itemOutcomes = [scoreItem(item, response)];
    const attemptEvaluation = deriveAttemptOutcome([item], itemOutcomes, 70);

    const entry = buildAttemptLedgerEntry({
      attemptId: "attempt-1",
      contentId: "level1_001",
      contentVersion: "1.0",
      mode: "single_word",
      targetWpm: 100,
      wordCount: 79,
      plannedDurationMs: 47400,
      actualDurationMs: 48120,
      rawResponses: { sc1: response },
      itemOutcomes,
      attemptEvaluation,
      now: () => "2026-01-01T00:00:00.000Z"
    });

    expect(entry).toEqual({
      attemptId: "attempt-1",
      contentId: "level1_001",
      contentVersion: "1.0",
      mode: "single_word",
      targetWpm: 100,
      wordCount: 79,
      plannedDurationMs: 47400,
      actualDurationMs: 48120,
      itemIds: ["sc1"],
      rawResponses: { sc1: response },
      itemOutcomes,
      validity: "VALID",
      decision: "PASS",
      reasonCode: "PASS",
      scorerVersion: ITEM_SCORER_VERSION,
      recordedAt: "2026-01-01T00:00:00.000Z"
    });
  });

  it("records validity INVALID (not VALID) for a technically-invalid attempt outcome", () => {
    const attemptEvaluation = deriveAttemptOutcome([item], [], 70, { interrupted: true });
    const entry = buildAttemptLedgerEntry({
      attemptId: "attempt-2",
      contentId: "level1_001",
      contentVersion: "1.0",
      mode: "single_word",
      rawResponses: {},
      itemOutcomes: [],
      attemptEvaluation
    });

    expect(entry.validity).toBe("INVALID");
    expect(entry.decision).toBe("INVALID");
    expect(entry.reasonCode).toBe("TECHNICAL_INTERRUPTION");
  });

  it("tolerates missing optional timing/WPM fields (null, not undefined or a crash)", () => {
    const attemptEvaluation = deriveAttemptOutcome(
      [item],
      [scoreItem(item, { type: "single_choice", selectedOptionId: "a" })],
      70
    );
    const entry = buildAttemptLedgerEntry({
      attemptId: "attempt-3",
      contentId: "level1_001",
      contentVersion: "1.0",
      mode: "multiple_choice",
      rawResponses: {},
      itemOutcomes: [],
      attemptEvaluation
    });

    expect(entry.targetWpm).toBeNull();
    expect(entry.wordCount).toBeNull();
    expect(entry.plannedDurationMs).toBeNull();
    expect(entry.actualDurationMs).toBeNull();
  });
});

describe("attempt ledger persistence", () => {
  function makeEntry(attemptId: string) {
    const attemptEvaluation = deriveAttemptOutcome(
      [item],
      [scoreItem(item, { type: "single_choice", selectedOptionId: "a" })],
      70
    );
    return buildAttemptLedgerEntry({
      attemptId,
      contentId: "level1_001",
      contentVersion: "1.0",
      mode: "single_word",
      rawResponses: {},
      itemOutcomes: [],
      attemptEvaluation
    });
  }

  it("appends entries and never overwrites prior ones - the ledger only grows", () => {
    appendAttemptLedgerEntry(makeEntry("a1"), "alice-123");
    appendAttemptLedgerEntry(makeEntry("a2"), "alice-123");

    const ledger = loadAttemptLedger("alice-123");
    expect(ledger.map((e) => e.attemptId)).toEqual(["a1", "a2"]);
  });

  it("keeps each learner's ledger isolated from every other learner's", () => {
    appendAttemptLedgerEntry(makeEntry("a1"), "alice-123");
    appendAttemptLedgerEntry(makeEntry("b1"), "bob-456");

    expect(loadAttemptLedger("alice-123").map((e) => e.attemptId)).toEqual(["a1"]);
    expect(loadAttemptLedger("bob-456").map((e) => e.attemptId)).toEqual(["b1"]);
  });
});
