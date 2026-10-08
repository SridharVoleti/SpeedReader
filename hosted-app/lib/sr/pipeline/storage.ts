// SR-042 - Durable WIP / approved separation on the real file system.
//
// * Everything generated is written under the WIP root. Nothing else may be written through this store.
// * Only an authorised QA actor holding a PASS for the exact content hash can promote an artifact. Promotion
//   publishes a hash-bound approval record and then the immutable artifact, both with exclusive-create
//   semantics (never overwrite), so a crash can never produce a half-trusted approved artifact.
// * Downstream readers only read the approved root, and only artifacts whose content still matches their
//   recorded approval hash (tamper / corruption fails closed).
// * State lives only on disk: a new store over the same roots sees every prior approval (restart recovery).

import {
  chmodSync, closeSync, existsSync, fsyncSync, linkSync, mkdirSync, openSync, readFileSync, readdirSync,
  realpathSync, renameSync, unlinkSync, writeSync
} from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { canonicalHash } from "./hash";

export type StorageConfig = { wipRoot: string; approvedRoot: string; qaActors: readonly string[] };
export type ApprovalRequest = { actor: string; verdict: "PASS" | "FAIL"; wipPath: string; hash: string };
export type ApprovalRecord = { hash: string; actor: string; approvedAt: string; sourceWip: string };

const CASE_INSENSITIVE = process.platform === "win32";
const fold = (p: string) => (CASE_INSENSITIVE ? p.toLowerCase() : p);
const APPROVAL_SUFFIX = ".approval.json";
const TMP_MARK = ".tmp-";

/** Canonical form of a path whose leaf may not exist yet: realpath of the deepest existing ancestor + the rest. */
function canonical(p: string): string {
  if (p.includes("\0")) throw new Error("path contains a NUL byte");
  const abs = resolve(p);
  let existing = abs;
  const rest: string[] = [];
  while (!existsSync(existing)) {
    const parent = dirname(existing);
    if (parent === existing) break;
    rest.unshift(basename(existing));
    existing = parent;
  }
  return join(realpathSync.native(existing), ...rest);
}

function within(root: string, p: string): boolean {
  let target: string;
  try { target = canonical(p); } catch { return false; }
  const rel = relative(fold(root), fold(target));
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
}

function writeExclusiveAtomic(target: string, content: string): void {
  // temp in the same directory, fsync, then hard-link into place: link() fails with EEXIST instead of overwriting
  mkdirSync(dirname(target), { recursive: true });
  const tmp = `${target}${TMP_MARK}${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const fd = openSync(tmp, "wx");
  try { writeSync(fd, content); fsyncSync(fd); } finally { closeSync(fd); }
  try { linkSync(tmp, target); } finally { unlinkSync(tmp); }
}

function writeReplaceAtomic(target: string, content: string): void {
  mkdirSync(dirname(target), { recursive: true });
  const tmp = `${target}${TMP_MARK}${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const fd = openSync(tmp, "wx");
  try { writeSync(fd, content); fsyncSync(fd); } finally { closeSync(fd); }
  renameSync(tmp, target);
}

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
}

