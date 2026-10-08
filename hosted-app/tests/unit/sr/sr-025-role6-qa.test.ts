import { describe, expect, it } from "vitest";
import { runQa } from "../../../lib/sr/pipeline/qa";
import { role6, role6Payload, approved, UPSTREAM } from "./helpers/artifacts";

const qa = (p: Record<string, unknown>) => runQa(6, role6(p), approved(3, 4), { 3: UPSTREAM[3], 4: UPSTREAM[4] });
const rules = (p: Record<string, unknown>) => qa(p).blockers.map((b) => b.violated_rule);
describe("SR-025 Role 6 QA: Scoring Contract", () => {
  it("a contract matching the approved assessment passes", () => expect(qa(role6Payload())).toMatchObject({ verdict: "PASS", blockers: [] }));
  it("points must be defined for exactly the approved items", () => {
    expect(rules({ ...role6Payload(), itemPoints: { I1: 50, I2: 50 } })).toContain("ITEM_POINTS_MATCH_ASSESSMENT");
    expect(rules({ ...role6Payload(), itemPoints: { I1: 20, I2: 20, I3: 20, I4: 20, I9: 20 } })).toContain("ITEM_POINTS_MATCH_ASSESSMENT");
  });
  it("points total 100", () => {
    const r = qa({ ...role6Payload(), itemPoints: { I1: 25, I2: 25, I3: 25, I4: 10 } });
    expect(r.blockers[0]).toMatchObject({ violated_rule: "POINTS_TOTAL_100", owner_role: 6 });
  });
  it("primary item must be the one Role 3 designated", () => expect(rules({ ...role6Payload(), primaryItemId: "I2" })).toContain("PRIMARY_ITEM_MATCH"));
  it("only a registered canonical rule may be referenced; invented thresholds are rejected", () => {
    expect(rules({ ...role6Payload(), ruleId: "THRESHOLD_60" })).toContain("SCORING_RULE_APPROVED");
    expect(runQa(6, role6({ ...role6Payload(), passThreshold: 60 }), approved(3, 4), { 3: UPSTREAM[3], 4: UPSTREAM[4] }).blockers.map((b) => b.evidence).join()).toMatch(/unexpected field passThreshold/);
  });
  it("rule item count must match the approved assessment, routed to Role 3", () => {
    const three = { ...UPSTREAM[3], items: (UPSTREAM[3].items as unknown[]).slice(0, 3) };
    const r = runQa(6, role6(), approved(3, 4), { 3: three, 4: UPSTREAM[4] });
    expect(r.blockers.find((b) => b.violated_rule === "RULE_ITEM_COUNT")).toMatchObject({ owner_role: 3 });
  });
  it("passage id must match", () => expect(rules({ ...role6Payload(), passageId: "W1-0001" })).toContain("PASSAGE_ID_MATCH"));
});
