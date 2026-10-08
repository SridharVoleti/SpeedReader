import { describe, expect, it } from "vitest";
import { OPEN_PROMPT, scoreFreeResponse, type FactMap } from "../../../lib/sr/free-explanation";

const facts: FactMap = [
  { factId: "F1", phrases: ["ravi returned the extra money", "ravi gave back the extra coins", "returned the extra change"] },
  { factId: "F2", phrases: ["the shopkeeper made a mistake", "shopkeeper gave extra change by mistake"] },
  { factId: "F3", phrases: ["ravi is honest", "he was honest"] }
];
describe("SR-043 free spoken explanation scored semantically", () => {
  it("uses one fixed open prompt, not pointed questions", () => {
    expect(OPEN_PROMPT).toMatch(/in your own words/i);
    expect(OPEN_PROMPT.trim().endsWith("?")).toBe(false);
  });
  it("no exact wording is required: any approved paraphrase is credited", () => {
    const r = scoreFreeResponse("Ravi gave back the extra coins and he was honest", facts);
    expect(r.credited).toEqual(["F1", "F3"]);
    expect(r.score).toBe(Math.round((2 / 3) * 100));
  });
  it("matching ignores case and punctuation", () => {
    expect(scoreFreeResponse("RAVI, IS HONEST!!", facts).credited).toContain("F3");
  });
  it("an empty explanation scores zero without error", () => {
    expect(scoreFreeResponse("", facts)).toMatchObject({ credited: [], score: 0 });
  });
  it("requires a non-empty fact map", () => {
    expect(() => scoreFreeResponse("x", [])).toThrow();
  });
});
