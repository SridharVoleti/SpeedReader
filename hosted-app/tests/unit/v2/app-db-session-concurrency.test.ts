import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { migratedDb, pgliteFetch } from "./helpers/pglite-postgrest";
import { SupabaseSessionPersistence } from "../../../lib/v2/supabase-adapters";
import { FileSessionPersistence } from "../../../lib/v2/file-session-store";
import { LearnerService, MemoryAssessmentStore, type Ctx } from "../../../lib/v2/learner-service";
import { FileLearnerRepository } from "../../../lib/v2/learner-repository";
import { SessionRegistry, type SessionPersistence } from "../../../lib/v2/session-envelope";

// Issue #21: session arbitration is atomic across serverless instances (separate in-memory registries, one durable store).
const T0 = Date.parse("2026-10-05T09:00:00Z"); // a Monday
const DAY = 24 * 60 * 60_000;

async function stores(): Promise<[string, () => Promise<SessionPersistence>][]> {
  return [
    ["postgres (real SQL)", async () => new SupabaseSessionPersistence({ url: "https://x.supabase.co", serviceRoleKey: "k", fetchImpl: pgliteFetch(await migratedDb()) })],
    ["file", async () => new FileSessionPersistence(join(mkdtempSync(join(tmpdir(), "sr-conc-")), "s"))]
  ];
}

describe.each(await stores())("concurrent session starts: %s", (_name, makeStore) => {
  async function fleet(n: number, clock: { t: number }) {
    const store = await makeStore();
    const repo = new FileLearnerRepository(mkdtempSync(join(tmpdir(), "sr-conc-l-")));
    const instances = Array.from({ length: n }, () => new LearnerService({ repo, assessments: new MemoryAssessmentStore(), sessions: new SessionRegistry(), sessionStore: store, bpcCatalog: [], now: () => new Date(clock.t).toISOString() }));
    const ctxOf = (i: number): Ctx => ({ learnerId: "kid", sessionId: `S${i}`, deviceId: `dev${i}` });
    return { store, instances, ctxOf };
  }

  it("two simultaneous bootstraps from different devices: exactly one wins, one active session is persisted", async () => {
    const clock = { t: T0 };
    const { store, instances, ctxOf } = await fleet(2, clock);
    const results = await Promise.all(instances.map((s, i) => s.bootstrap(ctxOf(i))));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toEqual([expect.objectContaining({ status: 409 })]);
    const saved = await store.load("kid");
    expect(saved.filter((s) => s.state === "ACTIVE")).toHaveLength(1);
    expect(saved).toHaveLength(1);
  });

  it("many simultaneous starts never create more than one live session", async () => {
    const clock = { t: T0 };
    const { store, instances, ctxOf } = await fleet(8, clock);
    const results = await Promise.all(instances.map((s, i) => s.bootstrap(ctxOf(i))));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect((await store.load("kid")).filter((s) => s.state === "ACTIVE")).toHaveLength(1);
  });

  it("the weekly maximum holds under concurrency, ordinals are unique and the 6th session is REVIEW", async () => {
    const clock = { t: T0 };
    const { store, instances, ctxOf } = await fleet(4, clock);
    const closeLive = async () => {
      const reg = new SessionRegistry(); reg.hydrate("kid", await store.load("kid"));
      const live = reg.active("kid", new Date(clock.t).toISOString());
      if (live) { reg.close("kid", live.sessionId, new Date(clock.t + 60_000).toISOString(), "NORMAL"); await store.save("kid", reg.list("kid")); }
    };
    let n = 0;
    for (let week = 0; week < 3; week += 1) {
      clock.t = T0 + week * 7 * DAY;
      for (let round = 0; round < 3; round += 1) { // 3 rounds per week, but only 2 may succeed
        const results = await Promise.all(instances.map((s, i) => s.bootstrap({ ...ctxOf(i), sessionId: `S${n}-${i}` })));
        const wins = results.filter((r) => r.ok).length;
        expect(wins).toBe(round < 2 ? 1 : 0);
        await closeLive();
        clock.t += 60 * 60_000;
      }
      n += 1;
    }
    const saved = await store.load("kid");
    expect(saved.map((s) => s.ordinal)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(saved.map((s) => s.kind)).toEqual(["LEARNING", "LEARNING", "LEARNING", "LEARNING", "LEARNING", "REVIEW"]);
  });

  it("a write based on stale session state is rejected instead of overwriting newer state", async () => {
    const store = await makeStore();
    const v0 = await store.loadVersioned("kid");
    expect(v0.version).toBe(0);
    expect(await store.saveIfVersion("kid", [], v0.version)).toBe(true);
    expect(await store.saveIfVersion("kid", [], v0.version)).toBe(false); // stale
    expect((await store.loadVersioned("kid")).version).toBe(1);
  });
});
