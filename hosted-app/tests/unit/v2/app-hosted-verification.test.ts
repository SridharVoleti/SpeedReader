import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { HostedConfig } from "../../../../tools/hosted-verification.mjs";
import { EXPECTED_RPCS, EXPECTED_TABLES, buildReport, loadHostedConfig, overallStatus, runHostedChecks } from "../../../../tools/hosted-verification.mjs";

// Issue #37: a repeatable verification run against the hosted Supabase project. It is external-evidence tooling: it can only
// report PASS when every check was actually verified, and without credentials it reports BLOCKED_EXTERNAL (never a pass).
const cfg = (extra: Record<string, string | undefined> = {}): HostedConfig => {
  const r = loadHostedConfig(env(extra));
  if (!r.ok) throw new Error("fixture config invalid");
  return r.config;
};
const URL_OK = "https://abcdefghijklmnop.supabase.co";
const env = (o: Record<string, string | undefined> = {}) => ({
  SR_HOSTED_SUPABASE_URL: URL_OK, SR_HOSTED_SERVICE_ROLE_KEY: "service-secret-value", SR_HOSTED_ANON_KEY: "anon-secret-value",
  SR_HOSTED_EXPECTED_REGION: "ap-south-1", ...o });

type Behavior = { tableStatus?: Record<string, number>; anonRows?: string[]; rpcMissing?: string[]; anonRpcExposed?: string[]; region?: string };
function hostedFetch(b: Behavior = {}): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const u = new URL(String(input));
    const key = new Headers(init?.headers).get("apikey");
    const isAnon = key === "anon-secret-value";
    const json = (status: number, body: unknown = []) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    if (u.hostname === "api.supabase.com") return json(200, { region: b.region ?? "ap-south-1", id: "abcdefghijklmnop" });
    const rpc = /\/rest\/v1\/rpc\/(.+)$/.exec(u.pathname);
    if (rpc) {
      if (b.rpcMissing?.includes(rpc[1])) return json(404, { message: "not found" });
      if (isAnon) return b.anonRpcExposed?.includes(rpc[1]) ? json(400, { message: "invalid arguments" }) : json(401, { message: "permission denied" });
      return json(400, { message: "invalid arguments" });
    }
    const table = u.pathname.replace("/rest/v1/", "");
    if (isAnon) {
      if (b.anonRows?.includes(table)) return json(200, [{ learner_id: "leaked" }]);
      return json(200, []);                                                  // RLS on, no policy: empty
    }
    const status = b.tableStatus?.[table] ?? 200;
    return json(status, status === 200 ? [] : { message: "relation does not exist" });
  }) as typeof fetch;
}

describe("configuration fails closed", () => {
  it("is valid with the documented variables", () => {
    expect(loadHostedConfig(env())).toMatchObject({ ok: true, config: { projectRef: "abcdefghijklmnop", expectedRegion: "ap-south-1" } });
  });
  it.each(["SR_HOSTED_SUPABASE_URL", "SR_HOSTED_SERVICE_ROLE_KEY", "SR_HOSTED_ANON_KEY", "SR_HOSTED_EXPECTED_REGION"])("is blocked when %s is missing", (name) => {
    const r = loadHostedConfig(env({ [name]: undefined }));
    expect(r).toMatchObject({ ok: false });
    expect((r as { missing: string[] }).missing).toContain(name);
  });
  it("rejects a non-https or non-supabase URL and identical service/anon keys", () => {
    expect(loadHostedConfig(env({ SR_HOSTED_SUPABASE_URL: "http://abcdefghijklmnop.supabase.co" }))).toMatchObject({ ok: false });
    expect(loadHostedConfig(env({ SR_HOSTED_SUPABASE_URL: "https://evil.example.com" }))).toMatchObject({ ok: false });
    expect(loadHostedConfig(env({ SR_HOSTED_ANON_KEY: "service-secret-value" }))).toMatchObject({ ok: false });
  });
});

