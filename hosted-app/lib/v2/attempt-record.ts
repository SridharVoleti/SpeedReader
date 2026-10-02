// FR-047 - Attempt records [FROZEN]
// Every reading attempt identifies at minimum: learner; canonical passage id; attempt type
// (NEW_PROGRESSION / FAMILIAR_PRACTICE / ASSESSMENT / REASSESSMENT / NEWS_READER); displayed WPM;
// passage word count; timestamp; structured-question evidence; spoken-expression evidence status;
// internal comprehension score where applicable; GREEN/NOT_GREEN where applicable; Level-Up state
// before/after; technical/ASR uncertainty state; and the rules/spec version used.

import { ATTEMPT_TYPES, isAttemptType, type AttemptType } from "./attempt-types";
import type { Classification } from "./comprehension-threshold";
import type { StructuredEvidence, ComprehensionResult } from "./comprehension-score";
import { applyNewPassage, type LearnerAggregate, type NewPassageEvent } from "./learner-aggregate";
import type { TechnicalReason } from "./spoken-evidence";
import { CURRENT_CALIBRATION } from "./calibration";
import { ASR_POLICY } from "./spoken-evidence";
import { SPOKEN_EXPRESSION_CONFIG } from "./spoken-expression";

export type SpokenEvidenceStatus = "SCORED" | "UNRESOLVED_TECHNICAL" | "AWAITING" | "NOT_APPLICABLE";
export type TechnicalState = "CLEAR" | "ASR_UNCERTAIN" | "TECHNICAL_RETRY";

export type RuleVersions = {
  calibration: string;
  spokenExpression: string;
  asrPolicy: string;
  /** Tokenizer/word-count version, passage/content version and readiness-rule version (CODEX-11). */
  tokenizer: string;
  content: string;
  readiness: string;
};

export type AttemptRecord = {
  learnerId: string;
  attemptId: string;
  passageId: string;
  attemptType: AttemptType;
  displayedWpm: number;
  passageWords: number;
  recordedAt: string;
  structured: StructuredEvidence | null;
  spokenStatus: SpokenEvidenceStatus;
  spokenReason: TechnicalReason | null;
  comprehensionScore: number | null;
  classification: Classification | null;
  levelUpBefore: { wpm: number };
  levelUpAfter: { wpm: number; event: NewPassageEvent | "NOT_APPLICABLE" };
  technicalState: TechnicalState;
  ruleVersions: RuleVersions;
};

const REQUIRED_TEXT: (keyof AttemptRecord)[] = ["learnerId", "attemptId", "passageId", "recordedAt"];

export function validateAttemptRecord(r: AttemptRecord): string[] {
  const errors: string[] = [];
  for (const key of REQUIRED_TEXT) if (typeof r[key] !== "string" || (r[key] as string) === "") errors.push(`${key} is required`);
  if (!isAttemptType(r.attemptType)) errors.push(`attemptType must be one of ${ATTEMPT_TYPES.join(", ")}`);
  if (!(r.displayedWpm > 0)) errors.push("displayedWpm must be positive");
  if (!(Number.isInteger(r.passageWords) && r.passageWords > 0)) errors.push("passageWords must be a positive integer");
  if (Number.isNaN(Date.parse(r.recordedAt))) errors.push("recordedAt must be a valid timestamp");
  for (const [name, v] of Object.entries(r.ruleVersions ?? {})) if (!v) errors.push(`ruleVersions.${name} is required`);
  for (const name of ["calibration", "spokenExpression", "asrPolicy", "tokenizer", "content", "readiness"] as const) {
    if (!r.ruleVersions || !(name in r.ruleVersions)) errors.push(`ruleVersions.${name} is required`);
  }
  if (r.comprehensionScore !== null && !(r.comprehensionScore >= 0 && r.comprehensionScore <= 1)) errors.push("comprehensionScore must be 0..1");
  if ((r.comprehensionScore === null) !== (r.classification === null)) errors.push("comprehensionScore and classification must both be present or both absent");

  // Applicability: News Reader evidence never carries a comprehension score or GREEN/NOT_GREEN (FR-048).
  if (r.attemptType === "NEWS_READER" && (r.comprehensionScore !== null || r.classification !== null || r.structured !== null)) {
    errors.push("NEWS_READER attempts cannot carry comprehension evidence");
  }
  if (r.attemptType !== "NEW_PROGRESSION" && r.levelUpAfter.wpm !== r.levelUpBefore.wpm) {
    errors.push("only NEW_PROGRESSION attempts can change the Level-Up state");
  }
  if (r.levelUpAfter.wpm < r.levelUpBefore.wpm) errors.push("Level-Up state can never decrease");
  if (r.spokenStatus === "UNRESOLVED_TECHNICAL" && !r.spokenReason) errors.push("unresolved spoken evidence needs an audit reason");
  if (r.spokenStatus === "UNRESOLVED_TECHNICAL" && r.comprehensionScore !== null) errors.push("unresolved spoken evidence cannot yield a comprehension score");
  return errors;
}

export function currentRuleVersions(): RuleVersions {
  return {
    calibration: CURRENT_CALIBRATION.version,
    spokenExpression: SPOKEN_EXPRESSION_CONFIG.version,
    asrPolicy: ASR_POLICY.version,
    tokenizer: "word-count-whitespace-v1",
    content: "content-unversioned-demo",
    readiness: "readiness-rs15-v1"
  };
}

export type NewProgressionInput = {
  attemptId: string;
  passageId: string;
  displayedWpm: number;
  passageWords: number;
  recordedAt: string;
  comprehension: ComprehensionResult;
  spokenReason?: TechnicalReason | null;
  ruleVersions?: RuleVersions;
};

/** Complete a NEW canonical passage and append the full, frozen FR-047 record to the learner's ledger. */
export function recordNewProgressionAttempt(learner: LearnerAggregate, input: NewProgressionInput): { learner: LearnerAggregate; record: AttemptRecord; event: NewPassageEvent } {
  const duplicate = learner.ledger.find((r) => r.attemptId === input.attemptId);
  if (duplicate) return { learner, record: duplicate, event: "NONE" }; // idempotent (AC-C04)

  const out = applyNewPassage(learner, input.attemptId, input.comprehension);
  const scored = input.comprehension.status === "SCORED";
  const spokenStatus: SpokenEvidenceStatus = scored ? "SCORED" : input.spokenReason ? "UNRESOLVED_TECHNICAL" : "AWAITING";
  const record: AttemptRecord = Object.freeze({
    learnerId: learner.learnerId,
    attemptId: input.attemptId,
    passageId: input.passageId,
    attemptType: "NEW_PROGRESSION" as const,
    displayedWpm: input.displayedWpm,
    passageWords: input.passageWords,
    recordedAt: input.recordedAt,
    structured: input.comprehension.structured,
    spokenStatus,
    spokenReason: input.spokenReason ?? null,
    comprehensionScore: scored ? input.comprehension.score : null,
    classification: scored ? input.comprehension.classification : null,
    levelUpBefore: { wpm: learner.core.wpm },
    levelUpAfter: { wpm: out.learner.core.wpm, event: out.event },
    technicalState: scored ? "CLEAR" : input.spokenReason ? "ASR_UNCERTAIN" : "TECHNICAL_RETRY",
    ruleVersions: input.ruleVersions ?? currentRuleVersions()
  } as AttemptRecord);
  const errors = validateAttemptRecord(record);
  if (errors.length) throw new Error(`invalid attempt record: ${errors.join("; ")}`);
  return { learner: { ...out.learner, ledger: [...learner.ledger, record] }, record, event: out.event };
}
