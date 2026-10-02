import { describe, expect, it } from "vitest";
import { STAMINA_TRANSITIONS, isValidStaminaTransition, evaluateStaminaTransitions, SUPERSEDED_RULES, type TransitionObservation } from "../../../lib/v2/ac53r";

const thresholds = { maxComprehensionDrop: 0.1, maxCompletionBurdenIncrease: 0.15, maxConfidenceDrop: 0.1, maxEngagementDrop: 0.1 };
const ok = (from: number, to: number): TransitionObservation => ({
  from, to, learners: 30, comprehensionDrop: 0.02, completionBurdenIncrease: 0.03, confidenceDrop: 0.01, engagementDrop: 0.02
});

// FR-007 - AC-53 replacement [FROZEN / SUPERSEDES OLD AC-53]
describe("FR-007 AC-53R progressive stamina-transition validity", () => {
  it("lists every +25 step from 100 to 1000 words (36 transitions)", () => {
    expect(STAMINA_TRANSITIONS).toHaveLength(36);
    expect(STAMINA_TRANSITIONS.slice(0, 4)).toEqual([[100, 125], [125, 150], [150, 175], [175, 200]]);
    expect(STAMINA_TRANSITIONS.at(-1)).toEqual([975, 1000]);
  });

  it("supersedes the direct 100->200 assumption", () => {
    expect(isValidStaminaTransition(100, 125)).toBe(true);
    expect(isValidStaminaTransition(100, 200)).toBe(false);
    expect(isValidStaminaTransition(125, 100)).toBe(false);
    expect(SUPERSEDED_RULES["AC-53"]).toMatch(/100.*200/);
  });

  it("passes when every transition shows no unacceptable collapse", () => {
    const result = evaluateStaminaTransitions(STAMINA_TRANSITIONS.map(([a, b]) => ok(a, b)), thresholds);
    expect(result.status).toBe("PASS");
    expect(result.failures).toEqual([]);
  });

  it("fails naming the transition and dimension on collapse in any dimension", () => {
    const obs = STAMINA_TRANSITIONS.map(([a, b]) => ok(a, b));
    obs[1] = { ...obs[1], comprehensionDrop: 0.3 };
    obs[2] = { ...obs[2], engagementDrop: 0.5 };
    const result = evaluateStaminaTransitions(obs, thresholds);
    expect(result.status).toBe("FAIL");
    expect(result.failures).toEqual([
      "125->150: comprehensionDrop 0.3 exceeds 0.1",
      "150->175: engagementDrop 0.5 exceeds 0.1"
    ]);
  });

  it("is INSUFFICIENT_EVIDENCE (never PASS) when a transition is unobserved or has no learners", () => {
    const missing = STAMINA_TRANSITIONS.slice(1).map(([a, b]) => ok(a, b));
    expect(evaluateStaminaTransitions(missing, thresholds).status).toBe("INSUFFICIENT_EVIDENCE");
    const empty = STAMINA_TRANSITIONS.map(([a, b]) => ({ ...ok(a, b), learners: a === 100 ? 0 : 30 }));
    expect(evaluateStaminaTransitions(empty, thresholds).status).toBe("INSUFFICIENT_EVIDENCE");
  });

  it("requires explicit thresholds (provisional pilot parameters, no hidden defaults)", () => {
    expect(() => evaluateStaminaTransitions([], undefined as never)).toThrow(/thresholds/);
  });

  it("ignores News Reader/oral performance as a gate for the core transition", () => {
    const withOral = STAMINA_TRANSITIONS.map(([a, b]) => ({ ...ok(a, b), oralFluencyDrop: 0.9 })) as TransitionObservation[];
    expect(evaluateStaminaTransitions(withOral, thresholds).status).toBe("PASS");
  });
});
