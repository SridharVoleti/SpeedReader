import { describe, expect, it } from "vitest";
import { buildParentReport, parentCopy, parentCopyViolations, READINESS_PARENT_COPY, COMPOSITE_PENDING_COPY, PRACTICE_PARENT_COPY } from "../../../lib/v2/parent-report";
import { recordNewProgressionAttempt } from "../../../lib/v2/attempt-record";
import { newLearnerAggregate, type LearnerAggregate } from "../../../lib/v2/learner-aggregate";
import { scoreComprehension, structuredEvidence } from "../../../lib/v2/comprehension-score";
import { recordNewsReaderAttempt } from "../../../lib/v2/news-reader";
import { newReadinessStream } from "../../../lib/v2/readiness-lifecycle";
import { pLevelComposite, type OralHistory, type OralHistoryEntry } from "../../../lib/v2/oral-telemetry";
import { RS_IDS } from "../../../lib/world1-framework";
import { COMPARATIVE_FIELDS } from "../../../lib/v2/personal-trajectory";

const scored = (s: number) => scoreComprehension(structuredEvidence([{ itemId: "q1", score: s }]), { score: s });
const play = (scores: number[], start = 90) => {
  let l: LearnerAggregate = newLearnerAggregate("kid", start);
  scores.forEach((s, i) => { l = recordNewProgressionAttempt(l, { attemptId: `a${i + 1}`, passageId: `P${i + 1}`, displayedWpm: l.core.wpm, passageWords: 100, recordedAt: `2026-10-03T10:${String(i).padStart(2, "0")}:00Z`, comprehension: scored(s) }).learner; });
  return l;
};
const e = (rsId: (typeof RS_IDS)[number], p: number, finalAccuracy: number, round = p): OralHistoryEntry => ({ learnerId: "kid", rsId, p, round, finalAccuracy, wpm: 80 });

describe("APP-REPORT-002 personal progress", () => {
  it("reports starting WPM, current WPM, Level Ups, canonical progress and the learner's own trend", () => {
    const r = buildParentReport({ learner: play([0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9]) });
    expect(r.personal).toMatchObject({ startingWpm: 90, currentWpm: 92, levelUps: 2 });
    expect(r.personal.trend).toMatchObject({ startWpm: 90, currentWpm: 92, gainWpm: 2 });
    expect(r.canonicalProgress).toEqual({ completedPassages: 10, ofPassages: 1500, nextPassageWords: 100, worldComplete: false });
  });
  it("a brand-new learner has no invented progress", () => {
    const r = buildParentReport({ learner: newLearnerAggregate("kid", 80) });
    expect(r.personal).toMatchObject({ startingWpm: 80, currentWpm: 80, levelUps: 0 });
    expect(r.canonicalProgress.completedPassages).toBe(0);
    expect(r.practice.status).toBeNull();
    expect(r.newsReader.passages).toEqual([]);
  });
  it("shows practice and readiness status in parent-appropriate language", () => {
    const stalled = play([0.5, 0.5, 0.5, 0.5, 0.5]);
    const r = buildParentReport({ learner: stalled, readiness: [newReadinessStream("kid", "RS03")] });
    expect(r.practice.status).toBe(PRACTICE_PARENT_COPY);
    expect(r.readiness).toEqual([{ streamId: "RS03", status: READINESS_PARENT_COPY.PRIMARY_DUE }]);
  });
  it("reports News Reader improvement separately and never folds it into WPM", () => {
    const base = play([0.9]);
    const withNr = { ...base, newsReader: recordNewsReaderAttempt(recordNewsReaderAttempt(base.newsReader, { attemptId: "n1", passageId: "P1", readNumber: 1, metrics: { clarity: 0.5 }, technicalState: "OK", recordedAt: "2026-10-03T11:00:00Z" }), { attemptId: "n2", passageId: "P1", readNumber: 2, metrics: { clarity: 0.8 }, technicalState: "OK", recordedAt: "2026-10-03T11:05:00Z" }) };
    const a = buildParentReport({ learner: base });
    const b = buildParentReport({ learner: withNr });
    expect(b.newsReader.passages).toEqual([{ passageId: "P1", improved: true, coaching: expect.stringContaining("second read") }]);
    expect(b.personal).toEqual(a.personal);
    expect(b.canonicalProgress).toEqual(a.canonicalProgress);
  });
});

