import type { EvidenceState } from "./world1-session";

export type LevelDimension = "SPEED" | "COMPREHENSION" | "ORAL_FLUENCY" | "STAMINA" | "INDEPENDENCE";
export type SpeedSessionEvidence = {
  sessionId: string;
  atWpm: number;
  comprehension: EvidenceState;
  oralQuality: EvidenceState;
};
export type SpeedState = { currentWpm: number; consecutiveValidSuccess: number; consumedSessionIds: string[] };
export type SpeedDecision = { state: SpeedState; eligible: boolean; reason: string };

export function evaluateSpeedSession(state: SpeedState, evidence: SpeedSessionEvidence): SpeedDecision {
  if (state.consumedSessionIds.includes(evidence.sessionId)) return { state, eligible: false, reason: "DUPLICATE_SESSION" };
  if (evidence.atWpm !== state.currentWpm) return { state, eligible: false, reason: "DIFFERENT_SPEED" };
  if ([evidence.comprehension, evidence.oralQuality].some((value) => value === "TECHNICAL_RETRY" || value === "INSUFFICIENT_EVIDENCE")) {
    return { state, eligible: false, reason: "INVALID_EVIDENCE" };
  }
  const bothPassed = evidence.comprehension === "PASS" && evidence.oralQuality === "PASS";
  const nextCount = bothPassed ? state.consecutiveValidSuccess + 1 : 0;
  const next = { ...state, consecutiveValidSuccess: nextCount, consumedSessionIds: [...state.consumedSessionIds, evidence.sessionId] };
  return { state: next, eligible: nextCount >= 3, reason: bothPassed ? (nextCount >= 3 ? "THREE_VALID_SUCCESSES" : "AWAITING_STABILITY") : "INDEPENDENT_GATE_HOLD" };
}

export type StaminaEvidence = { attemptId: string; targetWords: number; comprehension: EvidenceState; oralQuality: EvidenceState };
export type StaminaState = { validatedWords: number; confirmingAttemptIds: string[]; pendingWords: number | null };
export type StaminaDecision = { state: StaminaState; eligible: boolean; reason: string };

export function evaluateStaminaStep(state: StaminaState, evidence: StaminaEvidence, requiredConfirmations?: number): StaminaDecision {
  if (evidence.targetWords !== state.validatedWords + 25) return { state, eligible: false, reason: "NOT_NEXT_25_WORD_STEP" };
  if (requiredConfirmations === undefined) return { state, eligible: false, reason: "CONFIRMATION_COUNT_OPEN" };
  if (!Number.isInteger(requiredConfirmations) || requiredConfirmations < 1) throw new Error("invalid stamina confirmation count");
  if (evidence.comprehension !== "PASS" || evidence.oralQuality !== "PASS") return { state, eligible: false, reason: "GATES_NOT_MET" };
  if (state.pendingWords === evidence.targetWords && state.confirmingAttemptIds.includes(evidence.attemptId)) return { state, eligible: false, reason: "DUPLICATE_ATTEMPT" };
  const ids = state.pendingWords === evidence.targetWords ? [...state.confirmingAttemptIds, evidence.attemptId] : [evidence.attemptId];
  if (ids.length < requiredConfirmations) return { state: { ...state, pendingWords: evidence.targetWords, confirmingAttemptIds: ids }, eligible: false, reason: "AWAITING_CONFIRMATION" };
  return { state: { validatedWords: evidence.targetWords, pendingWords: null, confirmingAttemptIds: [] }, eligible: true, reason: "VALIDATED_LENGTH_STEP" };
}

export type AdvancementCandidate = { dimension: "SPEED" | "STAMINA"; key: string };
export function chooseAdvancement(candidates: AdvancementCandidate[], priority?: "SPEED" | "LENGTH"): AdvancementCandidate | null {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];
  if (!priority) return null; // OPEN-006: simultaneous eligibility needs configured tie-break.
  return candidates.find((candidate) => candidate.dimension === (priority === "LENGTH" ? "STAMINA" : "SPEED")) ?? candidates[0];
}

export type ValidatedCrossing = { eventId: string; dimension: LevelDimension; coordinate: string; evidenceIds: string[] };
export type LevelEvent = ValidatedCrossing & { ordinal: number };
export type BadgeAward = { badgeIndex: number; levelOrdinal: number };
export type LevelLedger = { levels: LevelEvent[]; badges: BadgeAward[] };

export function recordValidatedLevel(ledger: LevelLedger, crossing: ValidatedCrossing): LevelLedger {
  if (!crossing.eventId || !crossing.coordinate || crossing.evidenceIds.length === 0) throw new Error("validated crossing needs identity and evidence");
  if (ledger.levels.some((event) => event.eventId === crossing.eventId || (event.dimension === crossing.dimension && event.coordinate === crossing.coordinate))) return ledger;
  const ordinal = ledger.levels.length + 1;
  const levels = [...ledger.levels, { ...crossing, ordinal }];
  const badges = ordinal % 5 === 0 && !ledger.badges.some((badge) => badge.badgeIndex === ordinal / 5)
    ? [...ledger.badges, { badgeIndex: ordinal / 5, levelOrdinal: ordinal }]
    : ledger.badges;
  return { levels, badges };
}

// OPEN-002..004: no inferred band or composite threshold is awarded by default.
export type BandConfig = { order: readonly string[]; confirmations: number };
export type BandEvidence = { evidenceId: string; band: string; valid: boolean };
export function evaluateConfiguredBandCrossing(currentBand: string, evidence: BandEvidence[], config?: BandConfig): boolean {
  if (!config || !Number.isInteger(config.confirmations) || config.confirmations < 1) return false;
  const currentIndex = config.order.indexOf(currentBand);
  if (currentIndex < 0) return false;
  const distinct = new Map(evidence.filter((item) => item.valid).map((item) => [item.evidenceId, item.band]));
  const recent = [...distinct.values()].slice(-config.confirmations);
  return recent.length === config.confirmations && recent.every((band) => config.order.indexOf(band) > currentIndex);
}
