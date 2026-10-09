import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ApprovedPackageProvider, FixtureContentProvider, parseAssessmentManifest, ASSESSMENT_MANIFEST_FILE } from "../../../lib/v2/content-provider";
import { createStore } from "../../../lib/sr/pipeline/storage";
import { canonicalHash } from "../../../lib/sr/pipeline/hash";
import { buildDeps, handleV3 } from "../../../api/v3";
import { FileAssessmentStore } from "../../../lib/v2/file-assessment-store";
import { buildValidPackage } from "../sr/helpers/package";

// Issue #25: the approved assessment-content source is wired into the production provider.
// Contract: the content authority approves an ordered ASSESSMENT-MANIFEST (a list of approved package ids). The app
// serves those approved packages in order and authors nothing itself; anything missing or unapproved fails closed.
const MANIFEST = { schemaVersion: "1.0", manifestId: "SR-ASSESSMENT", manifestVersion: 2, packageIds: ["PKG-W1-0101", "PKG-W1-0102", "PKG-W1-0103", "PKG-W1-0104"] };
const PKG = JSON.stringify(buildValidPackage());
const CORRECT = [0, 1, 2, 0]; // keys of the shared package fixture; they never leave the server
const WRONG = [1, 0, 0, 1];

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "sr-ac-")); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

/** A store that serves an approved manifest and approved packages, recording what was read. */
function fakeStore(opts: { manifest?: unknown | null; hash?: string } = {}) {
  const read: string[] = [];
  const manifest = opts.manifest === undefined ? MANIFEST : opts.manifest;
  return {
    read,
    store: {
      roots: { approved: "/approved", wip: "/wip" },
      readAuthoritative: (path: string) => {
        const p = path.replace(/\\/g, "/");
        read.push(p);
        if (p.endsWith(`/${ASSESSMENT_MANIFEST_FILE}`)) {
          if (manifest === null) throw new Error("no approved artifact");
          return { content: JSON.stringify(manifest), hash: opts.hash ?? "manifest-hash-1" };
        }
        return { content: PKG, hash: `pkg-hash:${p.split("/").pop()}` };
      }
    } as never
  };
}

describe("parseAssessmentManifest", () => {
  it("accepts the contract and rejects anything malformed", () => {
    expect(parseAssessmentManifest(JSON.stringify(MANIFEST))).toMatchObject({ ok: true });
    for (const bad of [
      "not json", "[]", "{}",
      JSON.stringify({ ...MANIFEST, schemaVersion: "9" }),
      JSON.stringify({ ...MANIFEST, manifestVersion: 0 }),
      JSON.stringify({ ...MANIFEST, manifestId: "" }),
      JSON.stringify({ ...MANIFEST, packageIds: [] }),
      JSON.stringify({ ...MANIFEST, packageIds: ["PKG-W1-0101", "PKG-W1-0101"] }),
      JSON.stringify({ ...MANIFEST, packageIds: ["../../etc/passwd"] })
    ]) expect(parseAssessmentManifest(bad).ok, bad).toBe(false);
  });
});

