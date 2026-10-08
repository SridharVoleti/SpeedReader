// SpeedReader Pipeline v2 orchestrator. SQLite is local state only; there is no model API anywhere in this code.
// Semantic work (Roles 2-6, creator + independent QA) is done by people in separate Cowork contexts through exported
// job packets. Everything deterministic is here: queueing, hashes, promotion, QA certificates, defect routing,
// upstream touchback, dependency invalidation, retry/escalation, and the code-owned Roles 1, 7 and 8.
//
// Invariants (each has a regression test):
//   * Only the engine changes work-item states, and every change goes through transition() (allow-list + history).
//   * Creators/code write WIP only. An artifact is APPROVED only by an independent QA PASS (or a deterministic
//     machine certificate for the code-owned roles) bound to the exact content hash; downstream reads APPROVED only.
//   * A job is pinned to the approved upstream hashes it was built from; if they change it is STALE and rejected.
//   * Invalidation is hash-driven and touches only artifacts whose recorded inputs no longer match.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { openDb, type Db, type WorkState } from "./db";
import { CanonicalError, loadCanonicalPackage, type CanonicalPackage } from "./canonical";
import { loadRegistry, type Registry } from "./registry";
import { resolveConfig, type PipelineConfig } from "./config";
import { openArtifactStore, artifactHash, type ArtifactStore } from "./store";
import { acknowledgedCaveats, blockingGaps, gapsForRole } from "./gaps";
import { ROLE_AC_IDS, specExcerpts } from "./excerpts";
import { machineDefects, machinePassed, runMachineChecks, type MachineEvidence } from "./machine-checks";
import { loadContracts, loadSchemas, renderPrompt, roleFromLabel, roleLabel, type JobPacket, type UpstreamArtifact } from "./packets";
import { buildPassageSpec, verifyPassageSpec } from "./role1";
import { buildAttemptContract, verifyAttemptContract } from "./role7";
import {
  assembleFinalPackage, finalEvidenceSummary, INTERIM_ENVELOPE_SCHEMA, promotionSmoke, validateFinalPackage,
  type RefRule, type Role8Context, type Role8Validation, type SectionInput
} from "./role8";
import { canonicalHash } from "../pipeline/hash";
import { ROLES, descendants, type RoleId } from "../pipeline/roles";
import { SECTIONS, SECTION_ROLE } from "../pipeline/sections";

export const SEMANTIC_ROLES = [2, 3, 4, 5, 6] as const;
export const DETERMINISTIC_ROLES = [1, 7, 8] as const;
export const ARTIFACT_TYPE: Record<number, string> = { 1: "PASSAGE_SPEC", 2: "PASSAGE_TEXT", 3: "ASSESSMENT", 4: "MEANING_UNITS", 5: "BPC", 6: "SCORING_SEMANTIC_MAP", 7: "ATTEMPT_OUTCOME_CONTRACT", 8: "FINAL_PACKAGE" };

const ALLOWED: Record<WorkState, WorkState[]> = {
  PENDING: ["READY", "ESCALATED_HUMAN_REVIEW"],
  READY: ["IN_PROGRESS", "PENDING", "ESCALATED_HUMAN_REVIEW"],
  IN_PROGRESS: ["WIP_READY_FOR_QA", "BLOCKED_UPSTREAM", "QA_FAILED", "ESCALATED_HUMAN_REVIEW", "READY", "PENDING", "APPROVED", "FINAL_APPROVED"],
  WIP_READY_FOR_QA: ["APPROVED", "QA_FAILED", "BLOCKED_UPSTREAM", "ESCALATED_HUMAN_REVIEW", "READY", "PENDING"],
  QA_FAILED: ["READY", "ESCALATED_HUMAN_REVIEW"],
  BLOCKED_UPSTREAM: ["READY", "PENDING", "ESCALATED_HUMAN_REVIEW"],
  APPROVED: ["INVALIDATED", "READY", "ESCALATED_HUMAN_REVIEW"],
  INVALIDATED: ["PENDING", "READY", "ESCALATED_HUMAN_REVIEW"],
  ESCALATED_HUMAN_REVIEW: ["PENDING", "READY"],
  FINAL_APPROVED: ["INVALIDATED", "ESCALATED_HUMAN_REVIEW"]
};

export type UnitRow = { passage_id: string; registry_coordinate: string; passage_no: number; rs: number; p: number; delivery_session: number; canonical_package_id: string; canonical_package_hash: string; row_hash: string; status: string; created_at: string; updated_at: string };
export type ItemRow = { passage_id: string; role_id: number; state: WorkState; approved_artifact_id: string | null; current_artifact_id: string | null; failed_attempts: number; blocked_on_role: number | null; last_blocker_fps_json: string; escalation_reason: string | null; reopen_count: number; created_at: string; updated_at: string; approved_at: string | null };
export type ArtifactRow = { artifact_id: string; passage_id: string; role_id: number; version: number; status: string; path: string; content_hash: string; input_hashes_json: string; creator_job_id: number | null; creator_attempt: number | null; creator_run_ref: string | null; qa_job_id: number | null; qa_run_ref: string | null; qa_verdict: string | null; qa_certificate_hash: string | null; defect_ids_json: string; authority_caveats_json: string; created_at: string; updated_at: string; approved_at: string | null; invalidated_at: string | null; invalidated_reason: string | null };
export type JobRow = { job_id: number; passage_id: string; role_id: number; job_type: "CREATOR" | "QA" | "DETERMINISTIC"; state: "READY" | "EXPORTED" | "DONE" | "STALE" | "CANCELLED"; attempt_no: number; upstream_caused: number; is_correction: number; artifact_id: string | null; input_hashes_json: string; defect_ids_json: string; packet_hash: string | null; packet_path: string | null; prompt_path: string | null; result_path: string | null; result_hash: string | null; run_ref: string | null; created_at: string; updated_at: string; exported_at: string | null; imported_at: string | null };
export type DefectRow = { defect_id: string; fingerprint: string; passage_id: string; detected_by_role: number; owner_role: string; source_artifact_id: string | null; source_hash: string | null; violated_rule_id: string; severity: string; expected: string | null; actual: string | null; evidence_locator: string | null; detail_json: string; status: string; routed_job_id: number | null; occurrence_count: number; detected_in_job_id: number | null; created_at: string; updated_at: string; closed_at: string | null };
export type CertRow = { certificate_hash: string; artifact_id: string; qa_job_id: number | null; qa_kind: string; qa_role_id: number; verdict: string; candidate_hash: string; body_json: string; created_at: string };
export type HistoryRow = { id: number; passage_id: string; role_id: number; from_state: string | null; to_state: string; reason: string; job_id: number | null; ts: string };
export type EventRow = { id: number; ts: string; passage_id: string | null; role_id: number | null; job_id: number | null; type: string; detail_json: string };

export class ImportRejected extends Error {
  constructor(public code: string, message: string) { super(`${code}: ${message}`); this.name = "ImportRejected"; }
}
export class StaleJobError extends Error {
  constructor(public jobId: number, public replacement: number | null) { super(`STALE_JOB: job ${jobId} was built on approved inputs that have since changed${replacement ? `; use job ${replacement}` : ""}`); this.name = "StaleJobError"; }
}

export type ImportOutcome = {
  status: "READY_FOR_INDEPENDENT_QA" | "MACHINE_REJECTED" | "APPROVED" | "FINAL_APPROVED" | "QA_FAILED" | "BLOCKED_UPSTREAM" | "ESCALATED_HUMAN_REVIEW" | "QA_NOT_EXECUTED_REISSUED";
  jobId: number; passageId: string; roleId: number;
  artifactId?: string; contentHash?: string; qaJobId?: number; packetPath?: string; promptPath?: string;
  message: string; nextActions: string[];
};
export type DetRun = { passage: string; role: number; result: "APPROVED" | "FINAL_APPROVED" | "ESCALATED" | "BLOCKED_UPSTREAM" };

type RawDefect = Record<string, unknown>;
type NormDefect = { raw: RawDefect; owner: string; ownerRole: number | null; rule: string; actual: string; expected: string; locator: string; sourceArtifactId: string | null; sourceHash: string | null; suppliedId: string | null; fp: string };

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const normText = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const artifactIdOf = (passage: string, role: number, version: number) => `${passage}:r${role}:v${version}`;
const upstreamOf = (role: number): number[] => [...(ROLES.find((r) => r.id === role)?.upstream ?? [])];
const ancestorsOf = (role: number): number[] => ([1, 2, 3, 4, 5, 6, 7, 8] as RoleId[]).filter((r) => r !== role && descendants(r).includes(role as RoleId));
const isSemantic = (role: number) => (SEMANTIC_ROLES as readonly number[]).includes(role);

export class PipelineEngine {
  readonly cfg: PipelineConfig;
  readonly db: Db;
  readonly canonical: CanonicalPackage;
  readonly registry: Registry;
  readonly store: ArtifactStore;
  private schemas: ReturnType<typeof loadSchemas>;
  private depth = 0;

  private constructor(cfg: PipelineConfig, db: Db, canonical: CanonicalPackage, registry: Registry, store: ArtifactStore) {
    this.cfg = cfg; this.db = db; this.canonical = canonical; this.registry = registry; this.store = store;
    this.schemas = loadSchemas(cfg.architectureDir);
  }

  static open(over: Partial<PipelineConfig> & { root?: string }): PipelineEngine {
    const cfg = over.executionMode === "MANUAL_PACKET" && over.dbPath && over.wipRoot ? (over as PipelineConfig) : resolveConfig(over);
    const canonical = loadCanonicalPackage(cfg.canonicalDir, { requireFrozen: cfg.requireFrozenCanonical });
    const registry = loadRegistry(canonical, { expectedRows: cfg.expectedRegistryRows });
    const db = openDb(cfg.dbPath);
    let eng: PipelineEngine;
    try {
      const store = openArtifactStore(cfg);
      for (const d of [cfg.jobsRoot, cfg.resultsRoot]) mkdirSync(d, { recursive: true });
      eng = new PipelineEngine(cfg, db, canonical, registry, store);
    } catch (e) {
      db.close();
      throw e;
    }
    const drift = db.all<{ passage_id: string; canonical_package_hash: string }>("SELECT passage_id, canonical_package_hash FROM production_units WHERE status='ACTIVE' AND canonical_package_hash <> ?", canonical.hash);
    if (drift.length) {
      db.close();
      throw new CanonicalError("BLOCKED_CANONICAL_INPUT", [`canonical package hash changed since registration for ${drift.map((d) => d.passage_id).join(", ")}; re-register against the new package`]);
    }
    return eng;
  }

