import { describe, expect, it } from "vitest";
import { runQa } from "../../../lib/sr/pipeline/qa";
import { setOptionJudge, getOptionJudge } from "../../../lib/sr/pipeline/verifiers";
import { role3, role3Payload, items4, approved, UPSTREAM } from "./helpers/artifacts";

const qa = (p: Record<string, unknown>) => runQa(3, role3(p), approved(1, 2), { 1: UPSTREAM[1], 2: UPSTREAM[2] });
const rules = (p: Record<string, unknown>) => qa(p).blockers.map((b) => b.violated_rule);

describe("SR-019 Role 3 QA: Assessment Authoring", () => {
  it("valid 4-item assessment with one primary passes", () => expect(qa(role3Payload())).toMatchObject({ verdict: "PASS", blockers: [] }));
  it("passage id must match", () => expect(rules({ ...role3Payload(), passageId: "W1-0008" })).toContain("PASSAGE_ID_MATCH"));
  it("P10 blueprint: exactly four items", () => expect(rules({ passageId: "W1-0007", items: items4().slice(0, 3) })).toContain("P10_BLUEPRINT"));
  it("P10 blueprint: exactly one primary item", () => {
    expect(rules({ passageId: "W1-0007", items: items4().map((i) => ({ ...i, primary: false })) })).toContain("P10_BLUEPRINT");
    expect(rules({ passageId: "W1-0007", items: items4().map((i) => ({ ...i, primary: true })) })).toContain("P10_BLUEPRINT");
  });
  it("one defensible answer: index must be valid and options distinct", () => {
    const bad = items4(); bad[1] = { ...bad[1], answerIndex: 9 };
    expect(rules({ passageId: "W1-0007", items: bad })).toContain("ONE_DEFENSIBLE_ANSWER");
    const dup = items4(); dup[2] = { ...dup[2], options: ["a", "a", "b"] };
    expect(qa({ passageId: "W1-0007", items: dup }).blockers[0]).toMatchObject({ violated_rule: "ONE_DEFENSIBLE_ANSWER", owner_role: 3 });
  });
  it("item ids must be unique", () => {
    const dup = items4(); dup[1] = { ...dup[1], itemId: "I1" };
    expect(rules({ passageId: "W1-0007", items: dup })).toContain("ITEM_ID_UNIQUE");
  });
  describe("independent answer verification (issue #8)", () => {
    const two = () => {
      const it = items4();
      it[0] = { ...it[0], stem: "Who returned the money?", options: ["Ravi gave the change back", "Ravi handed the coins to the shopkeeper", "Ravi kept it"], answerIndex: 0 };
      return it;
    };
    const withJudge = (j: Parameters<typeof setOptionJudge>[0], fn: () => void) => { const prev = getOptionJudge(); setOptionJudge(j); try { fn(); } finally { setOptionJudge(prev); } };
    it("two differently worded correct options FAIL, owner Role 3, with cited evidence", () => {
      withJudge(() => ({ verdicts: ["SUPPORTED", "SUPPORTED", "CONTRADICTED"], evidence: ['"w0 w1" says Ravi returned the coins'] }), () => {
        const r = qa({ passageId: "W1-0007", items: two() });
        expect(r.verdict).toBe("FAIL");
        expect(r.blockers[0]).toMatchObject({ violated_rule: "ONE_DEFENSIBLE_ANSWER", owner_role: 3 });
        expect(r.blockers[0].evidence).toMatch(/both passage-supported/);
        expect(r.blockers[0].evidence).toMatch(/Ravi gave the change back/);
        expect(r.blockers[0].evidence).toMatch(/returned the coins/);
      });
    });
    it("a marked answer that the passage does not support FAILS as ANSWER_CORRECT", () => {
      withJudge(() => ({ verdicts: ["CONTRADICTED", "SUPPORTED", "CONTRADICTED"], evidence: ["e"] }), () =>
        expect(rules({ passageId: "W1-0007", items: two() })).toContain("ANSWER_CORRECT"));
    });
    it("no passage-supported option FAILS", () => {
      withJudge(() => ({ verdicts: ["UNSUPPORTED", "UNSUPPORTED", "UNSUPPORTED"], evidence: ["e"] }), () =>
        expect(rules({ passageId: "W1-0007", items: two() })).toContain("ANSWER_SUPPORTED_BY_PASSAGE"));
    });
    it("evidence must be cited and must exist in the approved passage", () => {
      const noEv = items4(); noEv[1] = { ...noEv[1], evidence: undefined as unknown as { quote: string } };
      expect(rules({ passageId: "W1-0007", items: noEv })).toContain("ANSWER_EVIDENCE_PRESENT");
      const bad = items4(); bad[1] = { ...bad[1], evidence: { quote: "never in the passage" } };
      expect(rules({ passageId: "W1-0007", items: bad })).toContain("ANSWER_EVIDENCE_IN_PASSAGE");
    });
    it("fails closed with no independent judge, and without passage text", () => {
      withJudge(null, () => expect(rules(role3Payload())).toContain("INDEPENDENT_VERIFIER_MISSING"));
      expect(runQa(3, role3(), approved(1, 2), { 1: UPSTREAM[1] }).blockers.map((b) => b.violated_rule)).toContain("PASSAGE_EVIDENCE_UNAVAILABLE");
    });
  });
});
