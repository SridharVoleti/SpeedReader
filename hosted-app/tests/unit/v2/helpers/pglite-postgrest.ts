// Real Postgres (PGlite = Postgres compiled to WASM) loaded with the project's migrations, plus a minimal
// PostgREST-shaped fetch shim so the Supabase adapters run against the REAL schema and the REAL sr_commit_learner
// function. It verifies our SQL (types, constraints, triggers, plpgsql); it does not exercise Supabase's own
// PostgREST, auth or row-level-security layers.

import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

export const MIGRATIONS = [
  "0001_speedreader_learner_state.sql",
  "0002_speedreader_evidence_domains.sql",
  "0003_speedreader_documents.sql",
  "0004_speedreader_retention.sql"
];

export async function migratedDb(): Promise<PGlite> {
  const db = new PGlite();
  for (const m of MIGRATIONS) await db.exec(readFileSync(`hosted-app/supabase/migrations/${m}`, "utf8"));
  return db;
}

const respond = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const eq = (u: URL, col: string) => {
  const v = u.searchParams.get(col);
  return v?.startsWith("eq.") ? v.slice(3) : null;
};

export function pgliteFetch(db: PGlite): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input.toString());
    const method = init?.method ?? "GET";
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, any>) : undefined;
    const path = url.pathname.replace("/rest/v1/", "");

    try {
      if (path === "sr_learner_state" && method === "GET") {
        const id = eq(url, "learner_id");
        const r = id === null
          ? await db.query("select state, version from sr_learner_state")
          : await db.query("select state, version from sr_learner_state where learner_id = $1", [id]);
        return respond(200, r.rows);
      }
      if (path === "sr_learner_state" && method === "POST") {
        const b = body!;
        await db.query(
          "insert into sr_learner_state(learner_id, baseline_wpm, current_wpm, canonical_pointer, state, version) values ($1,$2,$3,$4,$5::jsonb,$6)",
          [b.learner_id, b.baseline_wpm, b.current_wpm, b.canonical_pointer, JSON.stringify(b.state), b.version]
        );
        return respond(201);
      }
      if (path === "rpc/sr_commit_learner" && method === "POST") {
        const a = body!;
        const r = await db.query(
          "select sr_commit_learner($1,$2,$3,$4::jsonb,$5,$6,$7::jsonb) as r",
          [a.p_learner_id, a.p_expected_version, a.p_idempotency_key, JSON.stringify(a.p_state), a.p_current_wpm, a.p_pointer, a.p_attempt === null ? null : JSON.stringify(a.p_attempt)]
        );
        return respond(200, (r.rows[0] as { r: unknown }).r);
      }
      for (const [table, column] of [["sr_assessment_state", "value"], ["sr_session_state", "records"]] as const) {
        if (path !== table) continue;
        if (method === "GET") {
          const id = eq(url, "learner_id");
          const r = await db.query(`select ${column} from ${table} where learner_id = $1`, [id]);
          return respond(200, r.rows);
        }
        if (method === "POST") {
          const b = body!;
          await db.query(
            `insert into ${table}(learner_id, ${column}, updated_at) values ($1,$2::jsonb,$3)
             on conflict (learner_id) do update set ${column} = excluded.${column}, updated_at = excluded.updated_at`,
            [b.learner_id, JSON.stringify(b[column]), b.updated_at]
          );
          return respond(201);
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return respond(/duplicate key|unique/i.test(msg) ? 409 : 400, { message: msg });
    }
    return respond(404, { message: `unhandled ${method} ${path}` });
  }) as typeof fetch;
}
