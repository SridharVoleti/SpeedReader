// SR-R1-014: Raw attempt ledger.
// "Store raw evidence required for future re-evaluation, not only final scores." Every attempt
// is recorded as an immutable ledger entry - content id/version, WPM, word count, timing, mode,
// item IDs, raw responses/outcomes, validity, decision, scorer version and a timestamp - so a
// future scoring-rule change can replay history without having thrown away the raw evidence.

import { AttemptEvaluation, ItemScoreResult } from "./item-types";

// Bump whenever the item-scoring ruleset (lib/item-types.ts) changes, mirroring SCORER_VERSION
// in lib/scoring.ts for the legacy whole-passage scorer.
export const ITEM_SCORER_VERSION = "1.0";

export type AttemptLedgerEntry = {
  attemptId: string;
  contentId: string;
  contentVersion: string;
  mode: string;
  targetWpm: number | null;
  wordCount: number | null;
  plannedDurationMs: number | null;
  actualDurationMs: number | null;
  itemIds: string[];
  rawResponses: Record<string, unknown>;
  itemOutcomes: ItemScoreResult[];
  validity: "VALID" | "INVALID";
  decision: AttemptEvaluation["attemptOutcome"];
  reasonCode: string;
  scorerVersion: string;
  recordedAt: string;
};

export function buildAttemptLedgerEntry(params: {
  attemptId: string;
  contentId: string;
  contentVersion: string;
  mode: string;
  targetWpm?: number | null;
  wordCount?: number | null;
  plannedDurationMs?: number | null;
  actualDurationMs?: number | null;
  rawResponses: Record<string, unknown>;
  itemOutcomes: ItemScoreResult[];
  attemptEvaluation: AttemptEvaluation;
  now?: () => string;
}): AttemptLedgerEntry {
  const now = params.now ?? (() => new Date().toISOString());
  return {
    attemptId: params.attemptId,
    contentId: params.contentId,
    contentVersion: params.contentVersion,
    mode: params.mode,
    targetWpm: params.targetWpm ?? null,
    wordCount: params.wordCount ?? null,
    plannedDurationMs: params.plannedDurationMs ?? null,
    actualDurationMs: params.actualDurationMs ?? null,
    itemIds: params.itemOutcomes.map((outcome) => outcome.itemId),
    rawResponses: params.rawResponses,
    itemOutcomes: params.itemOutcomes,
    validity: params.attemptEvaluation.attemptOutcome === "INVALID" ? "INVALID" : "VALID",
    decision: params.attemptEvaluation.attemptOutcome,
    reasonCode: params.attemptEvaluation.reasonCode,
    scorerVersion: ITEM_SCORER_VERSION,
    recordedAt: now()
  };
}

const LEDGER_STORAGE_KEY = "speedreader-attempt-ledger-v1";

// Namespaced by learnerId, mirroring lib/progression.ts's storageKey - each learner's raw
// evidence history is isolated from every other learner's, same as their summarized progress.
function ledgerStorageKey(learnerId?: string): string {
  return learnerId ? `${LEDGER_STORAGE_KEY}:${learnerId}` : LEDGER_STORAGE_KEY;
}

export function loadAttemptLedger(learnerId?: string): AttemptLedgerEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ledgerStorageKey(learnerId));
    return raw ? (JSON.parse(raw) as AttemptLedgerEntry[]) : [];
  } catch {
    return [];
  }
}

// The ledger only ever grows - past entries are never edited or removed, so it stays a faithful
// record of raw evidence for future re-evaluation.
export function appendAttemptLedgerEntry(
  entry: AttemptLedgerEntry,
  learnerId?: string
): AttemptLedgerEntry[] {
  if (typeof window === "undefined") return [];
  const next = [...loadAttemptLedger(learnerId), entry];
  window.localStorage.setItem(ledgerStorageKey(learnerId), JSON.stringify(next));
  return next;
}
