// APP-DATA-009/010 + APP-DB-001..010: Supabase-backed adapters for the learner, assessment and session ports.
//
// Plain PostgREST over `fetch` (no client dependency), with an injectable fetch so the request shapes and result
// mapping are unit-tested against an in-memory fake. They have NOT been run against a live Supabase project (no
// credentials in this repo); supabase/migrations/0001-0003 define the schema and the transactional
// `sr_commit_learner` function these adapters call. Requests use the service-role key and run server-side only.

import type { LearnerAggregate } from "./learner-aggregate";
import { consistencyErrors } from "./progress-store";
import type { CommitOptions, LearnerRepository, RepositoryCommit, StoredSnapshot } from "./learner-repository";
import type { AssessmentStore, StoredAssessment } from "./learner-service";
import type { SessionPersistence, SessionRecord } from "./session-envelope";

export type SupabaseConfig = { url: string; serviceRoleKey: string; fetchImpl?: typeof fetch };

export function supabaseConfigFromEnv(env: Record<string, string | undefined> = process.env): SupabaseConfig | null {
  const url = env.SUPABASE_URL?.trim();
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return url && serviceRoleKey ? { url: url.replace(/\/+$/, ""), serviceRoleKey } : null;
}

class Rest {
  private readonly f: typeof fetch;
  private readonly cfg: SupabaseConfig;
  constructor(cfg: SupabaseConfig) {
    this.cfg = { ...cfg, url: cfg.url.replace(/\/+$/, "") };
    this.f = cfg.fetchImpl ?? fetch;
  }
  private headers(extra: Record<string, string> = {}) {
    return { apikey: this.cfg.serviceRoleKey, authorization: `Bearer ${this.cfg.serviceRoleKey}`, "content-type": "application/json", ...extra };
  }
  async select<T>(path: string): Promise<T[]> {
    const res = await this.f(`${this.cfg.url}/rest/v1/${path}`, { method: "GET", headers: this.headers() });
    if (!res.ok) throw new Error(`supabase GET ${path.split("?")[0]} failed: ${res.status}`);
    return (await res.json()) as T[];
  }
  /** Returns the HTTP status so callers can map 409 (unique violation) themselves. */
  async insert(table: string, row: unknown, prefer = "return=minimal"): Promise<number> {
    const res = await this.f(`${this.cfg.url}/rest/v1/${table}`, { method: "POST", headers: this.headers({ prefer }), body: JSON.stringify(row) });
    return res.status;
  }
  async rpc<T>(fn: string, args: unknown): Promise<T> {
    const res = await this.f(`${this.cfg.url}/rest/v1/rpc/${fn}`, { method: "POST", headers: this.headers(), body: JSON.stringify(args) });
    if (!res.ok) throw new Error(`supabase rpc ${fn} failed: ${res.status}`);
    return (await res.json()) as T;
  }
}

const enc = encodeURIComponent;

type StateRow = { state: LearnerAggregate; version: number };

export class SupabaseLearnerRepository implements LearnerRepository {
  private readonly rest: Rest;
  constructor(cfg: SupabaseConfig) { this.rest = new Rest(cfg); }

  async load(learnerId: string): Promise<StoredSnapshot | null> {
    const rows = await this.rest.select<StateRow>(`sr_learner_state?learner_id=eq.${enc(learnerId)}&select=state,version`);
    return rows[0] ? { learner: rows[0].state, version: rows[0].version } : null;
  }

  async list(): Promise<StoredSnapshot[]> {
    const rows = await this.rest.select<StateRow>("sr_learner_state?select=state,version");
    return rows.map((r) => ({ learner: r.state, version: r.version }));
  }

