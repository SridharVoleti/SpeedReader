import { describe, expect, it } from "vitest";
import { runQa } from "../../../lib/sr/pipeline/qa";
import { role5, role5Payload, approved, UPSTREAM } from "./helpers/artifacts";

const qa = (p: Record<string, unknown>) => runQa(5, role5(p), approved(2, 4), { 2: UPSTREAM[2], 4: UPSTREAM[4] });
const rules = (p: Record<string, unknown>) => qa(p).blockers.map((b) => b.violated_rule);
describe("SR-023 Role 5 QA: Best Possible Comprehension", () => {
  it("a BPC covering every meaning-unit fact passes", () => expect(qa(role5Payload())).toMatchObject({ verdict: "PASS", blockers: [] }));
  it("omitting a fact is a blocker owned by Role 5 with evidence", () => {
    const r = qa({ ...role5Payload(), factIds: ["F1", "F2"] });
    expect(r.blockers[0]).toMatchObject({ violated_rule: "FACT_COVERAGE", owner_role: 5 });
    expect(r.blockers[0].evidence).toMatch(/F3/);
  });
  it("citing a fact that no meaning unit supports is a blocker", () => {
    expect(rules({ ...role5Payload(), factIds: ["F1", "F2", "F3", "F9"] })).toContain("NO_UNKNOWN_FACTS");
  });
  it("empty BPC text is a blocker", () => expect(rules({ ...role5Payload(), text: "  " })).toContain("BPC_TEXT_PRESENT"));
  it("passage id must match", () => expect(rules({ ...role5Payload(), passageId: "W1-0001" })).toContain("PASSAGE_ID_MATCH"));
});
