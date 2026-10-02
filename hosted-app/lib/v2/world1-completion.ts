// FR-040 / FR-041 / FR-042 / FR-043 - World 1 completion and readiness [FROZEN]
//   FR-040  Reaching P1500 completes the canonical SEQUENCE but does not, by passage count alone, prove
//           World 1 mastery: the applicable core reading competency/readiness requirements must also hold.
//   FR-041  150 WPM is the ceiling, not a requirement: completion never depends on reaching it.
//   FR-042  WPM Level Ups are speed-development evidence and motivation; they never substitute for
//           readiness evidence.
//   FR-043  News Reader/oral mastery is parallel and never blocks World progression.
// The readiness requirements are the 15 canonical RS competencies of the approved Knowledge Map; each
// must be confirmed by independent evidence (FR-044 governs which forms count).

import { RS_IDS, type RsId } from "../world1-framework";
import { WORLD1_LAST_PASSAGE } from "./stamina";

export type ReadinessEvidence = {
  rsId: RsId;
  confirmed: boolean;
  /** Approved equivalent form that produced the evidence (FR-044). */
  formId: string;
};

export type World1Facts = {
  /** Next canonical passage; 1501 means P1500 has been completed. */
  canonicalPointer: number;
  readiness: readonly ReadinessEvidence[];
  /** Everything below is deliberately accepted but ignored by the completion decision. */
  earnedWpm?: number;
  levelUps?: number;
  newsReaderMastery?: unknown;
};

export type World1Status =
  | { status: "IN_PROGRESS"; passagesRemaining: number }
  | { status: "SEQUENCE_COMPLETE_READINESS_PENDING"; missingReadiness: RsId[] }
  | { status: "WORLD1_COMPLETE" };

export function sequenceComplete(canonicalPointer: number): boolean {
  return canonicalPointer > WORLD1_LAST_PASSAGE;
}

export function missingReadiness(readiness: readonly ReadinessEvidence[]): RsId[] {
  return RS_IDS.filter((rs) => !readiness.some((r) => r.rsId === rs && r.confirmed && r.formId.length > 0));
}

/** Completion = canonical sequence done AND all core readiness confirmed. WPM, Level Ups and oral are irrelevant. */
export function world1Status(facts: World1Facts): World1Status {
  if (!sequenceComplete(facts.canonicalPointer)) {
    return { status: "IN_PROGRESS", passagesRemaining: WORLD1_LAST_PASSAGE - facts.canonicalPointer + 1 };
  }
  const missing = missingReadiness(facts.readiness);
  return missing.length === 0 ? { status: "WORLD1_COMPLETE" } : { status: "SEQUENCE_COMPLETE_READINESS_PENDING", missingReadiness: missing };
}

export type WorldAdvance = { advance: true; toWorld: 2 } | { advance: false; reason: World1Status["status"] };

/**
 * FR-043: a learner who has satisfied the core World 1 reading requirements progresses in the core World
 * architecture. News Reader/oral mastery is parallel, so `newsReaderMastery` (and every other
 * non-core fact) is never consulted here.
 */
export function advanceFromWorld1(facts: World1Facts): WorldAdvance {
  const status = world1Status({ canonicalPointer: facts.canonicalPointer, readiness: facts.readiness });
  return status.status === "WORLD1_COMPLETE" ? { advance: true, toWorld: 2 } : { advance: false, reason: status.status };
}
