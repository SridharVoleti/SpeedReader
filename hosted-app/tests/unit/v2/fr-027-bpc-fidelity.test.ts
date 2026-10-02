import { describe, expect, it } from "vitest";
import { checkBpcFidelity } from "../../../lib/v2/bpc-fidelity";

const passageText =
  "Mia flew her red kite on a windy day. The wind pulled the string from her hand. The kite flew over the hill. Mia felt sad and sat down. Her brother Sam saw her and came to help. They climbed the hill together. They found the kite in a tree.";

const faithful =
  "Mia was flying her kite when the wind pulled it out of her hand, so the kite floated away over the hill. Mia felt sad, so she sat down. Then her brother Sam saw her and came to help. Together they climbed the hill, and they found the kite in a tree. This shows that things got better for Mia when Sam helped her.";

// FR-027 - Fidelity [FROZEN]
describe("FR-027 Best Possible Comprehension fidelity", () => {
  it("accepts an explanation that only connects and clarifies supported meaning", () => {
    const r = checkBpcFidelity(faithful, { passageText, qaAllowedExtras: ["flying", "floated", "helped"] });
    expect(r.unsupportedTerms).toEqual([]);
    expect(r.supported).toBe(true);
  });

  it("flags an invented motive", () => {
    const r = checkBpcFidelity("Mia felt sad because she loved that kite. Then Sam came to help.", { passageText });
    expect(r.supported).toBe(false);
    expect(r.unsupportedTerms).toContain("loved");
    expect(r.inventionCues).toContain("loved");
  });

  it("flags an invented event or fact", () => {
    const r = checkBpcFidelity("Mia lost her kite yesterday and Sam brought a ladder and a dog.", { passageText });
    expect(r.supported).toBe(false);
    expect(r.unsupportedTerms).toEqual(expect.arrayContaining(["yesterday", "ladder", "dog"]));
  });

  it("flags an invented lesson, judgment or conclusion", () => {
    const r = checkBpcFidelity("Sam was very kind and brave, and the lesson is that you should always help.", { passageText });
    expect(r.supported).toBe(false);
    expect(r.inventionCues).toEqual(expect.arrayContaining(["kind", "brave", "lesson", "should", "always"]));
  });

  it("flags an invented causal relationship introduced with unsupported wording", () => {
    const r = checkBpcFidelity("The kite broke because the string was rotten.", { passageText });
    expect(r.unsupportedTerms).toEqual(expect.arrayContaining(["broke", "rotten"]));
  });

  it("allows words only when a QA reviewer has explicitly accepted them for that passage", () => {
    const text = "Mia was upset when the wind took the kite.";
    expect(checkBpcFidelity(text, { passageText }).unsupportedTerms).toEqual(expect.arrayContaining(["upset", "took"]));
    const cleared = checkBpcFidelity(text, { passageText, qaAllowedExtras: ["upset", "took"] });
    expect(cleared.supported).toBe(true);
  });

  it("is case/inflection tolerant for grounded words and deterministic", () => {
    const a = checkBpcFidelity("The Kites climbed hills.", { passageText });
    expect(a.unsupportedTerms).toEqual([]);
    expect(checkBpcFidelity(faithful, { passageText })).toEqual(checkBpcFidelity(faithful, { passageText }));
  });
});
