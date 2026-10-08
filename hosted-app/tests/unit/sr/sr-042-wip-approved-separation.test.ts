import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStore, type StorageConfig } from "../../../lib/sr/pipeline/storage";
import { canonicalHash } from "../../../lib/sr/pipeline/hash";

// SR-042 / issue #11 - REAL file system integration tests (temp roots, no in-memory fakes).
let base: string;
let cfg: StorageConfig;
const content = JSON.stringify({ passageId: "W1-0007" });
const hashOf = (c: string) => canonicalHash(JSON.parse(c));
const wipPath = () => join(cfg.wipRoot, "role2", "W1-0007.json");
const sepc = process.platform === "win32" ? "\\" : "/";

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), "sr-store-"));
  cfg = { wipRoot: join(base, "wip"), approvedRoot: join(base, "approved"), qaActors: ["qa-agent"] };
});
afterEach(() => {
  rmSync(base, { recursive: true, force: true, maxRetries: 3 });
});

describe("SR-042 WIP / approved separation (real filesystem)", () => {
  it("generated artifacts are written to disk only under the WIP root", () => {
    const s = createStore(cfg);
    s.writeWip(wipPath(), content);
    expect(readFileSync(wipPath(), "utf8")).toBe(content);
    expect(() => s.writeWip(join(cfg.approvedRoot, "role2", "x.json"), content)).toThrow(/WIP/);
    expect(() => s.writeWip(join(base, "elsewhere.json"), content)).toThrow(/WIP/);
    expect(existsSync(join(cfg.approvedRoot, "role2"))).toBe(false);
  });
  it("path traversal, NUL bytes and sibling-prefix roots cannot escape the WIP root", () => {
    const s = createStore(cfg);
    expect(() => s.writeWip(join(cfg.wipRoot, "..", "approved", "x.json"), content)).toThrow(/WIP/);
    expect(() => s.writeWip(`${cfg.wipRoot}\0evil.json`, content)).toThrow(/WIP/);
    expect(() => s.writeWip(`${cfg.wipRoot}-evil${sepc}x.json`, content)).toThrow(/WIP/);
    expect(existsSync(join(cfg.approvedRoot, "x.json"))).toBe(false);
  });
  it.runIf(process.platform === "win32")("case tricks cannot escape on a case-insensitive file system", () => {
    const s = createStore(cfg);
    expect(() => s.writeWip(cfg.approvedRoot.toUpperCase() + "\\x.json", content)).toThrow(/WIP/);
    expect(() => s.writeWip(cfg.wipRoot.toUpperCase() + "\\ok.json", content)).not.toThrow();
  });
  it("a symlink/junction inside WIP pointing outside is rejected", () => {
    const s = createStore(cfg);
    mkdirSync(join(base, "outside"));
    try { symlinkSync(join(base, "outside"), join(cfg.wipRoot, "link"), "junction"); } catch { return; /* no privilege to create links */ }
    expect(() => s.writeWip(join(cfg.wipRoot, "link", "x.json"), content)).toThrow(/WIP/);
    expect(existsSync(join(base, "outside", "x.json"))).toBe(false);
  });
  it("roots must be separate and non-nested", () => {
    expect(() => createStore({ ...cfg, approvedRoot: cfg.wipRoot })).toThrow(/separate/);
    expect(() => createStore({ ...cfg, approvedRoot: join(cfg.wipRoot, "inner") })).toThrow(/separate/);
  });
  it("downstream stages cannot read WIP as authoritative", () => {
    const s = createStore(cfg);
    s.writeWip(wipPath(), content);
    expect(() => s.readAuthoritative(wipPath())).toThrow(/not authoritative/);
    expect(() => s.readAuthoritative(join(base, "other.json"))).toThrow(/outside the approved root/);
  });
  it("only QA may promote an exact artifact, with a PASS, to the approved location on disk", () => {
    const s = createStore(cfg);
    s.writeWip(wipPath(), content);
    const hash = hashOf(content);
    expect(() => s.approve({ actor: "creator-agent", verdict: "PASS", wipPath: wipPath(), hash })).toThrow(/QA/);
    expect(() => s.approve({ actor: "qa-agent", verdict: "FAIL", wipPath: wipPath(), hash })).toThrow(/PASS/);
    expect(existsSync(join(cfg.approvedRoot, "role2", "W1-0007.json"))).toBe(false);
    const target = s.approve({ actor: "qa-agent", verdict: "PASS", wipPath: wipPath(), hash });
    expect(existsSync(target)).toBe(true);
    expect(readFileSync(target, "utf8")).toBe(content);
    expect(existsSync(wipPath())).toBe(true);
  });
  it("the approved copy matches the QA'd hash exactly and is readable as authoritative", () => {
    const s = createStore(cfg);
    s.writeWip(wipPath(), content);
    const ap = s.approve({ actor: "qa-agent", verdict: "PASS", wipPath: wipPath(), hash: hashOf(content) });
    expect(s.readAuthoritative(ap)).toEqual({ content, hash: hashOf(content) });
  });
  it("an artifact edited in WIP after QA cannot be approved with the old hash", () => {
    const s = createStore(cfg);
    s.writeWip(wipPath(), content);
    const hash = hashOf(content);
    s.writeWip(wipPath(), JSON.stringify({ passageId: "W1-0007", sneaky: true }));
    expect(() => s.approve({ actor: "qa-agent", verdict: "PASS", wipPath: wipPath(), hash })).toThrow(/hash/);
    expect(s.listApproved()).toEqual([]);
  });
  it("approved files are immutable: writes, re-approval and in-place edits are refused or detected", () => {
    const s = createStore(cfg);
    s.writeWip(wipPath(), content);
    const hash = hashOf(content);
    const ap = s.approve({ actor: "qa-agent", verdict: "PASS", wipPath: wipPath(), hash });
    expect(() => s.writeWip(ap, "x")).toThrow();
    expect(() => s.approve({ actor: "qa-agent", verdict: "PASS", wipPath: wipPath(), hash })).toThrow(/already approved/);
    expect(() => writeFileSync(ap, "{}")).toThrow(); // read-only attribute
    chmodSync(ap, 0o666);
    writeFileSync(ap, JSON.stringify({ passageId: "W1-0007", forged: true }));
    expect(() => s.readAuthoritative(ap)).toThrow(/no longer matches/);
    expect(s.listApproved()).toEqual([]);
  });
});

