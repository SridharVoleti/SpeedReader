// In-memory stand-in for the Supabase REST endpoints the adapters use. It mirrors the semantics of
// supabase/migrations (unique keys, idempotency table, optimistic version, atomic commit function) so adapter request
// shapes and result mapping can be tested. It is NOT a substitute for running the real SQL against Supabase.

type Json = Record<string, any>;

export function createFakePostgrest(calls: { url: string; method: string; headers: Record<string, string>; body?: Json }[] = []) {
  const learners = new Map<string, { state: Json; version: number }>();
  const applied = new Set<string>();
  const attempts = new Map<string, Json>();
  const docs = { sr_assessment_state: new Map<string, Json>(), sr_session_state: new Map<string, Json>() };

  const respond = (status: number, body?: unknown) =>
    new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const eq = (u: URL, col: string) => {
    const v = u.searchParams.get(col);
    return v?.startsWith("eq.") ? decodeURIComponent(v.slice(3)) : null;
  };

  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input.toString());
    const method = init?.method ?? "GET";
    const headers = Object.fromEntries(Object.entries((init?.headers ?? {}) as Record<string, string>).map(([k, v]) => [k.toLowerCase(), v]));
    const body = init?.body ? (JSON.parse(String(init.body)) as Json) : undefined;
    calls.push({ url: url.toString(), method, headers, body });
    const path = url.pathname.replace("/rest/v1/", "");

    if (path === "sr_learner_state" && method === "GET") {
      const id = eq(url, "learner_id");
      const rows = [...learners.entries()].filter(([k]) => id === null || k === id).map(([, v]) => ({ state: v.state, version: v.version }));
      return respond(200, rows);
    }
    if (path === "sr_learner_state" && method === "POST") {
      if (learners.has(body!.learner_id)) return respond(409, { code: "23505" });
      learners.set(body!.learner_id, { state: body!.state, version: body!.version });
      return respond(201);
    }
    if (path === "rpc/sr_commit_learner" && method === "POST") {
      const a = body!;
      const key = `${a.p_learner_id}|${a.p_idempotency_key}`;
      if (applied.has(key)) return respond(200, { ok: true, replayed: true });
      const row = learners.get(a.p_learner_id);
      if (!row || row.version !== a.p_expected_version) return respond(200, { ok: false, reason: "VERSION_CONFLICT" });
      row.version += 1;
      row.state = a.p_state;
      if (a.p_attempt) attempts.set(`${a.p_learner_id}|${a.p_attempt.attemptId}`, a.p_attempt);
      applied.add(key);
      return respond(200, { ok: true, replayed: false, version: row.version });
    }
    for (const table of ["sr_assessment_state", "sr_session_state"] as const) {
      if (path !== table) continue;
      if (method === "GET") {
        const id = eq(url, "learner_id");
        const doc = id ? docs[table].get(id) : undefined;
        return respond(200, doc ? [doc] : []);
      }
      if (method === "POST") {
        docs[table].set(body!.learner_id, body!);
        return respond(201);
      }
    }
    return respond(404, { message: `unhandled ${method} ${path}` });
  }) as typeof fetch;

  return { fetchImpl, calls, learners, attempts, applied, docs };
}
