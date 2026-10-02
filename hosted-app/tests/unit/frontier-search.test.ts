import { describe, expect, it } from "vitest";
import { FrontierState, nextFrontierState } from "../../lib/adaptive-speed";

// SR-R4-002: Frontier search.
// "Allow configurable increments that shrink near comprehension frontier."
// "Tests show larger steps below frontier and smaller bounded steps after borderline/failure
//  evidence."
function state(overrides: Partial<FrontierState> = {}): FrontierState {
  return { stepSize: 20, minStepSize: 5, maxStepSize: 80, ...overrides };
}

describe("nextFrontierState", () => {
  it("grows the step size on a comfortable pass, bounded by maxStepSize", () => {
    const next = nextFrontierState(state({ stepSize: 20 }), "comfortable_pass");
    expect(next.stepSize).toBe(40);

    const atCeiling = nextFrontierState(state({ stepSize: 60, maxStepSize: 80 }), "comfortable_pass");
    expect(atCeiling.stepSize).toBe(80);
  });

  it("shrinks the step size on a borderline pass, bounded by minStepSize", () => {
    const next = nextFrontierState(state({ stepSize: 20 }), "borderline_pass");
    expect(next.stepSize).toBe(10);

    const atFloor = nextFrontierState(state({ stepSize: 8, minStepSize: 5 }), "borderline_pass");
    expect(atFloor.stepSize).toBe(5);
  });

  it("shrinks the step size on a genuine failure, the same as a borderline pass", () => {
    const next = nextFrontierState(state({ stepSize: 20 }), "fail");
    expect(next.stepSize).toBe(10);
  });

  it("leaves the step size unchanged for an invalid/technical attempt", () => {
    const next = nextFrontierState(state({ stepSize: 20 }), "invalid");
    expect(next.stepSize).toBe(20);
  });

  it("takes larger steps while comfortably below the frontier, then smaller bounded steps once borderline/failure evidence appears", () => {
    let current = state({ stepSize: 10, minStepSize: 5, maxStepSize: 80 });
    const history: number[] = [current.stepSize];

    for (const evidence of ["comfortable_pass", "comfortable_pass", "comfortable_pass"] as const) {
      current = nextFrontierState(current, evidence);
      history.push(current.stepSize);
    }
    // Growing while below the frontier.
    expect(history).toEqual([10, 20, 40, 80]);

    for (const evidence of ["borderline_pass", "fail"] as const) {
      current = nextFrontierState(current, evidence);
      history.push(current.stepSize);
    }
    // Shrinking once near/at the frontier.
    expect(history.slice(-2)).toEqual([40, 20]);
    expect(current.stepSize).toBeLessThan(80);
  });

  it("is deterministic for identical inputs", () => {
    expect(nextFrontierState(state(), "borderline_pass")).toEqual(nextFrontierState(state(), "borderline_pass"));
  });
});