describe("ApprovedPackageProvider.assessment (production retrieval path)", () => {
  it("serves the manifest's approved packages in order, with manifest and package identity", () => {
    const { store, read } = fakeStore();
    const p = new ApprovedPackageProvider(store).assessment(2)!;
    expect(p).toBeTruthy();
    expect(read.some((r) => r.endsWith(`/${ASSESSMENT_MANIFEST_FILE}`))).toBe(true);
    expect(read.some((r) => r.endsWith("packages/PKG-W1-0103.json"))).toBe(true);
    expect(p.source).toBe("APPROVED_PACKAGE");
    expect(p.provenance).toMatchObject({ packageId: expect.stringMatching(/^PKG-/), contentHash: "pkg-hash:PKG-W1-0103.json" });
    expect(p.provenance.manifest).toEqual({ manifestId: "SR-ASSESSMENT", manifestVersion: 2, hash: "manifest-hash-1" });
  });

  it("fails closed: no approved manifest, an index past the end, or a bad index gives null - never a fixture", () => {
    expect(new ApprovedPackageProvider(fakeStore({ manifest: null }).store).assessment(0)).toBeNull();
    expect(new ApprovedPackageProvider(fakeStore({ manifest: { ...MANIFEST, packageIds: [] } }).store).assessment(0)).toBeNull();
    const p = new ApprovedPackageProvider(fakeStore().store);
    expect(p.assessment(4)).toBeNull();
    expect(p.assessment(-1)).toBeNull();
    expect(p.assessment(1.5)).toBeNull();
  });

  it("an unapproved or tampered manifest/package (store refuses to read it) yields null", () => {
    const refusing = { roots: { approved: "/a", wip: "/w" }, readAuthoritative: () => { throw new Error("not approved"); } } as never;
    expect(new ApprovedPackageProvider(refusing).assessment(0)).toBeNull();
  });

  it("works against the real approval store: only a QA-approved manifest is honoured", () => {
    const store = createStore({ wipRoot: join(dir, "wip"), approvedRoot: join(dir, "approved"), qaActors: ["qa-agent"] });
    const wip = join(store.roots.wip, "assessment", ASSESSMENT_MANIFEST_FILE);
    store.writeWip(wip, JSON.stringify(MANIFEST));
    const provider = new ApprovedPackageProvider(store);
    expect(provider.assessment(0)).toBeNull(); // written but not approved: still nothing
    store.approve({ actor: "qa-agent", verdict: "PASS", wipPath: wip, hash: canonicalHash(MANIFEST) });
    // approved manifest, but its packages are not approved: still fails closed
    expect(provider.assessment(0)).toBeNull();
  });

  it("diagnostic fixtures are still the only fixture source and are labelled", () => {
    expect(new FixtureContentProvider().assessment(0)!.provenance.packageId).toMatch(/^FIXTURE-/);
  });
});

describe("a new learner completes the mandatory assessment through the production provider interface", () => {
  it("assessment/start -> passages -> answers -> finalize; keys stay server-side; content version is recorded", async () => {
    const { store } = fakeStore();
    const content = new ApprovedPackageProvider(store);
    const deps = buildDeps(join(dir, "data"), content, null);
    const who = { learnerId: "kid", sessionId: "S1", deviceId: "phone" };
    const call = async (m: string, path: string, body?: unknown) => {
      const res = await handleV3(new Request(`http://x/api/v3/${path}`, { method: m, body: body === undefined ? undefined : JSON.stringify(body) }), path.split("/"), who, deps);
      return { status: res.status, body: (await res.json()) as Record<string, any> };
    };
    expect((await call("POST", "bootstrap")).status).toBe(200);
    expect((await call("POST", "assessment/start")).status).toBe(200);
    // right at 60, right at 60, then wrong twice at 70 -> 60 WPM is the limit
    const plan = [CORRECT, CORRECT, WRONG, WRONG];
    for (let i = 0; i < plan.length; i += 1) {
      const served = await call("GET", "assessment/passage");
      expect(served.status).toBe(200);
      expect(JSON.stringify(served.body)).not.toMatch(/answerIndex|"answer"|bpc/i);
      const a = await call("POST", "assessment/answer", { key: `k${i}`, answers: plan[i] });
      expect(a.status).toBe(200);
    }
    const fin = await call("POST", "assessment/finalize");
    expect(fin.status).toBe(200);
    expect(fin.body.startingWpm).toBe(60);
    const stored = await new FileAssessmentStore(join(dir, "data", "assessments")).load("kid");
    expect(stored!.contentLog).toHaveLength(4);
    expect(stored!.contentLog![0]).toMatchObject({ packageId: expect.stringMatching(/^PKG-/), manifest: { manifestId: "SR-ASSESSMENT", manifestVersion: 2 } });
    expect(stored!.record!.content).toHaveLength(4);
  });

  it("with no approved assessment content the learner gets the child-safe 'being prepared' answer, not a fixture", async () => {
    const content = new ApprovedPackageProvider(fakeStore({ manifest: null }).store);
    const deps = buildDeps(join(dir, "data"), content, null);
    const who = { learnerId: "kid", sessionId: "S1", deviceId: "phone" };
    const call = async (m: string, path: string) => handleV3(new Request(`http://x/api/v3/${path}`, { method: m }), path.split("/"), who, deps);
    await call("POST", "bootstrap");
    await call("POST", "assessment/start");
    const res = await call("GET", "assessment/passage");
    expect(res.status).toBe(503);
    const body = await res.json() as { error: string; message: string };
    expect(body.error).toBe("CONTENT_UNAVAILABLE");
    expect(body.message).toMatch(/being prepared/i);
  });
});
