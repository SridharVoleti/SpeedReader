import { describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { migratedDb, pgliteFetch } from "./helpers/pglite-postgrest";
import { SupabaseAssessmentStore, SupabaseLearnerRepository, SupabaseSessionPersistence } from "../../../lib/v2/supabase-adapters";
import { recordNewProgressionAttempt } from "../../../lib/v2/attempt-record";
import { newLearnerAggregate, type LearnerAggregate } from "../../../lib/v2/learner-aggregate";
import { scoreComprehension, structuredEvidence } from "../../../lib/v2/comprehension-score";
import { SessionRegistry } from "../../../lib/v2/session-envelope";
import { LearnerService } from "../../../lib/v2/learner-service";
import { buildDeps, handleV3 } from "../../../api/v3";
import { FixtureContentProvider } from "../../../lib/v2/content-provider";

const scored = (s: number) => scoreComprehension(structuredEvidence([{ itemId: "q1", score: s }]), { score: s });
const step = (l: LearnerAggregate, i: number, s = 0.9) =>
  recordNewProgressionAttempt(l, { attemptId: `a${i}`, passageId: `P${i + 1}`, displayedWpm: l.core.wpm, passageWords: 100, recordedAt: "2026-10-03T10:00:00Z", comprehension: scored(s) }).learner;
const afterFour = (id = "kid") => { let l = newLearnerAggregate(id, 90); for (let i = 0; i < 4; i += 1) l = step(l, i); return l; };

const commit = (db: PGlite, id: string, expected: number, key: string, l: LearnerAggregate, attempt: unknown = null) =>
  db.query("select sr_commit_learner($1,$2,$3,$4::jsonb,$5,$6,$7::jsonb) as r", [id, expected, key, JSON.stringify(l), l.core.wpm, l.canonicalPointer, attempt === null ? null : JSON.stringify(attempt)]);
const insertLearner = (db: PGlite, l: LearnerAggregate) =>
  db.query("insert into sr_learner_state(learner_id, baseline_wpm, current_wpm, canonical_pointer, state) values ($1,$2,$3,$4,$5::jsonb)", [l.learnerId, l.baselineWpm, l.core.wpm, l.canonicalPointer, JSON.stringify(l)]);
const count = async (db: PGlite, table: string) => Number(((await db.query(`select count(*)::int as n from ${table}`)).rows[0] as { n: number }).n);

describe("the migrations apply cleanly to a real Postgres engine", () => {
  it("0001 -> 0003 create every table the adapters and requirements need", async () => {
    const db = await migratedDb();
    const tables = ((await db.query("select table_name from information_schema.tables where table_schema='public' order by 1")).rows as { table_name: string }[]).map((r) => r.table_name);
    for (const t of ["sr_learner_state", "sr_applied_event", "sr_attempt", "sr_structured_response", "sr_spoken_evidence", "sr_progression_decision", "sr_practice_event", "sr_news_reader_attempt", "sr_readiness_stream", "sr_readiness_attempt", "sr_calibration_version", "sr_content_package", "sr_assessment_state", "sr_session_state", "sr_retention_check"]) {
      expect(tables).toContain(t);
    }
  });
});

describe("retention checks are projected into their own append-only table, atomically with the state", () => {
  const rec = { attemptId: "r1", passageId: "P1", checkNumber: 1, correct: 3, total: 4, remembered: true, delaySeconds: 90000, delayBucket: "24h", immediateScore: 0.9, sessionId: "s", at: "2026-10-05T10:00:00Z", policyVersion: "RET-1" };

  it("a committed state with a retention log yields one row per check, replays add nothing, rows are immutable", async () => {
    const db = await migratedDb();
    await insertLearner(db, afterFour());
    const next = { ...afterFour(), retentionLog: [rec] } as LearnerAggregate;
    await commit(db, "kid", 1, "retention:r1", next);
    expect(await count(db, "sr_retention_check")).toBe(1);
    const again = { ...next, retentionLog: [rec, { ...rec, attemptId: "r2", checkNumber: 2 }] } as LearnerAggregate;
    await commit(db, "kid", 2, "retention:r2", again);
    expect(await count(db, "sr_retention_check")).toBe(2);
    expect((await db.query("select remembered, delay_bucket from sr_retention_check where attempt_id='r1'")).rows[0]).toEqual({ remembered: true, delay_bucket: "24h" });
    await expect(db.query("update sr_retention_check set correct = 4")).rejects.toThrow();
  });
});

describe("sr_commit_learner is atomic, idempotent and versioned (APP-DATA-007/008)", () => {
  it("applies state, attempt record and idempotency record together and bumps the version", async () => {
    const db = await migratedDb();
    await insertLearner(db, afterFour());
    const next = step(afterFour(), 4);
    const r = (await commit(db, "kid", 1, "a4", next, next.ledger[4])).rows[0] as { r: { ok: boolean; replayed: boolean; version: number } };
    expect(r.r).toEqual({ ok: true, replayed: false, version: 2 });
    expect(await count(db, "sr_attempt")).toBe(1);
    expect(await count(db, "sr_applied_event")).toBe(1);
    const row = (await db.query("select version, current_wpm, canonical_pointer from sr_learner_state where learner_id='kid'")).rows[0] as Record<string, number>;
    expect(row).toEqual({ version: 2, current_wpm: 91, canonical_pointer: 6 });
  });

  it("a replayed key is a no-op", async () => {
    const db = await migratedDb();
    await insertLearner(db, afterFour());
    const next = step(afterFour(), 4);
    await commit(db, "kid", 1, "a4", next, next.ledger[4]);
    const again = (await commit(db, "kid", 1, "a4", next, next.ledger[4])).rows[0] as { r: unknown };
    expect(again.r).toEqual({ ok: true, replayed: true });
    expect(await count(db, "sr_attempt")).toBe(1);
    expect((await db.query("select version from sr_learner_state")).rows[0]).toEqual({ version: 2 });
  });

  it("a stale writer gets VERSION_CONFLICT and nothing is written", async () => {
    const db = await migratedDb();
    await insertLearner(db, afterFour());
    const next = step(afterFour(), 4);
    await commit(db, "kid", 1, "a4", next, next.ledger[4]);
    const stale = (await commit(db, "kid", 1, "other", step(afterFour(), 4, 0.5), { attemptId: "z", attemptType: "NEW_PROGRESSION" })).rows[0] as { r: unknown };
    expect(stale.r).toEqual({ ok: false, reason: "VERSION_CONFLICT" });
    expect(await count(db, "sr_attempt")).toBe(1);
    expect(await count(db, "sr_applied_event")).toBe(1);
  });

  it("a failure inside the commit rolls the whole commit back (no half-applied Level Up)", async () => {
    const db = await migratedDb();
    await insertLearner(db, afterFour());
    const next = step(afterFour(), 4);
    await commit(db, "kid", 1, "a4", next, next.ledger[4]);
    // reusing an attempt id under a different event key violates the attempt primary key mid-function
    const dup = step(next, 5);
    await expect(commit(db, "kid", 2, "a5", dup, { ...dup.ledger[5], attemptId: "a4" })).rejects.toThrow();
    const row = (await db.query("select version, current_wpm, canonical_pointer from sr_learner_state")).rows[0] as Record<string, number>;
    expect(row).toEqual({ version: 2, current_wpm: 91, canonical_pointer: 6 });
    expect(await count(db, "sr_applied_event")).toBe(1);
    expect(await count(db, "sr_attempt")).toBe(1);
  });
});

describe("evidence is append-only and constrained (APP-DATA-003/004, APP-DB-002..010)", () => {
  it("attempt rows cannot be updated or deleted", async () => {
    const db = await migratedDb();
    await insertLearner(db, afterFour());
    const next = step(afterFour(), 4);
    await commit(db, "kid", 1, "a4", next, next.ledger[4]);
    await expect(db.query("update sr_attempt set attempt_type='FAMILIAR_PRACTICE'")).rejects.toThrow(/immutable/);
    await expect(db.query("delete from sr_attempt")).rejects.toThrow(/immutable/);
  });

  it("an attempt for an unknown learner violates the foreign key", async () => {
    const db = await migratedDb();
    await expect(db.query("insert into sr_attempt(learner_id, attempt_id, attempt_type, record) values ('ghost','a1','NEW_PROGRESSION','{}'::jsonb)")).rejects.toThrow();
  });

  it("learner rows reject impossible speeds and pointers (150 WPM ceiling, 1..1501)", async () => {
    const db = await migratedDb();
    await expect(db.query("insert into sr_learner_state(learner_id, baseline_wpm, current_wpm, canonical_pointer, state) values ('a',90,151,1,'{}'::jsonb)")).rejects.toThrow();
    await expect(db.query("insert into sr_learner_state(learner_id, baseline_wpm, current_wpm, canonical_pointer, state) values ('b',90,90,1502,'{}'::jsonb)")).rejects.toThrow();
    await expect(db.query("insert into sr_learner_state(learner_id, baseline_wpm, current_wpm, canonical_pointer, state) values ('c',0,90,1,'{}'::jsonb)")).rejects.toThrow();
  });

  it("earned WPM can never decrease in a decision record, and decisions need evidence", async () => {
    const db = await migratedDb();
    await insertLearner(db, afterFour());
    const ins = (before: number, after: number, evidence: string) =>
      db.query("insert into sr_progression_decision(learner_id, decision_id, decision_type, reason_code, input_evidence_ids, wpm_before, wpm_after, rule_versions, decided_at) values ('kid','d1','LEVEL_UP','x',$1::text[],$2,$3,'{}'::jsonb, now())", [evidence, before, after]);
    await expect(ins(91, 90, "{a1}")).rejects.toThrow();
    await expect(ins(90, 91, "{}")).rejects.toThrow();
    await ins(90, 91, "{a1,a2}");
    await expect(db.query("update sr_progression_decision set wpm_after = 120")).rejects.toThrow(/immutable/);
  });

  it("a confirmed transcript cannot exist without the raw transcript (APP-COMP-010)", async () => {
    const db = await migratedDb();
    await insertLearner(db, afterFour());
    const next = step(afterFour(), 4);
    await commit(db, "kid", 1, "a4", next, { attemptId: "a4", attemptType: "NEW_PROGRESSION" }); // bare record: nothing projected, so the constraint is exercised directly
    const ins = (raw: string | null, confirmed: string | null) =>
      db.query("insert into sr_spoken_evidence(learner_id, attempt_id, status, raw_transcript, confirmed_transcript) values ('kid','a4','SCORED',$1,$2)", [raw, confirmed]);
    await expect(ins(null, "the red kite")).rejects.toThrow();
    await ins("the kid kite", "the red kite");
  });

  it("a readiness form can never be reused within a stream, roles and outcomes are constrained (APP-READY-006)", async () => {
    const db = await migratedDb();
    await insertLearner(db, afterFour());
    await db.query("insert into sr_readiness_stream(learner_id, stream_id, phase) values ('kid','RS03','PRIMARY_DUE')");
    const ins = (id: string, form: string, role = "PRIMARY", outcome = "PASS") =>
      db.query("insert into sr_readiness_attempt(learner_id, stream_id, attempt_id, registry_passage_id, form_family_id, assessment_form_id, delivery_event_id, role, outcome, attempted_at) values ('kid','RS03',$1,'reg','fam',$2,'ev',$3,$4, now())", [id, form, role, outcome]);
    await ins("r1", "form-A");
    await expect(ins("r2", "form-A")).rejects.toThrow(); // same form again
    await expect(ins("r3", "form-B", "NOT_A_ROLE")).rejects.toThrow();
    await expect(ins("r4", "form-C", "PRIMARY", "MAYBE")).rejects.toThrow();
    await ins("r5", "form-B", "TECHNICAL_REPLACEMENT", "INVALID_FORM");
    await expect(db.query("delete from sr_readiness_attempt")).rejects.toThrow(/immutable/);
  });

  it("News Reader attempts live in their own table, only reads 1 and 2 exist, and they are append-only (APP-NR-004)", async () => {
    const db = await migratedDb();
    await insertLearner(db, afterFour());
    const ins = (n: number) => db.query("insert into sr_news_reader_attempt(learner_id, attempt_id, passage_id, read_number, microphone_available) values ('kid',$1,'P1',$2,true)", [`n${n}`, n]);
    await expect(ins(3)).rejects.toThrow();
    await ins(1);
    await expect(db.query("update sr_news_reader_attempt set read_number = 2")).rejects.toThrow(/immutable/);
  });

  it("item scores are bounded and calibration versions never change", async () => {
    const db = await migratedDb();
    await insertLearner(db, afterFour());
    const next = step(afterFour(), 4);
    await commit(db, "kid", 1, "a4", next, { attemptId: "a4", attemptType: "NEW_PROGRESSION" }); // bare record: nothing projected
    await expect(db.query("insert into sr_structured_response(learner_id, attempt_id, item_id, p_level, score) values ('kid','a4','q1',11,0.5)")).rejects.toThrow();
    await expect(db.query("insert into sr_structured_response(learner_id, attempt_id, item_id, p_level, score) values ('kid','a4','q1',3,1.5)")).rejects.toThrow();
    await db.query("insert into sr_structured_response(learner_id, attempt_id, item_id, p_level, score) values ('kid','a4','q1',3,0.5)");
    await db.query("insert into sr_calibration_version(version, status, parameters, audit) values ('c1','PROVISIONAL_PILOT','{}'::jsonb,'{}'::jsonb)");
    await expect(db.query("update sr_calibration_version set status='PRODUCTION_APPROVED'")).rejects.toThrow(/immutable/);
    await expect(db.query("insert into sr_calibration_version(version, status, parameters, audit) values ('c2','MADE_UP','{}'::jsonb,'{}'::jsonb)")).rejects.toThrow();
  });
});

describe("the Supabase adapters run against the real schema and the real commit function", () => {
  const cfg = (db: PGlite) => ({ url: "https://x.supabase.co", serviceRoleKey: "k", fetchImpl: pgliteFetch(db) });

  it("repository: create, commit with attempt, replay, conflict, list", async () => {
    const db = await migratedDb();
    const repo = new SupabaseLearnerRepository(cfg(db));
    await repo.create(afterFour());
    await expect(repo.create(afterFour())).rejects.toThrow(/already exists/);
    const next = step(afterFour(), 4);
    expect(await repo.commit("kid", next, { expectedVersion: 1, idempotencyKey: "a4" })).toMatchObject({ ok: true, replayed: false });
    expect(await repo.commit("kid", next, { expectedVersion: 1, idempotencyKey: "a4" })).toMatchObject({ ok: true, replayed: true });
    expect(await repo.commit("kid", step(afterFour(), 4, 0.4), { expectedVersion: 1, idempotencyKey: "z" })).toMatchObject({ ok: false, reason: "VERSION_CONFLICT" });
    const loaded = (await repo.load("kid"))!;
    expect(loaded.version).toBe(2);
    expect(loaded.learner.core.wpm).toBe(91);
    expect(loaded.learner.ledger).toHaveLength(5);
    expect(await count(db, "sr_attempt")).toBe(1);
    expect((await repo.list()).map((s) => s.learner.learnerId)).toEqual(["kid"]);
  });

  it("assessment and session documents round-trip and upsert", async () => {
    const db = await migratedDb();
    const a = new SupabaseAssessmentStore(cfg(db));
    expect(await a.load("kid")).toBeNull();
    const reg = new SessionRegistry();
    reg.start({ learnerId: "kid", deviceId: "phone", sessionId: "S1", now: "2026-10-05T09:00:00Z" });
    const sessions = new SupabaseSessionPersistence(cfg(db));
    await sessions.save("kid", reg.list("kid"));
    await sessions.save("kid", reg.list("kid")); // upsert, not duplicate
    expect((await sessions.load("kid"))[0]).toMatchObject({ sessionId: "S1", deviceId: "phone", kind: "LEARNING" });
    expect(await count(db, "sr_session_state")).toBe(1);
  });

  it("the entire v3 learner journey persists through the real SQL (assessment -> five stories -> Level Up)", async () => {
    const db = await migratedDb();
    const deps = buildDeps("unused", new FixtureContentProvider(), cfg(db));
    const who = { learnerId: "kid", sessionId: "S1", deviceId: "phone" };
    const call = async (m: string, path: string, body?: unknown) => {
      const res = await handleV3(new Request(`http://x/api/v3/${path}`, { method: m, body: body === undefined ? undefined : JSON.stringify(body) }), path.split("/"), who, deps);
      return { status: res.status, body: (await res.json()) as Record<string, any> };
    };
    const RIGHT = [1, 0, 2, 0];
    await call("POST", "bootstrap");
    await call("POST", "assessment/start");
    for (let i = 1; ; i += 1) {
      const a = await call("POST", "assessment/answer", { key: `k${i}`, answers: RIGHT });
      expect(a.status).toBe(200);
      if (a.body.status === "COMPLETE") break;
    }
    expect((await call("POST", "assessment/finalize")).status).toBe(200);
    const retell = "Mia has a red kite and takes it to the big hill. The string slips so the kite flies away over the trees. Ravi finds the kite stuck in a bush and carries it back. A kind friend turns a sad day into a happy one.";
    let last: Record<string, any> = {};
    for (let i = 1; i <= 5; i += 1) {
      const r = await call("POST", "passage/submit", { attemptId: `a${i}`, passageId: `FX-000${i}`, answers: RIGHT, explanation: { text: retell, mode: "typed" } });
      expect(r.status).toBe(200);
      last = r.body;
    }
    expect(last.feedback.message).toBe("You Levelled Up!");
    expect(await count(db, "sr_attempt")).toBe(5);
    expect(await count(db, "sr_applied_event")).toBe(5);
    const row = (await db.query("select baseline_wpm, current_wpm, canonical_pointer, version from sr_learner_state")).rows[0] as Record<string, number>;
    expect(row.current_wpm).toBe(row.baseline_wpm + 1);
    expect(row.canonical_pointer).toBe(6);
    // a second server instance (fresh service, same database) sees exactly the same learner
    const other = new LearnerService({ repo: new SupabaseLearnerRepository(cfg(db)), assessments: new SupabaseAssessmentStore(cfg(db)), sessions: new SessionRegistry(), sessionStore: new SupabaseSessionPersistence(cfg(db)), bpcCatalog: [], provenance: () => ({ packageId: "TEST-PKG", packageVersion: 1, contentHash: "test-hash" }) });
    const p = await other.progress(who);
    expect(p).toMatchObject({ ok: true, currentWpm: row.current_wpm, storiesRead: 5 });
  });
});
