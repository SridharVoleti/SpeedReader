import { afterEach, describe, expect, it } from "vitest";
import { persistenceFromEnv, PersistenceConfigError } from "../../../lib/v2/persistence-config";
import { getDeps, handleV3, resetServiceForTests } from "../../../api/v3";
import { GET as health } from "../../../../app/health/route";

// Issue #22: production fails closed when Supabase persistence is not configured; file adapters stay for dev/tests.
const GOOD = { SUPABASE_URL: "https://abc.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "k".repeat(40) };
const who = { learnerId: "kid", sessionId: "S1", deviceId: "d" };

const saved = { ...process.env };
afterEach(() => {
  for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
  Object.assign(process.env, saved);
  resetServiceForTests();
});

describe("persistenceFromEnv", () => {
  it("production without Supabase is a configuration error, never a file fallback", () => {
    const r = persistenceFromEnv({ VERCEL_ENV: "production" });
    expect(r).toMatchObject({ ok: false });
  });
  it("production rejects half-configured or malformed Supabase settings", () => {
    expect(persistenceFromEnv({ VERCEL_ENV: "production", SUPABASE_URL: GOOD.SUPABASE_URL })).toMatchObject({ ok: false });
    expect(persistenceFromEnv({ VERCEL_ENV: "production", SUPABASE_SERVICE_ROLE_KEY: GOOD.SUPABASE_SERVICE_ROLE_KEY })).toMatchObject({ ok: false });
    expect(persistenceFromEnv({ VERCEL_ENV: "production", ...GOOD, SUPABASE_URL: "http://abc.supabase.co" })).toMatchObject({ ok: false });
    expect(persistenceFromEnv({ VERCEL_ENV: "production", ...GOOD, SUPABASE_URL: "not a url" })).toMatchObject({ ok: false });
    expect(persistenceFromEnv({ VERCEL_ENV: "production", ...GOOD, SUPABASE_SERVICE_ROLE_KEY: "short" })).toMatchObject({ ok: false });
  });
  it("production with valid Supabase uses it", () => {
    expect(persistenceFromEnv({ VERCEL_ENV: "production", ...GOOD })).toMatchObject({ ok: true, kind: "supabase" });
  });
  it("local, test and preview environments still fall back to file persistence", () => {
    expect(persistenceFromEnv({})).toEqual({ ok: true, kind: "file" });
    expect(persistenceFromEnv({ VERCEL_ENV: "preview" })).toEqual({ ok: true, kind: "file" });
    expect(persistenceFromEnv({ VERCEL_ENV: "development" })).toEqual({ ok: true, kind: "file" });
  });
  it("a non-production environment with valid Supabase still prefers it", () => {
    expect(persistenceFromEnv(GOOD)).toMatchObject({ ok: true, kind: "supabase" });
  });
  it("the error message never echoes secrets", () => {
    const r = persistenceFromEnv({ VERCEL_ENV: "production", SUPABASE_URL: GOOD.SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: "secret-short" });
    expect(JSON.stringify(r)).not.toContain("secret-short");
  });
});

describe("production wiring fails closed", () => {
  it("getDeps throws a PersistenceConfigError in production without Supabase and builds file deps locally", () => {
    expect(() => getDeps({ VERCEL_ENV: "production" })).toThrow(PersistenceConfigError);
    resetServiceForTests();
    expect(() => getDeps({ SR_DATA_DIR: "./.data-test-cfg" })).not.toThrow();
  });

  it("no learner session can start in production without Supabase: bootstrap answers a safe 503 SERVER_CONFIGURATION", async () => {
    process.env.VERCEL_ENV = "production";
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    resetServiceForTests();
    const res = await handleV3(new Request("http://x/api/v3/bootstrap", { method: "POST", body: "{}" }), ["bootstrap"], who);
    expect(res.status).toBe(503);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("SERVER_CONFIGURATION");
    expect(JSON.stringify(body)).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY|\.data/);
  });

  it("health reports the configuration failure (503, distinct from CONTENT_UNAVAILABLE) and stays 200 when configured or non-production", async () => {
    process.env.VERCEL_ENV = "production";
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const bad = await health();
    expect(bad.status).toBe(503);
    expect(await bad.text()).toContain("CONFIGURATION_ERROR");
    Object.assign(process.env, GOOD);
    expect((await health()).status).toBe(200);
    process.env.VERCEL_ENV = "preview";
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect((await health()).status).toBe(200);
  });
});