  async create(learner: LearnerAggregate): Promise<StoredSnapshot> {
    const errors = consistencyErrors(learner);
    if (errors.length) throw new Error(errors.join("; "));
    const status = await this.rest.insert("sr_learner_state", {
      learner_id: learner.learnerId, baseline_wpm: learner.baselineWpm, current_wpm: learner.core.wpm,
      canonical_pointer: learner.canonicalPointer, state: learner, version: 1
    });
    if (status === 409) throw new Error(`learner ${learner.learnerId} already exists`);
    if (status >= 300) throw new Error(`supabase insert failed: ${status}`);
    return { learner, version: 1 };
  }

  async commit(learnerId: string, next: LearnerAggregate, options: CommitOptions): Promise<RepositoryCommit> {
    const current = await this.load(learnerId);
    if (!current) return { ok: false, reason: "UNKNOWN_LEARNER", error: `no learner ${learnerId}`, snapshot: null };
    if (next.learnerId !== learnerId) return { ok: false, reason: "INVARIANT_VIOLATION", error: "aggregate learnerId does not match", snapshot: current };
    const errors = consistencyErrors(next);
    if (errors.length) return { ok: false, reason: "INVARIANT_VIOLATION", error: errors.join("; "), snapshot: current };
    // exactly one new attempt record at most is appended per commit; it is written in the same transaction
    const attempt = next.ledger.length > current.learner.ledger.length ? next.ledger[next.ledger.length - 1] : null;
    let result: { ok: boolean; replayed?: boolean; reason?: string; version?: number };
    try {
      result = await this.rest.rpc("sr_commit_learner", {
        p_learner_id: learnerId, p_expected_version: options.expectedVersion, p_idempotency_key: options.idempotencyKey,
        p_state: next, p_current_wpm: next.core.wpm, p_pointer: next.canonicalPointer, p_attempt: attempt
      });
    } catch (e) {
      return { ok: false, reason: "WRITE_FAILED", error: e instanceof Error ? e.message : String(e), snapshot: current };
    }
    if (result.ok && result.replayed) return { ok: true, snapshot: (await this.load(learnerId)) ?? current, replayed: true };
    if (result.ok) return { ok: true, snapshot: { learner: next, version: result.version ?? current.version + 1 }, replayed: false };
    return { ok: false, reason: result.reason === "VERSION_CONFLICT" ? "VERSION_CONFLICT" : "WRITE_FAILED", error: result.reason ?? "commit failed", snapshot: (await this.load(learnerId)) ?? current };
  }
}

/** Upsert-by-learner JSON documents (assessment progress, session records). */
async function upsertDoc(rest: Rest, table: string, learnerId: string, column: string, value: unknown): Promise<void> {
  const status = await rest.insert(table, { learner_id: learnerId, [column]: value, updated_at: new Date().toISOString() }, "resolution=merge-duplicates,return=minimal");
  if (status >= 300) throw new Error(`supabase upsert ${table} failed: ${status}`);
}

export class SupabaseAssessmentStore implements AssessmentStore {
  private readonly rest: Rest;
  constructor(cfg: SupabaseConfig) { this.rest = new Rest(cfg); }
  async load(learnerId: string): Promise<StoredAssessment | null> {
    const rows = await this.rest.select<{ value: StoredAssessment }>(`sr_assessment_state?learner_id=eq.${enc(learnerId)}&select=value`);
    return rows[0]?.value ?? null;
  }
  async save(learnerId: string, value: StoredAssessment): Promise<void> {
    await upsertDoc(this.rest, "sr_assessment_state", learnerId, "value", value);
  }
}

export class SupabaseSessionPersistence implements SessionPersistence {
  private readonly rest: Rest;
  constructor(cfg: SupabaseConfig) { this.rest = new Rest(cfg); }
  async load(learnerId: string): Promise<SessionRecord[]> {
    const rows = await this.rest.select<{ records: SessionRecord[] }>(`sr_session_state?learner_id=eq.${enc(learnerId)}&select=records`);
    return rows[0]?.records ?? [];
  }
  async save(learnerId: string, records: readonly SessionRecord[]): Promise<void> {
    await upsertDoc(this.rest, "sr_session_state", learnerId, "records", records);
  }
}
