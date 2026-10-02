// FR-030 / FR-031 - What happens when a NEW canonical passage is completed [FROZEN]
//   >=75%: store exact internal score, classify GREEN, celebrate (without the number), provide BPC,
//          count toward Level-Up evidence.
//   <75% : store exact internal score, classify NOT_GREEN, no failure language or score, neutral
//          encouraging feedback, provide BPC, continue naturally by the adaptive rules.
// Technically-unresolved evidence (FR-024) produces no score and no progression evidence.

import type { ComprehensionResult } from "./comprehension-score";
import { recordNewPassage, type CoreWpmEvent, type CoreWpmState } from "./core-wpm";
import { buildLearnerFeedback, type LearnerFeedback } from "./learner-feedback";
import type { Classification } from "./comprehension-threshold";

export type InternalAttemptRecord = {
  attemptId: string;
  attemptType: "NEW_PROGRESSION";
  score: number | null;
  classification: Classification | null;
  countedTowardEvidence: boolean;
  calibrationVersion: string;
};

export type PassageCompletionOutcome = {
  record: InternalAttemptRecord;
  learner: LearnerFeedback;
  coreAfter: CoreWpmState;
  coreEvent: CoreWpmEvent;
};

export function completeNewPassage(attemptId: string, comprehension: ComprehensionResult, core: CoreWpmState): PassageCompletionOutcome {
  if (comprehension.status !== "SCORED") {
    // Unscored (awaiting/unresolved spoken evidence): nothing stored as a score, nothing counted.
    return {
      record: { attemptId, attemptType: "NEW_PROGRESSION", score: null, classification: null, countedTowardEvidence: false, calibrationVersion: comprehension.calibrationVersion },
      learner: buildLearnerFeedback({ attemptId, score: null, classification: null }),
      coreAfter: core,
      coreEvent: "NONE"
    };
  }
  const { event, state } = recordNewPassage(core, comprehension.classification);
  return {
    record: {
      attemptId, attemptType: "NEW_PROGRESSION", score: comprehension.score, classification: comprehension.classification,
      countedTowardEvidence: true, calibrationVersion: comprehension.calibrationVersion
    },
    learner: buildLearnerFeedback({ attemptId, score: comprehension.score, classification: comprehension.classification }),
    coreAfter: state,
    coreEvent: event
  };
}
