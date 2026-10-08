import { describe, expect, it } from "vitest";
import { detectAuthorityConflicts, releaseDecision } from "../../../lib/sr/pipeline/escalation";

const km = { source: "KnowledgeMap", ref: "AC-17", ruleKey: "p10.primaryItems", value: "1" };
const schema = { source: "JsonSchema", ref: "schema.json#/properties/primary", ruleKey: "p10.primaryItems", value: "2" };

describe("SR-032 escalation for authority conflicts", () => {
  it("agreeing authorities produce no conflict", () => {
    expect(detectAuthorityConflicts([km, { ...schema, value: "1" }])).toEqual([]);
  });
  it("contradicting authorities raise an escalation with exact conflicting citations", () => {
    const [e] = detectAuthorityConflicts([km, schema]);
    expect(e.ruleKey).toBe("p10.primaryItems");
    expect(e.citations).toEqual([
      { source: "KnowledgeMap", ref: "AC-17", value: "1" },
      { source: "JsonSchema", ref: "schema.json#/properties/primary", value: "2" }
    ]);
    expect(e.status).toBe("ESCALATED_TO_HUMAN");
  });
  it("no local precedence is invented: the escalation proposes no winner", () => {
    const [e] = detectAuthorityConflicts([km, schema]);
    expect("resolution" in e).toBe(false);
    expect("winner" in e).toBe(false);
    expect(e.agentMayResolve).toBe(false);
  });
  it("an unresolved conflict blocks release", () => {
    expect(releaseDecision(detectAuthorityConflicts([km, schema]))).toMatchObject({ release: false, reason: "AUTHORITY_CONFLICT" });
    expect(releaseDecision([])).toEqual({ release: true });
  });
  it("only same-rule citations are compared; unrelated rules do not conflict", () => {
    expect(detectAuthorityConflicts([km, { source: "JsonSchema", ref: "x", ruleKey: "other", value: "9" }])).toEqual([]);
  });
});
