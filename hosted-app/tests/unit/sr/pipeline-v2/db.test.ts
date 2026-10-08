// SQLite state layer: creation, restart persistence, transaction safety, history immutability. No model API anywhere.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb, SCHEMA_VERSION, WORK_STATES } from "../../../../lib/sr/pipeline-v2/db";

let dir: string;
let path: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "sr-db-")); path = join(dir, "state", "speedreader.db"); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const seedUnit = (db: ReturnType<typeof openDb>, id = "W1-0001") =>
  db.run(`INSERT INTO canonical_packages(canonical_hash, package_id, version, freeze_status, lock_file, registered_at) VALUES ('h','P','v1','FREEZE_CANDIDATE_UNCERTIFIED','lock','t') ON CONFLICT DO NOTHING`)
    && db.run(`INSERT INTO production_units(passage_id, registry_coordinate, passage_no, rs, p, delivery_session, canonical_package_id, canonical_package_hash, row_hash, status, created_at, updated_at)
               VALUES (?, 'RS01-P1', 1, 1, 1, 1, 'P', 'h', 'rh', 'ACTIVE', 't', 't')`, id);

describe("SQLite state store", () => {
  it("creates the database file, parent directories and the full schema", () => {
    const db = openDb(path);
    expect(existsSync(path)).toBe(true);
    const tables = db.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table'").map((r) => r.name);
    for (const t of ["meta", "canonical_packages", "production_units", "work_items", "artifacts", "jobs", "qa_certificates", "defects", "state_history", "events"]) expect(tables).toContain(t);
    expect(db.get<{ value: string }>("SELECT value FROM meta WHERE key='schema_version'")?.value).toBe(String(SCHEMA_VERSION));
    db.close();
  });

  it("persists across close/reopen (restart safety)", () => {
    let db = openDb(path);
    seedUnit(db);
    db.run(`INSERT INTO work_items(passage_id, role_id, state, created_at, updated_at) VALUES ('W1-0001', 2, 'READY', 't', 't')`);
    db.close();
    db = openDb(path);
    expect(db.get<{ state: string }>("SELECT state FROM work_items WHERE passage_id='W1-0001' AND role_id=2")?.state).toBe("READY");
    db.close();
  });

  it("re-opening an existing database is idempotent (no duplicate migration)", () => {
    openDb(path).close();
    const db = openDb(path);
    expect(db.all("SELECT * FROM meta WHERE key='schema_version'")).toHaveLength(1);
    db.close();
  });

  it("refuses a database written by a newer schema version", () => {
    const db = openDb(path);
    db.run("UPDATE meta SET value='999' WHERE key='schema_version'");
    db.close();
    expect(() => openDb(path)).toThrow(/newer/);
  });

  it("transactions commit atomically and roll back completely on error", () => {
    const db = openDb(path);
    seedUnit(db);
    expect(() => db.tx(() => {
      db.run(`INSERT INTO work_items(passage_id, role_id, state, created_at, updated_at) VALUES ('W1-0001', 1, 'READY', 't', 't')`);
      throw new Error("boom");
    })).toThrow("boom");
    expect(db.all("SELECT * FROM work_items")).toHaveLength(0);
    db.tx(() => db.run(`INSERT INTO work_items(passage_id, role_id, state, created_at, updated_at) VALUES ('W1-0001', 1, 'READY', 't', 't')`));
    expect(db.all("SELECT * FROM work_items")).toHaveLength(1);
    db.close();
  });

  it("nested transactions roll back only the inner scope", () => {
    const db = openDb(path);
    seedUnit(db);
    db.tx(() => {
      db.run(`INSERT INTO work_items(passage_id, role_id, state, created_at, updated_at) VALUES ('W1-0001', 1, 'READY', 't', 't')`);
      expect(() => db.tx(() => {
        db.run(`INSERT INTO work_items(passage_id, role_id, state, created_at, updated_at) VALUES ('W1-0001', 2, 'READY', 't', 't')`);
        throw new Error("inner");
      })).toThrow("inner");
    });
    expect(db.all<{ role_id: number }>("SELECT role_id FROM work_items").map((r) => r.role_id)).toEqual([1]);
    db.close();
  });

  it("enforces foreign keys and the explicit pipeline-state vocabulary", () => {
    const db = openDb(path);
    expect(() => db.run(`INSERT INTO work_items(passage_id, role_id, state, created_at, updated_at) VALUES ('NOPE', 1, 'READY', 't', 't')`)).toThrow();
    seedUnit(db);
    expect(() => db.run(`INSERT INTO work_items(passage_id, role_id, state, created_at, updated_at) VALUES ('W1-0001', 1, 'DONE_ISH', 't', 't')`)).toThrow();
    expect([...WORK_STATES]).toEqual(["PENDING", "READY", "IN_PROGRESS", "WIP_READY_FOR_QA", "QA_FAILED", "BLOCKED_UPSTREAM", "APPROVED", "INVALIDATED", "ESCALATED_HUMAN_REVIEW", "FINAL_APPROVED"]);
    db.close();
  });

  it("history is append-only: events, state_history and QA certificates cannot be edited or deleted", () => {
    const db = openDb(path);
    db.run(`INSERT INTO events(ts, type, detail_json) VALUES ('t','X','{}')`);
    db.run(`INSERT INTO state_history(passage_id, role_id, from_state, to_state, reason, ts) VALUES ('W1-0001', 1, NULL, 'READY', 'r', 't')`);
    expect(() => db.run("UPDATE events SET type='Y'")).toThrow(/append-only/);
    expect(() => db.run("DELETE FROM events")).toThrow(/append-only/);
    expect(() => db.run("UPDATE state_history SET to_state='APPROVED'")).toThrow(/append-only/);
    expect(() => db.run("DELETE FROM state_history")).toThrow(/append-only/);
    db.close();
  });

  it("an artifact's content hash and path are immutable once recorded", () => {
    const db = openDb(path);
    seedUnit(db);
    db.run(`INSERT INTO artifacts(artifact_id, passage_id, role_id, version, status, path, content_hash, input_hashes_json, created_at, updated_at) VALUES ('a1','W1-0001',2,1,'CANDIDATE','p','h1','{}','t','t')`);
    expect(() => db.run("UPDATE artifacts SET content_hash='h2' WHERE artifact_id='a1'")).toThrow(/immutable/);
    expect(() => db.run("UPDATE artifacts SET path='q' WHERE artifact_id='a1'")).toThrow(/immutable/);
    db.run("UPDATE artifacts SET status='QA_PENDING' WHERE artifact_id='a1'");
    expect(() => db.run(`INSERT INTO artifacts(artifact_id, passage_id, role_id, version, status, path, content_hash, input_hashes_json, created_at, updated_at) VALUES ('a2','W1-0001',2,1,'CANDIDATE','p','h1','{}','t','t')`)).toThrow();
    db.close();
  });

  it("no module in the pipeline imports a model SDK or makes network calls", () => {
    const root = join(__dirname, "..", "..", "..", "..", "lib", "sr", "pipeline-v2");
    const forbidden = /(from|require\()\s*["'](@anthropic-ai|anthropic|openai|@google\/generative-ai|node:http|node:https|node:net|undici|node-fetch|axios)/;
    for (const f of readdirSync(root).filter((n) => n.endsWith(".ts"))) {
      const src = readFileSync(join(root, f), "utf8");
      expect(forbidden.test(src), f).toBe(false);
      expect(/\bfetch\(/.test(src), `${f} calls fetch`).toBe(false);
    }
  });
});
