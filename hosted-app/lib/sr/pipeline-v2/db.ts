// SQLite is LOCAL STATE ONLY: a file the orchestrator opens directly through Node's built-in node:sqlite.
// It makes no network calls and loads no model SDK. Requires Node >= 22.13 (node:sqlite without a flag).
//
// Design rules enforced here (not just by convention):
//   * every multi-step change runs inside one transaction (nested scopes use savepoints);
//   * history tables (events, state_history, qa_certificates) are append-only;
//   * an artifact's content_hash/path never change after insert - a new attempt is a new artifact row.

import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createRequire } from "node:module";

type Param = string | number | bigint | null | Uint8Array;
type Stmt = { run(...p: Param[]): { changes: number | bigint; lastInsertRowid: number | bigint }; get(...p: Param[]): unknown; all(...p: Param[]): unknown[] };
type Raw = { exec(sql: string): void; prepare(sql: string): Stmt; close(): void };

export const SCHEMA_VERSION = 1;

export const WORK_STATES = [
  "PENDING", "READY", "IN_PROGRESS", "WIP_READY_FOR_QA", "QA_FAILED", "BLOCKED_UPSTREAM", "APPROVED", "INVALIDATED",
  "ESCALATED_HUMAN_REVIEW", "FINAL_APPROVED"
] as const;
export type WorkState = (typeof WORK_STATES)[number];

const list = (xs: readonly string[]) => xs.map((x) => `'${x}'`).join(",");

const SCHEMA_V1 = `
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE canonical_packages (
  canonical_hash TEXT PRIMARY KEY,
  package_id TEXT NOT NULL,
  version TEXT NOT NULL,
  freeze_status TEXT NOT NULL,
  lock_file TEXT NOT NULL,
  registered_at TEXT NOT NULL
);

CREATE TABLE production_units (
  passage_id TEXT PRIMARY KEY,
  registry_coordinate TEXT NOT NULL UNIQUE,
  passage_no INTEGER NOT NULL,
  rs INTEGER NOT NULL,
  p INTEGER NOT NULL,
  delivery_session INTEGER NOT NULL,
  canonical_package_id TEXT NOT NULL,
  canonical_package_hash TEXT NOT NULL REFERENCES canonical_packages(canonical_hash),
  row_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE work_items (
  passage_id TEXT NOT NULL REFERENCES production_units(passage_id),
  role_id INTEGER NOT NULL CHECK (role_id BETWEEN 1 AND 8),
  state TEXT NOT NULL CHECK (state IN (${list(WORK_STATES)})),
  approved_artifact_id TEXT,
  current_artifact_id TEXT,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  blocked_on_role INTEGER,
  last_blocker_fps_json TEXT NOT NULL DEFAULT '[]',
  escalation_reason TEXT,
  reopen_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  approved_at TEXT,
  PRIMARY KEY (passage_id, role_id)
);

CREATE TABLE artifacts (
  artifact_id TEXT PRIMARY KEY,
  passage_id TEXT NOT NULL REFERENCES production_units(passage_id),
  role_id INTEGER NOT NULL CHECK (role_id BETWEEN 1 AND 8),
  version INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('CANDIDATE','QA_PENDING','MACHINE_REJECTED','QA_FAILED','APPROVED','SUPERSEDED','INVALIDATED','REJECTED_UPSTREAM','STALE')),
  path TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  input_hashes_json TEXT NOT NULL,
  creator_job_id INTEGER,
  creator_attempt INTEGER,
  creator_run_ref TEXT,
  qa_job_id INTEGER,
  qa_run_ref TEXT,
  qa_verdict TEXT,
  qa_certificate_hash TEXT,
  defect_ids_json TEXT NOT NULL DEFAULT '[]',
  authority_caveats_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  approved_at TEXT,
  invalidated_at TEXT,
  invalidated_reason TEXT,
  UNIQUE (passage_id, role_id, version)
);

CREATE TABLE jobs (
  job_id INTEGER PRIMARY KEY AUTOINCREMENT,
  passage_id TEXT NOT NULL REFERENCES production_units(passage_id),
  role_id INTEGER NOT NULL CHECK (role_id BETWEEN 1 AND 8),
  job_type TEXT NOT NULL CHECK (job_type IN ('CREATOR','QA','DETERMINISTIC')),
  state TEXT NOT NULL CHECK (state IN ('READY','EXPORTED','DONE','STALE','CANCELLED')),
  attempt_no INTEGER NOT NULL,
  upstream_caused INTEGER NOT NULL DEFAULT 0,
  is_correction INTEGER NOT NULL DEFAULT 0,
  artifact_id TEXT,
  input_hashes_json TEXT NOT NULL,
  defect_ids_json TEXT NOT NULL DEFAULT '[]',
  packet_hash TEXT,
  packet_path TEXT,
  prompt_path TEXT,
  result_path TEXT,
  result_hash TEXT,
  run_ref TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  exported_at TEXT,
  imported_at TEXT
);

CREATE TABLE qa_certificates (
  certificate_hash TEXT PRIMARY KEY,
  artifact_id TEXT NOT NULL REFERENCES artifacts(artifact_id),
  qa_job_id INTEGER,
  qa_kind TEXT NOT NULL CHECK (qa_kind IN ('INDEPENDENT_SEMANTIC','MACHINE_DETERMINISTIC')),
  qa_role_id INTEGER NOT NULL,
  verdict TEXT NOT NULL CHECK (verdict IN ('PASS','FAIL','BLOCKED_NOT_EXECUTED')),
  candidate_hash TEXT NOT NULL,
  body_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE defects (
  defect_id TEXT PRIMARY KEY,
  fingerprint TEXT NOT NULL,
  passage_id TEXT NOT NULL REFERENCES production_units(passage_id),
  detected_by_role INTEGER NOT NULL,
  owner_role TEXT NOT NULL,
  source_artifact_id TEXT,
  source_hash TEXT,
  violated_rule_id TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('BLOCKER','NON_BLOCKING')),
  expected TEXT,
  actual TEXT,
  evidence_locator TEXT,
  detail_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('OPEN','ROUTED','CORRECTED_AWAITING_REVERIFY','CLOSED','ESCALATED')),
  routed_job_id INTEGER,
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  detected_in_job_id INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  closed_at TEXT
);

CREATE TABLE state_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  passage_id TEXT NOT NULL,
  role_id INTEGER NOT NULL,
  from_state TEXT,
  to_state TEXT NOT NULL,
  reason TEXT NOT NULL,
  job_id INTEGER,
  ts TEXT NOT NULL
);

CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  passage_id TEXT,
  role_id INTEGER,
  job_id INTEGER,
  type TEXT NOT NULL,
  detail_json TEXT NOT NULL
);

CREATE INDEX idx_jobs_state ON jobs(state, job_type, role_id);
CREATE INDEX idx_artifacts_unit_role ON artifacts(passage_id, role_id, status);
CREATE INDEX idx_defects_unit ON defects(passage_id, status);
CREATE INDEX idx_defects_fp ON defects(fingerprint);

CREATE TRIGGER events_no_update BEFORE UPDATE ON events BEGIN SELECT RAISE(ABORT, 'events is append-only'); END;
CREATE TRIGGER events_no_delete BEFORE DELETE ON events BEGIN SELECT RAISE(ABORT, 'events is append-only'); END;
CREATE TRIGGER state_history_no_update BEFORE UPDATE ON state_history BEGIN SELECT RAISE(ABORT, 'state_history is append-only'); END;
CREATE TRIGGER state_history_no_delete BEFORE DELETE ON state_history BEGIN SELECT RAISE(ABORT, 'state_history is append-only'); END;
CREATE TRIGGER qa_certificates_no_update BEFORE UPDATE ON qa_certificates BEGIN SELECT RAISE(ABORT, 'qa_certificates is append-only'); END;
CREATE TRIGGER qa_certificates_no_delete BEFORE DELETE ON qa_certificates BEGIN SELECT RAISE(ABORT, 'qa_certificates is append-only'); END;
CREATE TRIGGER artifacts_content_immutable BEFORE UPDATE OF content_hash, path, passage_id, role_id, version, input_hashes_json ON artifacts
  WHEN NEW.content_hash IS NOT OLD.content_hash OR NEW.path IS NOT OLD.path OR NEW.passage_id IS NOT OLD.passage_id
    OR NEW.role_id IS NOT OLD.role_id OR NEW.version IS NOT OLD.version OR NEW.input_hashes_json IS NOT OLD.input_hashes_json
  BEGIN SELECT RAISE(ABORT, 'artifact identity, content_hash and path are immutable'); END;
`;

