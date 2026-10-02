// AC-C08 - Observability [Codex engineering gate]
// Operational logs can distinguish content defects, scoring defects, ASR/technical uncertainty, learner
// NOT_GREEN, practice scheduling, Level Ups and stamina boundaries - WITHOUT exposing any negative
// internal label to the learner. Ops events are an internal stream: nothing in learner-facing feedback
// is built from them, and learnerVisibleOps() is constant-empty by design.

import type { AttemptRecord } from "./attempt-record";

export const OPS_EVENT_KINDS = [
  "CONTENT_DEFECT",
  "SCORING_DEFECT",
  "ASR_TECHNICAL_UNCERTAINTY",
  "LEARNER_NOT_GREEN",
  "PRACTICE_SCHEDULING",
  "LEVEL_UP",
  "STAMINA_BOUNDARY"
] as const;
export type OpsEventKind = (typeof OPS_EVENT_KINDS)[number];

export type OpsEvent = {
  kind: OpsEventKind;
  attemptId: string | null;
  passageId: string | null;
  at: string;
  detail: string;
  /** Rule/config versions in force, so a defect can be tied to the exact calibration. */
  ruleVersions: Record<string, string> | null;
};

/** Derive the operational events implied by one stored attempt record. */
export function opsEventsForAttempt(record: AttemptRecord, practiceScheduled = false): OpsEvent[] {
  const base = { attemptId: record.attemptId, passageId: record.passageId, at: record.recordedAt, ruleVersions: { ...record.ruleVersions } };
  const events: OpsEvent[] = [];
  if (record.spokenStatus === "UNRESOLVED_TECHNICAL" || record.technicalState !== "CLEAR") {
    events.push({ ...base, kind: "ASR_TECHNICAL_UNCERTAINTY", detail: record.spokenReason ?? record.technicalState });
  } else if (record.classification === "NOT_GREEN") {
    events.push({ ...base, kind: "LEARNER_NOT_GREEN", detail: "comprehension below GREEN threshold" });
  }
  if (record.levelUpAfter.event === "LEVEL_UP") {
    events.push({ ...base, kind: "LEVEL_UP", detail: `${record.levelUpBefore.wpm}->${record.levelUpAfter.wpm}` });
  }
  if (record.levelUpAfter.event === "LEVEL_UP_DEFERRED_BY_LENGTH_STEP") {
    events.push({ ...base, kind: "STAMINA_BOUNDARY", detail: "length step took precedence over Level Up" });
  }
  if (practiceScheduled) events.push({ ...base, kind: "PRACTICE_SCHEDULING", detail: "familiar practice offered at current WPM" });
  return events;
}

export function contentDefectEvent(passageId: string, detail: string, at: string): OpsEvent {
  return { kind: "CONTENT_DEFECT", attemptId: null, passageId, at, detail, ruleVersions: null };
}

export function scoringDefectEvent(attemptId: string, detail: string, at: string, ruleVersions: Record<string, string>): OpsEvent {
  return { kind: "SCORING_DEFECT", attemptId, passageId: null, at, detail, ruleVersions };
}

export class OpsLog {
  private readonly events: OpsEvent[] = [];
  emit(...events: OpsEvent[]): void {
    this.events.push(...events.map((e) => Object.freeze({ ...e })));
  }
  all(): readonly OpsEvent[] {
    return this.events;
  }
  byKind(kind: OpsEventKind): OpsEvent[] {
    return this.events.filter((e) => e.kind === kind);
  }
}

/** Ops events are never shown to learners. */
export function learnerVisibleOps(_events: readonly OpsEvent[]): never[] {
  return [];
}
