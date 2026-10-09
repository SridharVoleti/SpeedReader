import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LearnerService, MemoryAssessmentStore, type Ctx } from "../../../lib/v2/learner-service";
import { FileLearnerRepository } from "../../../lib/v2/learner-repository";
import { SESSION_POLICY_V1, SessionRegistry } from "../../../lib/v2/session-envelope";

// Issue #24: assessment time is measured by the server from trusted timestamps, never estimated or client-supplied.
const T0 = Date.parse("2026-10-05T09:00:00Z");
const ctx: Ctx = { learnerId: "kid", sessionId: "S1", deviceId: "phone" };
let dir: string;
let clock: number;
let store: MemoryAssessmentStore;
let sessions: SessionRegistry;
let svc: LearnerService;

const iso = () => new Date(clock).toISOString();
beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "sr-el-"));
  clock = T0;
  store = new MemoryAssessmentStore();
  sessions = new SessionRegistry(SESSION_POLICY_V1);
  svc = new LearnerService({ repo: new FileLearnerRepository(dir), assessments: store, sessions, bpcCatalog: [], provenance: () => null, now: iso });
  await svc.bootstrap(ctx);
  await svc.startAssessment(ctx);
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const ok = <T extends { ok: boolean }>(r: T) => { if (!r.ok) throw new Error(JSON.stringify(r)); return r as Extract<T, { ok: true }>; };
/** Serve the next passage, let the learner take `sec` seconds, then submit a GREEN answer. */
async function attempt(key: string, sec: number, score = 0.9, c: Ctx = ctx) {
  const served = ok(await svc.serveAssessmentPassage(c));
  clock += sec * 1000;
  return ok(await svc.submitAssessmentAttempt(c, { key, wpm: served.nextWpm, comprehensionScore: score }));
}
const elapsed = async () => (await store.load("kid"))!.state.elapsedSec;

describe("the assessment clock is the server's (#24)", () => {
  it("records the start time durably and the elapsed time of each attempt from server timestamps", async () => {
    const stored = (await store.load("kid"))!;
    expect(stored.startedAt).toBe(new Date(T0).toISOString());
    await attempt("k1", 25);
    await attempt("k2", 40);
    expect(await elapsed()).toBe(65);
    expect((await store.load("kid"))!.state.attempts.map((a) => a.durationSec)).toEqual([25, 40]);
  });

  it("slow answering consumes more of the ten-minute budget than fast answering", async () => {
    await attempt("k1", 300);
    const slow = await elapsed();
    expect(slow).toBe(300);
    expect(slow).toBeGreaterThan(30);
  });

  it("a client cannot supply, extend or shorten the duration: the request has no duration input", async () => {
    const served = ok(await svc.serveAssessmentPassage(ctx));
    clock += 20_000;
    await svc.submitAssessmentAttempt(ctx, { key: "k1", wpm: served.nextWpm, comprehensionScore: 0.9, durationSec: 1 } as never);
    expect(await elapsed()).toBe(20);
  });

  it("replaying an answer does not consume time twice", async () => {
    await attempt("k1", 30);
    clock += 120_000;
    const replay = ok(await svc.submitAssessmentAttempt(ctx, { key: "k1", wpm: 60, comprehensionScore: 0.9 }));
    expect(replay.replayed).toBe(true);
    expect(await elapsed()).toBe(30);
  });

  it("re-fetching the same passage (reload) does not restart its clock", async () => {
    ok(await svc.serveAssessmentPassage(ctx));
    clock += 50_000;
    const again = ok(await svc.serveAssessmentPassage(ctx));
    clock += 10_000;
    ok(await svc.submitAssessmentAttempt(ctx, { key: "k1", wpm: again.nextWpm, comprehensionScore: 0.9 }));
    expect(await elapsed()).toBe(60);
  });

  it("an answer without a recorded serve is measured from the last trusted event, never a fixed estimate", async () => {
    clock += 33_000;
    ok(await svc.submitAssessmentAttempt(ctx, { key: "k1", wpm: 60, comprehensionScore: 0.9 }));
    expect(await elapsed()).toBe(33);
  });

  it("a passage served in a new session restarts its clock: time away is not charged", async () => {
    ok(await svc.serveAssessmentPassage(ctx));
    sessions.close("kid", "S1", iso(), "NORMAL");
    clock += 3 * 24 * 3600_000;
    const c2: Ctx = { ...ctx, sessionId: "S2" };
    ok(await svc.bootstrap(c2));
    const served = ok(await svc.serveAssessmentPassage(c2));
    clock += 15_000;
    ok(await svc.submitAssessmentAttempt(c2, { key: "k1", wpm: served.nextWpm, comprehensionScore: 0.9 }));
    expect(await elapsed()).toBe(15);
  });
});

describe("the ten-minute budget boundary", () => {
  /** Spend `totalSec` across two attempts, or in one when it already exceeds the budget on its own. */
  async function takeUntil(totalSec: number) {
    if (totalSec > 600) return await attempt("k1", totalSec);
    await attempt("k1", totalSec - 1);
    return await attempt("k2", 1);
  }
  it("599 seconds: the assessment is still open", async () => {
    expect((await takeUntil(599)).status).toBe("IN_PROGRESS");
  });
  it("exactly 600 seconds: the budget is spent and the assessment completes", async () => {
    expect((await takeUntil(600)).status).toBe("COMPLETE");
  });
  it("over 600 seconds: complete, falling back to the confirmed speed or the floor", async () => {
    const r = await takeUntil(750);
    expect(r.status).toBe("COMPLETE");
    const fin = ok(await svc.finalizeAssessment(ctx));
    expect(fin.startingWpm).toBeGreaterThanOrEqual(30);
  });
  it("is deterministic: the same evidence and timings give the same baseline", async () => {
    const run = async () => {
      const d = mkdtempSync(join(tmpdir(), "sr-el2-"));
      let c = T0;
      const s = new LearnerService({ repo: new FileLearnerRepository(d), assessments: new MemoryAssessmentStore(), sessions: new SessionRegistry(SESSION_POLICY_V1), bpcCatalog: [], provenance: () => null, now: () => new Date(c).toISOString() });
      await s.bootstrap(ctx); await s.startAssessment(ctx);
      for (let i = 0; ; i += 1) {
        const served = ok(await s.serveAssessmentPassage(ctx));
        c += 40_000;
        const r = ok(await s.submitAssessmentAttempt(ctx, { key: `k${i}`, wpm: served.nextWpm, comprehensionScore: served.nextWpm <= 80 ? 0.9 : 0.4 }));
        if (r.status === "COMPLETE") break;
      }
      const wpm = ok(await s.finalizeAssessment(ctx)).startingWpm;
      rmSync(d, { recursive: true, force: true });
      return wpm;
    };
    expect(await run()).toBe(await run());
  });
});
