import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { chmodSync, existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStore } from "../../../lib/sr/pipeline/storage";
import { canonicalHash } from "../../../lib/sr/pipeline/hash";
import { publishPackage, wipPackagePath, approvedRolePath } from "../../../lib/sr/pipeline/publish";
import { loadApprovedPackage, approvedPackagePath } from "../../../lib/sr/runtime/package-loader";
import { buildValidPackage } from "./helpers/package";
import { UPSTREAM, PID } from "./helpers/artifacts";

// Issue #13: real persisted package -> mandatory checks -> real consumer -> durable promotion, all on disk.
let base: string;
let store: ReturnType<typeof createStore>;
const PKG = `PKG-${PID}`;
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

function approveRole(role: number, payload: unknown = UPSTREAM[role]) {
  const wip = join(store.roots.wip, `role${role}`, `${PID}.json`);
  store.writeWip(wip, JSON.stringify(payload));
  store.approve({ actor: "qa-agent", verdict: "PASS", wipPath: wip, hash: canonicalHash(payload) });
}
const persistPackage = (pkg: unknown) => store.writeWip(wipPackagePath(store, PKG), JSON.stringify(pkg));
const publish = (over = {}) => publishPackage(store, { packageId: PKG, actor: "qa-agent", expectedPackageVersion: 1, ...over });
const approveAllRoles = () => { for (let r = 1; r <= 7; r++) approveRole(r); };

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), "sr-publish-"));
  store = createStore({ wipRoot: join(base, "wip"), approvedRoot: join(base, "approved"), qaActors: ["qa-agent"] });
});
afterEach(() => rmSync(base, { recursive: true, force: true, maxRetries: 3 }));

describe("SR-041 publishPackage: persisted inputs, durable promotion, real consumer", () => {
  it("publishes a clean package: all checks pass, file lands in approved root, runtime loads it", () => {
    approveAllRoles(); persistPackage(buildValidPackage());
    const r = publish();
    expect(r).toMatchObject({ promoted: true });
    expect(existsSync(approvedPackagePath(store, PKG))).toBe(true);
    const loaded = loadApprovedPackage(createStore({ wipRoot: join(base, "wip"), approvedRoot: join(base, "approved"), qaActors: [] }), PKG);
    expect(loaded.ok && loaded.pkg.items).toHaveLength(4);
    expect(loaded.ok && loaded.pkg.passageId).toBe(PID);
  });
  it("fails closed when the package was never persisted", () => {
    approveAllRoles();
    expect(publish()).toMatchObject({ promoted: false, reason: "MISSING_INPUT" });
  });
  it("fails closed when any upstream role has no approved artifact on disk (WIP does not count)", () => {
    for (let r = 1; r <= 7; r++) if (r !== 4) approveRole(r);
    store.writeWip(join(store.roots.wip, "role4", `${PID}.json`), JSON.stringify(UPSTREAM[4])); // WIP only
    persistPackage(buildValidPackage());
    const r = publish();
    expect(r).toMatchObject({ promoted: false, reason: "MISSING_INPUT" });
    expect(!r.promoted && r.problems.join()).toMatch(/role 4/);
    expect(existsSync(approvedPackagePath(store, PKG))).toBe(false);
  });
  it("binds package sections to the approved source artifacts: a tampered section is rejected", () => {
    approveAllRoles();
    const bad = clone(buildValidPackage()); bad.bpc.text = "rewritten after approval";
    persistPackage(bad);
    const r = publish();
    expect(r).toMatchObject({ promoted: false, reason: "FINAL_QA_FAILED" });
    expect(existsSync(approvedPackagePath(store, PKG))).toBe(false);
  });
  it("detects an approved upstream artifact tampered on disk after approval", () => {
    approveAllRoles(); persistPackage(buildValidPackage());
    const f = approvedRolePath(store, 3, PID);
    chmodSync(f, 0o666); writeFileSync(f, JSON.stringify({ ...UPSTREAM[3], forged: true }));
    expect(publish()).toMatchObject({ promoted: false, reason: "MISSING_INPUT" });
  });
  it("version drift fails closed", () => {
    approveAllRoles(); persistPackage(buildValidPackage());
    expect(publish({ expectedPackageVersion: 2 })).toMatchObject({ promoted: false, reason: "FINAL_QA_FAILED" });
    expect(publish({ schemaVersion: "2.0" })).toMatchObject({ promoted: false, reason: "FINAL_QA_FAILED" });
  });
  it("a package that passes the mandatory checks but cannot be consumed by the runtime is not published", () => {
    // structurally valid and faithful to its (approved) upstream, but the scoring contract names a rule whose item count cannot be met
    const items = (UPSTREAM[3].items as { itemId: string; options: string[]; answerIndex: number }[]).map((i, n) => (n === 1 ? { ...i, answerIndex: 2, options: ["a", "b", "c"] } : i));
    const broken = { ...UPSTREAM[2], text: UPSTREAM[2].text + " extra", wordCount: UPSTREAM[2].wordCount }; // wordCount no longer matches text
    for (let r = 1; r <= 7; r++) approveRole(r, r === 2 ? broken : r === 3 ? { ...UPSTREAM[3], items } : UPSTREAM[r]);
    const pkg = clone(buildValidPackage()) as Record<string, any>;
    pkg.passage = broken; pkg.assessment = { ...UPSTREAM[3], items };
    pkg.lock.roleHashes["2"] = canonicalHash(broken); pkg.lock.roleHashes["3"] = canonicalHash({ ...UPSTREAM[3], items });
    persistPackage(pkg);
    const r = publish();
    expect(r).toMatchObject({ promoted: false, reason: "INGESTION_FAILED" });
    expect(existsSync(approvedPackagePath(store, PKG))).toBe(false);
  });
  it("a second publish of the same package is refused (immutable approved artifact)", () => {
    approveAllRoles(); persistPackage(buildValidPackage());
    expect(publish()).toMatchObject({ promoted: true });
    expect(publish()).toMatchObject({ promoted: false, reason: "PROMOTION_FAILED" });
  });
  it("only a QA actor can publish", () => {
    approveAllRoles(); persistPackage(buildValidPackage());
    expect(publish({ actor: "creator-agent" })).toMatchObject({ promoted: false, reason: "PROMOTION_FAILED" });
    expect(existsSync(approvedPackagePath(store, PKG))).toBe(false);
  });
  it("the runtime loader refuses WIP, unknown and tampered packages", () => {
    approveAllRoles(); persistPackage(buildValidPackage());
    expect(loadApprovedPackage(store, PKG).ok).toBe(false); // persisted in WIP only
    publish();
    expect(loadApprovedPackage(store, "PKG-W1-9999").ok).toBe(false);
    expect(loadApprovedPackage(store, "../evil").ok).toBe(false);
    const f = approvedPackagePath(store, PKG);
    chmodSync(f, 0o666); writeFileSync(f, JSON.stringify({ ...buildValidPackage(), packageVersion: 9 }));
    expect(loadApprovedPackage(store, PKG).ok).toBe(false);
  });
});
