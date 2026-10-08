import { describe, expect, it } from "vitest";
import { classifyResponse, validateFactMap, type FactMapV } from "../../../lib/sr/semantic-recall";

const map: FactMapV = {
  mapId: "W1-0007", version: "1.0.0",
  facts: [
    { factId: "F1", explicitness: "EXPLICIT", proposition: { subject: ["ravi", "the boy"], predicate: ["returned", "return", "gave back", "give back", "handed back"], object: ["the extra money", "the change", "the extra coins"] },
      contradictions: [{ predicate: ["kept", "pocketed", "took"], object: ["the extra money", "the change", "the extra coins"] }] },
    { factId: "F2", explicitness: "IMPLICIT", proposition: { predicate: ["was afraid of", "feared", "was scared of"], object: ["the shopkeeper"] } },
    { factId: "F3", explicitness: "EXPLICIT", proposition: { predicate: ["bought", "purchased"], object: ["a pencil"] } },
    { factId: "F4", explicitness: "NOT_IN_PASSAGE", proposition: { predicate: ["stole", "took without paying"], object: ["a pen"] } }
  ]
};
const ctx = { asrConfidence: 0.9, boundVersion: { mapId: "W1-0007", version: "1.0.0" } };
const run = (t: string, c = ctx) => classifyResponse(t, map, c);

describe("SR-044 proposition recall, evidence states, audit", () => {
  it("credits approved paraphrases of the same proposition", () => {
    expect(run("Ravi gave back the change").states.F1).toBe("CREDITED");
    expect(run("the boy handed back the extra coins").states.F1).toBe("CREDITED");
  });
  it("negation of a fact is a contradiction, not credit (adversarial)", () => {
    expect(run("Ravi did not return the extra money").states.F1).toBe("CONTRADICTED");
    expect(run("he never gave back the change").states.F1).toBe("CONTRADICTED");
  });
  it("explicit contradicting proposition is CONTRADICTED", () => {
    expect(run("Ravi kept the extra money").states.F1).toBe("CONTRADICTED");
  });
  it("saying both credit and contradiction resolves to CONTRADICTED", () => {
    expect(run("Ravi returned the extra money but then pocketed the extra coins").states.F1).toBe("CONTRADICTED");
  });
  it("omission is OMITTED; multiple claims in one sentence are scored independently", () => {
    const r = run("Ravi returned the change and bought a pencil");
    expect(r.states.F1).toBe("CREDITED");
    expect(r.states.F3).toBe("CREDITED");
    expect(run("Ravi returned the change").states.F3).toBe("OMITTED");
  });
  it("negation applies only to its own clause", () => {
    const r = run("he did not buy a pencil but he returned the change");
    expect(r.states.F1).toBe("CREDITED");
    expect(r.states.F3).not.toBe("CREDITED");
  });
  it("an implicit fact stated is an unsupported inference, never P1 recall credit", () => {
    expect(run("he feared the shopkeeper").states.F2).toBe("UNSUPPORTED_INFERENCE");
  });
  it("a known unsupported claim is flagged UNSUPPORTED_CLAIM; its absence is not an error", () => {
    expect(run("he stole a pen").states.F4).toBe("UNSUPPORTED_CLAIM");
    expect(run("he bought a pencil").states.F4).toBeUndefined();
  });
  it("partial matches are UNRESOLVED_SEMANTIC (review), not omission and not credit", () => {
    const r = run("Ravi returned something to the man");
    expect(r.states.F1).toBe("UNRESOLVED_SEMANTIC");
    expect(r.audit.find((a) => a.factId === "F1")?.rule).toMatch(/NEEDS_REVIEW/);
  });
  it("a wrong named subject does not earn credit", () => {
    expect(run("Mohan returned the change").states.F1).toBe("UNRESOLVED_SEMANTIC");
  });
  it("low ASR confidence leaves unmatched facts UNRESOLVED_ASR but never downgrades clear credit", () => {
    const r = run("um bought a pencil", { ...ctx, asrConfidence: 0.3 });
    expect(r.states.F3).toBe("CREDITED");
    expect(r.states.F1).toBe("UNRESOLVED_ASR");
  });
  it("every decision is auditable and the method is declared as closed-set, not general equivalence", () => {
    const r = run("Ravi returned the change");
    expect(r.method).toBe("APPROVED_ALTERNATES_PROPOSITION_MATCH");
    expect(r.audit.every((a) => a.rule && a.factId)).toBe(true);
    expect(r.audit.find((a) => a.factId === "F1")).toMatchObject({ clause: expect.any(String), matched: expect.arrayContaining([expect.stringMatching(/^predicate:/)]) });
    expect(r.factMap).toEqual({ mapId: "W1-0007", version: "1.0.0" });
  });
  it("unmatched clauses are surfaced for review rather than silently dropped", () => {
    expect(run("the weather was nice").unclassifiedClauses).toContain("the weather was nice");
  });
  it("fact-map version drift fails closed", () => {
    expect(() => run("x", { ...ctx, boundVersion: { mapId: "W1-0007", version: "0.9.0" } })).toThrow(/version drift/);
  });
  it("rejects duplicate fact ids and empty maps", () => {
    expect(validateFactMap({ ...map, facts: [map.facts[0], map.facts[0]] }).join()).toMatch(/duplicate/);
    expect(validateFactMap({ ...map, facts: [] }).join()).toMatch(/required/);
  });
});
