import { describe, expect, it } from "vitest";
import { OPS_EVENT_KINDS, OpsLog, contentDefectEvent, learnerVisibleOps, opsEventsForAttempt, scoringDefectEvent } from "../../../lib/v2/ops-log";
import { recordNewProgressionAttempt } from "../../../lib/v2/attempt-record";
import { newLearnerAggregate, type LearnerAggregate } from "../../../lib/v2/learner-aggregate";
import { scoreComprehension, structuredEvidence } from "../../../lib/v2/comprehension-score";
import { buildLearnerFeedback } from "../../../lib/v2/learner-feedback";
import { learnerLanguageViolations } from "../../../lib/v2/learner-language";

const scored = (s: number) => scoreComprehension(structuredEvidence([{ itemId: "q1", score: s }]), { score: s });
const attempt = (learner: LearnerAggregate, id: string, s: number, pointerOverride?: number) =>
  recordNewProgressionAttempt(pointerOverride ? { ...learner, canonicalPointer: pointerOverride } : learner, {
    attemptId: id, passageId: "P001", displayedWpm: learner.core.wpm, passageWords: 100, recordedAt: "2026-10-03T10:00:00Z", comprehension: scored(s)
  });

// AC-C08 - Observability
describe("AC-C08 operational logs distinguish the cases without leaking labels to learners", () => {
  it("defines the seven distinguishable kinds", () => {
    expect([...OPS_EVENT_KINDS]).toEqual([
      "CONTENT_DEFECT", "SCORING_DEFECT", "ASR_TECHNICAL_UNCERTAINTY", "LEARNER_NOT_GREEN", "PRACTICE_SCHEDULING", "LEVEL_UP", "STAMINA_BOUNDARY"
    ]);
  });

  it("a learner NOT_GREEN is logged as LEARNER_NOT_GREEN", () => {
    const { record } = attempt(newLearnerAggregate("l", 90), "a1", 0.5);
    expect(opsEventsForAttempt(record).map((e) => e.kind)).toEqual(["LEARNER_NOT_GREEN"]);
  });

  it("technical/ASR uncertainty is a DIFFERENT kind from learner NOT_GREEN", () => {
    const pending = scoreComprehension(structuredEvidence([{ itemId: "q1", score: 0 }]), null);
    const { record } = recordNewProgressionAttempt(newLearnerAggregate("l", 90), {
      attemptId: "t1", passageId: "P001", displayedWpm: 90, passageWords: 100, recordedAt: "2026-10-03T10:00:00Z", comprehension: pending, spokenReason: "ASR_LOW_CONFIDENCE"
    });
    const kinds = opsEventsForAttempt(record).map((e) => e.kind);
    expect(kinds).toEqual(["ASR_TECHNICAL_UNCERTAINTY"]);
    expect(kinds).not.toContain("LEARNER_NOT_GREEN");
    expect(opsEventsForAttempt(record)[0].detail).toBe("ASR_LOW_CONFIDENCE");
  });

  it("a Level Up is logged as LEVEL_UP with the WPM change", () => {
    let l = newLearnerAggregate("l", 90);
    let last = attempt(l, "x0", 0.9);
    l = last.learner;
    for (let i = 1; i < 5; i += 1) { last = attempt(l, `x${i}`, 0.9); l = last.learner; }
    const events = opsEventsForAttempt(last.record);
    expect(events.map((e) => e.kind)).toEqual(["LEVEL_UP"]);
    expect(events[0].detail).toBe("90->91");
  });

  it("a length-step boundary that defers a Level Up is logged as STAMINA_BOUNDARY (not LEVEL_UP)", () => {
    let l: LearnerAggregate = { ...newLearnerAggregate("l", 90), canonicalPointer: 146 };
    let last = attempt(l, "b0", 0.9);
    l = last.learner;
    for (let i = 1; i < 5; i += 1) { last = attempt(l, `b${i}`, 0.9); l = last.learner; }
    expect(opsEventsForAttempt(last.record).map((e) => e.kind)).toEqual(["STAMINA_BOUNDARY"]);
  });

  it("practice scheduling, content defects and scoring defects have their own kinds", () => {
    const { record } = attempt(newLearnerAggregate("l", 90), "a1", 0.5);
    expect(opsEventsForAttempt(record, true).map((e) => e.kind)).toEqual(["LEARNER_NOT_GREEN", "PRACTICE_SCHEDULING"]);
    expect(contentDefectEvent("P077", "missing approved BPC", "2026-10-03T00:00:00Z").kind).toBe("CONTENT_DEFECT");
    expect(scoringDefectEvent("a1", "score out of range", "2026-10-03T00:00:00Z", { calibration: "c1" }).kind).toBe("SCORING_DEFECT");
  });

  it("events carry the attempt and rule versions, and the log keeps frozen, filterable entries", () => {
    const { record } = attempt(newLearnerAggregate("l", 90), "a1", 0.5);
    const log = new OpsLog();
    log.emit(...opsEventsForAttempt(record), contentDefectEvent("P9", "x", "2026-10-03T00:00:00Z"));
    expect(log.byKind("LEARNER_NOT_GREEN")[0].ruleVersions?.calibration).toMatch(/calibration/);
    expect(log.byKind("CONTENT_DEFECT")).toHaveLength(1);
    expect(Object.isFrozen(log.all()[0])).toBe(true);
  });

  it("never exposes negative internal labels to the learner: ops events do not reach learner views", () => {
    const log = new OpsLog();
    for (const s of [0.2, 0.5, 0.9]) log.emit(...opsEventsForAttempt(attempt(newLearnerAggregate("l", 90), `a${s}`, s).record));
    expect(log.all().length).toBeGreaterThan(0);
    expect(learnerVisibleOps(log.all())).toEqual([]);
    // the internal label is exactly the kind of text the learner-language gate forbids...
    expect(learnerLanguageViolations("LEARNER_NOT_GREEN")).not.toEqual([]);
    // ...and learner feedback never contains any ops kind name
    for (const s of [0.2, 0.9]) {
      const text = JSON.stringify(buildLearnerFeedback({ attemptId: "a", score: s, classification: s >= 0.75 ? "GREEN" : "NOT_GREEN" }));
      for (const kind of OPS_EVENT_KINDS) expect(text).not.toContain(kind);
    }
  });
});
