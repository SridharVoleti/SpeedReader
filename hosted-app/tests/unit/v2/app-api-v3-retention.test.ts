import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildDeps, handleV3, retentionPolicyFromEnv, type Verified } from "../../../api/v3";
import { FixtureContentProvider } from "../../../lib/v2/content-provider";
import { RETENTION_POLICY_V1 } from "../../../lib/v2/retention-check";
import { assertNoInternalLeak } from "../../../lib/v2/learner-feedback";

const who: Verified = { learnerId: "kid", sessionId: "S1", deviceId: "phone" };
const RIGHT = [1, 0, 2, 0];
const WRONG = [0, 1, 0, 1];
const RETELL = "Mia has a red kite and takes it to the big hill. The string slips so the kite flies away over the trees. Ravi finds the kite stuck in a bush and carries it back. A kind friend turns a sad day into a happy one.";
let dir: string;

beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "sr-ret-")); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const due = { ...RETENTION_POLICY_V1, version: "retention-test", intervalsHours: [0, 168, 720] }; // first check immediately due
const make = (policy = RETENTION_POLICY_V1) => buildDeps(dir, new FixtureContentProvider(), null, policy);

const mk = (deps: ReturnType<typeof make>) => async (method: string, path: string, body?: unknown) => {
  const res = await handleV3(new Request(`http://localhost/api/v3/${path}`, { method, body: body === undefined ? undefined : JSON.stringify(body) }), path.split("?")[0].split("/"), who, deps);
  return { status: res.status, body: (await res.json()) as Record<string, any> };
};

async function readStories(call: ReturnType<typeof mk>, stories: number) {
  await call("POST", "bootstrap");
  await call("POST", "assessment/start");
  for (let i = 1; ; i += 1) { const a = await call("POST", "assessment/answer", { key: `k${i}`, answers: RIGHT }); if (a.body.status === "COMPLETE") break; }
  await call("POST", "assessment/finalize");
  for (let i = 1; i <= stories; i += 1) {
    const r = await call("POST", "passage/submit", { attemptId: `a${i}`, passageId: `FX-000${i}`, answers: RIGHT, explanation: { text: RETELL, mode: "typed" } });
    expect(r.status).toBe(200);
  }
}