describe("APP-REPORT-001/003 privacy and no peer comparison", () => {
  it("contains no comparative fields anywhere in the report shape", () => {
    const text = JSON.stringify(buildParentReport({ learner: play([0.9, 0.9]) }));
    for (const f of COMPARATIVE_FIELDS) expect(text).not.toContain(`"${f}"`);
  });
  it("parent copy never uses internal state names or negative labels", () => {
    const r = buildParentReport({ learner: play([0.5, 0.5, 0.5, 0.5, 0.5]), readiness: (Object.keys(READINESS_PARENT_COPY) as (keyof typeof READINESS_PARENT_COPY)[]).map((phase, i) => ({ ...newReadinessStream("kid", `RS${i}`), phase })) });
    expect(parentCopy(r).length).toBeGreaterThan(8);
    expect(parentCopyViolations(r)).toEqual([]);
    for (const copy of Object.values(READINESS_PARENT_COPY)) expect(copy).not.toMatch(/GREEN|PASS|FAIL|score|percent|%/i);
  });
});

describe("APP-REPORT-004 complete-round composites only", () => {
  it("no composite until every RS has reached the same P level", () => {
    const partial: OralHistory = [...RS_IDS.map((rs) => e(rs, 1, 0.6)), ...RS_IDS.slice(0, 14).map((rs) => e(rs, 2, 0.7))];
    expect(pLevelComposite(partial, "kid", 2)).toBeNull();
    const r = buildParentReport({ learner: newLearnerAggregate("kid", 90), oralHistory: partial });
    // P1 is complete across all 15 RS, P2 is not -> the report may show the P1 composite only
    expect(r.composite).toMatchObject({ p: 1 });
  });
  it("shows the highest completed P level's composite as the mean of per-RS deltas against each RS's own baseline", () => {
    const h: OralHistory = [...RS_IDS.map((rs) => e(rs, 1, 0.6)), ...RS_IDS.map((rs, i) => e(rs, 2, 0.6 + (i % 2 ? 0.1 : 0.2)))];
    const r = buildParentReport({ learner: newLearnerAggregate("kid", 90), oralHistory: h });
    expect(r.composite).toMatchObject({ p: 2 });
    expect((r.composite as { meanAccuracyDelta: number }).meanAccuracyDelta).toBeCloseTo((8 * 0.2 + 7 * 0.1) / 15);
  });
  it("with no oral history the report says when the overall picture will appear, without a number", () => {
    const r = buildParentReport({ learner: newLearnerAggregate("kid", 90) });
    expect(r.composite).toEqual({ pending: COMPOSITE_PENDING_COPY });
    expect(Object.keys(r.competencies)).toHaveLength(15);
  });
  it("keeps the 15 competency timelines separate with each RS compared only with its own baseline", () => {
    const h: OralHistory = [e("RS01", 1, 0.5), e("RS01", 3, 0.8), e("RS02", 1, 0.9)];
    const r = buildParentReport({ learner: newLearnerAggregate("kid", 90), oralHistory: h });
    expect(r.competencies.RS01.timeline.map((x) => x.p)).toEqual([1, 3]);
    expect(r.competencies.RS01.sinceBaseline).toMatchObject({ state: "COMPARED" });
    expect(r.competencies.RS02.sinceBaseline).toMatchObject({ state: "BASELINE_ONLY" });
    expect(r.competencies.RS03.sinceBaseline).toEqual({ state: "NO_BASELINE" });
  });
});

describe("retention in the parent report", () => {
  it("reports memory checks on their own, in parent language, and says nothing before any check", async () => {
    const { recordRetentionCheck } = await import("../../../lib/v2/retention-check");
    const base = play([0.9, 0.9]);
    expect(buildParentReport({ learner: base }).retention).toEqual({ checks: 0, storiesChecked: 0, storiesRemembered: 0, summary: null });
    const later = (h: number) => new Date(Date.parse(base.ledger[0].completedAt) + h * 3_600_000).toISOString();
    const a = recordRetentionCheck(base, { attemptId: "r1", passageId: "P1", correct: 4, total: 4, sessionId: "S", at: later(30) });
    if (!a.ok) throw new Error(a.error);
    const b = recordRetentionCheck(a.learner, { attemptId: "r2", passageId: "P2", correct: 1, total: 4, sessionId: "S", at: later(31) });
    if (!b.ok) throw new Error(b.error);
    const r = buildParentReport({ learner: b.learner });
    expect(r.retention).toMatchObject({ checks: 2, storiesChecked: 2, storiesRemembered: 1, summary: "Your child still remembered 1 of 2 stories when asked after time away." });
    expect(parentCopyViolations(r)).toEqual([]);
    expect(r.personal).toEqual(buildParentReport({ learner: base }).personal); // memory checks never change progress figures
  });
});