  close(): void { this.db.close(); }
  private now(): string { return this.cfg.clock ? this.cfg.clock() : new Date().toISOString(); }

  // ---------------------------------------------------------------------------------------------------------------
  // reads
  unit(passage: string): UnitRow | undefined { return this.db.get<UnitRow>("SELECT * FROM production_units WHERE passage_id=?", passage); }
  units(): UnitRow[] { return this.db.all<UnitRow>("SELECT * FROM production_units ORDER BY delivery_session"); }
  item(passage: string, role: number): ItemRow {
    const r = this.db.get<ItemRow>("SELECT * FROM work_items WHERE passage_id=? AND role_id=?", passage, role);
    if (!r) throw new Error(`no work item for ${passage} role ${role}`);
    return r;
  }
  items(passage: string): ItemRow[] { return this.db.all<ItemRow>("SELECT * FROM work_items WHERE passage_id=? ORDER BY role_id", passage); }
  artifacts(passage: string, role?: number): ArtifactRow[] {
    return role === undefined
      ? this.db.all<ArtifactRow>("SELECT * FROM artifacts WHERE passage_id=? ORDER BY role_id, version", passage)
      : this.db.all<ArtifactRow>("SELECT * FROM artifacts WHERE passage_id=? AND role_id=? ORDER BY version", passage, role);
  }
  artifact(id: string): ArtifactRow { const a = this.db.get<ArtifactRow>("SELECT * FROM artifacts WHERE artifact_id=?", id); if (!a) throw new Error(`no artifact ${id}`); return a; }
  certificates(artifactId: string): CertRow[] { return this.db.all<CertRow>("SELECT * FROM qa_certificates WHERE artifact_id=? ORDER BY rowid", artifactId); }
  getJob(id: number): JobRow { const j = this.db.get<JobRow>("SELECT * FROM jobs WHERE job_id=?", id); if (!j) throw new Error(`no job ${id}`); return j; }
  listJobs(f: { passage?: string; role?: number; type?: string; state?: string } = {}): JobRow[] {
    const w: string[] = []; const p: unknown[] = [];
    if (f.passage) { w.push("passage_id=?"); p.push(f.passage); }
    if (f.role !== undefined) { w.push("role_id=?"); p.push(f.role); }
    if (f.type) { w.push("job_type=?"); p.push(f.type); }
    if (f.state) { w.push("state=?"); p.push(f.state); }
    return this.db.all<JobRow>(`SELECT * FROM jobs ${w.length ? "WHERE " + w.join(" AND ") : ""} ORDER BY job_id`, ...p);
  }
  defects(f: { passage?: string; status?: string } = {}): DefectRow[] {
    const w: string[] = []; const p: unknown[] = [];
    if (f.passage) { w.push("passage_id=?"); p.push(f.passage); }
    if (f.status) { w.push("status=?"); p.push(f.status); }
    return this.db.all<DefectRow>(`SELECT * FROM defects ${w.length ? "WHERE " + w.join(" AND ") : ""} ORDER BY rowid`, ...p);
  }
  history(passage: string, role?: number): HistoryRow[] {
    return role === undefined
      ? this.db.all<HistoryRow>("SELECT * FROM state_history WHERE passage_id=? ORDER BY id", passage)
      : this.db.all<HistoryRow>("SELECT * FROM state_history WHERE passage_id=? AND role_id=? ORDER BY id", passage, role);
  }
  events(): EventRow[] { return this.db.all<EventRow>("SELECT * FROM events ORDER BY id"); }

  nextJob(): JobRow | null {
    return this.db.get<JobRow>(`SELECT j.* FROM jobs j JOIN production_units u USING(passage_id)
      WHERE j.state='READY' AND j.job_type IN ('CREATOR','QA')
      ORDER BY j.is_correction DESC, u.delivery_session ASC, j.role_id ASC, j.job_id ASC LIMIT 1`) ?? null;
  }

  // ---------------------------------------------------------------------------------------------------------------
  // low-level helpers
  private tx<T>(fn: () => T): T { return this.db.tx(fn); }

  private ev(type: string, ctx: { passage?: string; role?: number; job?: number }, detail: Record<string, unknown> = {}): void {
    this.db.run("INSERT INTO events(ts, passage_id, role_id, job_id, type, detail_json) VALUES (?,?,?,?,?,?)", this.now(), ctx.passage ?? null, ctx.role ?? null, ctx.job ?? null, type, JSON.stringify(detail));
  }

  private transition(passage: string, role: number, to: WorkState, reason: string, jobId?: number): void {
    const it = this.item(passage, role);
    if (it.state === to) return;
    if (!ALLOWED[it.state].includes(to)) throw new Error(`illegal transition ${it.state} -> ${to} for ${passage} role ${role} (${reason})`);
    const t = this.now();
    this.db.run("UPDATE work_items SET state=?, updated_at=? WHERE passage_id=? AND role_id=?", to, t, passage, role);
    this.db.run("INSERT INTO state_history(passage_id, role_id, from_state, to_state, reason, job_id, ts) VALUES (?,?,?,?,?,?,?)", passage, role, it.state, to, reason, jobId ?? null, t);
  }

  private setItem(passage: string, role: number, cols: Partial<Record<string, unknown>>): void {
    const keys = Object.keys(cols);
    this.db.run(`UPDATE work_items SET ${keys.map((k) => `${k}=?`).join(", ")}, updated_at=? WHERE passage_id=? AND role_id=?`, ...keys.map((k) => cols[k]), this.now(), passage, role);
  }

  private approvedArtifact(passage: string, role: number): ArtifactRow | undefined {
    const it = this.item(passage, role);
    return it.approved_artifact_id ? this.artifact(it.approved_artifact_id) : undefined;
  }
  /** hash of the last approved artifact for a role (kept while a correction is in progress) */
  private lastApprovedHash(passage: string, role: number): string | null { return this.approvedArtifact(passage, role)?.content_hash ?? null; }

