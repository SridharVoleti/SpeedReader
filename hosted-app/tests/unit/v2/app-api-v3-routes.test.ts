import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { handleV3, internalAuthorized, type Verified } from "../../../api/v3";
import { FileLearnerRepository } from "../../../lib/v2/learner-repository";
import { FileAssessmentStore } from "../../../lib/v2/file-assessment-store";
import { LearnerService } from "../../../lib/v2/learner-service";
import { SessionRegistry } from "../../../lib/v2/session-envelope";

let dir: string;
const who: Verified = { learnerId: "kid", sessionId: "S1", deviceId: "phone" };
let deps: { service: LearnerService; repo: FileLearnerRepository };

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "sr-v3-"));
  const repo = new FileLearnerRepository(join(dir, "learners"));
  deps = { repo, service: new LearnerService({ repo, assessments: new FileAssessmentStore(join(dir, "assessments")), sessions: new SessionRegistry(), bpcCatalog: [] }) };
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const call = async (method: string, path: string, body?: unknown, headers: Record<string, string> = {}, v: Verified = who) => {
  const req = new Request(`http://localhost/api/v3/${path}`, { method, headers: { "content-type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  const res = await handleV3(req, path.split("?")[0].split("/"), v, deps);
  return { status: res.status, body: (await res.json()) as Record<string, any> };
};

describe("v3 HTTP transport maps requests to the learner service", () => {
  it("runs the full journey: bootstrap -> assessment -> next -> passage -> progress", async () => {
    expect((await call("POST", "bootstrap")).body).toMatchObject({ state: "ASSESSMENT_REQUIRED", next: { activity: "INITIAL_ASSESSMENT" } });
    let a = (await call("POST", "assessment/start")).body;
    let i = 0;
    while (a.status !== "COMPLETE") {
      a = (await call("POST", "assessment/attempt", { key: `k${(i += 1)}`, wpm: a.nextWpm, comprehensionScore: a.nextWpm <= 70 ? 0.9 : 0.3, durationSec: 40 })).body;
    }
    const fin = await call("POST", "assessment/finalize");
    expect(fin.body).toMatchObject({ startingWpm: 70 });
    expect((await call("GET", "next")).body).toMatchObject({ ok: true, next: { activity: "NEW_PROGRESSION", sequence: 1, wpm: 70 } });
    const done = await call("POST", "passage/complete", {
      attemptId: "a1", passageId: "P1", displayedWpm: 70, items: [{ itemId: "q1", score: 0.9 }],
      speech: { rawTranscript: "x", confirmedTranscript: "x", asr: { usable: true, speechDetected: true, confidence: 0.9 }, evaluator: { score: 0.9, version: "e1" } }
    });
    expect(done.status).toBe(200);
    expect(JSON.stringify(done.body)).not.toMatch(/GREEN|score|classification/i);
    expect((await call("GET", "progress")).body).toMatchObject({ currentWpm: 70, startingWpm: 70, storiesRead: 1 });
  });

  it("maps service errors to HTTP statuses and rejects malformed bodies and unknown routes", async () => {
    expect((await call("POST", "assessment/start")).status).toBe(409); // no session yet
    await call("POST", "bootstrap");
    const req = new Request("http://localhost/api/v3/passage/complete", { method: "POST", body: "{not json" });
    expect((await handleV3(req, ["passage", "complete"], who, deps)).status).toBe(400);
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
    expect(internalAuthorized(new Request("http://x", { headers: { "x-sr-internal-key": "undefined" } }), {})).toBe(false);
  });
});
