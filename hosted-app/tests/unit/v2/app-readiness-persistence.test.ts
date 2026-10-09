import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { migratedDb, pgliteFetch } from "./helpers/pglite-postgrest";
import { LearnerService, MemoryAssessmentStore, type Ctx } from "../../../lib/v2/learner-service";
import { FileLearnerRepository } from "../../../lib/v2/learner-repository";
import { SupabaseLearnerRepository, SupabaseAssessmentStore, SupabaseSessionPersistence } from "../../../lib/v2/supabase-adapters";
import { SESSION_POLICY_V1, SessionRegistry } from "../../../lib/v2/session-envelope";
import { newLearnerAggregate } from "../../../lib/v2/learner-aggregate";
import { recordNewProgressionAttempt } from "../../../lib/v2/attempt-record";
import { scoreComprehension, structuredEvidence } from "../../../lib/v2/comprehension-score";

// Issue #20 remainder: readiness streams/attempts and calibration versions have a production writer, persisted atomically.
const ctx: Ctx = { learnerId: "kid", sessionId: "S1", deviceId: "d" };
const T0 = Date.parse("2026-10-05T09:00:00Z");
const ident = (n: number) => ({ registryPassageId: `W1-00${n}`, formFamilyId: "fam", assessmentFormId: `form-${n}`, deliveryEventId: `ev-${n}`, attemptId: `ra-${n}` });
const n = async (db: PGlite, t: string) => Number(((await db.query(`select count(*)::int as n from ${t}`)).rows[0] as { n: number }).n);

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "sr-rp-")); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

async function fileService() {
  const repo = new FileLearnerRepository(dir);
  await repo.create(newLearnerAggregate("kid", 60));
  const svc = new LearnerService({ repo, assessments: new MemoryAssessmentStore(), sessions: new SessionRegistry(SESSION_POLICY_V1), bpcCatalog: [], provenance: () => null, now: () => new Date(T0).toISOString() });
  await svc.bootstrap(ctx);
  return { svc, repo };
}

describe("readiness lifecycle has a production writer (service)", () => {
  it("a first attempt creates the stream; PASS moves PRIMARY -> CONFIRMATION_DUE and the due state is surfaced beside canonical reading", async () => {
    const { svc, repo } = await fileService();
    const r = await svc.recordReadinessAttempt(ctx, "RS03", { ...ident(1), role: "PRIMARY", outcome: "PASS", at: new Date(T0).toISOString() });
    expect(r).toMatchObject({ ok: true, phase: "CONFIRMATION_DUE", replayed: false });
    expect(((await repo.load("kid"))!.learner.readinessStreams as any[])[0]).toMatchObject({ streamId: "RS03", phase: "CONFIRMATION_DUE" });
    const next = await svc.nextActivity(ctx);
    expect(next).toMatchObject({ activity: "NEW_PROGRESSION", readinessDue: { streamId: "RS03", role: "CONFIRMATION_DUE" } });
  });
  it("lifecycle rules are enforced (no form reuse, wrong role) and the stream is unchanged on rejection", async () => {
    const { svc, repo } = await fileService();
    await svc.recordReadinessAttempt(ctx, "RS03", { ...ident(1), role: "PRIMARY", outcome: "PASS", at: new Date(T0).toISOString() });
    expect(await svc.recordReadinessAttempt(ctx, "RS03", { ...ident(2), assessmentFormId: "form-1", role: "CONFIRMATION", outcome: "PASS", at: new Date(T0).toISOString() })).toMatchObject({ ok: false, status: 409 });
    expect(await svc.recordReadinessAttempt(ctx, "RS03", { ...ident(3), role: "PRIMARY", outcome: "PASS", at: new Date(T0).toISOString() })).toMatchObject({ ok: false });
    expect(((await repo.load("kid"))!.learner.readinessStreams as any[])[0].history).toHaveLength(1);
  });
  it("is idempotent per attempt id and never touches WPM, pointer or the attempt ledger", async () => {
    const { svc, repo } = await fileService();
    const before = (await repo.load("kid"))!.learner;
    const a = { ...ident(1), role: "PRIMARY" as const, outcome: "PASS" as const, at: new Date(T0).toISOString() };
    await svc.recordReadinessAttempt(ctx, "RS03", a);
    expect(await svc.recordReadinessAttempt(ctx, "RS03", a)).toMatchObject({ ok: true, replayed: true });
    const after = (await repo.load("kid"))!.learner;
    expect(after.core).toEqual(before.core);
    expect(after.canonicalPointer).toBe(before.canonicalPointer);
    expect(after.ledger).toEqual(before.ledger);
    expect((after.readinessStreams as any[])[0].history).toHaveLength(1);
  });
});

