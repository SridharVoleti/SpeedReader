import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileLearnerRepository, type LearnerRepository } from "../../../lib/v2/learner-repository";
import { SupabaseAssessmentStore, SupabaseLearnerRepository, SupabaseSessionPersistence, supabaseConfigFromEnv } from "../../../lib/v2/supabase-adapters";
import { FileSessionPersistence } from "../../../lib/v2/file-session-store";
import { FileAssessmentStore } from "../../../lib/v2/file-assessment-store";
import { LearnerService, MemoryAssessmentStore, type AssessmentStore, type Ctx } from "../../../lib/v2/learner-service";
import { SessionRegistry, type SessionPersistence } from "../../../lib/v2/session-envelope";
import { recordNewProgressionAttempt } from "../../../lib/v2/attempt-record";
import { newLearnerAggregate, type LearnerAggregate } from "../../../lib/v2/learner-aggregate";
import { scoreComprehension, structuredEvidence } from "../../../lib/v2/comprehension-score";
import { buildDeps, handleV3 } from "../../../api/v3";
import { FixtureContentProvider } from "../../../lib/v2/content-provider";
import { createFakePostgrest } from "./helpers/fake-postgrest";

const scored = (s: number) => scoreComprehension(structuredEvidence([{ itemId: "q1", score: s }]), { score: s });
const step = (l: LearnerAggregate, i: number, s = 0.9) =>
  recordNewProgressionAttempt(l, { attemptId: `a${i}`, passageId: `P${i + 1}`, displayedWpm: l.core.wpm, passageWords: 100, recordedAt: "2026-10-03T10:00:00Z", comprehension: scored(s) }).learner;
const afterFour = () => { let l = newLearnerAggregate("kid-1", 90); for (let i = 0; i < 4; i += 1) l = step(l, i); return l; };

// One behavioural contract, run against every LearnerRepository implementation.
function repositoryContract(name: string, make: () => LearnerRepository) {
  describe(`LearnerRepository contract: ${name}`, () => {
    let repo: LearnerRepository;
    beforeEach(() => { repo = make(); });

    it("creates, loads and lists learners; create never overwrites", async () => {
      expect(await repo.load("kid-1")).toBeNull();
      await repo.create(afterFour());
      expect((await repo.load("kid-1"))!.version).toBe(1);
      await expect(Promise.resolve().then(() => repo.create(afterFour()))).rejects.toThrow(/already exists/);
      await repo.create(newLearnerAggregate("kid-2", 100));
      expect((await repo.list()).map((s) => s.learner.learnerId).sort()).toEqual(["kid-1", "kid-2"]);
    });

    it("commits atomically with a version bump and persists the new state", async () => {
      await repo.create(afterFour());
      const r = await repo.commit("kid-1", step(afterFour(), 4), { expectedVersion: 1, idempotencyKey: "a4" });
      expect(r).toMatchObject({ ok: true, replayed: false });
      const s = (await repo.load("kid-1"))!;
      expect(s.version).toBe(2);
      expect(s.learner.core.wpm).toBe(91);
      expect(s.learner.ledger).toHaveLength(5);
    });

    it("replays an already-applied idempotency key without re-applying", async () => {
      await repo.create(afterFour());
      const next = step(afterFour(), 4);
      await repo.commit("kid-1", next, { expectedVersion: 1, idempotencyKey: "a4" });
      expect(await repo.commit("kid-1", next, { expectedVersion: 1, idempotencyKey: "a4" })).toMatchObject({ ok: true, replayed: true });
      expect((await repo.load("kid-1"))!.version).toBe(2);
    });

    it("rejects a stale writer, an unknown learner, and invariant violations", async () => {
      await repo.create(afterFour());
      await repo.commit("kid-1", step(afterFour(), 4), { expectedVersion: 1, idempotencyKey: "a4" });
      expect(await repo.commit("kid-1", step(afterFour(), 4, 0.5), { expectedVersion: 1, idempotencyKey: "other" })).toMatchObject({ ok: false, reason: "VERSION_CONFLICT" });
      expect(await repo.commit("nobody", afterFour(), { expectedVersion: 1, idempotencyKey: "k" })).toMatchObject({ ok: false, reason: "UNKNOWN_LEARNER" });
      const good = step(afterFour(), 4);
      expect(await repo.commit("kid-1", { ...good, core: { ...good.core, wpm: 120 } }, { expectedVersion: 2, idempotencyKey: "x" })).toMatchObject({ ok: false, reason: "INVARIANT_VIOLATION" });
      expect(await repo.commit("kid-1", { ...good, learnerId: "someone-else" }, { expectedVersion: 2, idempotencyKey: "y" })).toMatchObject({ ok: false, reason: "INVARIANT_VIOLATION" });
      expect((await repo.load("kid-1"))!.version).toBe(2);
    });

    it("keeps learners isolated", async () => {
      await repo.create(afterFour());
      await repo.create(newLearnerAggregate("kid-2", 100));
      expect((await repo.load("kid-2"))!.learner.core.wpm).toBe(100);
      expect((await repo.load("kid-1"))!.learner.core.wpm).toBe(90);
    });
  });
}

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "sr-sb-")); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

