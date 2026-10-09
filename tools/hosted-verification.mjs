// Hosted Supabase verification (issue #37). Evidence tooling for the real hosted project: it never certifies anything by itself and can only
// report PASS when every check was actually verified. Anything it could not verify is NOT_VERIFIED, which keeps the overall result INCOMPLETE
// (APP-INFRA-003 / APP-DATA-010 stay PARTIAL/BLOCKED_EXTERNAL until a run is fully verified and independently reviewed).
//
// The report records the commit SHA, check names and outcomes only - never keys, tokens, request bodies or learner data.

export const EXPECTED_TABLES = [
  "sr_learner_state", "sr_applied_event", "sr_attempt", "sr_structured_response", "sr_spoken_evidence",
  "sr_progression_decision", "sr_practice_event", "sr_news_reader_attempt", "sr_readiness_stream", "sr_readiness_attempt",
  "sr_calibration_version", "sr_content_package", "sr_assessment_state", "sr_session_state", "sr_retention_check"
];
export const EXPECTED_RPCS = ["sr_commit_learner", "sr_save_sessions"];

const REQUIRED = ["SR_HOSTED_SUPABASE_URL", "SR_HOSTED_SERVICE_ROLE_KEY", "SR_HOSTED_ANON_KEY", "SR_HOSTED_EXPECTED_REGION"];

export function loadHostedConfig(env) {
  const missing = REQUIRED.filter((name) => !env[name] || !String(env[name]).trim());
  if (missing.length) return { ok: false, missing, problems: [`missing: ${missing.join(", ")}`] };
  const problems = [];
  let url;
  try { url = new URL(env.SR_HOSTED_SUPABASE_URL); } catch { problems.push("SR_HOSTED_SUPABASE_URL is not a URL"); }
  let projectRef = null;
  if (url) {
    const match = /^([a-z0-9]{10,30})\.supabase\.co$/.exec(url.hostname);
    if (url.protocol !== "https:") problems.push("SR_HOSTED_SUPABASE_URL must be https");
    if (!match) problems.push("SR_HOSTED_SUPABASE_URL must be a <project-ref>.supabase.co host");
    else projectRef = match[1];
  }
  if (env.SR_HOSTED_SERVICE_ROLE_KEY === env.SR_HOSTED_ANON_KEY) problems.push("service-role and anon keys must differ");
  if (problems.length) return { ok: false, missing: [], problems };
  return {
    ok: true,
    config: {
      baseUrl: `https://${url.hostname}`, projectRef, serviceKey: env.SR_HOSTED_SERVICE_ROLE_KEY, anonKey: env.SR_HOSTED_ANON_KEY,
      expectedRegion: env.SR_HOSTED_EXPECTED_REGION.trim(), accessToken: env.SR_HOSTED_ACCESS_TOKEN?.trim() || null
    }
  };
}

const rest = (config, path, key, init = {}) => ({
  url: `${config.baseUrl}/rest/v1/${path}`,
  init: { ...init, headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json", ...(init.headers ?? {}) } }
});

async function call(fetchImpl, config, path, key, init) {
  const r = rest(config, path, key, init);
  const response = await fetchImpl(r.url, r.init);
  let body = null;
  try { body = await response.json(); } catch { /* empty or non-JSON body */ }
  return { status: response.status, body };
}

const result = (name, status, detail) => ({ name, status, detail });

export async function runHostedChecks(config, fetchImpl = fetch) {
  const results = [];
  const guard = async (name, fn) => {
    try { results.push(await fn()); } catch (error) { results.push(result(name, "FAIL", `request failed: ${error instanceof Error ? error.message : "unknown error"}`)); }
  };

  await guard("tables_exist", async () => {
    const bad = [];
    for (const table of EXPECTED_TABLES) {
      const r = await call(fetchImpl, config, `${table}?select=*&limit=0`, config.serviceKey);
      if (r.status !== 200) bad.push(`${table}:${r.status}`);
    }
    return bad.length ? result("tables_exist", "FAIL", `service-role access failed or table missing: ${bad.join(", ")}`)
      : result("tables_exist", "PASS", `${EXPECTED_TABLES.length} tables reachable with the service role (migrations applied)`);
  });

  await guard("anon_denied", async () => {
    const leaking = [];
    for (const table of EXPECTED_TABLES) {
      const r = await call(fetchImpl, config, `${table}?select=*&limit=1`, config.anonKey);
      const denied = r.status === 401 || r.status === 403 || (r.status === 200 && Array.isArray(r.body) && r.body.length === 0);
      if (!denied) leaking.push(`${table}:${r.status}`);
    }
    return leaking.length ? result("anon_denied", "FAIL", `anon role can read: ${leaking.join(", ")}`)
      : result("anon_denied", "PASS", "anon role receives no rows from any SpeedReader table");
  });

  await guard("rpc_present", async () => {
    const missing = [];
    for (const fn of EXPECTED_RPCS) {
      const r = await call(fetchImpl, config, `rpc/${fn}`, config.serviceKey, { method: "POST", body: "{}" });
      if (r.status === 404) missing.push(fn);
    }
    return missing.length ? result("rpc_present", "FAIL", `RPC missing: ${missing.join(", ")}`)
      : result("rpc_present", "PASS", "RPCs resolve through PostgREST with the service role");
  });

  await guard("rpc_anon_denied", async () => {
    const exposed = [];
    for (const fn of EXPECTED_RPCS) {
      const r = await call(fetchImpl, config, `rpc/${fn}`, config.anonKey, { method: "POST", body: "{}" });
      if (![401, 403, 404].includes(r.status)) exposed.push(`${fn}:${r.status}`);
    }
    return exposed.length ? result("rpc_anon_denied", "FAIL", `anon role can reach: ${exposed.join(", ")}`)
      : result("rpc_anon_denied", "PASS", "anon role cannot execute SpeedReader RPCs");
  });

  await guard("region", async () => {
    if (!config.accessToken) return result("region", "NOT_VERIFIED", "set SR_HOSTED_ACCESS_TOKEN (Supabase management API) to verify the deployment region");
    const response = await fetchImpl(`https://api.supabase.com/v1/projects/${config.projectRef}`, { headers: { authorization: `Bearer ${config.accessToken}` } });
    if (response.status !== 200) return result("region", "FAIL", `management API returned ${response.status}`);
    const body = await response.json();
    return body.region === config.expectedRegion ? result("region", "PASS", `project region is ${body.region}`)
      : result("region", "FAIL", `project region is ${body.region ?? "unknown"}, expected ${config.expectedRegion}`);
  });

  results.push(result("immutable_evidence_and_projections", "NOT_VERIFIED",
    "write-path checks (sr_commit_learner concurrency, immutable sr_attempt, retention projections, session CAS) need a disposable test learner on the hosted project; not automated by this read-only run"));
  return results;
}

export function overallStatus(results) {
  if (results.some((r) => r.status === "FAIL")) return "FAIL";
  if (results.some((r) => r.status === "NOT_VERIFIED")) return "INCOMPLETE";
  return "PASS";
}

export function buildReport({ commitSha, results, config, now }) {
  return {
    schema: "sr-hosted-verification/1", commitSha, projectRef: config.projectRef, expectedRegion: config.expectedRegion,
    generatedAt: now.toISOString(), overall: overallStatus(results),
    checks: results.map(({ name, status, detail }) => ({ name, status, detail })),
    certification: "NOT_CERTIFIED"
  };
}
