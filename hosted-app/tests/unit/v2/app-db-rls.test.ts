import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { MIGRATIONS, migratedDb } from "./helpers/pglite-postgrest";

// Issue #19: every SpeedReader runtime/evidence table sits behind RLS; access is server-mediated (service role) only.
const EXPECTED_TABLES = [
  "sr_learner_state", "sr_applied_event", "sr_attempt", "sr_structured_response", "sr_spoken_evidence",
  "sr_progression_decision", "sr_practice_event", "sr_news_reader_attempt", "sr_readiness_stream", "sr_readiness_attempt",
  "sr_calibration_version", "sr_content_package", "sr_assessment_state", "sr_session_state", "sr_retention_check"
];

describe("RLS covers the full SpeedReader table set (#19)", () => {
  it("every sr_* table is in the expected set, and every one has row level security enabled", async () => {
    const db = await migratedDb();
    const rows = (await db.query("select c.relname as name, c.relrowsecurity as rls from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' order by 1")).rows as { name: string; rls: boolean }[];
    const sr = rows.filter((r) => r.name.startsWith("sr_"));
    expect(sr.map((r) => r.name).sort()).toEqual([...EXPECTED_TABLES].sort());
    expect(sr.filter((r) => !r.rls).map((r) => r.name)).toEqual([]);
    // no table at all in public may be left unprotected
    expect(rows.filter((r) => !r.rls).map((r) => r.name)).toEqual([]);
  });

  it("spoken transcripts and readiness evidence are specifically protected", async () => {
    const db = await migratedDb();
    for (const t of ["sr_spoken_evidence", "sr_readiness_stream", "sr_readiness_attempt", "sr_structured_response", "sr_progression_decision"]) {
      const r = (await db.query("select relrowsecurity as rls from pg_class where oid = $1::regclass", [t])).rows[0] as { rls: boolean };
      expect(r.rls, t).toBe(true);
    }
  });

  it("no policy grants a client role direct access (server-mediated only)", async () => {
    const db = await migratedDb();
    const policies = (await db.query("select tablename, policyname from pg_policies where schemaname='public'")).rows;
    expect(policies).toEqual([]);
  });

  it("upgrade path: 0005 applies on a database already at 0004 holding learner data, and is re-runnable", async () => {
    const db = new PGlite();
    const apply = (m: string) => db.exec(readFileSync(`hosted-app/supabase/migrations/${m}`, "utf8"));
    for (const m of MIGRATIONS.filter((x) => x < "0005")) await apply(m);
    await db.query("insert into sr_learner_state(learner_id, baseline_wpm, current_wpm, canonical_pointer, state) values ('kid',60,60,1,'{}'::jsonb)");
    const m5 = MIGRATIONS.find((x) => x.startsWith("0005"))!;
    await apply(m5);
    await apply(m5);
    expect(Number(((await db.query("select count(*)::int as n from sr_learner_state")).rows[0] as { n: number }).n)).toBe(1);
    expect((await db.query("select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity")).rows).toEqual([]);
  });
});