export type Db = {
  run(sql: string, ...params: unknown[]): { changes: number; lastInsertRowid: number };
  get<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T | undefined;
  all<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T[];
  /** Run fn in a transaction (BEGIN IMMEDIATE); nested calls become savepoints. Throws roll everything back. */
  tx<T>(fn: () => T): T;
  close(): void;
};

const norm = (p: unknown[]): Param[] => p.map((x) => (x === undefined ? null : (x as Param)));
const plain = <T>(r: unknown): T => ({ ...(r as object) }) as T;

export function openDb(path: string): Db {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as { DatabaseSync: new (p: string) => Raw };
  const raw = new DatabaseSync(path);
  raw.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA synchronous = FULL;");
  let depth = 0;
  let sp = 0;
  const db: Db = {
    run(sql, ...params) {
      const r = raw.prepare(sql).run(...norm(params));
      return { changes: Number(r.changes), lastInsertRowid: Number(r.lastInsertRowid) };
    },
    get: <T>(sql: string, ...params: unknown[]) => {
      const r = raw.prepare(sql).get(...norm(params));
      return r === undefined ? undefined : plain<T>(r);
    },
    all: <T>(sql: string, ...params: unknown[]) => raw.prepare(sql).all(...norm(params)).map((r) => plain<T>(r)),
    tx<T>(fn: () => T): T {
      const name = `sp_${++sp}`;
      if (depth === 0) raw.exec("BEGIN IMMEDIATE"); else raw.exec(`SAVEPOINT ${name}`);
      depth++;
      try {
        const out = fn();
        depth--;
        if (depth === 0) raw.exec("COMMIT"); else raw.exec(`RELEASE ${name}`);
        return out;
      } catch (e) {
        depth--;
        if (depth === 0) raw.exec("ROLLBACK"); else raw.exec(`ROLLBACK TO ${name}; RELEASE ${name}`);
        throw e;
      }
    },
    close: () => raw.close()
  };
  migrate(db, raw);
  return db;
}

function migrate(db: Db, raw: Raw): void {
  const hasMeta = !!db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='meta'");
  const current = hasMeta ? Number(db.get<{ value: string }>("SELECT value FROM meta WHERE key='schema_version'")?.value ?? 0) : 0;
  if (current > SCHEMA_VERSION) { raw.close(); throw new Error(`database schema version ${current} is newer than this build (${SCHEMA_VERSION})`); }
  if (current === SCHEMA_VERSION) return;
  db.tx(() => {
    raw.exec(SCHEMA_V1);
    db.run("INSERT INTO meta(key, value) VALUES ('schema_version', ?)", String(SCHEMA_VERSION));
  });
}