describe("spaced memory checks over HTTP", () => {
  it("with the production schedule nothing is due right after reading a story", async () => {
    const deps = make();
    const call = mk(deps);
    await readStories(call, 1);
    expect((await call("GET", "progress")).body).toMatchObject({ storiesRead: 1, storiesRemembered: 0, retentionDue: false });
    expect((await call("GET", "retention/next")).status).toBe(409);
  });

  it("when due, only the questions are sent - never the story text - and the check is answered from memory", async () => {
    const deps = make(due);
    const call = mk(deps);
    await readStories(call, 1);
    expect((await call("GET", "progress")).body.retentionDue).toBe(true);
    const next = await call("GET", "retention/next");
    expect(next.status).toBe(200);
    expect(next.body.due).toEqual({ passageId: "FX-0001", checkNumber: 1 });
    expect(next.body.items).toHaveLength(4);
    expect(JSON.stringify(next.body)).not.toMatch(/tokens|answerIndex|Mia has a red kite|bpc/i);
  });

  it("a good memory is celebrated and counted; the refresher arrives only after answering", async () => {
    const deps = make(due);
    const call = mk(deps);
    await readStories(call, 1);
    const r = await call("POST", "retention/submit", { attemptId: "r1", passageId: "FX-0001", answers: RIGHT });
    expect(r.status).toBe(200);
    expect(r.body.feedback).toEqual({ message: "You remember this story really well - great memory!", remembered: true });
    expect(r.body.refresher).toMatch(/red kite/);
    assertNoInternalLeak({ message: r.body.feedback.message });
    expect((await call("GET", "progress")).body).toMatchObject({ storiesRemembered: 1, retentionDue: false });
  });

  it("a faded memory is met with a normal-and-fine message plus a refresher, never a failure", async () => {
    const deps = make(due);
    const call = mk(deps);
    await readStories(call, 1);
    const r = await call("POST", "retention/submit", { attemptId: "r1", passageId: "FX-0001", answers: WRONG });
    expect(r.body.feedback.remembered).toBe(false);
    expect(r.body.feedback.message).toMatch(/completely normal/);
    expect(JSON.stringify(r.body.feedback)).not.toMatch(/fail|wrong|score|%|GREEN/i);
    expect(r.body.refresher).toBeTruthy();
    expect((await call("GET", "progress")).body.storiesRemembered).toBe(0);
  });

  it("never touches progression: speed, pointer and ledger are identical before and after, and the next story stays open", async () => {
    const deps = make(due);
    const call = mk(deps);
    await readStories(call, 2);
    const before = (await deps.repo.load("kid"))!.learner;
    await call("POST", "retention/submit", { attemptId: "r1", passageId: "FX-0001", answers: WRONG });
    const after = (await deps.repo.load("kid"))!.learner;
    expect(after.core).toEqual(before.core);
    expect(after.canonicalPointer).toBe(before.canonicalPointer);
    expect(after.ledger).toEqual(before.ledger);
    expect((await call("GET", "passage/next")).body.sequence).toBe(3);
  });

  it("is idempotent, refuses a story that is not due, and validates the request", async () => {
    const deps = make(due);
    const call = mk(deps);
    await readStories(call, 1);
    const a = await call("POST", "retention/submit", { attemptId: "r1", passageId: "FX-0001", answers: RIGHT });
    const b = await call("POST", "retention/submit", { attemptId: "r1", passageId: "FX-0001", answers: WRONG });
    expect(b.body.replayed).toBe(true);
    expect(a.body.feedback.remembered).toBe(true);
    expect((await deps.repo.load("kid"))!.learner.retentionLog).toHaveLength(1);
    // check 2 is a week away
    expect((await call("POST", "retention/submit", { attemptId: "r2", passageId: "FX-0001", answers: RIGHT })).status).toBe(409);
    expect((await call("POST", "retention/submit", { attemptId: "r3", passageId: "FX-0009", answers: RIGHT })).status).toBeGreaterThanOrEqual(400);
    expect((await call("POST", "retention/submit", { passageId: "FX-0001" })).status).toBe(400);
  });

  it("the sync API does not change: a memory check reports nothing to Babysteps and is invisible to the ledger-based decision log", async () => {
    const deps = make(due);
    const call = mk(deps);
    await readStories(call, 1);
    await call("POST", "retention/submit", { attemptId: "r1", passageId: "FX-0001", answers: RIGHT });
    const l = (await deps.repo.load("kid"))!.learner;
    expect(l.ledger.every((r) => r.attemptType === "NEW_PROGRESSION")).toBe(true);
    expect(l.ledger).toHaveLength(1);
  });
});

describe("the schedule can only be shortened where diagnostics are enabled", () => {
  it("production and previews that did not opt in keep the pilot schedule", () => {
    expect(retentionPolicyFromEnv({})).toBe(RETENTION_POLICY_V1);
    expect(retentionPolicyFromEnv({ SR_RETENTION_FIRST_CHECK_HOURS: "0" })).toBe(RETENTION_POLICY_V1);
    expect(retentionPolicyFromEnv({ SR_RETENTION_FIRST_CHECK_HOURS: "0", SR_ENABLE_DIAGNOSTICS: "true", VERCEL_ENV: "production" })).toBe(RETENTION_POLICY_V1);
  });
  it("a test deployment may bring only the first check forward, and the version records it", () => {
    const p = retentionPolicyFromEnv({ SR_RETENTION_FIRST_CHECK_HOURS: "0", SR_ENABLE_DIAGNOSTICS: "true" });
    expect(p.intervalsHours).toEqual([0, 168, 720]);
    expect(p.version).toMatch(/\+test-first-0h$/);
    expect(retentionPolicyFromEnv({ SR_RETENTION_FIRST_CHECK_HOURS: "abc", SR_ENABLE_DIAGNOSTICS: "true" })).toBe(RETENTION_POLICY_V1);
    expect(retentionPolicyFromEnv({ SR_RETENTION_FIRST_CHECK_HOURS: "-3", SR_ENABLE_DIAGNOSTICS: "true" })).toBe(RETENTION_POLICY_V1);
  });
});
