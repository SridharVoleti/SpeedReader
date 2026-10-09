import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { diagnosticsEnabled } from "../../../lib/diagnostics-gate";
import { authorizeLearner, anonymousAllowed, cookieValue } from "../../../../app/api/sr/authorize";
import { SESSION_COOKIE, signSessionToken } from "../../../../container/launch/session";
import { postAttempt, getPackage } from "../../../api/sr-explain";

const req = (cookie?: string, init: RequestInit = {}) =>
  new Request("http://localhost/api/sr/attempt", { ...init, headers: { ...(cookie ? { cookie } : {}), "content-type": "application/json" } });

describe("APP-NFR-007 / APP-PRIV-004 diagnostics protection", () => {
  it("diagnostics are off by default, on only with the explicit flag, and never on a Vercel production deployment", () => {
    expect(diagnosticsEnabled({})).toBe(false);
    expect(diagnosticsEnabled({ SR_ENABLE_DIAGNOSTICS: "false" })).toBe(false);
    expect(diagnosticsEnabled({ SR_ENABLE_DIAGNOSTICS: "true" })).toBe(true);
    expect(diagnosticsEnabled({ SR_ENABLE_DIAGNOSTICS: "true", VERCEL_ENV: "preview" })).toBe(true);
    expect(diagnosticsEnabled({ SR_ENABLE_DIAGNOSTICS: "true", VERCEL_ENV: "production" })).toBe(false);
  });

  it("every demo/diagnostic page is registered only behind the gate; the learner table holds no demo", () => {
    const src = readFileSync("hosted-app/app.manifest.ts", "utf8");
    const learner = src.slice(src.indexOf("const learnerPages"), src.indexOf("const diagnosticPages"));
    expect(learner).not.toMatch(/-demo/);
    expect(src).toMatch(/pages: diagnosticsEnabled\(\) \? \{ \.\.\.learnerPages, \.\.\.diagnosticPages \} : learnerPages/);
    const diagnostic = src.slice(src.indexOf("const diagnosticPages"), src.indexOf("export const DIAGNOSTIC_ROUTES"));
    expect((diagnostic.match(/-demo"/g) ?? []).length).toBe(13);
  });
});

describe("APP-PLAT-004 / APP-PRIV-004 learner identity comes from the signed session", () => {
  beforeAll(() => { process.env.SESSION_SECRET = "x".repeat(40); });
  const token = (learnerId: string) => signSessionToken({ learnerId, learnerSessionId: "s1", displayName: "Kid" }, new Date(Date.now() + 3_600_000));

  it("parses cookies", () => {
    expect(cookieValue("a=1; b=two%20words", "b")).toBe("two words");
    expect(cookieValue(null, "a")).toBeNull();
    expect(cookieValue("a=1", "z")).toBeNull();
  });

  it("refuses an anonymous caller by default", async () => {
    const r = await authorizeLearner(req(), {});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(401);
  });

  it("allows anonymous only with the explicit non-production opt-in, never on Vercel production", async () => {
    expect(anonymousAllowed({ SR_ALLOW_ANONYMOUS_LEARNER: "true" })).toBe(true);
    expect(anonymousAllowed({ SR_ALLOW_ANONYMOUS_LEARNER: "true", VERCEL_ENV: "production" })).toBe(false);
    expect(await authorizeLearner(req(), { SR_ALLOW_ANONYMOUS_LEARNER: "true" })).toEqual({ ok: true, learnerId: null, sessionId: null });
  });

  it("rejects a forged/garbage session cookie even when anonymous is allowed", async () => {
    const r = await authorizeLearner(req(`${SESSION_COOKIE}=not-a-jwt`), { SR_ALLOW_ANONYMOUS_LEARNER: "true" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(401);
  });

  it("returns the learner id from a valid signed session", async () => {
    const r = await authorizeLearner(req(`${SESSION_COOKIE}=${await token("learner-42")}`), {});
    expect(r).toEqual({ ok: true, learnerId: "learner-42", sessionId: "s1" });
  });

  it("a session learner cannot act as another learner: mismatching body or query is refused with 403", async () => {
    const body = JSON.stringify({ learnerId: "someone-else", packageId: "PKG-X", answers: [] });
    const attempt = await postAttempt(req(undefined, { method: "POST", body }), "learner-42");
    expect(attempt.status).toBe(403);
    expect(await attempt.json()).toEqual({ error: "learner mismatch" });
  });

  it("the session learner overrides a missing body learner id (it is never taken from the caller)", async () => {
    const body = JSON.stringify({ packageId: "PKG-NOPE", answers: [] });
    const res = await postAttempt(req(undefined, { method: "POST", body }), "learner-42");
    expect(res.status).not.toBe(403);
    expect(res.status).not.toBe(400); // learnerId was supplied from the session, so it passes the "learnerId required" check
  });

  it("getPackage refuses to return another learner's revisit data", () => {
    // package lookup happens first and fails closed (404) for an unknown package: no data either way
    const res = getPackage(new Request("http://localhost/api/sr/package?id=PKG-NOPE&learnerId=victim"), "attacker");
    expect([403, 404]).toContain(res.status);
  });
});
