import { describe, expect, it } from "vitest";
import { runQa } from "../../../lib/sr/pipeline/qa";
import { role7, role7Payload, approved, UPSTREAM } from "./helpers/artifacts";

const qa = (p: Record<string, unknown>) => runQa(7, role7(p), approved(6), { 6: UPSTREAM[6] });
const rules = (p: Record<string, unknown>) => qa(p).blockers.map((b) => b.violated_rule);
const base = role7Payload();
describe("SR-027 Role 7 QA: Attempt Outcome Contract", () => {
  it("a complete non-blocking contract passes", () => expect(qa(base)).toMatchObject({ verdict: "PASS", blockers: [] }));
  it("must define both PASS and FAIL outcomes", () => expect(rules({ ...base, outcomes: [base.outcomes[0]] })).toContain("OUTCOME_STATES_COMPLETE"));
  it("every outcome must continue to the next passage (no learner blocking)", () => {
    const bad = { ...base, outcomes: [base.outcomes[0], { ...base.outcomes[1], nextAction: "STOP_AND_RETRY" }] };
    expect(qa(bad).blockers[0]).toMatchObject({ violated_rule: "NON_BLOCKING_PROGRESSION", owner_role: 7 });
  });
  it("oral and comprehension readiness must be separate booleans", () => {
    const bad = { ...base, outcomes: base.outcomes.map((o) => ({ state: o.state, nextAction: o.nextAction, combinedReady: true })) };
    expect(rules(bad)).toContain("SEPARATE_GATE_FLAGS");
  });
  it("passage id must match the scoring contract", () => expect(rules({ ...base, passageId: "W1-0001" })).toContain("PASSAGE_ID_MATCH"));
});