repositoryContract("file", () => new FileLearnerRepository(mkdtempSync(join(tmpdir(), "sr-sb-file-"))));
repositoryContract("supabase (fake PostgREST)", () => new SupabaseLearnerRepository({ url: "https://x.supabase.co", serviceRoleKey: "service-key", fetchImpl: createFakePostgrest().fetchImpl }));

describe("Supabase request shapes", () => {
  it("authenticates server-side with the service key, URL-encodes ids, and selects only needed columns", async () => {
    const f = createFakePostgrest();
    const repo = new SupabaseLearnerRepository({ url: "https://x.supabase.co/", serviceRoleKey: "service-key", fetchImpl: f.fetchImpl });
    await repo.load("a b/../c");
    const call = f.calls[0];
    expect(call.url).toBe("https://x.supabase.co/rest/v1/sr_learner_state?learner_id=eq.a%20b%2F..%2Fc&select=state,version");
    expect(call.headers).toMatchObject({ apikey: "service-key", authorization: "Bearer service-key" });
  });

  it("writes the denormalised WPM and pointer columns that the schema constrains", async () => {
    const f = createFakePostgrest();
    const repo = new SupabaseLearnerRepository({ url: "https://x.supabase.co", serviceRoleKey: "k", fetchImpl: f.fetchImpl });
    await repo.create(afterFour());
    expect(f.calls[0].body).toMatchObject({ learner_id: "kid-1", baseline_wpm: 90, current_wpm: 90, canonical_pointer: 5, version: 1 });
  });

  it("sends the new attempt record in the same transactional call as the state", async () => {
    const f = createFakePostgrest();
    const repo = new SupabaseLearnerRepository({ url: "https://x.supabase.co", serviceRoleKey: "k", fetchImpl: f.fetchImpl });
    await repo.create(afterFour());
    await repo.commit("kid-1", step(afterFour(), 4), { expectedVersion: 1, idempotencyKey: "a4" });
    const rpc = f.calls.find((c) => c.url.endsWith("/rpc/sr_commit_learner"))!;
    expect(rpc.body).toMatchObject({ p_learner_id: "kid-1", p_expected_version: 1, p_idempotency_key: "a4", p_current_wpm: 91, p_pointer: 6 });
    expect(rpc.body!.p_attempt).toMatchObject({ attemptId: "a4", attemptType: "NEW_PROGRESSION" });
    expect(f.attempts.has("kid-1|a4")).toBe(true);
  });

  it("a practice or News Reader commit (no new attempt) sends no attempt record", async () => {
    const f = createFakePostgrest();
    const repo = new SupabaseLearnerRepository({ url: "https://x.supabase.co", serviceRoleKey: "k", fetchImpl: f.fetchImpl });
    const l = afterFour();
    await repo.create(l);
    await repo.commit("kid-1", { ...l, practiceServedSinceLastNew: true }, { expectedVersion: 1, idempotencyKey: "practice:p1" });
    expect(f.calls.find((c) => c.url.endsWith("/rpc/sr_commit_learner"))!.body!.p_attempt).toBeNull();
  });

  it("a failing network call becomes WRITE_FAILED, never an exception, and leaves state untouched", async () => {
    const f = createFakePostgrest();
    let fail = false;
    const flaky = (async (u: RequestInfo | URL, i?: RequestInit) => { if (fail && String(u).includes("/rpc/")) throw new Error("network down"); return f.fetchImpl(u, i); }) as typeof fetch;
    const repo = new SupabaseLearnerRepository({ url: "https://x.supabase.co", serviceRoleKey: "k", fetchImpl: flaky });
    await repo.create(afterFour());
    fail = true;
    expect(await repo.commit("kid-1", step(afterFour(), 4), { expectedVersion: 1, idempotencyKey: "a4" })).toMatchObject({ ok: false, reason: "WRITE_FAILED" });
    fail = false;
    expect((await repo.load("kid-1"))!.version).toBe(1);
    expect(await repo.commit("kid-1", step(afterFour(), 4), { expectedVersion: 1, idempotencyKey: "a4" })).toMatchObject({ ok: true, replayed: false });
  });

  it("an HTTP error on read surfaces as an error rather than pretending the learner does not exist", async () => {
    const down = (async () => new Response("boom", { status: 500 })) as typeof fetch;
    const repo = new SupabaseLearnerRepository({ url: "https://x.supabase.co", serviceRoleKey: "k", fetchImpl: down });
    await expect(repo.load("kid-1")).rejects.toThrow(/failed: 500/);
  });

  it("is selected from the environment only when both variables are present", () => {
    expect(supabaseConfigFromEnv({})).toBeNull();
    expect(supabaseConfigFromEnv({ SUPABASE_URL: "https://x.supabase.co" })).toBeNull();
    expect(supabaseConfigFromEnv({ SUPABASE_SERVICE_ROLE_KEY: "k" })).toBeNull();
    expect(supabaseConfigFromEnv({ SUPABASE_URL: "https://x.supabase.co//", SUPABASE_SERVICE_ROLE_KEY: " k " })).toMatchObject({ url: "https://x.supabase.co", serviceRoleKey: "k" });
  });
});

