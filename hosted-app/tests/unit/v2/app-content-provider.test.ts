import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ApprovedPackageProvider, FIXTURE_STORY, FixtureContentProvider, ideasFromMeaningUnits, learnerView, scoreItems } from "../../../lib/v2/content-provider";
import { createStore } from "../../../lib/sr/pipeline/storage";
import { evaluateSpokenExpression } from "../../../lib/v2/spoken-expression";
import { count100 } from "../../../lib/sr/pipeline-v2/count100";
import { assertNoInternalLeak } from "../../../lib/v2/learner-feedback";

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "sr-cp-")); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("FixtureContentProvider (diagnostics only)", () => {
  const p = new FixtureContentProvider();
  it("serves a canonical-length first-150 passage and is labelled as a fixture", () => {
    // the fixture tokenises cleanly with the canonical tokenizer but is deliberately NOT a 100-token canonical passage
    expect(count100(FIXTURE_STORY).status).toBe("VALID_TOKENIZATION");
    expect(count100(FIXTURE_STORY).count).not.toBe(100);
    const a = p.bySequence(1)!;
    expect(a).toMatchObject({ source: "FIXTURE", sequence: 1, passageId: "FX-0001" });
    expect(p.byPassageId("FX-0001")!.passageId).toBe("FX-0001");
    expect(p.bySequence(0)).toBeNull();
    expect(p.bySequence(1501)).toBeNull();
    expect(p.byPassageId("W1-0001")).toBeNull();
    expect(p.assessment(0)!.sequence).toBeNull();
    expect(p.assessment(99)).toBeNull();
  });
  it("the learner view carries tokens and questions but never answer keys, ideas or BPC", () => {
    const v = learnerView(p.bySequence(1)!);
    expect(JSON.stringify(v)).not.toMatch(/answerIndex|ideas|bpc|wordings/i);
    expect(v.tokens[0]).toEqual({ index: 1, text: "Mia" });
    expect(v.items).toHaveLength(4);
    assertNoInternalLeak(v);
  });
  it("scores items on the server: keyed option = 1, anything else (including missing) = 0", () => {
    const passage = p.bySequence(1)!;
    expect(scoreItems(passage, [1, 0, 2, 0]).map((s) => s.score)).toEqual([1, 1, 1, 1]);
    expect(scoreItems(passage, [0, 1, 0, 1]).map((s) => s.score)).toEqual([0, 0, 0, 0]);
    expect(scoreItems(passage, [1, null]).map((s) => s.score)).toEqual([1, 0, 0, 0]);
  });
});

describe("derived authored ideas drive the spoken evaluator", () => {
  const passage = new FixtureContentProvider().bySequence(1)!;
  const meta = { passageId: passage.passageId, ideas: passage.ideas };
  it("a connected retelling in the child's own words scores well", () => {
    const s = evaluateSpokenExpression("Mia has a red kite and takes it to the big hill. The string slips so the kite flies away over the trees. Ravi finds the kite stuck in a bush and carries it back. A kind friend turns a sad day into a happy one.", meta);
    expect(s.score).toBeGreaterThan(0.6);
    expect(s.matchedIdeaIds.length).toBeGreaterThanOrEqual(3);
  });
  it("an unrelated answer scores low and a blank one does not throw", () => {
    expect(evaluateSpokenExpression("I like cricket and my dog.", meta).score).toBeLessThan(0.3);
    expect(() => evaluateSpokenExpression("", meta)).not.toThrow();
  });
  it("ideas are built from distinctive key stems, with pair alternatives", () => {
    const [idea] = ideasFromMeaningUnits([{ muId: "m", text: "Ravi finds the kite stuck in a bush" }]);
    expect(idea.wordings[0].length).toBe(3);
    expect(idea.wordings.length).toBeGreaterThan(1);
  });
});

describe("ApprovedPackageProvider fails closed", () => {
  it("returns null for anything not in the approved root, and never offers assessment passages", () => {
    const store = createStore({ wipRoot: join(dir, "wip"), approvedRoot: join(dir, "approved"), qaActors: [] });
    const p = new ApprovedPackageProvider(store);
    expect(p.bySequence(1)).toBeNull();
    expect(p.byPassageId("W1-0001")).toBeNull();
    expect(p.byPassageId("nonsense")).toBeNull();
    expect(p.bySequence(-3)).toBeNull();
    expect(p.assessment()).toBeNull();
    expect(p.source).toBe("APPROVED_PACKAGE");
  });
});
