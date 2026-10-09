import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildDeps, handleV3, internalAuthorized, makeProvider, sanitizeStartedAt, speechFor, type Verified } from "../../../api/v3";
import { ApprovedPackageProvider, FixtureContentProvider, type ContentProvider } from "../../../lib/v2/content-provider";
import { createStore } from "../../../lib/sr/pipeline/storage";
import { assertNoInternalLeak } from "../../../lib/v2/learner-feedback";

let dir: string;
const who: Verified = { learnerId: "kid", sessionId: "S1", deviceId: "phone" };
let deps: ReturnType<typeof buildDeps>;
const GOOD_RETELLING = "Mia has a red kite and takes it to the big hill. The string slips so the kite flies away over the trees. Ravi finds the kite stuck in a bush and carries it back. A kind friend turns a sad day into a happy one.";
const ALL_RIGHT = [1, 0, 2, 0];
const ALL_WRONG = [0, 1, 0, 1];

beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "sr-v3-")); deps = buildDeps(dir, new FixtureContentProvider()); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const call = async (method: string, path: string, body?: unknown, headers: Record<string, string> = {}, v: Verified = who, d = deps) => {
  const req = new Request(`http://localhost/api/v3/${path}`, { method, headers: { "content-type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  const res = await handleV3(req, path.split("?")[0].split("/"), v, d);
  return { status: res.status, body: (await res.json()) as Record<string, any> };
};

/** Complete the initial assessment for a learner who comprehends up to `limit` WPM. */
async function onboard(limit = 70) {
  await call("POST", "bootstrap");
  await call("POST", "assessment/start");
  let i = 0;
  for (;;) {
    const p = await call("GET", "assessment/passage");
    expect(p.status).toBe(200);
    const a = await call("POST", "assessment/answer", { key: `k${(i += 1)}`, answers: p.body.wpm <= limit ? ALL_RIGHT : ALL_WRONG });
    expect(a.status).toBe(200);
    if (a.body.status === "COMPLETE") break;
  }
  return (await call("POST", "assessment/finalize")).body;
}
const story = (text: string, over: Record<string, unknown> = {}) => ({ explanation: { text, mode: "typed" }, ...over });

describe("v3 transport: content-backed learner journey with server-side scoring", () => {
  it("assessment -> first story -> feedback -> BPC -> progress, with no answer keys ever sent to the browser", async () => {
    expect((await call("POST", "bootstrap")).body).toMatchObject({ state: "ASSESSMENT_REQUIRED", next: { activity: "INITIAL_ASSESSMENT" } });
    await call("POST", "assessment/start");
    const p = await call("GET", "assessment/passage");
    expect(p.body).toMatchObject({ ok: true, wpm: 60, attemptNumber: 1 });
    expect(JSON.stringify(p.body)).not.toMatch(/answerIndex|ideas|wordings|bpc/i);
    expect(p.body.passage.tokens.length).toBeGreaterThan(50);

    const fin = await onboard(70);
    expect(fin).toMatchObject({ startingWpm: 70 });
    const next = await call("GET", "passage/next");
    expect(next.body).toMatchObject({ ok: true, wpm: 70, sequence: 1 });
    expect(next.body.passage.passageId).toBe("FX-0001");

    const done = await call("POST", "passage/submit", { attemptId: "a1", passageId: "FX-0001", answers: ALL_RIGHT, ...story(GOOD_RETELLING) });
    expect(done.status).toBe(200);
    expect(done.body.feedback).toMatchObject({ celebration: "SMALL", showBestPossibleComprehension: true });
    expect(JSON.stringify(done.body)).not.toMatch(/GREEN|classification|score"|percent/i);
    assertNoInternalLeak(done.body.feedback);

    expect((await call("GET", "bpc?attemptId=a1")).body.text).toMatch(/kite/);
    expect((await call("GET", "progress")).body).toMatchObject({ currentWpm: 70, startingWpm: 70, storiesRead: 1 });
    expect((await call("GET", "passage/next")).body.sequence).toBe(2);
  });

  it("scoring is the server's job: the client cannot post scores, and the direct-score assessment route is closed", async () => {
    await onboard(70);
    const sneaky = await call("POST", "passage/submit", { attemptId: "x", passageId: "FX-0001", answers: ALL_WRONG, items: [{ itemId: "i1", score: 1 }], ...story("I like cricket.") });
    expect(sneaky.status).toBe(200);
    const learner = deps.repo.load("kid")!.learner;
    expect(learner.ledger[0].structured!.items.map((i) => i.score)).toEqual([0, 0, 0, 0]);
    expect(learner.ledger[0].classification).toBe("NOT_GREEN");
    expect(learner.core.wpm).toBe(70); // NOT_GREEN never lowers earned WPM
    expect((await call("POST", "assessment/attempt", { key: "k", wpm: 60, comprehensionScore: 1, durationSec: 1 })).status).toBe(404);
  });

  it("a typed explanation is evaluated on the server; a bad answer is neutral feedback, never a block", async () => {
    await onboard(70);
    const r = await call("POST", "passage/submit", { attemptId: "a1", passageId: "FX-0001", answers: ALL_WRONG, ...story("I like cricket.") });
    expect(r.body.feedback).toMatchObject({ celebration: "NONE", showBestPossibleComprehension: true });
    expect((await call("GET", "passage/next")).body.sequence).toBe(2);
  });

  it("technically failed speech is a retry, not a failure (APP-NFR-008)", async () => {
    await onboard(70);
    const r = await call("POST", "passage/submit", { attemptId: "t1", passageId: "FX-0001", answers: ALL_RIGHT, explanation: { asrFailed: true, mode: "spoken" } });
    expect(r.body.feedback.retry).toBe(true);
    expect((await call("GET", "progress")).body).toMatchObject({ storiesRead: 0, currentWpm: 70 });
    expect((await call("GET", "passage/next")).body.sequence).toBe(1);
  });

  it("an off-sequence story is refused; a replay of a committed attempt is answered from the ledger", async () => {
    await onboard(70);
    expect((await call("POST", "passage/submit", { attemptId: "a9", passageId: "FX-0005", answers: ALL_RIGHT, ...story(GOOD_RETELLING) })).status).toBe(409);
    await call("POST", "passage/submit", { attemptId: "a1", passageId: "FX-0001", answers: ALL_RIGHT, ...story(GOOD_RETELLING) });
    const again = await call("POST", "passage/submit", { attemptId: "a1", passageId: "FX-0001", answers: ALL_RIGHT, ...story(GOOD_RETELLING) });
    expect(again.body.replayed).toBe(true);
    expect(deps.repo.load("kid")!.learner.ledger).toHaveLength(1);
  });

  it("while holding, a familiar story is offered at the current WPM and completing it moves nothing", async () => {
    await onboard(70);
    for (let i = 1; i <= 5; i += 1) await call("POST", "passage/submit", { attemptId: `s${i}`, passageId: `FX-${String(i).padStart(4, "0")}`, answers: ALL_WRONG, ...story("cricket") });
    const prac = await call("GET", "practice/next");
    expect(prac.body).toMatchObject({ ok: true, wpm: 70 });
    const before = deps.repo.load("kid")!.learner;
    const done = await call("POST", "practice/submit", { attemptId: "p1", passageId: prac.body.passage.passageId });
    expect(done.body.feedback.celebration).toBe("NONE");
    const after = deps.repo.load("kid")!.learner;
    expect([after.core, after.canonicalPointer]).toEqual([before.core, before.canonicalPointer]);
    expect((await call("GET", "passage/next")).body.sequence).toBe(6);
  });
});

describe("production content fails closed", () => {
  it("with no approved package the learner gets a friendly 'being prepared' message, never an error page or fixture content", async () => {
    const store = createStore({ wipRoot: join(dir, "wip"), approvedRoot: join(dir, "approved"), qaActors: [] });
    const prod = buildDeps(join(dir, "prod"), new ApprovedPackageProvider(store));
    await call("POST", "bootstrap", undefined, {}, who, prod);
    await call("POST", "assessment/start", undefined, {}, who, prod);
    const a = await call("GET", "assessment/passage", undefined, {}, who, prod);
    expect(a.status).toBe(503);
    expect(a.body).toMatchObject({ error: "CONTENT_UNAVAILABLE", message: expect.stringMatching(/being prepared/) });
    expect((await call("POST", "assessment/answer", { key: "k", answers: [1, 0, 2, 0] }, {}, who, prod)).status).toBe(503);
  });
  it("fixtures are selected only when diagnostics are enabled AND fixtures are requested", () => {
    const kinds = (env: Record<string, string | undefined>): ContentProvider["source"] => makeProvider(env).source;
    expect(kinds({})).toBe("APPROVED_PACKAGE");
    expect(kinds({ SR_CONTENT: "fixture" })).toBe("APPROVED_PACKAGE");
    expect(kinds({ SR_ENABLE_DIAGNOSTICS: "true" })).toBe("APPROVED_PACKAGE");
    expect(kinds({ SR_ENABLE_DIAGNOSTICS: "true", SR_CONTENT: "fixture" })).toBe("FIXTURE");
    expect(kinds({ SR_ENABLE_DIAGNOSTICS: "true", SR_CONTENT: "fixture", VERCEL_ENV: "production" })).toBe("APPROVED_PACKAGE");
  });
});

describe("speechFor builds the speech-evidence contract", () => {
  const ideas = { passageId: "p", ideas: [] };
  it("typed text has no recognition uncertainty; spoken keeps the raw transcript; ASR failure is technical", () => {
    expect(speechFor(ideas, { text: "hello there", mode: "typed" })).toMatchObject({ rawTranscript: "hello there", confirmedTranscript: "hello there", asr: { usable: true, speechDetected: true, confidence: 1 } });
    expect(speechFor(ideas, { text: "hello there", raw: "hallo there", mode: "spoken", asrConfidence: 0.8 })).toMatchObject({ rawTranscript: "hallo there", confirmedTranscript: "hello there", asr: { confidence: 0.8 } });
    expect(speechFor(ideas, { asrFailed: true, mode: "spoken" })).toMatchObject({ asr: { usable: false }, evaluator: null });
    expect(speechFor(ideas, { text: "   ", mode: "typed" })).toMatchObject({ confirmedTranscript: null, asr: { speechDetected: false }, evaluator: null });
    expect(speechFor(ideas, undefined).evaluator).toBeNull();
  });
});

describe("transport basics", () => {
  it("maps service errors to HTTP statuses and rejects malformed bodies and unknown routes", async () => {
    expect((await call("POST", "assessment/start")).status).toBe(409);
    await call("POST", "bootstrap");
    const req = new Request("http://localhost/api/v3/passage/submit", { method: "POST", body: "{not json" });
    expect((await handleV3(req, ["passage", "submit"], who, deps)).status).toBe(400);
    expect((await call("GET", "nope")).status).toBe(404);
    expect((await call("POST", "bootstrap", undefined, {}, { ...who, deviceId: "laptop", sessionId: "S2" })).status).toBe(409);
  });
  it("parent detail and ops metrics need the separate internal key and fail closed without one", async () => {
    await call("POST", "bootstrap");
    expect((await call("GET", "progress/parent")).status).toBe(403);
    expect((await call("GET", "ops/summary")).status).toBe(403);
    expect(internalAuthorized(new Request("http://x", { headers: { "x-sr-internal-key": "short" } }), { SR_INTERNAL_API_KEY: "short" })).toBe(false);
    const env = { SR_INTERNAL_API_KEY: "k".repeat(24) };
    expect(internalAuthorized(new Request("http://x", { headers: { "x-sr-internal-key": "k".repeat(24) } }), env)).toBe(true);
    expect(internalAuthorized(new Request("http://x", { headers: { "x-sr-internal-key": "wrong" } }), env)).toBe(false);
    expect(internalAuthorized(new Request("http://x"), env)).toBe(false);
  });
});

describe("client clocks are never trusted", () => {
  const now = Date.parse("2026-10-09T10:00:00Z");
  it("accepts a sane recent start time and replaces future, ancient or invalid ones with server time", () => {
    expect(sanitizeStartedAt("2026-10-09T09:58:00Z", now)).toBe("2026-10-09T09:58:00.000Z");
    expect(sanitizeStartedAt("2026-10-09T11:00:00Z", now)).toBe("2026-10-09T10:00:00.000Z"); // skewed into the future
    expect(sanitizeStartedAt("2026-10-08T09:00:00Z", now)).toBe("2026-10-09T10:00:00.000Z"); // outside the session window
    expect(sanitizeStartedAt("garbage", now)).toBe("2026-10-09T10:00:00.000Z");
    expect(sanitizeStartedAt(undefined, now)).toBe("2026-10-09T10:00:00.000Z");
  });
  it("a learner whose device clock is hours ahead still completes a story normally", async () => {
    await onboard(70);
    const r = await call("POST", "passage/submit", { attemptId: "skew", passageId: "FX-0001", answers: ALL_RIGHT, startedAt: "2099-01-01T00:00:00Z", ...story(GOOD_RETELLING) });
    expect(r.status).toBe(200);
    const rec = deps.repo.load("kid")!.learner.ledger[0];
    expect(Date.parse(rec.startedAt)).toBeLessThanOrEqual(Date.parse(rec.completedAt));
  });
});
