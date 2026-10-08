import { describe, expect, it } from "vitest";
import { buildQaPrompt, runQa } from "../../../lib/sr/pipeline/qa";
import { role1, role1Payload, envelope } from "./helpers/artifacts";

describe("SR-015 Role 1 QA: Passage Specification", () => {
  it("QA prompt is stage-specific, independent, and forbids repairs", () => {
    const p = buildQaPrompt(1);
    expect(p).toMatch(/QA for Role 1/);
    expect(p).toMatch(/independent/i);
    expect(p).toMatch(/do not (repair|fix|edit)/i);
    expect(p).toMatch(/PASS or FAIL/);
  });
  it("a valid spec gets PASS with zero blockers", () => {
    expect(runQa(1, role1(), [])).toMatchObject({ verdict: "PASS", blockers: [] });
  });
  it("complexity drift is a blocker with exact owner and evidence", () => {
    const bad = envelope(1, "PASSAGE_SPEC", { ...role1Payload(), complexity: { maxSentenceWords: 99, vocabularyBand: "A", maxClausesPerSentence: 2 } });
    const r = runQa(1, bad, []);
    expect(r.verdict).toBe("FAIL");
    expect(r.blockers[0]).toMatchObject({ violated_rule: "CONSTANT_DIFFICULTY", owner_role: 1 });
    expect(r.blockers[0].evidence).toMatch(/maxSentenceWords/);
  });
  it("a length that breaks the ladder is a blocker", () => {
    const bad = envelope(1, "PASSAGE_SPEC", { ...role1Payload(200), targetWords: 80 });
    expect(runQa(1, bad, []).blockers.map((b) => b.violated_rule)).toContain("LENGTH_LADDER");
  });
  it("sequence outside 1..1500 is a blocker", () => {
    const bad = envelope(1, "PASSAGE_SPEC", { ...role1Payload(), sequence: 1501 });
    expect(runQa(1, bad, []).verdict).toBe("FAIL");
  });
  it("incomplete or unbounded artifacts fail", () => {
    expect(runQa(1, envelope(1, "PASSAGE_SPEC", { passageId: "x" }), []).verdict).toBe("FAIL");
    const a = role1();
    expect(runQa(1, { ...a, payload: { ...a.payload, extra: 1 } }, []).verdict).toBe("FAIL");
  });
  it("QA never repairs: the artifact is untouched", () => {
    const bad = envelope(1, "PASSAGE_SPEC", { ...role1Payload(200), targetWords: 80 });
    const before = JSON.stringify(bad);
    runQa(1, bad, []);
    expect(JSON.stringify(bad)).toBe(before);
  });
  it("defect ids are unique within a report", () => {
    const bad = envelope(1, "PASSAGE_SPEC", { ...role1Payload(200), targetWords: 80, complexity: { maxSentenceWords: 1, vocabularyBand: "Z", maxClausesPerSentence: 9 } });
    const ids = runQa(1, bad, []).blockers.map((b) => b.defect_id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
