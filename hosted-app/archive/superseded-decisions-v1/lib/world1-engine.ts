import { chooseAdvancement, evaluateSpeedSession, evaluateStaminaStep, recordValidatedLevel, type LevelLedger, type SpeedState, type StaminaState } from "./world1-advancement";
import type { EvidenceState } from "./world1-session";
import { nextSequentialPassage, passageLengthTarget, validateWorldConfig, type AgeBand, type CanonicalWordCounter, type CatalogPassage, type CatalogSelection, type WorldConfig } from "./world1-product";

export type World1LearnerState = {
  nextPassageSequence: number;
  speed: SpeedState;
  stamina: StaminaState;
  levels: LevelLedger;
  processedAttemptIds: string[];
  pendingSpeedWpm: number | null;
};

export type PassageCompletion = {
  attemptId: string;
  sessionId: string;
  sequence: number;
  trainedWpm: number;
  comprehension: EvidenceState;
  oralQuality: EvidenceState;
  // The frozen KM assesses readiness independently. Product continuation cannot
  // bypass it based on a short spoken answer or a demo score.
  kmReadinessApproved: boolean;
};

export type PassageDecision = { state: World1LearnerState; reason: string };

export function selectEligibleWorld1Passage(
  catalog: CatalogPassage[], state: World1LearnerState, ageBand: AgeBand, countWords: CanonicalWordCounter
): CatalogSelection | { status: "READINESS_HOLD" | "WORLD_COMPLETE"; reason: string } {
  if (state.nextPassageSequence > 1500) return { status: "WORLD_COMPLETE", reason: "all 1500 passages completed" };
  if (passageLengthTarget(state.nextPassageSequence).words > state.stamina.validatedWords + 25) {
    return { status: "READINESS_HOLD", reason: "previous length step is not validated" };
  }
  return nextSequentialPassage(catalog, ageBand, state.nextPassageSequence, countWords);
}

export function completeWorld1Passage(state: World1LearnerState, event: PassageCompletion, config: WorldConfig): PassageDecision {
  if (validateWorldConfig(config).length > 0) return { state, reason: "CONFIG_INVALID" };
  if (state.processedAttemptIds.includes(event.attemptId)) return { state, reason: "DUPLICATE_ATTEMPT" };
  if (event.sequence !== state.nextPassageSequence || event.sequence > (config.passageCount ?? 1500)) return { state, reason: "WRONG_SEQUENCE" };
  const currentWords = passageLengthTarget(event.sequence).words;
  if (currentWords > state.stamina.validatedWords + 25) return { state, reason: "READINESS_HOLD" };
  if ([event.comprehension, event.oralQuality].some((value) => value === "TECHNICAL_RETRY" || value === "INSUFFICIENT_EVIDENCE")) return { state, reason: "TECHNICAL_OR_INSUFFICIENT" };
  const processedAttemptIds = [...state.processedAttemptIds, event.attemptId];
  if (event.comprehension !== "PASS" || event.oralQuality !== "PASS" || !event.kmReadinessApproved) {
    return { state: { ...state, processedAttemptIds }, reason: "HOLD_FOR_LEARNING_OR_KM_READINESS" };
  }

  let next = { ...state, processedAttemptIds, nextPassageSequence: event.sequence + 1 };
  const nextWords = event.sequence < (config.passageCount ?? 1500) ? passageLengthTarget(event.sequence + 1).words : currentWords;
  const lengthStep = nextWords > currentWords;

  // A speed decision and a passage-length transition cannot be committed together.
  // On a length boundary, adaptation at the existing speed takes precedence over an
  // unresolved tie-break. It does not itself award a stamina level.
  const speed = evaluateSpeedSession(next.speed, {
    sessionId: event.sessionId, atWpm: event.trainedWpm,
    comprehension: event.comprehension, oralQuality: event.oralQuality
  });
  next = { ...next, speed: speed.state };
  if (event.sequence === (config.passageCount ?? 1500)) return { state: next, reason: "WORLD_COMPLETE" };
  if (lengthStep) return { state: { ...next, speed: { ...next.speed, consecutiveValidSuccess: 0 } }, reason: "LENGTH_STEP_SERVED_SPEED_HELD" };

  const chosen = chooseAdvancement(speed.eligible ? [{ dimension: "SPEED", key: event.sessionId }] : [], config.advancementPriority);
  if (!chosen || config.speedStepWpm === undefined) return { state: next, reason: speed.eligible ? "SPEED_STEP_CONFIGURATION_OPEN" : "PASSAGE_COMPLETE" };
  const pendingSpeedWpm = next.speed.currentWpm + config.speedStepWpm;
  return { state: { ...next, pendingSpeedWpm, speed: { ...next.speed, consecutiveValidSuccess: 0 } }, reason: "SPEED_CHALLENGE_READY" };
}

// A pending speed challenge is not a certified speed level. Only a successful,
// independently validated step creates the level event.
export function confirmSpeedStep(state: World1LearnerState, attemptId: string, evidence: EvidenceState, kmReadinessApproved: boolean): PassageDecision {
  if (state.pendingSpeedWpm === null) return { state, reason: "NO_SPEED_CHALLENGE" };
  if (evidence !== "PASS" || !kmReadinessApproved) return { state, reason: evidence === "TECHNICAL_RETRY" ? "TECHNICAL_RETRY" : "SPEED_NOT_VALIDATED" };
  const wpm = state.pendingSpeedWpm;
  return {
    state: {
      ...state,
      speed: { ...state.speed, currentWpm: wpm, consecutiveValidSuccess: 0, consumedSessionIds: [] },
      pendingSpeedWpm: null,
      levels: recordValidatedLevel(state.levels, { eventId: `speed:${wpm}`, dimension: "SPEED", coordinate: String(wpm), evidenceIds: [attemptId] })
    },
    reason: "SPEED_VALIDATED"
  };
}

export function confirmStaminaStep(state: World1LearnerState, input: {
  attemptId: string; sequence: number; targetWords: number; comprehension: EvidenceState; oralQuality: EvidenceState; kmReadinessApproved: boolean;
}, config: WorldConfig): PassageDecision {
  if (input.sequence < 1 || input.sequence > 1500 || input.sequence >= state.nextPassageSequence || !state.processedAttemptIds.includes(input.attemptId) || !input.kmReadinessApproved || passageLengthTarget(input.sequence).words !== input.targetWords) {
    return { state, reason: "PASSAGE_NOT_VALIDATED" };
  }
  const decision = evaluateStaminaStep(state.stamina, input, config.staminaConfirmations);
  if (!decision.eligible) return { state: { ...state, stamina: decision.state }, reason: decision.reason };
  return {
    state: {
      ...state,
      stamina: decision.state,
      levels: recordValidatedLevel(state.levels, { eventId: `stamina:${input.targetWords}`, dimension: "STAMINA", coordinate: String(input.targetWords), evidenceIds: [input.attemptId] })
    },
    reason: "STAMINA_VALIDATED"
  };
}