describe("hosted checks", () => {
  const config = () => cfg();
  const withToken = () => cfg({ SR_HOSTED_ACCESS_TOKEN: "mgmt-token" });
  const byName = (results: { name: string; status: string }[], name: string) => results.find((r) => r.name === name)!;

  it("expects the full table and RPC set", () => {
    expect(EXPECTED_TABLES).toHaveLength(15);
    expect(EXPECTED_RPCS).toEqual(["sr_commit_learner", "sr_save_sessions"]);
  });

  it("a correctly provisioned project passes every automatable check; region needs the management token, so the run is INCOMPLETE", async () => {
    const results = await runHostedChecks(config(), hostedFetch());
    for (const name of ["tables_exist", "anon_denied", "rpc_present", "rpc_anon_denied"]) expect(byName(results, name).status, name).toBe("PASS");
    expect(byName(results, "region").status).toBe("NOT_VERIFIED");
    expect(overallStatus(results)).toBe("INCOMPLETE");
  });

  it("with a management token the region is verified and a mismatch fails", async () => {
    expect(byName(await runHostedChecks(withToken(), hostedFetch()), "region").status).toBe("PASS");
    expect(byName(await runHostedChecks(withToken(), hostedFetch({ region: "us-east-1" })), "region").status).toBe("FAIL");
  });

  it("even with every automatable check passing, write-path evidence stays NOT_VERIFIED so the overall result is never a full PASS", async () => {
    const results = await runHostedChecks(withToken(), hostedFetch());
    expect(byName(results, "immutable_evidence_and_projections").status).toBe("NOT_VERIFIED");
    expect(overallStatus(results)).toBe("INCOMPLETE");
  });

  it("detects a missing table (migration not applied)", async () => {
    const r = byName(await runHostedChecks(config(), hostedFetch({ tableStatus: { sr_retention_check: 404 } })), "tables_exist");
    expect(r.status).toBe("FAIL");
    expect(JSON.stringify(r)).toContain("sr_retention_check");
  });

  it("detects anon-readable rows (RLS not protecting a table)", async () => {
    const results = await runHostedChecks(config(), hostedFetch({ anonRows: ["sr_spoken_evidence"] }));
    expect(byName(results, "anon_denied").status).toBe("FAIL");
    expect(JSON.stringify(byName(results, "anon_denied"))).toContain("sr_spoken_evidence");
    expect(overallStatus(results)).toBe("FAIL");
  });

  it("detects a missing RPC and an RPC callable by the anon role", async () => {
    const missing = await runHostedChecks(config(), hostedFetch({ rpcMissing: ["sr_save_sessions"] }));
    expect(byName(missing, "rpc_present").status).toBe("FAIL");
    const exposed = await runHostedChecks(config(), hostedFetch({ anonRpcExposed: ["sr_commit_learner"] }));
    expect(byName(exposed, "rpc_anon_denied").status).toBe("FAIL");
  });

  it("a network failure is a FAIL, never a pass", async () => {
    const results = await runHostedChecks(config(), (async () => { throw new Error("ECONNREFUSED"); }) as unknown as typeof fetch);
    expect(overallStatus(results)).toBe("FAIL");
  });
});

describe("report", () => {
  it("is tied to the commit, records every check, and contains no secrets or learner data", async () => {
    const hosted = cfg({ SR_HOSTED_ACCESS_TOKEN: "mgmt-token" });
    const results = await runHostedChecks(hosted, hostedFetch({ anonRows: ["sr_attempt"] }));
    const report = buildReport({ commitSha: "a".repeat(40), results, config: hosted, now: new Date("2026-10-09T12:00:00Z") });
    const text = JSON.stringify(report);
    for (const secret of ["service-secret-value", "anon-secret-value", "mgmt-token", "leaked"]) expect(text).not.toContain(secret);
    expect(report).toMatchObject({ schema: "sr-hosted-verification/1", commitSha: "a".repeat(40), projectRef: "abcdefghijklmnop", overall: "FAIL" });
    expect(report.checks.length).toBeGreaterThanOrEqual(6);
  });
});

describe("CLI", () => {
  it("without credentials it reports BLOCKED_EXTERNAL and exits non-zero (never a pass)", () => {
    const clean = { PATH: process.env.PATH ?? "", SystemRoot: process.env.SystemRoot ?? "" } as unknown as NodeJS.ProcessEnv;
    const r = spawnSync(process.execPath, ["tools/hosted-supabase-verify.mjs"], { env: clean, encoding: "utf8" });
    expect(r.status).toBe(2);
    expect(r.stdout + r.stderr).toMatch(/BLOCKED_EXTERNAL/);
    expect(r.stdout + r.stderr).toMatch(/SR_HOSTED_SERVICE_ROLE_KEY/);
  });
  it("is documented in the README with the exact variables", () => {
    const readme = readFileSync("hosted-app/README.md", "utf8");
    expect(readme).toMatch(/hosted-supabase-verify/);
    expect(readme).toMatch(/SR_HOSTED_EXPECTED_REGION/);
  });
});
