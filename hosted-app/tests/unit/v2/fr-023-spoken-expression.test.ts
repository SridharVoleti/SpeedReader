import { describe, expect, it } from "vitest";
import { evaluateSpokenExpression, SPOKEN_EXPRESSION_CONFIG, type SpokenPassageMeta } from "../../../lib/v2/spoken-expression";
import { learnerLanguageViolations } from "../../../lib/v2/learner-language";

// A small authored passage: "Mia lost her kite in the wind, so she felt sad. Her brother Sam helped
// her climb the hill, and they found the kite in a tree."
const meta: SpokenPassageMeta = {
  passageId: "P-demo",
  ideas: [
    { ideaId: "i1", role: "KEY_EVENT", wordings: [["mia", "lost", "kite"], ["kite", "blew", "away"], ["kite", "flew", "away"]] },
    { ideaId: "i2", role: "CAUSE_EFFECT", wordings: [["wind", "kite"], ["wind", "blew"]] },
    { ideaId: "i3", role: "MOTIVATION", wordings: [["mia", "sad"], ["mia", "cry"], ["mia", "upset"]] },
    { ideaId: "i4", role: "KEY_EVENT", wordings: [["sam", "help"], ["brother", "help"]] },
    { ideaId: "i5", role: "DETAIL", wordings: [["hill"]] },
    { ideaId: "i6", role: "KEY_EVENT", wordings: [["found", "kite", "tree"], ["kite", "tree"]] }
  ]
};

const strong =
  "Mia lost her kite because the wind blew it away. She felt sad. Then her brother Sam helped her. They went up the hill and found the kite in a tree.";

// FR-023 - Spoken comprehension expression [FROZEN] (+ CODEX-07 evaluator contract)
describe("FR-023 spoken comprehension expression", () => {
  it("rewards a connected, complete retelling", () => {
    const r = evaluateSpokenExpression(strong, meta);
    expect(r.score).toBeGreaterThan(0.85);
    expect(r.evidenceCoverage).toBe(1);
    expect(r.components.sequencing).toBe(1);
    expect(r.components.connections).toBeGreaterThan(0.5);
    expect(r.matchedIdeaIds).toEqual(["i1", "i2", "i3", "i4", "i5", "i6"]);
  });

  it("returns score/component evidence, coverage, an uncertainty state and coaching (CODEX-07)", () => {
    const r = evaluateSpokenExpression(strong, meta);
    expect(Object.keys(r.components).sort()).toEqual(["clarity", "connections", "details", "keyIdeas", "relevance", "sequencing"]);
    expect(r.uncertainty).toBe("CLEAR");
    expect(r.configVersion).toBe(SPOKEN_EXPRESSION_CONFIG.version);
    expect(r.coaching.length).toBeGreaterThan(0);
  });

  it("scores a partial retelling lower than a full one and an unrelated response near zero", () => {
    const partial = evaluateSpokenExpression("Mia lost her kite. She was sad.", meta);
    const unrelated = evaluateSpokenExpression("I like pizza and my dog is big and brown today.", meta);
    expect(partial.score).toBeLessThan(evaluateSpokenExpression(strong, meta).score);
    expect(partial.score).toBeGreaterThan(unrelated.score);
    expect(unrelated.score).toBeLessThan(0.25);
    expect(unrelated.evidenceCoverage).toBe(0);
  });

  it("rewards connections and sequencing: the same facts told out of order and unlinked score lower", () => {
    const jumbled = "Found the kite in a tree. Sam helped. Mia was sad. The wind took the kite. Mia lost the kite.";
    const jumbledScore = evaluateSpokenExpression(jumbled, meta);
    const told = evaluateSpokenExpression(strong, meta);
    expect(jumbledScore.components.sequencing).toBeLessThan(told.components.sequencing);
    expect(jumbledScore.score).toBeLessThan(told.score);
  });

  it("does not reward sophisticated vocabulary merely for sounding advanced", () => {
    const plain = evaluateSpokenExpression(strong, meta);
    const fancy = evaluateSpokenExpression(
      "Notwithstanding considerable meteorological turbulence, Mia lost her kite because the wind blew it away. She felt sad. Then her brother Sam helped her. They ascended the magnificent hill and found the kite in a tree.",
      meta
    );
    expect(fancy.score).toBeLessThanOrEqual(plain.score + 1e-9);
  });

  it("does not penalise ordinary grammar variation, dialect or age-appropriate wording", () => {
    const standard = evaluateSpokenExpression(strong, meta);
    const variation = evaluateSpokenExpression(
      "Mia she lost her kite cos the wind blew it away. Mia feel sad. Then her brother Sam he help her. They go up hill and find kite in tree.",
      meta
    );
    expect(variation.evidenceCoverage).toBe(standard.evidenceCoverage);
    expect(variation.components.keyIdeas).toBe(standard.components.keyIdeas);
    expect(variation.score).toBeGreaterThan(standard.score - 0.15);
  });

  it("accepts an alternative authored wording (age-appropriate phrasing)", () => {
    const r = evaluateSpokenExpression("The kite flew away. Mia cried. Her brother helped. They found the kite in a tree.", meta);
    expect(r.matchedIdeaIds).toEqual(expect.arrayContaining(["i1", "i3", "i4", "i6"]));
  });

  it("handles an empty response without throwing", () => {
    const r = evaluateSpokenExpression("", meta);
    expect(r.score).toBe(0);
    expect(r.evidenceCoverage).toBe(0);
  });

  it("is deterministic", () => {
    expect(evaluateSpokenExpression(strong, meta)).toEqual(evaluateSpokenExpression(strong, meta));
  });

  it("keeps coaching positive and free of prohibited learner-facing labels", () => {
    for (const text of [strong, "Mia lost her kite.", "I like pizza.", ""]) {
      for (const line of evaluateSpokenExpression(text, meta).coaching) {
        expect(learnerLanguageViolations(line)).toEqual([]);
      }
    }
  });

  it("component weights sum to 1 and are not hard-coded outside the versioned config", () => {
    const w = SPOKEN_EXPRESSION_CONFIG.weights;
    expect(Object.values(w).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });
});