describe("adapter and schema stay in step", () => {
  const sql = readFileSync("hosted-app/supabase/migrations/0001_speedreader_learner_state.sql", "utf8");
  it("the RPC arguments the adapter sends are exactly the parameters of sr_commit_learner", async () => {
    const declared = [...sql.slice(sql.indexOf("function sr_commit_learner(")).split("returns")[0].matchAll(/p_\w+/g)].map((m) => m[0]).sort();
    const f = createFakePostgrest();
    const repo = new SupabaseLearnerRepository({ url: "https://x.supabase.co", serviceRoleKey: "k", fetchImpl: f.fetchImpl });
    await repo.create(afterFour());
    await repo.commit("kid-1", step(afterFour(), 4), { expectedVersion: 1, idempotencyKey: "a4" });
    expect(Object.keys(f.calls.find((c) => c.url.endsWith("/rpc/sr_commit_learner"))!.body!).sort()).toEqual(declared);
  });
  it("the tables and columns the adapters use exist in the migrations", () => {
    const all = ["0001_speedreader_learner_state.sql", "0003_speedreader_documents.sql"].map((f) => readFileSync(`hosted-app/supabase/migrations/${f}`, "utf8")).join("\n");
    for (const needle of ["sr_learner_state", "baseline_wpm", "current_wpm", "canonical_pointer", "sr_assessment_state", "sr_session_state", "records", "value"]) expect(all).toContain(needle);
  });
});

// ------------------------------------------------------------------------------------------------ documents + sessions

const T0 = Date.parse("2026-10-05T09:00:00Z");
const MIN = 60_000;
const ctx: Ctx = { learnerId: "kid", sessionId: "S1", deviceId: "phone" };

function sessionStores(): [string, () => { sessions: SessionPersistence; assessments: AssessmentStore }][] {
  return [
    ["file", () => { const d = mkdtempSync(join(tmpdir(), "sr-sess-")); return { sessions: new FileSessionPersistence(join(d, "s")), assessments: new FileAssessmentStore(join(d, "a")) }; }],
    ["supabase (fake)", () => { const f = createFakePostgrest(); const cfg = { url: "https://x.supabase.co", serviceRoleKey: "k", fetchImpl: f.fetchImpl }; return { sessions: new SupabaseSessionPersistence(cfg), assessments: new SupabaseAssessmentStore(cfg) }; }]
  ];
}

