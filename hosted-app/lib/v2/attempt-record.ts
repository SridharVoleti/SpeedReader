// FR-047 - Attempt records [FROZEN]
// Every reading attempt identifies at minimum: learner; canonical passage id; attempt type
// (NEW_PROGRESSION / FAMILIAR_PRACTICE / ASSESSMENT / REASSESSMENT / NEWS_READER); displayed WPM;
// passage word count; timestamp; structured-question evidence; spoken-expression evidence status;
// internal comprehension score where applicable; GREEN/NOT_GREEN where applicable; Level-Up state
// before/after; technical/ASR uncertainty state; and the rules/spec version used.

import { ATTEMPT_TYPES, isAttemptType, type AttemptType } from "./attempt-types";
import type { ClientClass } from "./client-class";
import type { Classification } from "./comprehension-threshold";
import type { StructuredEvidence, ComprehensionResult } from "./comprehension-score";
import { applyNewPassage, type LearnerAggregate, type NewPassageEvent } from "./learner-aggregate";
import type { TechnicalReason } from "./spoken-evidence";
import { CURRENT_CALIBRATION } from "./calibration";
import { COUNT100_VERSION } from "../sr/pipeline-v2/count100";
import { READINESS_RULESET_ID } from "./p10-readiness";
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

/** APP-DATA-002: what a learner was shown/allowed before or while answering (assistance & exposure). */
export type AssistanceFlags = { bpcExposedBeforeEvidence: boolean; modelAnswerExposedBeforeEvidence: boolean; technicalRetryUsed: boolean };

export type RegistryCoordinate = { registryPassageId: string; rsId: string; p: number };

export type AttemptRecord = {
  learnerId: string;
  attemptId: string;
  /** Stable event key: a replay of the same event can never create a second record or award (APP-DATA-008). */
  idempotencyKey: string;
  /** Authorized app-session id the attempt happened in (APP-PLAT-009). */
  sessionId: string;
  passageId: string;
  /** Registry/RS/P coordinate where applicable (first-150 / readiness forms). */
  registry: RegistryCoordinate | null;
  /** Readiness form identity where applicable (APP-READY-002). */
  formFamilyId: string | null;
  formId: string | null;
  /** Readiness lifecycle role where applicable (PRIMARY, CONFIRMATION, TECHNICAL_REPLACEMENT...). */
  role: string | null;
  attemptType: AttemptType;
  displayedWpm: number;
  passageWords: number;
  recordedAt: string;
  startedAt: string;
  completedAt: string;
  structured: StructuredEvidence | null;
  spokenStatus: SpokenEvidenceStatus;
  spokenReason: TechnicalReason | null;
  /** Raw ASR transcript and the learner-confirmed corrected transcript are kept separately (APP-COMP-010). */
  rawTranscript: string | null;
  confirmedTranscript: string | null;
  /** News Reader oral metrics: only NEWS_READER attempts may carry them. */
  newsReaderMetrics: Readonly<Record<string, number>> | null;
  /** Readiness outcome where applicable (ASSESSMENT / REASSESSMENT / REVALIDATION). */
  readinessOutcome: "PASS" | "FAIL" | "TECHNICAL_INVALID" | "INSUFFICIENT_EVIDENCE" | "INVALID_FORM" | null;
  comprehensionScore: number | null;
  classification: Classification | null;
  levelUpBefore: { wpm: number };
  levelUpAfter: { wpm: number; event: NewPassageEvent | "NOT_APPLICABLE" };
  /** Canonical pointer before/after: only a scored NEW_PROGRESSION attempt may move it, by exactly one. */
  pointerBefore: number;
  pointerAfter: number;
  technicalState: TechnicalState;
  assistance: AssistanceFlags;
  /** Coarse device/browser class only (APP-CAL-003); the raw user agent is never stored. */
  client?: ClientClass | null;
  ruleVersions: RuleVersions;
  /** Exact content package consumed (id, version, immutable hash), recoverable historically (#23). */
  contentPackage?: ContentPackageRef | null;
};

export type ContentPackageRef = { packageId: string; packageVersion: number; contentHash: string };

const REQUIRED_TEXT: (keyof AttemptRecord)[] = ["learnerId", "attemptId", "idempotencyKey", "sessionId", "passageId", "recordedAt", "startedAt", "completedAt"];

