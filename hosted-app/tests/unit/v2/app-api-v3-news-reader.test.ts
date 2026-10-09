import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildDeps, handleV3, type Verified } from "../../../api/v3";
import { FIXTURE_STORY, FixtureContentProvider } from "../../../lib/v2/content-provider";

const who: Verified = { learnerId: "kid", sessionId: "S1", deviceId: "phone" };
const RIGHT = [1, 0, 2, 0];
const RETELL = "Mia has a red kite and takes it to the big hill. The string slips so the kite flies away over the trees. Ravi finds the kite stuck in a bush and carries it back. A kind friend turns a sad day into a happy one.";
let dir: string;
let deps: ReturnType<typeof buildDeps>;

beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "sr-nr-")); deps = buildDeps(dir, new FixtureContentProvider()); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const call = async (method: string, path: string, body?: unknown) => {
  const res = await handleV3(new Request(`http://localhost/api/v3/${path}`, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }), path.split("?")[0].split("/"), who, deps);
  return { status: res.status, body: (await res.json()) as Record<string, any> };
};

async function onboardAndRead(stories = 1) {
  await call("POST", "bootstrap");
  await call("POST", "assessment/start");
  for (let i = 1; ; i += 1) {
    const p = await call("GET", "assessment/passage");
    const a = await call("POST", "assessment/answer", { key: `k${i}`, answers: RIGHT });
    expect(p.status).toBe(200);
    if (a.body.status === "COMPLETE") break;
  }
  await call("POST", "assessment/finalize");
  for (let i = 1; i <= stories; i += 1) {
    const r = await call("POST", "passage/submit", { attemptId: `a${i}`, passageId: `FX-${String(i).padStart(4, "0")}`, answers: RIGHT, explanation: { text: RETELL, mode: "typed" } });
    expect(r.status).toBe(200);
  }
}

describe("News Reader over HTTP (APP-API-007, APP-NR-001..010)", () => {
  it("lists only completed stories and refuses an unread one (no spoilers of the canonical sequence)", async () => {
    await onboardAndRead(2);
    expect((await call("GET", "news-reader/passages")).body.passages).toEqual([{ passageId: "FX-0001" }, { passageId: "FX-0002" }]);
    expect((await call("POST", "news-reader/start", { passageId: "FX-0003" })).status).toBe(400);
    expect((await call("POST", "news-reader/read", { passageId: "FX-0003", readNumber: 1, key: "k", micState: "OK", transcript: "x", confidence: 0.9 })).status).toBe(400);
  });

  it("start returns the reference delivery policy (145 WPM female TTS) and the canonical tokens for read-along", async () => {
    await onboardAndRead(1);
    const s = await call("POST", "news-reader/start", { passageId: "FX-0001" });
    expect(s.body.delivery).toMatchObject({ mode: "TTS", wpm: 145, voiceGender: "female" });
    expect(s.body.passage.tokens[0]).toEqual({ index: 1, text: "Mia" });
    expect(JSON.stringify(s.body)).not.toMatch(/answerIndex|ideas|bpc/i);
  });

  it("two reads are stored separately, the second is framed as practice, and core state is untouched", async () => {
    await onboardAndRead(1);
    const before = (await deps.repo.load("kid"))!.learner;
    const half = FIXTURE_STORY.split(" ").map((w, i) => (i % 2 ? "zzz" : w)).join(" ");
    const r1 = await call("POST", "news-reader/read", { passageId: "FX-0001", readNumber: 1, key: "a", micState: "OK", transcript: half, confidence: 0.9 });
    expect(r1.body).toMatchObject({ ok: true, technicalState: "OK", coaching: { status: "INCOMPLETE" } });
    const r2 = await call("POST", "news-reader/read", { passageId: "FX-0001", readNumber: 2, key: "b", micState: "OK", transcript: FIXTURE_STORY, confidence: 0.9 });
    expect(r2.body.coaching).toMatchObject({ status: "COMPLETE", improved: true });
    expect(r2.body.coaching.coaching).toMatch(/second read/i);
    const after = (await deps.repo.load("kid"))!.learner;
    expect(after.newsReader.attempts).toHaveLength(2);
    expect(after.core).toEqual(before.core);
    expect(after.canonicalPointer).toBe(before.canonicalPointer);
    expect(after.ledger).toEqual(before.ledger);
  });

  it("a replayed read is idempotent", async () => {
    await onboardAndRead(1);
    const body = { passageId: "FX-0001", readNumber: 1, key: "same", micState: "OK", transcript: FIXTURE_STORY, confidence: 0.9 };
    await call("POST", "news-reader/read", body);
    await call("POST", "news-reader/read", body);
    expect((await deps.repo.load("kid"))!.learner.newsReader.attempts).toHaveLength(1);
  });

  it("missing microphone, failed capture or low confidence are technical: stored unscored and never block anything", async () => {
    await onboardAndRead(1);
    const mic = await call("POST", "news-reader/read", { passageId: "FX-0001", readNumber: 1, key: "m", micState: "MIC_UNAVAILABLE" });
    expect(mic.body).toMatchObject({ ok: true, technicalState: "MIC_UNAVAILABLE" });
    const low = await call("POST", "news-reader/read", { passageId: "FX-0001", readNumber: 2, key: "l", micState: "OK", transcript: FIXTURE_STORY, confidence: 0.2 });
    expect(low.body).toMatchObject({ technicalState: "CAPTURE_FAILED", coaching: { status: "UNSCORED" } });
    const l = (await deps.repo.load("kid"))!.learner;
    expect(l.core.wpm).toBeGreaterThan(0);
    expect((await call("GET", "passage/next")).body.ok).toBe(true); // the next canonical story is still open
  });

  it("validates the request and the direct-submit route is closed (metrics are the server's job)", async () => {
    await onboardAndRead(1);
    expect((await call("POST", "news-reader/read", { passageId: "FX-0001", readNumber: 3, key: "k", micState: "OK" })).status).toBe(400);
    expect((await call("POST", "news-reader/read", { passageId: "FX-0001", readNumber: 1, micState: "OK" })).status).toBe(400);
    expect((await call("POST", "news-reader/submit", { attemptId: "x" })).status).toBe(404);
  });
});