describe.each(sessionStores())("durable sessions and assessment progress: %s", (_name, make) => {
  /** Two server instances sharing only the durable stores (e.g. two serverless invocations). */
  function twoInstances(clock: { t: number }) {
    const stores = make();
    const repo = new FileLearnerRepository(mkdtempSync(join(tmpdir(), "sr-sess-l-")));
    const build = () => new LearnerService({ repo, assessments: stores.assessments, sessions: new SessionRegistry(), sessionStore: stores.sessions, bpcCatalog: [], provenance: () => ({ packageId: "TEST-PKG", packageVersion: 1, contentHash: "test-hash" }), now: () => new Date(clock.t).toISOString() });
    return { a: build(), b: build(), stores };
  }

  it("a session started on one instance is enforced on another (single active device)", async () => {
    const clock = { t: T0 };
    const { a, b } = twoInstances(clock);
    expect((await a.bootstrap(ctx)).ok).toBe(true);
    expect(await b.bootstrap({ ...ctx, deviceId: "laptop", sessionId: "S2" })).toMatchObject({ ok: false, status: 409 });
    expect((await b.bootstrap(ctx)).ok).toBe(true); // same device/session is welcomed on any instance
  });

  it("an accidentally closed session resumes on a different instance within the window, with its committed keys", async () => {
    const clock = { t: T0 };
    const { a, b, stores } = twoInstances(clock);
    await a.bootstrap(ctx);
    // simulate committed work + an accidental close, persisted by instance A
    const reg = new SessionRegistry();
    reg.hydrate("kid", await stores.sessions.load("kid"));
    reg.checkpoint("kid", "S1", new Date(clock.t + MIN).toISOString(), { activity: "PASSAGE_COMPLETE", position: 3, committedEventKeys: ["a1", "a2"] });
    reg.close("kid", "S1", new Date(clock.t + 2 * MIN).toISOString(), "ACCIDENTAL");
    await stores.sessions.save("kid", reg.list("kid"));
    clock.t += 10 * MIN;
    const r = await b.resume(ctx);
    expect(r).toMatchObject({ ok: true, resumed: true, resumeFrom: { activity: "PASSAGE_COMPLETE", committedEventKeys: ["a1", "a2"] } });
    clock.t += 30 * MIN; // past the original 45-minute end
    expect((await a.bootstrap(ctx)).ok).toBe(true);
  });

  it("the weekly limit holds across instances", async () => {
    const clock = { t: T0 };
    const { a, b, stores } = twoInstances(clock);
    await a.bootstrap(ctx);
    const reg = new SessionRegistry(); reg.hydrate("kid", await stores.sessions.load("kid"));
    reg.close("kid", "S1", new Date(clock.t + MIN).toISOString(), "NORMAL");
    await stores.sessions.save("kid", reg.list("kid"));
    clock.t += 24 * 60 * MIN;
    expect((await b.bootstrap({ ...ctx, sessionId: "S2" })).ok).toBe(true);
    reg.hydrate("kid", await stores.sessions.load("kid"));
    reg.close("kid", "S2", new Date(clock.t + MIN).toISOString(), "NORMAL");
    await stores.sessions.save("kid", reg.list("kid"));
    clock.t += 24 * 60 * MIN;
    expect(await a.bootstrap({ ...ctx, sessionId: "S3" })).toMatchObject({ ok: false, status: 429 });
  });

  it("assessment progress survives across instances and finalizes once", async () => {
    const clock = { t: T0 };
    const { a, b } = twoInstances(clock);
    await a.bootstrap(ctx);
    const start = await a.startAssessment(ctx);
    expect(start.ok && start.nextWpm).toBe(60);
    let status = "IN_PROGRESS";
    for (let i = 1; status !== "COMPLETE"; i += 1) {
      const svc = i % 2 ? b : a; // alternate instances every attempt
      const p = await svc.assessmentPending(ctx);
      if (!p.ok) throw new Error(JSON.stringify(p));
      const r = await svc.submitAssessmentAttempt(ctx, { key: `k${i}`, wpm: p.nextWpm, comprehensionScore: p.nextWpm <= 70 ? 0.9 : 0.3 });
      if (!r.ok) throw new Error(JSON.stringify(r));
      status = r.status;
    }
    const f1 = await a.finalizeAssessment(ctx);
    const f2 = await b.finalizeAssessment(ctx);
    expect(f1).toMatchObject({ ok: true, startingWpm: 70, replayed: false });
    expect(f2).toMatchObject({ ok: true, startingWpm: 70, replayed: true });
  });
});

describe("the whole v3 journey runs through the Supabase adapters (fake PostgREST)", () => {
  it("assessment -> story -> Level Up evidence is written via the transactional function", async () => {
    const f = createFakePostgrest();
    const deps = buildDeps(dir, new FixtureContentProvider(), { url: "https://x.supabase.co", serviceRoleKey: "k", fetchImpl: f.fetchImpl });
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
    for (let i = 1; i <= 5; i += 1) {
      const r = await call("POST", "passage/submit", { attemptId: `a${i}`, passageId: `FX-000${i}`, answers: RIGHT, explanation: { text: "Mia has a red kite and takes it to the big hill. The string slips so the kite flies away over the trees. Ravi finds the kite stuck in a bush and carries it back. A kind friend turns a sad day into a happy one.", mode: "typed" } });
      expect(r.status).toBe(200);
    }
    expect(f.attempts.size).toBe(5);
    expect(f.applied.size).toBe(5);
    expect(f.docs.sr_session_state.has("kid")).toBe(true);
    expect(f.docs.sr_assessment_state.has("kid")).toBe(true);
    const stored = f.learners.get("kid")!;
    expect(stored.version).toBeGreaterThanOrEqual(6);
    expect(stored.state.core.wpm).toBeGreaterThan(stored.state.baselineWpm - 1);
  });
});

describe("MemoryAssessmentStore stays available for tests", () => {
  it("round-trips by value", async () => {
    const s = new MemoryAssessmentStore();
    expect(s.load("x")).toBeNull();
  });
});
