import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LearnerService, MemoryAssessmentStore, type Ctx, type ContentProvenance } from "../../../lib/v2/learner-service";
import { FileLearnerRepository } from "../../../lib/v2/learner-repository";
import { SESSION_POLICY_V1, SessionRegistry } from "../../../lib/v2/session-envelope";
import { ApprovedPackageProvider, FixtureContentProvider } from "../../../lib/v2/content-provider";
import { COUNT100_VERSION } from "../../../lib/sr/pipeline-v2/count100";
import { READINESS_RULESET_ID } from "../../../lib/v2/p10-readiness";
import { newLearnerAggregate } from "../../../lib/v2/learner-aggregate";
import { buildValidPackage } from "../sr/helpers/package";

// Issue #23: every production attempt is bound to the exact tokenizer, content package (id/version/hash) and readiness ruleset.
const T0 = Date.parse("2026-10-05T09:00:00Z");
const ctx: Ctx = { learnerId: "kid", sessionId: "S1", deviceId: "phone" };
const PLACEHOLDERS = ["content-unversioned-demo", "word-count-whitespace-v1", "readiness-rs15-v1"];
let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "sr-prov-")); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const speech = { rawTranscript: "a kite", confirmedTranscript: "a kite", asr: { usable: true, speechDetected: true, confidence: 0.9 }, evaluator: { score: 0.9, version: "ev" } };
const body = (id: string, wpm = 60) => ({ attemptId: id, passageId: "P1", displayedWpm: wpm, items: [{ itemId: "q1", score: 1 }, { itemId: "q2", score: 1 }], speech });

async function service(provenance: (passageId: string) => ContentProvenance | null) {
  const repo = new FileLearnerRepository(dir);
  await repo.create(newLearnerAggregate("kid", 60));
  const svc = new LearnerService({ repo, assessments: new MemoryAssessmentStore(), sessions: new SessionRegistry(SESSION_POLICY_V1), bpcCatalog: [], provenance, now: () => new Date(T0).toISOString() });
  await svc.bootstrap(ctx);
  return { svc, repo };
}

describe("attempt audit metadata comes from the runtime and package actually consumed (#23)", () => {
  it("records the real tokenizer version, package id/version/hash and readiness ruleset id", async () => {
    const { svc, repo } = await service(() => ({ packageId: "PKG-W1-0001", packageVersion: 3, contentHash: "abc123hash" }));
    const r = await svc.completePassage(ctx, body("a1"));
    expect(r.ok).toBe(true);
    const rec = (await repo.load("kid"))!.learner.ledger[0];
    expect(rec.ruleVersions.tokenizer).toBe(COUNT100_VERSION);
    expect(rec.ruleVersions.readiness).toBe(READINESS_RULESET_ID);
    expect(rec.ruleVersions.content).toBe("PKG-W1-0001@3#abc123hash");
    expect(rec.contentPackage).toEqual({ packageId: "PKG-W1-0001", packageVersion: 3, contentHash: "abc123hash" });
    for (const v of Object.values(rec.ruleVersions)) for (const p of PLACEHOLDERS) expect(v).not.toBe(p);
  });

  it("two package versions stay distinguishable, and an old record is never rewritten by a later update", async () => {
    let version = 1;
    const { svc, repo } = await service(() => ({ packageId: "PKG-W1-0001", packageVersion: version, contentHash: `hash-v${version}` }));
    await svc.completePassage(ctx, body("a1"));
    const first = JSON.stringify((await repo.load("kid"))!.learner.ledger[0]);
    version = 2;
    const snap = (await repo.load("kid"))!;
    await svc.completePassage(ctx, body("a2", snap.learner.core.wpm));
    const ledger = (await repo.load("kid"))!.learner.ledger;
    expect(ledger[0].ruleVersions.content).toBe("PKG-W1-0001@1#hash-v1");
    expect(ledger[1].ruleVersions.content).toBe("PKG-W1-0001@2#hash-v2");
    expect(JSON.stringify(ledger[0])).toBe(first);
  });

  it("an attempt on content with no provenance is refused rather than recorded with a placeholder", async () => {
    const { svc, repo } = await service(() => null);
    const r = await svc.completePassage(ctx, body("a1"));
    expect(r).toMatchObject({ ok: false });
    expect((await repo.load("kid"))!.learner.ledger).toHaveLength(0);
  });

  it("the learner-facing response carries no version or hash metadata", async () => {
    const { svc } = await service(() => ({ packageId: "PKG-W1-0001", packageVersion: 3, contentHash: "abc123hash" }));
    const r = await svc.completePassage(ctx, body("a1"));
    const text = JSON.stringify(r);
    expect(text).not.toMatch(/abc123hash|PKG-W1-0001|COUNT-100|BLOCKER4|ruleVersions/);
  });
});

describe("content providers expose package identity", () => {
  it("the approved provider reports the approval hash from the store", () => {
    const pkg = JSON.stringify(buildValidPackage());
    const store = { roots: { approved: "/approved", wip: "/wip" }, readAuthoritative: () => ({ content: pkg, hash: "approval-hash-xyz" }) } as never;
    const p = new ApprovedPackageProvider(store).byPassageId("W1-0007")!;
    expect(p.provenance).toMatchObject({ packageId: p.packageId, contentHash: "approval-hash-xyz" });
    expect(p.provenance.packageVersion).toBeGreaterThan(0);
  });
  it("fixtures are labelled as fixtures, never as approved content", () => {
    const p = new FixtureContentProvider().bySequence(1)!;
    expect(p.provenance.packageId).toMatch(/^FIXTURE-/);
  });
});