export function validateAttemptRecord(r: AttemptRecord): string[] {
  const errors: string[] = [];
  for (const key of REQUIRED_TEXT) if (typeof r[key] !== "string" || (r[key] as string) === "") errors.push(`${key} is required`);
  if (!isAttemptType(r.attemptType)) errors.push(`attemptType must be one of ${ATTEMPT_TYPES.join(", ")}`);
  if (!(r.displayedWpm > 0)) errors.push("displayedWpm must be positive");
  if (!(Number.isInteger(r.passageWords) && r.passageWords > 0)) errors.push("passageWords must be a positive integer");
  for (const key of ["recordedAt", "startedAt", "completedAt"] as const) {
    if (Number.isNaN(Date.parse(r[key]))) errors.push(`${key} must be a valid timestamp`);
  }
  if (Date.parse(r.startedAt) > Date.parse(r.completedAt)) errors.push("startedAt must not be after completedAt");
  if (!Number.isInteger(r.pointerBefore) || !Number.isInteger(r.pointerAfter) || r.pointerBefore < 1) errors.push("pointerBefore/pointerAfter must be canonical positions");
  const moved = r.pointerAfter - r.pointerBefore;
  if (moved < 0 || moved > 1) errors.push("canonical pointer can only stay or advance by one");
  if (moved === 1 && (r.attemptType !== "NEW_PROGRESSION" || r.classification === null)) errors.push("only a scored NEW_PROGRESSION attempt may advance the canonical pointer");
  if (r.confirmedTranscript !== null && r.rawTranscript === null) errors.push("a confirmed transcript requires the raw transcript to be retained");
  if (r.newsReaderMetrics !== null && r.attemptType !== "NEWS_READER") errors.push("oral News Reader metrics belong to NEWS_READER attempts only");
  if (r.readinessOutcome !== null && !["ASSESSMENT", "REASSESSMENT", "REVALIDATION"].includes(r.attemptType)) errors.push("readiness outcome belongs to ASSESSMENT/REASSESSMENT/REVALIDATION attempts only");
  if (!r.assistance || typeof r.assistance.bpcExposedBeforeEvidence !== "boolean" || typeof r.assistance.modelAnswerExposedBeforeEvidence !== "boolean" || typeof r.assistance.technicalRetryUsed !== "boolean") errors.push("assistance flags are required");
  if (r.assistance?.bpcExposedBeforeEvidence && r.attemptType === "NEW_PROGRESSION" && r.classification !== null) errors.push("evidence gathered after BPC exposure cannot be independent progression evidence");
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
    tokenizer: COUNT100_VERSION,
    // no package is bound at this level: production attempts are built by the service from the package actually consumed
    content: "content-unbound",
    readiness: READINESS_RULESET_ID
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
  contentPackage?: ContentPackageRef | null;
  /** Optional v3.0 fields; sensible defaults keep callers that predate them working. */
  idempotencyKey?: string;
  sessionId?: string;
  startedAt?: string;
  completedAt?: string;
  registry?: RegistryCoordinate | null;
  rawTranscript?: string | null;
  confirmedTranscript?: string | null;
  assistance?: Partial<AssistanceFlags>;
  client?: ClientClass | null;
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
    idempotencyKey: input.idempotencyKey ?? input.attemptId,
    sessionId: input.sessionId ?? "SESSION-UNSPECIFIED",
    passageId: input.passageId,
    registry: input.registry ?? null,
    formFamilyId: null,
    formId: null,
    role: null,
    attemptType: "NEW_PROGRESSION" as const,
    displayedWpm: input.displayedWpm,
    passageWords: input.passageWords,
    recordedAt: input.recordedAt,
    startedAt: input.startedAt ?? input.recordedAt,
    completedAt: input.completedAt ?? input.recordedAt,
    structured: input.comprehension.structured,
    spokenStatus,
    spokenReason: input.spokenReason ?? null,
    rawTranscript: input.rawTranscript ?? null,
    confirmedTranscript: input.confirmedTranscript ?? null,
    newsReaderMetrics: null,
    readinessOutcome: null,
    comprehensionScore: scored ? input.comprehension.score : null,
    classification: scored ? input.comprehension.classification : null,
    levelUpBefore: { wpm: learner.core.wpm },
    levelUpAfter: { wpm: out.learner.core.wpm, event: out.event },
    pointerBefore: learner.canonicalPointer,
    pointerAfter: out.learner.canonicalPointer,
    client: input.client ?? null,
    assistance: { bpcExposedBeforeEvidence: false, modelAnswerExposedBeforeEvidence: false, technicalRetryUsed: !scored, ...input.assistance },
    technicalState: scored ? "CLEAR" : input.spokenReason ? "ASR_UNCERTAIN" : "TECHNICAL_RETRY",
    ruleVersions: input.ruleVersions ?? currentRuleVersions(),
    contentPackage: input.contentPackage ?? null
  } as AttemptRecord);
  const errors = validateAttemptRecord(record);
  if (errors.length) throw new Error(`invalid attempt record: ${errors.join("; ")}`);
  return { learner: { ...out.learner, ledger: [...learner.ledger, record] }, record, event: out.event };
}
