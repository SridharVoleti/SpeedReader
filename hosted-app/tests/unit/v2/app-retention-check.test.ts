import { describe, expect, it } from "vitest";
import { RETENTION_POLICY_V1, recordRetentionCheck, retentionDue, retentionPolicyValid, retentionSummary, type RetentionPolicy } from "../../../lib/v2/retention-check";
import { recordNewProgressionAttempt } from "../../../lib/v2/attempt-record";
import { newLearnerAggregate, type LearnerAggregate } from "../../../lib/v2/learner-aggregate";
import { scoreComprehension, structuredEvidence } from "../../../lib/v2/comprehension-score";
import { consistencyErrors } from "../../../lib/v2/progress-store";

const H = 3_600_000;
const T0 = Date.parse("2026-10-01T10:00:00Z");
const at = (hours: number) => new Date(T0 + hours * H).toISOString();
const items = (scores: number[]) => scoreComprehension(structuredEvidence(scores.map((s, i) => ({ itemId: `q${i}`, score: s }))), { score: 0.9 });

/** A learner who completed the given stories, `hoursAgo` hours after T0 each. */
function learner(stories: { id: string; atHour: number; scores?: number[] }[]): LearnerAggregate {
  let l = newLearnerAggregate("kid", 90);
  stories.forEach((s, i) => {
    l = recordNewProgressionAttempt(l, { attemptId: `a${i}`, passageId: s.id, displayedWpm: l.core.wpm, passageWords: 100, recordedAt: at(s.atHour), completedAt: at(s.atHour), startedAt: at(s.atHour), comprehension: items(s.scores ?? [1, 1, 1, 1]) }).learner;
  });
  return l;
}
const input = (id: string, passageId: string, correct: number, hour: number, total = 4) => ({ attemptId: id, passageId, correct, total, sessionId: "S", at: at(hour) });

describe("spaced retention checks: policy", () => {
  it("is a versioned PROVISIONAL_PILOT policy: 24 hours, 7 days, 30 days, remembered at 75%", () => {
    expect(RETENTION_POLICY_V1).toMatchObject({ status: "PROVISIONAL_PILOT", intervalsHours: [24, 168, 720], rememberedShare: 0.75 });
    expect(retentionPolicyValid(RETENTION_POLICY_V1)).toEqual([]);
  });
  it("rejects a policy with no version, non-increasing intervals or an impossible share", () => {
    const base: RetentionPolicy = { ...RETENTION_POLICY_V1 };
    expect(retentionPolicyValid({ ...base, version: "" })).toContain("retention policy needs a version");
    expect(retentionPolicyValid({ ...base, intervalsHours: [24, 24] })).toContain("intervals must be non-negative and strictly increasing");
    expect(retentionPolicyValid({ ...base, intervalsHours: [] })).toContain("intervals must be non-negative and strictly increasing");
    expect(retentionPolicyValid({ ...base, rememberedShare: 0 })).toContain("rememberedShare must be in (0,1]");
  });
});

describe("when is a story due?", () => {
  const l = learner([{ id: "P1", atHour: 0 }]);
  it("not before 24 hours, due exactly at 24 hours", () => {
    expect(retentionDue(l, at(23.99))).toBeNull();
    expect(retentionDue(l, at(24))).toMatchObject({ passageId: "P1", checkNumber: 1, dueAt: at(24) });
  });
  it("a learner who has read nothing has nothing due", () => {
    expect(retentionDue(newLearnerAggregate("kid", 90), at(1000))).toBeNull();
  });
  it("the earliest-due story comes first, and each story is checked on its own schedule", () => {
    const two = learner([{ id: "P1", atHour: 0 }, { id: "P2", atHour: 5 }]);
    expect(retentionDue(two, at(40))?.passageId).toBe("P1");
    const afterFirst = recordRetentionCheck(two, input("r1", "P1", 4, 40));
    if (!afterFirst.ok) throw new Error(afterFirst.error);
    expect(retentionDue(afterFirst.learner, at(40))?.passageId).toBe("P2");
  });
  it("after check 1 the next check waits 7 days from the story, then 30 days, then stops", () => {
    let cur = l;
    const step = (hour: number, id: string) => { const r = recordRetentionCheck(cur, input(id, "P1", 4, hour)); if (!r.ok) throw new Error(r.error); cur = r.learner; };
    step(25, "r1");
    expect(retentionDue(cur, at(167))).toBeNull();
    expect(retentionDue(cur, at(168))).toMatchObject({ checkNumber: 2 });
    step(170, "r2");
    expect(retentionDue(cur, at(719))).toBeNull();
    expect(retentionDue(cur, at(720))).toMatchObject({ checkNumber: 3 });
    step(721, "r3");
    expect(retentionDue(cur, at(100_000))).toBeNull(); // the schedule is finite
  });
  it("only a scored first completion counts: a technically unresolved attempt is not a story the learner has read", () => {
    let u = newLearnerAggregate("kid", 90);
    u = recordNewProgressionAttempt(u, { attemptId: "t", passageId: "P9", displayedWpm: 90, passageWords: 100, recordedAt: at(0), spokenReason: "ASR_LOW_CONFIDENCE", comprehension: { status: "AWAITING_SPOKEN_EVIDENCE", structured: structuredEvidence([{ itemId: "q", score: 1 }]), calibrationVersion: "c", score: null, classification: null } as never }).learner;
    expect(retentionDue(u, at(1000))).toBeNull();
  });
  it("rejects an invalid clock", () => {
    expect(() => retentionDue(l, "nope")).toThrow(RangeError);
  });
});