describe("SR-042 durability and restart recovery", () => {
  it("approvals survive a restart (new store over the same roots)", () => {
    const first = createStore(cfg);
    first.writeWip(wipPath(), content);
    const ap = first.approve({ actor: "qa-agent", verdict: "PASS", wipPath: wipPath(), hash: hashOf(content) });
    const second = createStore(cfg);
    expect(second.readAuthoritative(ap).content).toBe(content);
    expect(second.listApproved()).toEqual([ap]);
    expect(() => second.approve({ actor: "qa-agent", verdict: "PASS", wipPath: wipPath(), hash: hashOf(content) })).toThrow(/already approved/);
  });
  it("an approval record without its artifact (crash mid-promotion) is not approved; recover() completes it from matching WIP", () => {
    const s = createStore(cfg);
    s.writeWip(wipPath(), content);
    const target = s.approve({ actor: "qa-agent", verdict: "PASS", wipPath: wipPath(), hash: hashOf(content) });
    chmodSync(target, 0o666);
    rmSync(target); // simulate the crash window
    expect(() => s.readAuthoritative(target)).toThrow(/no approved artifact/);
    expect(s.listApproved()).toEqual([]);
    const rec = createStore(cfg).recover();
    expect(rec.completed).toEqual([target]);
    expect(createStore(cfg).readAuthoritative(target).content).toBe(content);
  });
  it("recover() removes an orphan record whose WIP source changed, and stale temp files", () => {
    const s = createStore(cfg);
    s.writeWip(wipPath(), content);
    const target = s.approve({ actor: "qa-agent", verdict: "PASS", wipPath: wipPath(), hash: hashOf(content) });
    chmodSync(target, 0o666);
    rmSync(target);
    s.writeWip(wipPath(), JSON.stringify({ passageId: "W1-0007", changed: 1 }));
    writeFileSync(join(cfg.wipRoot, "role2", "W1-0007.json.tmp-123"), "partial");
    const rec = createStore(cfg).recover();
    expect(rec.removedOrphans).toHaveLength(1);
    expect(rec.removedTemps).toBe(1);
    expect(createStore(cfg).listApproved()).toEqual([]);
  });
  it("an artifact dropped into the approved root without an approval record is not readable", () => {
    const s = createStore(cfg);
    mkdirSync(join(cfg.approvedRoot, "role2"), { recursive: true });
    const rogue = join(cfg.approvedRoot, "role2", "rogue.json");
    writeFileSync(rogue, content);
    expect(() => s.readAuthoritative(rogue)).toThrow(/not approved/);
    expect(s.listApproved()).toEqual([]);
  });
  it("WIP writes are atomic: no partial temp file remains after a write", () => {
    const s = createStore(cfg);
    s.writeWip(wipPath(), content);
    s.writeWip(wipPath(), content + " ");
    expect(s.recover().removedTemps).toBe(0);
  });
});
