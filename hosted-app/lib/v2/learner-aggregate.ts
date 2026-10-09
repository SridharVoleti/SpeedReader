// CODEX-02 / CODEX-04 / CODEX-09 / FR-035 - The learner aggregate and the deterministic new-passage
// decision service. Core reading, canonical sequence, practice and News Reader are SEPARATE state
// domains held side by side (never one "score"/"level" field). applyNewPassage is the single function
// that completes a NEW canonical passage; it takes no News Reader input at all, so News Reader
// performance cannot block a Level Up, reduce WPM, delay the canonical sequence, or act as a GREEN light.

import type { ComprehensionResult } from "./comprehension-score";
import { newCoreWpmState, type CoreWpmEvent, type CoreWpmState } from "./core-wpm";
import { completeNewPassage, type InternalAttemptRecord, type PassageCompletionOutcome } from "./passage-completion";
import { newNewsReaderState, type NewsReaderState } from "./news-reader";
import { passageWords, WORLD1_LAST_PASSAGE } from "./stamina";
import type { LearnerFeedback } from "./learner-feedback";
import type { AttemptRecord } from "./attempt-record";

export type LearnerAggregate = {
  learnerId: string;
  baselineWpm: number;
  /** Core Reading / WPM progression domain. */
  core: CoreWpmState;
  /** Canonical Passage Sequence / Stamina domain: next canonical passage to attempt (1..1500; 1501 = complete). */
  canonicalPointer: number;
  /** News Reader domain (isolated). */
  newsReader: NewsReaderState;
  /** Immutable internal attempt log (FR-047/FR-048). */
  attempts: readonly InternalAttemptRecord[];
  /** Full FR-047 attempt records (immutable ledger), written by recordNewProgressionAttempt. */
  ledger: readonly AttemptRecord[];
  /** Familiar-practice log: its own namespace, never progression evidence (APP-DB-006). */
  practiceLog?: readonly PracticeLogEntry[];
  /** True once a familiar passage has been served since the last new canonical passage (scheduler alternation). */
  practiceServedSinceLastNew?: boolean;
};

export type PracticeLogEntry = { attemptId: string; passageId: string; wpm: number; attemptType: "FAMILIAR_PRACTICE"; sessionId: string; recordedAt: string };

export type NewPassageEvent = CoreWpmEvent | "LEVEL_UP_DEFERRED_BY_LENGTH_STEP";

export function newLearnerAggregate(learnerId: string, startingWpm: number): LearnerAggregate {
  return {
    learnerId, baselineWpm: startingWpm, core: newCoreWpmState(startingWpm), canonicalPointer: 1,
    newsReader: newNewsReaderState(), attempts: [], ledger: []
  };
}

export type NewPassageResult = { learner: LearnerAggregate; feedback: PassageCompletionOutcome["learner"]; event: NewPassageEvent };

/**
 * Complete a NEW canonical passage. Deterministic: same aggregate + same comprehension result always
 * yields the same output. Never reads `learner.newsReader`.
 */
export function applyNewPassage(learner: LearnerAggregate, attemptId: string, comprehension: ComprehensionResult): NewPassageResult {
  if (learner.attempts.some((a) => a.attemptId === attemptId)) {
    // Idempotent: reprocessing the same completed attempt can never award a second Level Up (AC-C04).
    return { learner, feedback: { message: "", celebration: "NONE", showBestPossibleComprehension: false }, event: "NONE" };
  }
  const out = completeNewPassage(attemptId, comprehension, learner.core, learner.baselineWpm);
  let core = out.coreAfter;
  let event: NewPassageEvent = out.coreEvent;
  let feedback: LearnerFeedback & { newWpm?: number } = out.learner;

  // CODEX-04: a Level Up never lands on the same passage that introduces a longer passage length.
  const completedSequence = learner.canonicalPointer;
  const scored = comprehension.status === "SCORED";
  if (scored && out.coreEvent === "LEVEL_UP" && completedSequence < WORLD1_LAST_PASSAGE &&
      passageWords(completedSequence + 1) > passageWords(completedSequence)) {
    core = { wpm: learner.core.wpm, newAttempts: [], postFiveStreak: 0, practiceEligible: false };
    event = "LEVEL_UP_DEFERRED_BY_LENGTH_STEP";
    // The learner is not told a Level Up was withheld; they simply continue (FR-019).
    feedback = { message: "Great reading! You explained the story well.", celebration: "SMALL", showBestPossibleComprehension: true };
  }

  return {
    learner: {
      ...learner,
      core,
      // A passage with scored evidence is complete; technically-unresolved evidence leaves the pointer in place.
      canonicalPointer: scored ? Math.min(learner.canonicalPointer + 1, WORLD1_LAST_PASSAGE + 1) : learner.canonicalPointer,
      practiceServedSinceLastNew: scored ? false : learner.practiceServedSinceLastNew,
      attempts: [...learner.attempts, out.record]
    },
    feedback,
    event
  };
}