describe("recording a check", () => {
  it("scores it on its own, marks 'remembered' at the pilot share, and carries the immediate result for reporting only", () => {
    const l = learner([{ id: "P1", atHour: 0, scores: [1, 1, 1, 0] }]);
    const r = recordRetentionCheck(l, input("r1", "P1", 3, 30));
    if (!r.ok) throw new Error(r.error);
    expect(r.record).toMatchObject({ checkNumber: 1, correct: 3, total: 4, remembered: true, delayBucket: "NEXT_DAY", immediateScore: 0.75, policyVersion: RETENTION_POLICY_V1.version });
    expect(r.record.delaySeconds).toBe(30 * 3600);
    const weak = recordRetentionCheck(l, input("r2", "P1", 2, 30));
    expect(weak.ok && weak.record.remembered).toBe(false);
  });

  it("changes ONLY the retention log: WPM, pointer, ledger, practice and News Reader are untouched, and the aggregate stays consistent", () => {
    const l = learner([{ id: "P1", atHour: 0 }, { id: "P2", atHour: 1 }]);
    const r = recordRetentionCheck(l, input("r1", "P1", 1, 30));
    if (!r.ok) throw new Error(r.error);
    expect(r.learner.core).toEqual(l.core);
    expect(r.learner.canonicalPointer).toBe(l.canonicalPointer);
    expect(r.learner.ledger).toEqual(l.ledger);
    expect(r.learner.newsReader).toEqual(l.newsReader);
    expect(r.learner.baselineWpm).toBe(l.baselineWpm);
    expect(consistencyErrors(r.learner)).toEqual([]);
  });

  it("a failed memory check never lowers earned WPM and never blocks the next story", () => {
    const l = learner([{ id: "P1", atHour: 0 }]);
    const r = recordRetentionCheck(l, input("r1", "P1", 0, 30));
    if (!r.ok) throw new Error(r.error);
    expect(r.record.remembered).toBe(false);
    expect(r.learner.core.wpm).toBe(l.core.wpm);
    expect(r.learner.canonicalPointer).toBe(l.canonicalPointer);
  });

  it("is idempotent per attempt id", () => {
    const l = learner([{ id: "P1", atHour: 0 }]);
    const a = recordRetentionCheck(l, input("r1", "P1", 4, 30));
    if (!a.ok) throw new Error(a.error);
    const b = recordRetentionCheck(a.learner, input("r1", "P1", 0, 31));
    expect(b).toMatchObject({ ok: true, replayed: true });
    expect(b.ok && b.learner.retentionLog).toHaveLength(1);
  });

  it("refuses a story that is not due, one never read, and malformed results", () => {
    const l = learner([{ id: "P1", atHour: 0 }]);
    expect(recordRetentionCheck(l, input("r1", "P1", 4, 10))).toMatchObject({ ok: false, error: expect.stringMatching(/not due/) });
    expect(recordRetentionCheck(l, input("r1", "P7", 4, 30))).toMatchObject({ ok: false });
    expect(recordRetentionCheck(l, input("r1", "P1", 5, 30))).toMatchObject({ ok: false, error: "invalid recall result" });
    expect(recordRetentionCheck(l, input("r1", "P1", -1, 30))).toMatchObject({ ok: false });
    expect(recordRetentionCheck(l, input("r1", "P1", 1, 30, 0))).toMatchObject({ ok: false });
    expect(recordRetentionCheck(l, { ...input("", "P1", 4, 30) })).toMatchObject({ ok: false, error: "attemptId is required" });
  });

  it("checks are due strictly in order: the wrong story cannot be checked out of turn", () => {
    const l = learner([{ id: "P1", atHour: 0 }, { id: "P2", atHour: 2 }]);
    expect(recordRetentionCheck(l, input("r1", "P2", 4, 40))).toMatchObject({ ok: false });
  });
});

describe("what the learner can be told: stories remembered", () => {
  it("counts a story as remembered when its latest check was remembered", () => {
    let l = learner([{ id: "P1", atHour: 0 }, { id: "P2", atHour: 0 }]);
    const step = (id: string, pid: string, correct: number, hour: number) => { const r = recordRetentionCheck(l, input(id, pid, correct, hour)); if (!r.ok) throw new Error(r.error); l = r.learner; };
    expect(retentionSummary(l)).toEqual({ checks: 0, storiesChecked: 0, storiesRemembered: 0 });
    step("r1", "P1", 4, 30);
    step("r2", "P2", 1, 30);
    expect(retentionSummary(l)).toEqual({ checks: 2, storiesChecked: 2, storiesRemembered: 1 });
    step("r3", "P1", 4, 200); // both are due again at the same moment: the earlier story is checked first
    step("r4", "P2", 4, 200); // the second check shows P2 stuck after all
    expect(retentionSummary(l)).toEqual({ checks: 4, storiesChecked: 2, storiesRemembered: 2 });
    step("r5", "P1", 0, 740); // and one that was remembered can fade by the third check
    expect(retentionSummary(l)).toEqual({ checks: 5, storiesChecked: 2, storiesRemembered: 1 });
  });
});