  /** current pins: what an artifact/job for `role` must have been built from. null = that input has no approved artifact. */
  private pinsNow(passage: string, role: number): Record<string, string | null> {
    const u = this.unit(passage)!;
    const pins: Record<string, string | null> = { canonical: u.canonical_package_hash };
    if (role === 1) pins.row = u.row_hash;
    for (const up of upstreamOf(role)) pins[String(up)] = this.lastApprovedHash(passage, up);
    return pins;
  }
  /** pins for NEW work: only when every upstream is currently APPROVED. */
  private eligiblePins(passage: string, role: number): Record<string, string> | null {
    for (const up of upstreamOf(role)) { const s = this.item(passage, up).state; if (s !== "APPROVED" && s !== "FINAL_APPROVED") return null; }
    const pins = this.pinsNow(passage, role);
    return Object.values(pins).some((v) => v === null) ? null : (pins as Record<string, string>);
  }
  private static samePins(a: Record<string, unknown>, b: Record<string, unknown>): string | null {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) if ((a[k] ?? null) !== (b[k] ?? null)) return k;
    return null;
  }

  private nextVersion(passage: string, role: number): number {
    return (this.db.get<{ v: number | null }>("SELECT MAX(version) v FROM artifacts WHERE passage_id=? AND role_id=?", passage, role)?.v ?? 0) + 1;
  }

  // ---------------------------------------------------------------------------------------------------------------
  // registration
  registerUnits(ids: string[]): { registered: string[]; alreadyRegistered: string[] } {
    const out = { registered: [] as string[], alreadyRegistered: [] as string[] };
    const unknown = ids.filter((i) => !this.registry.byId.has(i));
    if (unknown.length) throw new CanonicalError("BLOCKED_CANONICAL_INPUT", [`not in the canonical registry: ${unknown.join(", ")}`]);
    this.tx(() => {
      this.db.run("INSERT INTO canonical_packages(canonical_hash, package_id, version, freeze_status, lock_file, registered_at) VALUES (?,?,?,?,?,?) ON CONFLICT(canonical_hash) DO NOTHING",
        this.canonical.hash, this.canonical.id, this.canonical.version, this.canonical.freeze.status, this.canonical.lockFile, this.now());
      for (const id of ids) {
        if (this.unit(id)) { out.alreadyRegistered.push(id); continue; }
        const r = this.registry.byId.get(id)!;
        const t = this.now();
        this.db.run("INSERT INTO production_units(passage_id, registry_coordinate, passage_no, rs, p, delivery_session, canonical_package_id, canonical_package_hash, row_hash, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,'ACTIVE',?,?)",
          id, r.coordinate, r.passageNo, r.rs, r.p, r.deliverySession, this.canonical.id, this.canonical.hash, canonicalHash(r.row), t, t);
        for (let role = 1; role <= 8; role++) {
          this.db.run("INSERT INTO work_items(passage_id, role_id, state, created_at, updated_at) VALUES (?,?,'PENDING',?,?)", id, role, t, t);
          this.db.run("INSERT INTO state_history(passage_id, role_id, from_state, to_state, reason, ts) VALUES (?,?,NULL,'PENDING','registered',?)", id, role, t);
        }
        this.ev("UNIT_REGISTERED", { passage: id }, { coordinate: r.coordinate, canonical_package_hash: this.canonical.hash, freeze_status: this.canonical.freeze.status });
        out.registered.push(id);
      }
      this.reconcile();
    });
    return out;
  }

  // ---------------------------------------------------------------------------------------------------------------
  // reconcile: derive every state that follows from hashes (eligibility, staleness, invalidation, unblocking)
  reconcile(): string[] {
    const log: string[] = [];
    this.tx(() => {
      for (const u of this.units().filter((x) => x.status === "ACTIVE")) for (let role = 1; role <= 8; role++) this.reconcileItem(u.passage_id, role, log);
    });
    return log;
  }

  private reconcileItem(passage: string, role: number, log: string[]): void {
    const it = this.item(passage, role);
    switch (it.state) {
      case "APPROVED":
      case "FINAL_APPROVED": {
        const art = this.approvedArtifact(passage, role);
        if (!art) break;
        const bad = PipelineEngine.samePins(JSON.parse(art.input_hashes_json), this.pinsNow(passage, role));
        if (bad) {
          this.invalidate(passage, role, art, bad === "canonical" || bad === "row" ? `canonical input ${bad} changed` : `relied on a superseded or invalidated role ${bad} artifact`);
          log.push(`${passage} role ${role}: INVALIDATED (role ${bad})`);
          this.tryStart(passage, role, log);
        }
        break;
      }
      case "INVALIDATED": this.tryStart(passage, role, log); break;
      case "PENDING": this.tryStart(passage, role, log); break;
      case "READY": {
        if (isSemantic(role)) {
          const live = this.listJobs({ passage, role, type: "CREATOR" }).filter((j) => j.state === "READY");
          const pins = this.eligiblePins(passage, role);
          const stale = live.filter((j) => !pins || PipelineEngine.samePins(JSON.parse(j.input_hashes_json), pins));
          for (const j of stale) this.setJob(j.job_id, { state: "STALE" }, "inputs changed before export");
          if (!pins) { this.transition(passage, role, "PENDING", "upstream no longer approved"); break; }
          if (live.length === stale.length) this.createCreatorJob(passage, role, false);
        }
        break;
      }
      case "IN_PROGRESS": {
        if (isSemantic(role)) {
          const job = this.listJobs({ passage, role, type: "CREATOR" }).find((j) => j.state === "EXPORTED");
          if (job && PipelineEngine.samePins(JSON.parse(job.input_hashes_json), this.pinsNow(passage, role))) {
            this.setJob(job.job_id, { state: "STALE" }, "approved inputs changed while the job was out");
            this.ev("JOB_STALE", { passage, role, job: job.job_id });
            log.push(`${passage} role ${role}: job ${job.job_id} STALE`);
            this.transition(passage, role, "READY", "stale job replaced", job.job_id);
            const pins = this.eligiblePins(passage, role);
            if (pins) this.createCreatorJob(passage, role, false); else this.transition(passage, role, "PENDING", "upstream not approved");
          }
        }
        break;
      }
      case "WIP_READY_FOR_QA": {
        const art = it.current_artifact_id ? this.artifact(it.current_artifact_id) : undefined;
        if (art && art.status === "QA_PENDING" && PipelineEngine.samePins(JSON.parse(art.input_hashes_json), this.pinsNow(passage, role))) {
          this.db.run("UPDATE artifacts SET status='STALE', invalidated_at=?, invalidated_reason=?, updated_at=? WHERE artifact_id=?", this.now(), "candidate built on superseded inputs", this.now(), art.artifact_id);
          for (const j of this.listJobs({ passage, role, type: "QA" }).filter((x) => x.state === "READY" || x.state === "EXPORTED")) this.setJob(j.job_id, { state: "STALE" }, "candidate stale");
          log.push(`${passage} role ${role}: candidate ${art.artifact_id} STALE`);
          this.transition(passage, role, "READY", "candidate stale: upstream changed");
          const pins = this.eligiblePins(passage, role);
          if (pins) this.createCreatorJob(passage, role, false); else this.transition(passage, role, "PENDING", "upstream not approved");
        }
        break;
      }
      case "BLOCKED_UPSTREAM": {
        const waiting = this.db.get("SELECT 1 x FROM defects WHERE passage_id=? AND detected_by_role=? AND status IN ('OPEN','ROUTED','ESCALATED') AND owner_role <> ? LIMIT 1", passage, role, String(role));
        if (!waiting && this.eligiblePins(passage, role)) {
          this.setItem(passage, role, { blocked_on_role: null });
          this.transition(passage, role, "READY", "upstream corrected and re-approved");
          if (isSemantic(role)) this.createCreatorJob(passage, role, true);
          log.push(`${passage} role ${role}: unblocked`);
        }
        break;
      }
      case "ESCALATED_HUMAN_REVIEW": {
        if (it.escalation_reason?.startsWith("BLOCKED_CANONICAL_INPUT") && this.gapBlockers(role).length === 0) {
          this.setItem(passage, role, { escalation_reason: null });
          this.transition(passage, role, "PENDING", "canonical gap resolved or acknowledged");
          this.tryStart(passage, role, log);
        }
        break;
      }
      default: break;
    }
  }

  private gapBlockers(role: number) { return blockingGaps(this.canonical, this.cfg, role); }

  private tryStart(passage: string, role: number, log: string[]): void {
    let it = this.item(passage, role);
    if (it.state === "INVALIDATED") { this.transition(passage, role, "PENDING", "awaiting inputs"); it = this.item(passage, role); }
    if (it.state !== "PENDING") return;
    if (!this.eligiblePins(passage, role)) return;
    const gaps = this.gapBlockers(role);
    if (gaps.length) {
      const reason = `BLOCKED_CANONICAL_INPUT: ${gaps.map((g) => `${g.id} (${g.missing})`).join("; ")}`;
      this.setItem(passage, role, { escalation_reason: reason });
      this.transition(passage, role, "ESCALATED_HUMAN_REVIEW", reason);
      this.ev("BLOCKED_CANONICAL_INPUT", { passage, role }, { gaps: gaps.map((g) => g.id) });
      log.push(`${passage} role ${role}: ${reason}`);
      return;
    }
    this.transition(passage, role, "READY", "inputs approved");
    if (isSemantic(role)) this.createCreatorJob(passage, role, false);
  }

  private invalidate(passage: string, role: number, art: ArtifactRow, reason: string): void {
    const t = this.now();
    this.db.run("UPDATE artifacts SET status='INVALIDATED', invalidated_at=?, invalidated_reason=?, updated_at=? WHERE artifact_id=?", t, reason, t, art.artifact_id);
    this.setItem(passage, role, { approved_artifact_id: null, approved_at: null });
    this.transition(passage, role, "INVALIDATED", reason);
    this.ev("ARTIFACT_INVALIDATED", { passage, role }, { artifact_id: art.artifact_id, hash: art.content_hash, reason });
  }

  private setJob(jobId: number, cols: Record<string, unknown>, why?: string): void {
    const keys = Object.keys(cols);
    this.db.run(`UPDATE jobs SET ${keys.map((k) => `${k}=?`).join(", ")}, updated_at=? WHERE job_id=?`, ...keys.map((k) => cols[k]), this.now(), jobId);
    if (why) this.ev("JOB_UPDATED", { job: jobId }, { ...cols, why });
  }

  private openDefectContext(passage: string, role: number): DefectRow[] {
    return this.db.all<DefectRow>("SELECT * FROM defects WHERE passage_id=? AND owner_role=? AND status IN ('OPEN','ROUTED') AND severity='BLOCKER' ORDER BY rowid", passage, String(role));
  }

  private createCreatorJob(passage: string, role: number, upstreamCaused: boolean): JobRow {
    const live = this.listJobs({ passage, role, type: "CREATOR" }).find((j) => j.state === "READY" || j.state === "EXPORTED");
    if (live) return live;
    const it = this.item(passage, role);
    const pins = this.eligiblePins(passage, role);
    if (!pins) throw new Error(`cannot create ${passage} role ${role} job: upstream not approved`);
    const attempt = it.failed_attempts + 1;
    if (attempt > this.cfg.maxCreatorAttempts) throw new Error(`retry cap exceeded for ${passage} role ${role}`);
    const defects = this.openDefectContext(passage, role);
    const t = this.now();
    const r = this.db.run("INSERT INTO jobs(passage_id, role_id, job_type, state, attempt_no, upstream_caused, is_correction, artifact_id, input_hashes_json, defect_ids_json, created_at, updated_at) VALUES (?,?,'CREATOR','READY',?,?,?,NULL,?,?,?,?)",
      passage, role, attempt, upstreamCaused ? 1 : 0, defects.length || attempt > 1 ? 1 : 0, JSON.stringify(pins), JSON.stringify(defects.map((d) => d.defect_id)), t, t);
    const job = this.getJob(r.lastInsertRowid);
    this.ev("JOB_CREATED", { passage, role, job: job.job_id }, { type: "CREATOR", attempt, upstream_caused: upstreamCaused, defects: defects.map((d) => d.defect_id) });
    return job;
  }

  // ---------------------------------------------------------------------------------------------------------------
  // deterministic roles 1, 7, 8 and resume
  runDeterministic(): DetRun[] {
    const runs: DetRun[] = [];
    for (let guard = 0; guard < 64; guard++) {
      this.reconcile();
      let progressed = false;
      for (const u of this.units().filter((x) => x.status === "ACTIVE")) {
        for (const role of DETERMINISTIC_ROLES) {
          if (this.item(u.passage_id, role).state !== "READY") continue;
          const result = this.tx(() => this.executeDeterministic(u.passage_id, role));
          runs.push({ passage: u.passage_id, role, result });
          progressed = true;
          break;
        }
        if (progressed) break;
      }
      if (!progressed) break;
    }
    return runs;
  }

  resume(): { recovery: { removedTemps: number; completed: string[]; removedOrphans: string[] }; deterministic: DetRun[]; next: JobRow | null } {
    const recovery = this.store.recover();
    if (recovery.removedTemps || recovery.completed.length || recovery.removedOrphans.length) this.ev("STORE_RECOVERED", {}, recovery);
    const deterministic = this.runDeterministic();
    return { recovery, deterministic, next: this.nextJob() };
  }

  private executeDeterministic(passage: string, role: number): DetRun["result"] {
    const t = this.now();
    const pins = this.eligiblePins(passage, role);
    if (!pins) throw new Error(`deterministic role ${role} for ${passage} is READY without approved inputs`);
    this.transition(passage, role, "IN_PROGRESS", "deterministic execution");
    const version = this.nextVersion(passage, role);
    const artifactId = artifactIdOf(passage, role, version);
    const runRef = `code:role${role}`;
    const caveats = acknowledgedCaveats(this.canonical, this.cfg, role);
    const escalate = (reason: string): DetRun["result"] => {
      this.setItem(passage, role, { escalation_reason: reason });
      this.transition(passage, role, "ESCALATED_HUMAN_REVIEW", reason);
      this.ev("DETERMINISTIC_ESCALATED", { passage, role }, { reason });
      return "ESCALATED";
    };
    let artifact: unknown;
    let problems: string[] = [];
    let machine: unknown = [];
    let r8: { bytes: Uint8Array; validation: Role8Validation; ctx: Role8Context } | null = null;
    try {
      if (role === 1) {
        artifact = buildPassageSpec(this.canonical, this.registry, passage);
        problems = verifyPassageSpec(artifact as never, this.canonical, this.registry).problems;
      } else if (role === 7) {
        artifact = buildAttemptContract(this.canonical, this.registry, passage, pins["6"]);
        problems = verifyAttemptContract(artifact as never, this.canonical, this.registry, pins["6"]).problems;
      } else {
        const ctx = this.buildRole8Context(passage, version);
        if (typeof ctx === "string") return escalate(ctx);
        const { pkg, bytes } = assembleFinalPackage(ctx);
        artifact = pkg;
        const validation = validateFinalPackage(bytes, ctx);
        r8 = { bytes, validation, ctx };
        problems = validation.problems.map((p) => `${p.check}: ${p.message}`);
        machine = validation.evidence;
      }
    } catch (e) {
      const msg = e instanceof CanonicalError ? `${e.code}: ${e.details.join("; ")}` : (e as Error).message;
      return escalate(`BLOCKED_CANONICAL_INPUT: role ${role} could not be derived - ${msg}`);
    }
    const { path, hash } = this.store.writeWip(role, passage, version, artifact);
    this.db.run("INSERT INTO artifacts(artifact_id, passage_id, role_id, version, status, path, content_hash, input_hashes_json, creator_job_id, creator_attempt, creator_run_ref, authority_caveats_json, created_at, updated_at) VALUES (?,?,?,?, 'CANDIDATE', ?,?,?, NULL, 1, ?,?,?,?)",
      artifactId, passage, role, version, path, hash, JSON.stringify(pins), runRef, JSON.stringify(caveats), t, t);
    this.setItem(passage, role, { current_artifact_id: artifactId });
    this.ev("DETERMINISTIC_PRODUCED", { passage, role }, { artifact_id: artifactId, hash });

    if (problems.length) {
      this.db.run("UPDATE artifacts SET status='MACHINE_REJECTED', updated_at=? WHERE artifact_id=?", this.now(), artifactId);
      if (r8 && r8.validation.problems.some((p) => p.ownerRole >= 1 && p.ownerRole <= 7 && p.ownerRole !== 8)) {
        const routed = this.routeRole8Problems(passage, artifactId, r8.validation);
        return routed === "ESCALATED_HUMAN_REVIEW" ? "ESCALATED" : "BLOCKED_UPSTREAM";
      }
      return escalate(`ROLE${role}_VALIDATION_FAILED: ${problems.slice(0, 5).join(" | ")}`);
    }

    const cert = this.insertCertificate(artifactId, null, "MACHINE_DETERMINISTIC", role, "PASS", hash, {
      verifier: role === 1 ? "verifyPassageSpec" : role === 7 ? "verifyAttemptContract" : "validateFinalPackage",
      upstream_hashes: pins, canonical_package_hash: this.canonical.hash, machine_evidence: machine, caveats
    });
    this.db.run("UPDATE artifacts SET status='QA_PENDING', qa_verdict='PASS', qa_certificate_hash=?, qa_run_ref=?, updated_at=? WHERE artifact_id=?", cert, runRef, this.now(), artifactId);
    this.store.promote(role, passage, version, hash);
    if (role === 8) {
      const smoke = promotionSmoke(() => this.store.readApprovedText(8, passage, version), hash);
      const all = [...r8!.validation.evidence.filter((e) => e.check !== "PROMOTION_SMOKE"), smoke];
      const fin = finalEvidenceSummary(all);
      if (!fin.canPass) throw new Error(`Role 8 final evidence incomplete after promotion: failed=${fin.failed} notExecuted=${fin.notExecuted}`);
      const caveatsAll = [...caveats, ...r8!.validation.caveats];
      this.db.run("UPDATE artifacts SET authority_caveats_json=?, updated_at=? WHERE artifact_id=?", JSON.stringify(caveatsAll), this.now(), artifactId);
      this.ev("FINAL_EVIDENCE", { passage, role }, { evidence: all, caveats: caveatsAll });
    }
    this.afterApproval(passage, role, artifactId, role === 8 ? "FINAL_APPROVED" : "APPROVED");
    this.reconcile();
    return role === 8 ? "FINAL_APPROVED" : "APPROVED";
  }

  private insertCertificate(artifactId: string, qaJobId: number | null, kind: "INDEPENDENT_SEMANTIC" | "MACHINE_DETERMINISTIC", role: number, verdict: "PASS" | "FAIL" | "BLOCKED_NOT_EXECUTED", candidateHash: string, body: Record<string, unknown>): string {
    const art = this.artifact(artifactId);
    const full = { artifact_id: artifactId, passage_id: art.passage_id, role_id: role, version: art.version, qa_kind: kind, qa_job_id: qaJobId, verdict, candidate_hash: candidateHash, issued_at: this.now(), ...body };
    const hash = canonicalHash(full);
    this.db.run("INSERT INTO qa_certificates(certificate_hash, artifact_id, qa_job_id, qa_kind, qa_role_id, verdict, candidate_hash, body_json, created_at) VALUES (?,?,?,?,?,?,?,?,?)", hash, artifactId, qaJobId, kind, role, verdict, candidateHash, JSON.stringify(full), this.now());
    this.ev("QA_CERTIFICATE", { passage: art.passage_id, role, job: qaJobId ?? undefined }, { certificate_hash: hash, verdict, kind });
    return hash;
  }

  /** Common tail of every approval: supersede the previous version, close/forward defects, set the item state. */
  private afterApproval(passage: string, role: number, artifactId: string, to: "APPROVED" | "FINAL_APPROVED"): void {
    const t = this.now();
    const prev = this.approvedArtifact(passage, role);
    if (prev && prev.artifact_id !== artifactId) {
      this.db.run("UPDATE artifacts SET status='SUPERSEDED', updated_at=? WHERE artifact_id=?", t, prev.artifact_id);
      this.ev("ARTIFACT_SUPERSEDED", { passage, role }, { old: prev.artifact_id, old_hash: prev.content_hash, new: artifactId, hash_changed: prev.content_hash !== this.artifact(artifactId).content_hash });
    }
    this.db.run("UPDATE artifacts SET status='APPROVED', approved_at=?, updated_at=? WHERE artifact_id=?", t, t, artifactId);
    // defects this role owned: own-QA defects close now; defects detected downstream await re-verification there
    this.db.run("UPDATE defects SET status='CLOSED', closed_at=?, updated_at=? WHERE passage_id=? AND owner_role=? AND detected_by_role=? AND status IN ('OPEN','ROUTED')", t, t, passage, String(role), role);
    this.db.run("UPDATE defects SET status='CORRECTED_AWAITING_REVERIFY', updated_at=? WHERE passage_id=? AND owner_role=? AND status IN ('OPEN','ROUTED')", t, passage, String(role));
    // defects this role detected and whose owners have since corrected them are now verified by this approval
    this.db.run("UPDATE defects SET status='CLOSED', closed_at=?, updated_at=? WHERE passage_id=? AND detected_by_role=? AND status='CORRECTED_AWAITING_REVERIFY'", t, t, passage, role);
    this.setItem(passage, role, { approved_artifact_id: artifactId, current_artifact_id: artifactId, approved_at: t, blocked_on_role: null, escalation_reason: null });
    this.transition(passage, role, to, "approved", this.artifact(artifactId).qa_job_id ?? undefined);
    this.ev("ARTIFACT_PROMOTED", { passage, role }, { artifact_id: artifactId, hash: this.artifact(artifactId).content_hash });
  }

  // ---------------------------------------------------------------------------------------------------------------
  // Role 8 plumbing
  private resolveFinalSchema(): Role8Context["schema"] | null {
    const member = this.canonical.artifacts.find((a) => a.present && /final[_ ]package.*schema|Final_Package_Schema/i.test(a.name));
    if (member) return { authority: "CANONICAL", id: member.name, schema: JSON.parse(this.canonical.readArtifactText(member.name)) };
    if (this.cfg.finalSchemaPath) return { authority: "CONFIGURED_NON_CANONICAL", id: this.cfg.finalSchemaPath, schema: JSON.parse(readFileSync(this.cfg.finalSchemaPath, "utf8")) };
    if (this.cfg.allowInterimEnvelopeSchema) return { authority: "INTERIM_ENVELOPE", id: "interim-envelope", schema: INTERIM_ENVELOPE_SCHEMA };
    return null;
  }
  private resolveRefRules(): { rules: RefRule[]; authority: Role8Context["refRulesAuthority"] } {
    const member = this.canonical.artifacts.find((a) => a.present && /referential|reference[_ ]rules/i.test(a.name));
    if (member) return { rules: JSON.parse(this.canonical.readArtifactText(member.name)) as RefRule[], authority: "CANONICAL" };
    if (this.cfg.referentialRulesPath) return { rules: JSON.parse(readFileSync(this.cfg.referentialRulesPath, "utf8")) as RefRule[], authority: "CONFIGURED_NON_CANONICAL" };
    return { rules: [], authority: "NONE" };
  }

  /** Build the Role 8 context from APPROVED artifacts only (re-verified against their approval records). */
  private buildRole8Context(passage: string, packageVersion: number): Role8Context | string {
    const schema = this.resolveFinalSchema();
    if (!schema) return "BLOCKED_CANONICAL_INPUT: G-R8-FINAL-SCHEMA (no canonical final package schema and no schema configured)";
    const sections: Record<number, SectionInput> = {};
    for (const s of SECTIONS) {
      const role = SECTION_ROLE[s];
      const a = this.approvedArtifact(passage, role);
      if (!a) return `BLOCKED_UPSTREAM: role ${role} has no approved artifact`;
      const approved = this.store.readApproved(role, passage, a.version);
      const cert = a.qa_certificate_hash ? this.db.get<CertRow>("SELECT * FROM qa_certificates WHERE certificate_hash=?", a.qa_certificate_hash) : undefined;
      sections[role] = { role, artifactId: a.artifact_id, version: a.version, hash: approved.hash, artifact: approved.artifact, certificateHash: a.qa_certificate_hash, qaKind: cert?.qa_kind ?? null, currentHash: this.lastApprovedHash(passage, role) };
    }
    const u = this.unit(passage)!;
    const refs = this.resolveRefRules();
    return { passageId: passage, packageVersion, canonical: { id: this.canonical.id, version: this.canonical.version, hash: this.canonical.hash }, unitCanonicalHash: u.canonical_package_hash, sections, schema, refRules: refs.rules, refRulesAuthority: refs.authority };
  }

  /** Dry-run Role 8 validation over the currently approved artifacts (no state change). */
  validatePassage(passage: string): { ready: boolean; missing: number[]; validation?: Role8Validation; schemaAuthority?: string } {
    if (!this.unit(passage)) throw new Error(`unknown passage ${passage}`);
    const missing = SECTIONS.map((s) => SECTION_ROLE[s]).filter((r) => !this.approvedArtifact(passage, r));
    if (missing.length) return { ready: false, missing };
    const ctx = this.buildRole8Context(passage, this.nextVersion(passage, 8));
    if (typeof ctx === "string") return { ready: false, missing: [8], validation: undefined, schemaAuthority: ctx };
    const { bytes } = assembleFinalPackage(ctx);
    return { ready: true, missing: [], validation: validateFinalPackage(bytes, ctx), schemaAuthority: ctx.schema.authority };
  }

  private routeRole8Problems(passage: string, artifactId: string, validation: Role8Validation) {
    const defects: RawDefect[] = validation.problems.filter((p) => p.ownerRole >= 1 && p.ownerRole <= 7).map((p) => {
      const src = this.approvedArtifact(passage, p.ownerRole);
      return {
        violated_rule_id: `R8:${p.check}`, expected: `${p.check} PASS`, actual: p.message, evidence_locator: p.locator, severity: "BLOCKER",
        owner_role: String(p.ownerRole), source_role: String(p.ownerRole), source_artifact_id: src?.artifact_id ?? `${passage}:r${p.ownerRole}`, source_hash: src?.content_hash ?? null
      };
    });
    return this.handleDefects(passage, 8, artifactId, null, defects.map((d) => this.normDefect(passage, d)), "ROLE8_VALIDATION");
  }

  // ---------------------------------------------------------------------------------------------------------------
  // job export
  exportJob(jobId: number): { packet: JobPacket; packetPath: string; promptPath: string } {
    const job = this.getJob(jobId);
    if (job.job_type === "DETERMINISTIC") throw new Error("deterministic jobs are executed by the engine, not exported");
    if (job.state !== "READY" && job.state !== "EXPORTED") throw new Error(`job ${jobId} is ${job.state} and cannot be exported`);
    const role = job.role_id;
    const passage = job.passage_id;
    const artifact = job.artifact_id ? this.artifact(job.artifact_id) : null;
    const pinsNow = this.pinsNow(passage, role);
    const pinned = JSON.parse(job.input_hashes_json) as Record<string, string>;
    if (PipelineEngine.samePins(pinned, pinsNow) || (job.job_type === "QA" && artifact?.status !== "QA_PENDING")) {
      this.tx(() => { this.setJob(jobId, { state: "STALE" }, "stale at export"); this.reconcile(); });
      const repl = this.listJobs({ passage, role, state: "READY" })[0];
      throw new StaleJobError(jobId, repl?.job_id ?? null);
    }
    const upstream: UpstreamArtifact[] = upstreamOf(role).map((u) => {
      const a = this.approvedArtifact(passage, u);
      if (!a) throw new Error(`upstream role ${u} has no approved artifact`);
      const approved = this.store.readApproved(u, passage, a.version); // re-verifies the approval record (tamper => throws)
      if (approved.hash !== pinned[String(u)]) throw new StaleJobError(jobId, null);
      return { role_id: roleLabel(u), artifact_type: ARTIFACT_TYPE[u], artifact_id: a.artifact_id, version: a.version, content_hash: approved.hash, content: approved.artifact };
    });
    let candidate: JobPacket["candidate_artifact"] = null;
    let evidence: MachineEvidence[] = [];
    if (job.job_type === "QA") {
      const wip = this.store.readWip(role, passage, artifact!.version);
      if (wip.hash !== artifact!.content_hash) throw new ImportRejected("CANDIDATE_TAMPERED", `WIP candidate ${artifact!.artifact_id} no longer matches its recorded hash`);
      candidate = { artifact_id: artifact!.artifact_id, role_id: roleLabel(role), version: artifact!.version, content_hash: artifact!.content_hash, content: wip.artifact };
      evidence = runMachineChecks(role, wip.artifact, passage);
    }
    const defects = (JSON.parse(job.defect_ids_json) as string[]).map((id) => this.db.get<DefectRow>("SELECT * FROM defects WHERE defect_id=?", id)).filter(Boolean).map((d) => ({
      defect_id: d!.defect_id, status: d!.status, source_role: JSON.parse(d!.detail_json).source_role ?? d!.owner_role, owner_role: d!.owner_role, detected_by_role: roleLabel(d!.detected_by_role),
      source_artifact_id: d!.source_artifact_id, source_hash: d!.source_hash, violated_rule_id: d!.violated_rule_id, expected: d!.expected, actual: d!.actual, evidence_locator: d!.evidence_locator, severity: d!.severity
    }));
    const packet: JobPacket = {
      job_id: job.job_id, production_unit_id: passage, role_id: roleLabel(role), job_type: job.job_type as "CREATOR" | "QA", attempt_no: job.attempt_no,
      canonical_package_id: this.canonical.id, canonical_package_hash: this.canonical.hash,
      applicable_acceptance_criteria_ids: ROLE_AC_IDS[role] ?? [], approved_upstream_artifacts: upstream, candidate_artifact: candidate,
      machine_check_evidence: evidence, open_defect_context: defects
    };
    const check = this.schemas.validatePacket(packet);
    if (!check.ok) throw new Error(`generated packet violates job_packet.schema.json: ${check.errors.join("; ")}`);
    const caveats = [...acknowledgedCaveats(this.canonical, this.cfg, role)];
    if (this.canonical.freeze.status !== "FROZEN_CERTIFIED") caveats.unshift(`CANONICAL PACKAGE ${this.canonical.version} IS NOT A CERTIFIED FREEZE (${this.canonical.freeze.status}): ${this.canonical.freeze.evidence}. Outputs are provisional.`);
    const contracts = loadContracts(this.cfg.architectureDir, role, job.job_type as "CREATOR" | "QA");
    const prompt = renderPrompt({ packet, canonicalVersion: this.canonical.version, freezeStatus: this.canonical.freeze.status, excerpts: specExcerpts(this.canonical, role), caveats, contracts, resultSchemaText: this.schemas.resultSchemaText });
    const base = join(this.cfg.jobsRoot, `job-${String(job.job_id).padStart(6, "0")}`);
    const packetPath = `${base}.packet.json`;
    const promptPath = `${base}.prompt.md`;
    mkdirSync(this.cfg.jobsRoot, { recursive: true });
    writeFileSync(packetPath, JSON.stringify(packet, null, 2));
    writeFileSync(promptPath, prompt);
    this.tx(() => {
      this.setJob(job.job_id, { state: "EXPORTED", packet_path: packetPath, prompt_path: promptPath, packet_hash: canonicalHash(packet), exported_at: this.now() });
      if (job.job_type === "CREATOR" && this.item(passage, role).state === "READY") this.transition(passage, role, "IN_PROGRESS", "creator job exported", job.job_id);
      this.ev("JOB_EXPORTED", { passage, role, job: job.job_id }, { packet: packetPath, prompt: promptPath, type: job.job_type });
    });
    return { packet, packetPath, promptPath };
  }

  /** Re-issue a lost/unusable job with the same pins; the old packet becomes unimportable. No attempt is spent. */
  retryJob(jobId: number): JobRow {
    const job = this.getJob(jobId);
    if (job.state !== "EXPORTED" && job.state !== "READY") throw new Error(`job ${jobId} is ${job.state} and cannot be retried`);
    return this.tx(() => {
      this.setJob(jobId, { state: "CANCELLED" }, "retry requested");
      let fresh: JobRow;
      if (job.job_type === "CREATOR") {
        if (this.item(job.passage_id, job.role_id).state === "IN_PROGRESS") this.transition(job.passage_id, job.role_id, "READY", "job retried", jobId);
        fresh = this.createCreatorJob(job.passage_id, job.role_id, !!job.upstream_caused);
      } else {
        fresh = this.createQaJob(this.artifact(job.artifact_id!));
      }
      this.ev("JOB_RETRIED", { passage: job.passage_id, role: job.role_id, job: jobId }, { replacement: fresh.job_id });
      return fresh;
    });
  }

  private createQaJob(art: ArtifactRow): JobRow {
    const t = this.now();
    const r = this.db.run("INSERT INTO jobs(passage_id, role_id, job_type, state, attempt_no, upstream_caused, is_correction, artifact_id, input_hashes_json, defect_ids_json, created_at, updated_at) VALUES (?,?,'QA','READY',?,0,0,?,?,?,?,?)",
      art.passage_id, art.role_id, art.creator_attempt ?? 1, art.artifact_id, art.input_hashes_json, art.defect_ids_json, t, t);
    const job = this.getJob(r.lastInsertRowid);
    this.ev("JOB_CREATED", { passage: art.passage_id, role: art.role_id, job: job.job_id }, { type: "QA", artifact_id: art.artifact_id, candidate_hash: art.content_hash });
    return job;
  }

  // ---------------------------------------------------------------------------------------------------------------
  // result import
  importResult(jobId: number, raw: unknown, opts: { runRef?: string } = {}): ImportOutcome {
    try {
      return this.doImport(jobId, raw, opts);
    } catch (e) {
      if (e instanceof ImportRejected) {
        const j = this.db.get<JobRow>("SELECT * FROM jobs WHERE job_id=?", jobId);
        this.ev("IMPORT_REJECTED", { passage: j?.passage_id, role: j?.role_id, job: j ? jobId : undefined }, { code: e.code, message: e.message });
      }
      throw e;
    }
  }

  private reject(code: string, message: string): never { throw new ImportRejected(code, message); }

  private normDefect(passage: string, raw: RawDefect): NormDefect {
    const ownerStr = String(raw.owner_role);
    const ownerRole = ownerStr === "CANONICAL_OWNER" ? null : roleFromLabel(ownerStr);
    const owner = ownerRole === null ? "CANONICAL_OWNER" : String(ownerRole);
    const rule = String(raw.violated_rule_id);
    const actual = String(raw.actual);
    return {
      raw, owner, ownerRole, rule, actual, expected: String(raw.expected ?? ""), locator: String(raw.evidence_locator ?? ""),
      sourceArtifactId: raw.source_artifact_id ? String(raw.source_artifact_id) : null, sourceHash: raw.source_hash ? String(raw.source_hash) : null,
      suppliedId: raw.defect_id ? String(raw.defect_id) : null, fp: sha256(`${passage}|${owner}|${rule}|${normText(actual)}`)
    };
  }

  private validateDefects(job: JobRow, defects: unknown[]): NormDefect[] {
    const out: NormDefect[] = [];
    for (const d of defects) {
      const v = this.schemas.validateDefect(d);
      if (!v.ok) this.reject("INVALID_DEFECT", `defect does not match COMMON_AGENT_CONTRACT section 5: ${v.errors.join("; ")}`);
      const nd = this.normDefect(job.passage_id, d as RawDefect);
      if (nd.ownerRole !== null && nd.ownerRole !== job.role_id && !ancestorsOf(job.role_id).includes(nd.ownerRole)) {
        this.reject("INVALID_DEFECT_OWNER", `owner_role ${nd.owner} is neither role ${job.role_id} nor one of its upstream roles (${ancestorsOf(job.role_id).join(", ")})`);
      }
      out.push(nd);
    }
    return out;
  }

  private doImport(jobId: number, raw: unknown, opts: { runRef?: string }): ImportOutcome {
    const job = this.db.get<JobRow>("SELECT * FROM jobs WHERE job_id=?", jobId);
    if (!job) this.reject("JOB_NOT_FOUND", `no job ${jobId}`);
    if (job.job_type === "DETERMINISTIC") this.reject("JOB_MISMATCH", "deterministic work is executed by code and has no result to import");
    const schema = this.schemas.validateResult(raw);
    if (!schema.ok) this.reject("INVALID_RESULT_SCHEMA", schema.errors.join("; "));
    const r = raw as { job_id: number | string; production_unit_id: string; role_id: string; job_type: string; state: string; artifact?: unknown; candidate_hash?: string | null; blocking_defects: unknown[]; notes?: string | null };
    if (String(r.job_id) !== String(jobId) || r.production_unit_id !== job.passage_id || roleFromLabel(r.role_id) !== job.role_id || r.job_type !== job.job_type) {
      this.reject("JOB_MISMATCH", `result (job ${String(r.job_id)}, ${r.production_unit_id}, role ${r.role_id}, ${r.job_type}) does not match job ${jobId} (${job.passage_id}, role ${roleLabel(job.role_id)}, ${job.job_type})`);
    }
    if (job.state === "DONE") this.reject("JOB_ALREADY_IMPORTED", `job ${jobId} already has an imported result`);
    if (job.state === "STALE") this.reject("STALE_JOB", `job ${jobId} was built on approved inputs that have since changed`);
    if (job.state !== "EXPORTED") this.reject("JOB_NOT_EXPORTED", `job ${jobId} is ${job.state}; export it first (and a retried job's old packet is void)`);
    const runRef = (opts.runRef ?? "").trim();
    if (!runRef) this.reject("RUN_REF_REQUIRED", "a Cowork run reference (--run-ref) is required so creator and QA contexts can be proven separate");
    if (PipelineEngine.samePins(JSON.parse(job.input_hashes_json), this.pinsNow(job.passage_id, job.role_id))) {
      this.tx(() => { this.setJob(jobId, { state: "STALE" }, "stale at import"); this.reconcile(); });
      this.reject("STALE_JOB", `job ${jobId} was built on approved inputs that have since changed; a replacement job was queued`);
    }
    const resultText = JSON.stringify(raw);
    return job.job_type === "CREATOR" ? this.importCreator(job, r, resultText, runRef) : this.importQa(job, r, resultText, runRef);
  }

  private storeResult(job: JobRow, resultText: string, runRef: string): void {
    const path = join(this.cfg.resultsRoot, `job-${String(job.job_id).padStart(6, "0")}.result.json`);
    mkdirSync(this.cfg.resultsRoot, { recursive: true });
    writeFileSync(path, resultText);
    this.setJob(job.job_id, { state: "DONE", result_path: path, result_hash: sha256(resultText), run_ref: runRef, imported_at: this.now() });
    this.ev("RESULT_IMPORTED", { passage: job.passage_id, role: job.role_id, job: job.job_id }, { run_ref: runRef, result_hash: sha256(resultText), type: job.job_type });
  }

  private importCreator(job: JobRow, r: { state: string; artifact?: unknown; candidate_hash?: string | null; blocking_defects: unknown[]; notes?: string | null }, resultText: string, runRef: string): ImportOutcome {
    const passage = job.passage_id, role = job.role_id;
    const allowed = ["READY_FOR_INDEPENDENT_QA", "BLOCKED_UPSTREAM", "BLOCKED_CANONICAL", "ESCALATED"];
    if (!allowed.includes(r.state)) this.reject("WRONG_RESULT_STATE", `a CREATOR job may return ${allowed.join(" | ")}, not ${r.state}; only an independent QA job can PASS`);

    if (r.state === "READY_FOR_INDEPENDENT_QA") {
      const a = r.artifact;
      if (!a || typeof a !== "object" || Array.isArray(a)) this.reject("ARTIFACT_INVALID", "READY_FOR_INDEPENDENT_QA requires `artifact` to be a JSON object");
      if ((a as { passage_id?: unknown }).passage_id !== passage) this.reject("ARTIFACT_INVALID", `artifact.passage_id must equal ${passage}`);
      const hash = artifactHash(a);
      if (r.candidate_hash && r.candidate_hash !== hash) this.reject("CANDIDATE_HASH_MISMATCH", `candidate_hash ${r.candidate_hash} != recomputed canonical hash ${hash}`);
      const evidence = runMachineChecks(role, a, passage);
      const machineOk = machinePassed(evidence);
      const out = this.tx((): ImportOutcome => {
        const version = this.nextVersion(passage, role);
        const artifactId = artifactIdOf(passage, role, version);
        const { path } = this.store.writeWip(role, passage, version, a);
        const t = this.now();
        this.db.run("INSERT INTO artifacts(artifact_id, passage_id, role_id, version, status, path, content_hash, input_hashes_json, creator_job_id, creator_attempt, creator_run_ref, defect_ids_json, authority_caveats_json, created_at, updated_at) VALUES (?,?,?,?,'CANDIDATE',?,?,?,?,?,?,?,?,?,?)",
          artifactId, passage, role, version, path, hash, job.input_hashes_json, job.job_id, job.attempt_no, runRef, job.defect_ids_json, JSON.stringify(acknowledgedCaveats(this.canonical, this.cfg, role)), t, t);
        this.storeResult(job, resultText, runRef);
        this.setItem(passage, role, { current_artifact_id: artifactId });
        this.transition(passage, role, "WIP_READY_FOR_QA", "creator candidate stored in WIP", job.job_id);
        if (!machineOk) {
          this.db.run("UPDATE artifacts SET status='MACHINE_REJECTED', updated_at=? WHERE artifact_id=?", this.now(), artifactId);
          const defects = machineDefects(role, evidence).map((d) => this.normDefect(passage, { ...d, severity: "BLOCKER", owner_role: String(role), source_role: String(role), source_artifact_id: artifactId, source_hash: hash }));
          const status = this.handleDefects(passage, role, artifactId, job.job_id, defects, "MACHINE_CHECK");
          this.reconcile();
          return { status: status === "QA_FAILED" ? "MACHINE_REJECTED" : status, jobId: job.job_id, passageId: passage, roleId: role, artifactId, contentHash: hash, message: `machine check failed: ${defects.map((d) => d.actual).join("; ")}`, nextActions: ["fix the candidate and run the correction job", "pipeline next"] };
        }
        this.db.run("UPDATE artifacts SET status='QA_PENDING', updated_at=? WHERE artifact_id=?", this.now(), artifactId);
        const qa = this.createQaJob(this.artifact(artifactId));
        return { status: "READY_FOR_INDEPENDENT_QA", jobId: job.job_id, passageId: passage, roleId: role, artifactId, contentHash: hash, qaJobId: qa.job_id, message: "READY_FOR_INDEPENDENT_QA", nextActions: [`open a NEW Cowork context and run QA job ${qa.job_id}`] };
      });
      if (out.status === "READY_FOR_INDEPENDENT_QA") {
        const ex = this.exportJob(out.qaJobId!);
        out.packetPath = ex.packetPath; out.promptPath = ex.promptPath;
      }
      return out;
    }

    // BLOCKED_UPSTREAM / BLOCKED_CANONICAL / ESCALATED
    const touchback = r.state === "BLOCKED_UPSTREAM" ? this.validateDefects(job, r.blocking_defects) : [];
    if (r.state === "BLOCKED_UPSTREAM") {
      if (!touchback.some((d) => d.raw.severity === "BLOCKER")) this.reject("INVALID_DEFECT", "BLOCKED_UPSTREAM requires at least one complete BLOCKER defect");
      if (touchback.some((d) => d.ownerRole === role)) this.reject("INVALID_DEFECT_OWNER", "a creator reporting BLOCKED_UPSTREAM must name an upstream owner, not itself");
    }
    return this.tx((): ImportOutcome => {
      this.storeResult(job, resultText, runRef);
      if (r.state === "BLOCKED_UPSTREAM") {
        const status = this.handleDefects(passage, role, null, job.job_id, touchback.filter((d) => d.raw.severity === "BLOCKER"), "CREATOR_TOUCHBACK");
        this.reconcile();
        return { status, jobId: job.job_id, passageId: passage, roleId: role, message: `creator reported ${r.state}`, nextActions: ["pipeline next"] };
      }
      const reason = `${r.state === "BLOCKED_CANONICAL" ? "BLOCKED_CANONICAL_INPUT" : "CREATOR_ESCALATED"}: ${r.notes ?? r.blocking_defects.map((d) => String((d as RawDefect).actual)).join("; ")}`.slice(0, 600);
      for (const d of r.blocking_defects) {
        if (!this.schemas.validateDefect(d).ok) continue; // incomplete defect objects stay in the stored result; notes carry the reason
        this.insertDefect(passage, role, job.job_id, this.normDefect(passage, d as RawDefect), "ESCALATED");
      }
      this.setItem(passage, role, { escalation_reason: reason });
      this.transition(passage, role, "ESCALATED_HUMAN_REVIEW", reason, job.job_id);
      this.ev("CREATOR_ESCALATED", { passage, role, job: job.job_id }, { reason });
      return { status: "ESCALATED_HUMAN_REVIEW", jobId: job.job_id, passageId: passage, roleId: role, message: reason, nextActions: ["a canonical owner/human must decide, then `pipeline resolve`"] };
    });
  }

  private importQa(job: JobRow, r: { state: string; artifact?: unknown; candidate_hash?: string | null; blocking_defects: unknown[] }, resultText: string, runRef: string): ImportOutcome {
    const passage = job.passage_id, role = job.role_id;
    const allowed = ["QA_PASS", "QA_FAIL", "QA_BLOCKED_NOT_EXECUTED"];
    if (!allowed.includes(r.state)) this.reject("WRONG_RESULT_STATE", `a QA job may return ${allowed.join(" | ")}, not ${r.state}`);
    if (r.artifact !== null && r.artifact !== undefined) this.reject("QA_MUST_NOT_REPAIR", "QA is read-only: a QA result must not carry an artifact (route the defect to its owner instead)");
    const art = this.artifact(job.artifact_id!);
    if (art.status !== "QA_PENDING") this.reject("JOB_MISMATCH", `candidate ${art.artifact_id} is ${art.status}, not awaiting QA`);
    if (art.creator_run_ref && art.creator_run_ref === runRef) this.reject("SELF_APPROVAL", `QA run reference ${runRef} is the creator's own context; independent QA must run in a separate Cowork context`);

    if (r.state === "QA_BLOCKED_NOT_EXECUTED") {
      this.tx(() => {
        this.storeResult(job, resultText, runRef);
        this.createQaJob(art);
      });
      return this.finishReissue(job, art);
    }

    if (r.state === "QA_PASS") {
      if (!r.candidate_hash || r.candidate_hash !== art.content_hash) this.reject("CANDIDATE_HASH_MISMATCH", `QA reviewed ${String(r.candidate_hash)} but the candidate is ${art.content_hash}`);
      if (r.blocking_defects.some((d) => (d as RawDefect)?.severity !== "NON_BLOCKING")) this.reject("QA_PASS_WITH_BLOCKERS", "QA_PASS requires zero BLOCKER defects");
      let wip: { artifact: unknown; hash: string };
      try { wip = this.store.readWip(role, passage, art.version); } catch { this.reject("CANDIDATE_TAMPERED", "WIP candidate is unreadable"); }
      if (wip.hash !== art.content_hash) this.reject("CANDIDATE_TAMPERED", `WIP bytes hash ${wip.hash} != QA-reviewed ${art.content_hash}`);
      if (this.db.get("SELECT 1 x FROM defects WHERE source_artifact_id=? AND severity='BLOCKER' AND status='OPEN' LIMIT 1", art.artifact_id)) this.reject("OPEN_BLOCKER", `candidate ${art.artifact_id} has an open blocker defect`);
      const evidence = runMachineChecks(role, wip.artifact, passage);
      if (!machinePassed(evidence)) this.reject("MACHINE_CHECK_FAILED", `mandatory machine checks no longer pass: ${evidence.filter((e) => e.result !== "PASS").map((e) => e.check).join(", ")}`);
      const out = this.tx((): ImportOutcome => {
        this.storeResult(job, resultText, runRef);
        const cert = this.insertCertificate(art.artifact_id, job.job_id, "INDEPENDENT_SEMANTIC", role, "PASS", art.content_hash, {
          qa_run_ref: runRef, creator_run_ref: art.creator_run_ref, upstream_hashes: JSON.parse(art.input_hashes_json), canonical_package_hash: this.canonical.hash,
          qa_checks_run: (JSON.parse(resultText) as { checks_run: unknown[] }).checks_run, machine_evidence: evidence, nonblocking_observations: (JSON.parse(resultText) as { nonblocking_observations: unknown[] }).nonblocking_observations
        });
        this.db.run("UPDATE artifacts SET qa_job_id=?, qa_run_ref=?, qa_verdict='PASS', qa_certificate_hash=?, updated_at=? WHERE artifact_id=?", job.job_id, runRef, cert, this.now(), art.artifact_id);
        this.store.promote(role, passage, art.version, art.content_hash); // last step inside the transaction: a failure rolls the DB back
        this.afterApproval(passage, role, art.artifact_id, "APPROVED");
        this.reconcile();
        return { status: "APPROVED", jobId: job.job_id, passageId: passage, roleId: role, artifactId: art.artifact_id, contentHash: art.content_hash, message: "independent QA PASS recorded and artifact promoted", nextActions: ["pipeline resume", "pipeline next"] };
      });
      return out;
    }

    // QA_FAIL
    const defects = this.validateDefects(job, r.blocking_defects);
    if (!defects.some((d) => d.raw.severity === "BLOCKER")) this.reject("QA_FAIL_WITHOUT_BLOCKER", "QA_FAIL requires at least one complete BLOCKER defect (NON_BLOCKING observations never force rework)");
    return this.tx((): ImportOutcome => {
      this.storeResult(job, resultText, runRef);
      this.db.run("UPDATE artifacts SET qa_job_id=?, qa_run_ref=?, qa_verdict='FAIL', updated_at=? WHERE artifact_id=?", job.job_id, runRef, this.now(), art.artifact_id);
      this.insertCertificate(art.artifact_id, job.job_id, "INDEPENDENT_SEMANTIC", role, "FAIL", art.content_hash, { qa_run_ref: runRef, creator_run_ref: art.creator_run_ref, defect_fingerprints: defects.map((d) => d.fp) });
      const status = this.handleDefects(passage, role, art.artifact_id, job.job_id, defects.filter((d) => d.raw.severity === "BLOCKER"), "QA_FAIL");
      this.reconcile();
      return { status, jobId: job.job_id, passageId: passage, roleId: role, artifactId: art.artifact_id, message: `QA FAIL routed: ${status}`, nextActions: ["pipeline next"] };
    });
  }

  private finishReissue(job: JobRow, art: ArtifactRow): ImportOutcome {
    const fresh = this.listJobs({ passage: job.passage_id, role: job.role_id, type: "QA", state: "READY" }).filter((j) => j.artifact_id === art.artifact_id).pop()!;
    const ex = this.exportJob(fresh.job_id);
    return { status: "QA_NOT_EXECUTED_REISSUED", jobId: job.job_id, passageId: job.passage_id, roleId: job.role_id, artifactId: art.artifact_id, qaJobId: fresh.job_id, packetPath: ex.packetPath, promptPath: ex.promptPath, message: "QA could not execute; a fresh QA job was issued (no verdict recorded)", nextActions: [`run QA job ${fresh.job_id} in a new context`] };
  }

  // ---------------------------------------------------------------------------------------------------------------
  // defect routing: the orchestrator, never an agent, performs the touchback
  private insertDefect(passage: string, detectedBy: number, jobId: number | null, d: NormDefect, status: "OPEN" | "ESCALATED"): string {
    const n = (this.db.get<{ c: number }>("SELECT COUNT(*) c FROM defects WHERE fingerprint=?", d.fp)?.c ?? 0) + 1;
    const id = `D-${d.fp.slice(0, 12)}-${n}`;
    const t = this.now();
    this.db.run("INSERT INTO defects(defect_id, fingerprint, passage_id, detected_by_role, owner_role, source_artifact_id, source_hash, violated_rule_id, severity, expected, actual, evidence_locator, detail_json, status, occurrence_count, detected_in_job_id, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      id, d.fp, passage, detectedBy, d.owner, d.sourceArtifactId, d.sourceHash, d.rule, String(d.raw.severity ?? "BLOCKER"), d.expected, d.actual, d.locator, JSON.stringify({ ...d.raw, supplied_id: d.suppliedId }), status, n, jobId, t, t);
    this.ev("DEFECT_RECORDED", { passage, role: detectedBy, job: jobId ?? undefined }, { defect_id: id, owner: d.owner, rule: d.rule, fingerprint: d.fp });
    return id;
  }

  /** Public so Role 8 validation (and tests) can route a finding that did not come through an imported QA job. */
  routeExternalDefects(passage: string, detectedByRole: number, defects: RawDefect[]): string {
    return this.tx(() => {
      const nd = defects.map((d) => this.normDefect(passage, d));
      const status = this.handleDefects(passage, detectedByRole, null, null, nd, "EXTERNAL");
      this.reconcile();
      return status;
    });
  }

  /**
   * Route blocker defects to their true owners. Returns the outcome status for the detecting item.
   *  - owner = detecting role      -> counted failure, correction job (or escalation at the cap / on a repeated blocker)
   *  - owner = upstream role       -> detector BLOCKED_UPSTREAM (no retry spent); owner reopened for correction
   *  - owner = CANONICAL_OWNER/R1  -> human escalation (code-owned or canonical issues get no LLM correction job)
   */
  private handleDefects(passage: string, detector: number, detectorArtifactId: string | null, jobId: number | null, defects: NormDefect[], source: string): "QA_FAILED" | "BLOCKED_UPSTREAM" | "ESCALATED_HUMAN_REVIEW" {
    const ids = new Map<NormDefect, string>();
    for (const d of defects) ids.set(d, this.insertDefect(passage, detector, jobId, d, "OPEN"));
    const codeOwned = (d: NormDefect) => d.ownerRole === null || d.ownerRole === 1 || d.ownerRole === 7 || d.ownerRole === 8;
    const upstreamOwners = [...new Set(defects.filter((d) => d.ownerRole !== null && d.ownerRole !== detector && !codeOwned(d)).map((d) => d.ownerRole as number))].sort((a, b) => a - b);
    const selfDefects = defects.filter((d) => d.ownerRole === detector && !codeOwned(d));
    const canon = defects.filter((d) => codeOwned(d));
    let result: "QA_FAILED" | "BLOCKED_UPSTREAM" | "ESCALATED_HUMAN_REVIEW" = "QA_FAILED";
    const setDefects = (ds: NormDefect[], status: string, routedJob?: number) => {
      for (const d of ds) this.db.run("UPDATE defects SET status=?, routed_job_id=COALESCE(?, routed_job_id), updated_at=? WHERE defect_id=?", status, routedJob ?? null, this.now(), ids.get(d)!);
    };

    if (canon.length) {
      const reason = `CANONICAL_OWNER: ${canon.map((d) => `${d.rule} (${d.actual})`).join("; ")}`.slice(0, 600);
      setDefects(canon, "ESCALATED");
      const it = this.item(passage, detector);
      if (it.state !== "ESCALATED_HUMAN_REVIEW" && ALLOWED[it.state].includes("ESCALATED_HUMAN_REVIEW")) {
        this.setItem(passage, detector, { escalation_reason: reason });
        this.transition(passage, detector, "ESCALATED_HUMAN_REVIEW", reason, jobId ?? undefined);
      }
      if (detectorArtifactId) this.db.run("UPDATE artifacts SET status='QA_FAILED', updated_at=? WHERE artifact_id=?", this.now(), detectorArtifactId);
      result = "ESCALATED_HUMAN_REVIEW";
    }

    // owners first, so the detector's blocked_on_role can point at them
    for (const owner of upstreamOwners) {
      const mine = defects.filter((d) => d.ownerRole === owner);
      const oi = this.item(passage, owner);
      const previous = JSON.parse(oi.last_blocker_fps_json) as string[];
      const repeated = mine.some((d) => previous.includes(d.fp));
      this.setItem(passage, owner, { last_blocker_fps_json: JSON.stringify(mine.map((d) => d.fp)) });
      if (oi.state === "ESCALATED_HUMAN_REVIEW") { setDefects(mine, "ESCALATED"); continue; }
      if (oi.state !== "APPROVED") { // already being corrected: attach the new defects to its live job
        const live = this.listJobs({ passage, role: owner, type: "CREATOR" }).find((j) => j.state === "READY" || j.state === "EXPORTED");
        setDefects(mine, "ROUTED", live?.job_id);
        continue;
      }
      const failed = oi.failed_attempts + 1;
      this.setItem(passage, owner, { failed_attempts: failed });
      if (repeated || failed >= this.cfg.maxCreatorAttempts) {
        const reason = repeated ? `REPEATED_BLOCKER: ${mine.map((d) => d.rule).join(", ")} reported again after correction` : `RETRY_LIMIT: ${failed} failed creator attempts`;
        this.setItem(passage, owner, { escalation_reason: reason });
        this.transition(passage, owner, "ESCALATED_HUMAN_REVIEW", reason, jobId ?? undefined);
        setDefects(mine, "ESCALATED");
        this.ev("ESCALATED", { passage, role: owner }, { reason, source });
        continue;
      }
      this.setItem(passage, owner, { reopen_count: oi.reopen_count + 1 });
      this.transition(passage, owner, "READY", `reopened for correction: defect from role ${detector}`, jobId ?? undefined);
      setDefects(mine, "ROUTED");
      if (!this.eligiblePins(passage, owner)) { // its own upstream is also being corrected: it will start when that is approved
        this.transition(passage, owner, "PENDING", "waiting for its own upstream correction");
        this.ev("TOUCHBACK", { passage, role: owner }, { detected_by: detector, defects: mine.map((d) => ids.get(d)), source, queued: true });
        continue;
      }
      const job = this.createCreatorJob(passage, owner, false);
      setDefects(mine, "ROUTED", job.job_id);
      this.ev("TOUCHBACK", { passage, role: owner, job: job.job_id }, { detected_by: detector, defects: mine.map((d) => ids.get(d)), source });
    }

    if (upstreamOwners.length) {
      const di = this.item(passage, detector);
      if (di.state === "IN_PROGRESS" || di.state === "WIP_READY_FOR_QA") {
        this.setItem(passage, detector, { blocked_on_role: upstreamOwners[0] });
        this.transition(passage, detector, "BLOCKED_UPSTREAM", `waiting for corrected role ${upstreamOwners.join(", ")}`, jobId ?? undefined);
        if (detectorArtifactId) this.db.run("UPDATE artifacts SET status='REJECTED_UPSTREAM', updated_at=? WHERE artifact_id=?", this.now(), detectorArtifactId);
        for (const j of this.listJobs({ passage, role: detector }).filter((x) => x.state === "READY" || x.state === "EXPORTED")) this.setJob(j.job_id, { state: "CANCELLED" }, "detector blocked upstream");
      }
      if (selfDefects.length) setDefects(selfDefects, "ROUTED");
      if (result !== "ESCALATED_HUMAN_REVIEW") result = "BLOCKED_UPSTREAM";
      return result;
    }

    if (selfDefects.length) {
      const di = this.item(passage, detector);
      const previous = JSON.parse(di.last_blocker_fps_json) as string[];
      const repeated = selfDefects.some((d) => previous.includes(d.fp));
      this.setItem(passage, detector, { last_blocker_fps_json: JSON.stringify(selfDefects.map((d) => d.fp)) });
      const failed = di.failed_attempts + 1;
      this.setItem(passage, detector, { failed_attempts: failed });
      if (detectorArtifactId) this.db.run("UPDATE artifacts SET status=CASE WHEN status='MACHINE_REJECTED' THEN status ELSE 'QA_FAILED' END, updated_at=? WHERE artifact_id=?", this.now(), detectorArtifactId);
      if (di.state === "IN_PROGRESS" || di.state === "WIP_READY_FOR_QA") this.transition(passage, detector, "QA_FAILED", `${source}: ${selfDefects.length} blocker(s)`, jobId ?? undefined);
      if (repeated || failed >= this.cfg.maxCreatorAttempts) {
        const reason = repeated ? `REPEATED_BLOCKER: ${selfDefects.map((d) => d.rule).join(", ")} appeared twice consecutively` : `RETRY_LIMIT: ${failed} failed creator attempts`;
        this.setItem(passage, detector, { escalation_reason: reason });
        this.transition(passage, detector, "ESCALATED_HUMAN_REVIEW", reason, jobId ?? undefined);
        setDefects(selfDefects, "ESCALATED");
        this.ev("ESCALATED", { passage, role: detector }, { reason, source });
        return "ESCALATED_HUMAN_REVIEW";
      }
      this.transition(passage, detector, "READY", "correction scheduled", jobId ?? undefined);
      const next = this.createCreatorJob(passage, detector, false);
      setDefects(selfDefects, "ROUTED", next.job_id);
      return result === "ESCALATED_HUMAN_REVIEW" ? result : "QA_FAILED";
    }
    return result;
  }

  // ---------------------------------------------------------------------------------------------------------------
  // human decisions and reporting
  resolveEscalation(passage: string, role: number, note: string): void {
    this.tx(() => {
      const it = this.item(passage, role);
      if (it.state !== "ESCALATED_HUMAN_REVIEW") throw new Error(`${passage} role ${role} is not escalated (state ${it.state})`);
      this.setItem(passage, role, { failed_attempts: 0, last_blocker_fps_json: "[]", escalation_reason: null });
      this.db.run("UPDATE defects SET status='ROUTED', updated_at=? WHERE passage_id=? AND owner_role=? AND status='ESCALATED'", this.now(), passage, String(role));
      this.transition(passage, role, "PENDING", `human resolution: ${note}`);
      this.ev("ESCALATION_RESOLVED", { passage, role }, { note });
      this.reconcile();
    });
  }

  status() {
    const byState = this.db.all<{ role_id: number; state: string; c: number }>("SELECT role_id, state, COUNT(*) c FROM work_items GROUP BY role_id, state ORDER BY role_id, state");
    return {
      canonical: { id: this.canonical.id, version: this.canonical.version, hash: this.canonical.hash, freeze: this.canonical.freeze },
      units: this.db.get<{ c: number }>("SELECT COUNT(*) c FROM production_units")!.c,
      byRole: byState,
      jobs: this.db.all<{ job_type: string; state: string; c: number }>("SELECT job_type, state, COUNT(*) c FROM jobs GROUP BY job_type, state"),
      escalated: this.db.all<{ passage_id: string; role_id: number; escalation_reason: string | null }>("SELECT passage_id, role_id, escalation_reason FROM work_items WHERE state='ESCALATED_HUMAN_REVIEW' ORDER BY passage_id, role_id"),
      openDefects: this.db.get<{ c: number }>("SELECT COUNT(*) c FROM defects WHERE status IN ('OPEN','ROUTED','ESCALATED','CORRECTED_AWAITING_REVERIFY')")!.c,
      gaps: [2, 3, 4, 5, 6, 8].flatMap((r) => gapsForRole(this.canonical, this.cfg, r).filter((g) => !g.satisfied).map((g) => ({ role: r, id: g.id, acknowledged: g.acknowledged, missing: g.missing })))
    };
  }

  passageReport(passage: string) {
    const unit = this.unit(passage);
    if (!unit) throw new Error(`unknown passage ${passage}`);
    return { unit, items: this.items(passage), artifacts: this.artifacts(passage), jobs: this.listJobs({ passage }), defects: this.defects({ passage }), history: this.history(passage) };
  }
}