describe("normalized readiness and calibration tables are written in the commit transaction (Postgres)", () => {
  async function pgService(db: PGlite) {
    const cfg = { url: "https://x.supabase.co", serviceRoleKey: "k".repeat(30), fetchImpl: pgliteFetch(db) };
    const repo = new SupabaseLearnerRepository(cfg);
    await repo.create(newLearnerAggregate("kid", 60));
    const svc = new LearnerService({ repo, assessments: new SupabaseAssessmentStore(cfg), sessions: new SessionRegistry(SESSION_POLICY_V1), sessionStore: new SupabaseSessionPersistence(cfg), bpcCatalog: [], provenance: () => null, now: () => new Date(T0).toISOString() });
    await svc.bootstrap(ctx);
    return { svc, repo };
  }
  it("stream phase and immutable attempt rows are projected; a replayed attempt adds nothing; form reuse is blocked in the database too", async () => {
    const db = await migratedDb();
    const { svc } = await pgService(db);
    await svc.recordReadinessAttempt(ctx, "RS03", { ...ident(1), role: "PRIMARY", outcome: "PASS", at: new Date(T0).toISOString() });
    await svc.recordReadinessAttempt(ctx, "RS03", { ...ident(2), role: "CONFIRMATION", outcome: "PASS", at: new Date(T0 + 1000).toISOString() });
    expect((await db.query("select stream_id, phase, cycle from sr_readiness_stream")).rows).toEqual([{ stream_id: "RS03", phase: "CONFIRMED", cycle: 1 }]);
    expect((await db.query("select attempt_id, role, outcome from sr_readiness_attempt order by attempted_at")).rows).toEqual([
      { attempt_id: "ra-1", role: "PRIMARY", outcome: "PASS" }, { attempt_id: "ra-2", role: "CONFIRMATION", outcome: "PASS" }
    ]);
    await expect(db.query("update sr_readiness_attempt set outcome = 'FAIL'")).rejects.toThrow();
    expect(await n(db, "sr_attempt")).toBe(0); // readiness is not a reading attempt
  });
  it("the calibration version used by an attempt is published once, immutably", async () => {
    const db = await migratedDb();
    const { repo } = await pgService(db);
    let l = (await repo.load("kid"))!.learner;
    const sc = scoreComprehension(structuredEvidence([{ itemId: "q1", score: 0.9 }]), { score: 0.9 });
    for (let i = 0; i < 2; i += 1) {
      l = recordNewProgressionAttempt(l, { attemptId: `a${i}`, passageId: "P1", displayedWpm: l.core.wpm, passageWords: 100, recordedAt: "2026-10-03T10:00:00Z", comprehension: sc }).learner;
      const snap = (await repo.load("kid"))!;
      expect((await repo.commit("kid", l, { expectedVersion: snap.version, idempotencyKey: `a${i}` })).ok).toBe(true);
    }
    const rows = (await db.query("select version, status, parameters->'comprehensionWeights' as w from sr_calibration_version")).rows as Array<Record<string, any>>;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ version: "calibration-2026-10-pilot-1", status: "PROVISIONAL_PILOT", w: { structured: 0.7, spoken: 0.3 } });
    await expect(db.query("update sr_calibration_version set status='SUPERSEDED'")).rejects.toThrow();
  });
});