export function createStore(cfg: StorageConfig) {
  mkdirSync(cfg.wipRoot, { recursive: true });
  mkdirSync(cfg.approvedRoot, { recursive: true });
  const wipRoot = realpathSync.native(cfg.wipRoot);
  const approvedRoot = realpathSync.native(cfg.approvedRoot);
  if (fold(wipRoot) === fold(approvedRoot) || within(wipRoot, approvedRoot) || within(approvedRoot, wipRoot)) {
    throw new Error("WIP and approved roots must be separate, non-nested directories");
  }

  const approvalPath = (artifact: string) => artifact + APPROVAL_SUFFIX;
  const readRecord = (artifact: string): ApprovalRecord | null => {
    const rp = approvalPath(artifact);
    if (!existsSync(rp)) return null;
    try { return JSON.parse(readFileSync(rp, "utf8")) as ApprovalRecord; } catch { return null; }
  };
  const targetFor = (wipPath: string) => join(approvedRoot, relative(fold(wipRoot), fold(canonical(wipPath))));

  return {
    writeWip(path: string, content: string): void {
      if (!within(wipRoot, path)) throw new Error(`generated artifacts must be written under the WIP root ${cfg.wipRoot}`);
      writeReplaceAtomic(canonical(path), content);
    },

    readWip(path: string): string {
      if (!within(wipRoot, path)) throw new Error("not a WIP path");
      return readFileSync(canonical(path), "utf8");
    },

    /** Approved-only read for downstream stages. Verifies the artifact still matches its recorded approval. */
    readAuthoritative(path: string): { content: string; hash: string } {
      if (within(wipRoot, path)) throw new Error("WIP is not authoritative: read the approved copy");
      if (!within(approvedRoot, path)) throw new Error(`${path} is outside the approved root`);
      const file = canonical(path);
      if (!existsSync(file)) throw new Error(`no approved artifact at ${path}`);
      const rec = readRecord(file);
      if (!rec) throw new Error(`artifact at ${path} has no valid approval record - not approved`);
      const content = readFileSync(file, "utf8");
      let actual: string;
      try { actual = canonicalHash(JSON.parse(content)); } catch { throw new Error(`approved artifact at ${path} is not valid JSON (corrupt)`); }
      if (actual !== rec.hash) throw new Error(`approved artifact at ${path} no longer matches its approval hash (tampered or corrupt)`);
      return { content, hash: rec.hash };
    },

    /** Every approved artifact path (with a valid, matching approval record), for downstream discovery. */
    listApproved(): string[] {
      return walk(approvedRoot)
        .filter((f) => !f.endsWith(APPROVAL_SUFFIX) && !f.includes(TMP_MARK))
        .filter((f) => { try { this.readAuthoritative(f); return true; } catch { return false; } });
    },

    approve(req: ApprovalRequest): string {
      if (!cfg.qaActors.includes(req.actor)) throw new Error(`only QA may promote artifacts (actor ${req.actor})`);
      if (req.verdict !== "PASS") throw new Error("only a QA PASS may be promoted");
      if (!within(wipRoot, req.wipPath)) throw new Error("promotion source must be under the WIP root");
      const src = canonical(req.wipPath);
      if (!existsSync(src)) throw new Error(`no WIP artifact at ${req.wipPath}`);
      const content = readFileSync(src, "utf8");
      let actual: string;
      try { actual = canonicalHash(JSON.parse(content)); } catch { throw new Error("WIP artifact is not valid JSON"); }
      if (actual !== req.hash) throw new Error("WIP artifact hash differs from the QA'd hash; re-run QA");
      const target = targetFor(req.wipPath);
      if (!within(approvedRoot, target)) throw new Error("promotion target escapes the approved root");
      if (existsSync(target) || existsSync(approvalPath(target))) throw new Error(`artifact already approved at ${target}`);

      const record: ApprovalRecord = { hash: req.hash, actor: req.actor, approvedAt: new Date().toISOString(), sourceWip: relative(wipRoot, src) };
      // approval record first, artifact second: an artifact can never exist without its approval; a crash between the
      // two leaves only an orphan record, which recover() completes (hash-verified) or removes.
      writeExclusiveAtomic(approvalPath(target), JSON.stringify(record));
      writeExclusiveAtomic(target, content);
      for (const f of [target, approvalPath(target)]) chmodSync(f, 0o444);
      return target;
    },

    /** Restart recovery: drop interrupted temp files; finish or remove half-completed promotions. */
    recover(): { removedTemps: number; completed: string[]; removedOrphans: string[] } {
      const out = { removedTemps: 0, completed: [] as string[], removedOrphans: [] as string[] };
      for (const f of [...walk(approvedRoot), ...walk(wipRoot)].filter((x) => x.includes(TMP_MARK))) { unlinkSync(f); out.removedTemps++; }
      for (const rec of walk(approvedRoot).filter((f) => f.endsWith(APPROVAL_SUFFIX))) {
        const artifact = rec.slice(0, -APPROVAL_SUFFIX.length);
        if (existsSync(artifact)) continue;
        const r = JSON.parse(readFileSync(rec, "utf8")) as ApprovalRecord;
        const src = join(wipRoot, r.sourceWip);
        let ok = false;
        try { ok = existsSync(src) && canonicalHash(JSON.parse(readFileSync(src, "utf8"))) === r.hash; } catch { ok = false; }
        if (ok) { writeExclusiveAtomic(artifact, readFileSync(src, "utf8")); chmodSync(artifact, 0o444); out.completed.push(artifact); }
        else { chmodSync(rec, 0o666); unlinkSync(rec); out.removedOrphans.push(rec); }
      }
      return out;
    },

    roots: { wip: wipRoot, approved: approvedRoot }
  };
}
