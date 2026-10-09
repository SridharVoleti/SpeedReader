import { describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { migratedDb } from "./helpers/pglite-postgrest";
import { recordNewProgressionAttempt } from "../../../lib/v2/attempt-record";
import { newLearnerAggregate, type LearnerAggregate } from "../../../lib/v2/learner-aggregate";
import { scoreComprehension, structuredEvidence } from "../../../lib/v2/comprehension-score";

// Issue #20: normalized evidence domains are written by the production commit, atomically and idempotently.
const scored = (s: number) => scoreComprehension(structuredEvidence([{ itemId: "q1", score: s }, { itemId: "q2", score: s }]), { score: s });
const step = (l: LearnerAggregate, i: number, s = 0.9) =>
  recordNewProgressionAttempt(l, { attemptId: `a${i}`, passageId: `P${i + 1}`, displayedWpm: l.core.wpm, passageWords: 100, recordedAt: "2026-10-03T10:00:00Z", comprehension: scored(s), rawTranscript: "raw words", confirmedTranscript: "confirmed words" }).learner;
const insertLearner = (db: PGlite, l: LearnerAggregate) =>
  db.query("insert into sr_learner_state(learner_id, baseline_wpm, current_wpm, canonical_pointer, state) values ($1,$2,$3,$4,$5::jsonb)", [l.learnerId, l.baselineWpm, l.core.wpm, l.canonicalPointer, JSON.stringify(l)]);
const commit = (db: PGlite, expected: number, key: string, l: LearnerAggregate, attempt: unknown = null) =>
  db.query("select sr_commit_learner($1,$2,$3,$4::jsonb,$5,$6,$7::jsonb) as r", ["kid", expected, key, JSON.stringify(l), l.core.wpm, l.canonicalPointer, attempt === null ? null : JSON.stringify(attempt)]);
const n = async (db: PGlite, t: string) => Number(((await db.query(`select count(*)::int as n from ${t}`)).rows[0] as { n: number }).n);

describe("committing an attempt writes the normalized evidence domains in the same transaction (#20)", () => {
  it("structured items and raw/confirmed spoken evidence are queryable; replay duplicates nothing", async () => {
    const db = await migratedDb();
    let l = newLearnerAggregate("kid", 90);
    await insertLearner(db, l);
    l = step(l, 0);
    await commit(db, 1, "a0", l, l.ledger[0]);
    expect(await n(db, "sr_structured_response")).toBe(2);
    expect((await db.query("select status, raw_transcript, confirmed_transcript from sr_spoken_evidence")).rows).toEqual([{ status: "SCORED", raw_transcript: "raw words", confirmed_transcript: "confirmed words" }]);
    const again = (await commit(db, 1, "a0", l, l.ledger[0])).rows[0] as { r: { replayed: boolean } };
    expect(again.r.replayed).toBe(true);
    expect(await n(db, "sr_structured_response")).toBe(2);
    expect(await n(db, "sr_spoken_evidence")).toBe(1);
  });

  it("a Level-Up and a HOLD are persisted as auditable decisions with input evidence ids and rule versions", async () => {
    const db = await migratedDb();
    let l = newLearnerAggregate("kid", 90);
    await insertLearner(db, l);
    for (let i = 0; i < 5; i += 1) { l = step(l, i); await commit(db, i + 1, `a${i}`, l, l.ledger[i]); }
    const rows = (await db.query("select decision_type, reason_code, input_evidence_ids, wpm_before, wpm_after, rule_versions->>'calibration' as cal from sr_progression_decision order by decision_id")).rows as Array<Record<string, unknown>>;
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0]).toMatchObject({ input_evidence_ids: ["a4"] });
    expect(rows[0].cal).toBeTruthy();
    expect(["LEVEL_UP", "LEVEL_UP_DEFERRED", "HOLD"]).toContain(rows[0].decision_type);
    await expect(db.query("update sr_progression_decision set wpm_after = 1")).rejects.toThrow();
  });

  it("familiar practice and News Reader are projected into their own tables, never into attempts or decisions", async () => {
    const db = await migratedDb();
    let l = newLearnerAggregate("kid", 90);
    await insertLearner(db, l);
    l = {
      ...l,
      practiceLog: [{ attemptId: "p1", passageId: "P1", wpm: 90, attemptType: "FAMILIAR_PRACTICE", sessionId: "s", recordedAt: "2026-10-03T10:00:00Z" }],
      newsReader: { attempts: [{ attemptId: "n1", passageId: "P1", readNumber: 1, metrics: { clarity: 0.5 }, technicalState: "MIC_UNAVAILABLE", recordedAt: "2026-10-03T10:00:00Z" }] }
    };
    await commit(db, 1, "mix", l);
    await commit(db, 2, "mix2", l); // same logs again: no duplicates
    expect(await n(db, "sr_practice_event")).toBe(1);
    expect((await db.query("select read_number, microphone_available from sr_news_reader_attempt")).rows).toEqual([{ read_number: 1, microphone_available: false }]);
    expect(await n(db, "sr_attempt")).toBe(0);
    expect(await n(db, "sr_progression_decision")).toBe(0);
    expect(await n(db, "sr_structured_response")).toBe(0);
  });

  it("a failing evidence projection rolls the learner state back (no split-brain)", async () => {
    const db = await migratedDb();
    let l = newLearnerAggregate("kid", 90);
    await insertLearner(db, l);
    l = step(l, 0);
    const bad = { ...l.ledger[0], structured: { items: [{ itemId: "q1", score: 7 }], score: 7 } }; // violates sr_structured_response check
    await expect(commit(db, 1, "bad", l, bad)).rejects.toThrow();
    expect(await n(db, "sr_attempt")).toBe(0);
    expect(await n(db, "sr_applied_event")).toBe(0);
    expect((await db.query("select version, canonical_pointer from sr_learner_state")).rows).toEqual([{ version: 1, canonical_pointer: 1 }]);
  });

  it("the content package consumed by an attempt is recoverable: identity is stored once per version, history never rewritten (#23)", async () => {
    const db = await migratedDb();
    let l = newLearnerAggregate("kid", 90);
    await insertLearner(db, l);
    const withPkg = (lg: LearnerAggregate, i: number, version: number) => {
      const out = recordNewProgressionAttempt(lg, { attemptId: `a${i}`, passageId: "W1-0001", displayedWpm: lg.core.wpm, passageWords: 100, recordedAt: "2026-10-03T10:00:00Z", comprehension: scored(0.9), contentPackage: { packageId: "PKG-W1-0001", packageVersion: version, contentHash: `hash-v${version}` } });
      return out.learner;
    };
    l = withPkg(l, 0, 1); await commit(db, 1, "a0", l, l.ledger[0]);
    l = withPkg(l, 1, 1); await commit(db, 2, "a1", l, l.ledger[1]);
    l = withPkg(l, 2, 2); await commit(db, 3, "a2", l, l.ledger[2]);
    expect((await db.query("select package_id, version, sha256 from sr_content_package order by version")).rows).toEqual([
      { package_id: "PKG-W1-0001", version: "1", sha256: "hash-v1" },
      { package_id: "PKG-W1-0001", version: "2", sha256: "hash-v2" }
    ]);
  });
});
