import { describe, expect, it } from "vitest";
import {
  EvidenceSchema,
  matchProposition,
  normalizeEvidenceText,
  Proposition,
  validateEvidenceSchema
} from "../../lib/evidence-scoring";

// SR-R3-001: Evidence proposition schema.
// "Support canonical/mandatory/optional propositions, accepted expressions and contradictions."
// "Schema validates references; scorer maps authored variants deterministically."
function mainIdeaProposition(overrides: Partial<Proposition> = {}): Proposition {
  return {
    propositionId: "p1",
    canonicalText: "Ravi returned the extra change",
    mandatory: true,
    acceptedExpressions: ["returned the extra change", "gave back the extra money"],
    contradictionExpressions: ["kept the extra change", "did not return"],
    ...overrides
  };
}

describe("validateEvidenceSchema", () => {
  it("accepts a well-formed schema with unique proposition ids and non-empty expression sets", () => {
    const schema: EvidenceSchema = { propositions: [mainIdeaProposition()] };
    expect(validateEvidenceSchema(schema)).toEqual({ valid: true });
  });

  it("rejects a schema with duplicate proposition_ids", () => {
    const schema: EvidenceSchema = {
      propositions: [mainIdeaProposition(), mainIdeaProposition({ canonicalText: "different" })]
    };
    const result = validateEvidenceSchema(schema);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors.some((e) => e.includes("duplicate"))).toBe(true);
  });

  it("rejects a proposition with an empty accepted-expression set", () => {
    const schema: EvidenceSchema = { propositions: [mainIdeaProposition({ acceptedExpressions: [] })] };
    const result = validateEvidenceSchema(schema);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors.some((e) => e.includes("accepted expression"))).toBe(true);
  });

  it("rejects a proposition with a blank propositionId", () => {
    const schema: EvidenceSchema = { propositions: [mainIdeaProposition({ propositionId: "" })] };
    expect(validateEvidenceSchema(schema).valid).toBe(false);
  });
});

describe("matchProposition", () => {
  const proposition = mainIdeaProposition();

  it("matches when any accepted expression variant is present, mapping variants deterministically", () => {
    const words = normalizeEvidenceText("He returned the extra change to the shopkeeper.");
    const result = matchProposition(proposition, words);

    expect(result.propositionId).toBe("p1");
    expect(result.matched).toBe(true);
    expect(result.contradicted).toBe(false);
  });

  it("matches an alternate authored expression for the same proposition identically", () => {
    const words = normalizeEvidenceText("He gave back the extra money.");
    expect(matchProposition(proposition, words).matched).toBe(true);
  });

  it("does not match when no accepted expression is present", () => {
    const words = normalizeEvidenceText("He went home and had dinner.");
    expect(matchProposition(proposition, words).matched).toBe(false);
  });

  it("flags a contradiction expression separately from a non-match", () => {
    const words = normalizeEvidenceText("He kept the extra change for himself.");
    const result = matchProposition(proposition, words);
    expect(result.matched).toBe(false);
    expect(result.contradicted).toBe(true);
  });

  it("is deterministic for identical inputs", () => {
    const words = normalizeEvidenceText("He returned the extra change.");
    expect(matchProposition(proposition, words)).toEqual(matchProposition(proposition, words));
  });
});
