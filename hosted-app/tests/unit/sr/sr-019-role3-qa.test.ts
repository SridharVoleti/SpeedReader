import { describe, expect, it } from "vitest";
import { runQa } from "../../../lib/sr/pipeline/qa";
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
});
