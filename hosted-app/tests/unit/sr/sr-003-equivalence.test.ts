import { describe, expect, it } from "vitest";
import { classifyPractice, formalEquivalenceAllowed } from "../../../lib/sr/equivalence";

describe("SR-003 ordinary practice equivalence", () => {
  const prior = { passageId: "p1", rsId: "RS01", difficulty: "W1" };
  it("a new same-difficulty passage is acceptable ordinary practice, with no replacement forced", () => {
    const r = classifyPractice(prior, { passageId: "p2", rsId: "RS01", difficulty: "W1" });
    expect(r.acceptableAsPractice).toBe(true);
    expect(r.requiresReplacementPassage).toBe(false);
    expect(r.blocksProgression).toBe(false);
  });
  it("repeating an old passage is confidence support", () => {
    expect(classifyPractice(prior, { ...prior }).role).toBe("CONFIDENCE_REPEAT");
  });
  it("practice equivalence never blocks progression even when difficulty differs", () => {
    const r = classifyPractice(prior, { passageId: "p3", rsId: "RS01", difficulty: "W2" });
    expect(r.blocksProgression).toBe(false);
    expect(r.acceptableAsPractice).toBe(false);
  });
  it("formal readiness equivalence is strict: only declared equivalent forms", () => {
    expect(formalEquivalenceAllowed("form-A", "form-B", [["form-A", "form-B"]])).toBe(true);
    expect(formalEquivalenceAllowed("form-A", "form-C", [["form-A", "form-B"]])).toBe(false);
    expect(formalEquivalenceAllowed("form-B", "form-A", [["form-A", "form-B"]])).toBe(true);
  });
});
