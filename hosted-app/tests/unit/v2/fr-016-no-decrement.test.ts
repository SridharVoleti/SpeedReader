import { describe, expect, it } from "vitest";
import { newCoreWpmState, recordNewPassage, type CoreWpmState } from "../../../lib/v2/core-wpm";
import { assertNoDecrement, CORE_PROGRESSION_OUTCOMES, SUPERSEDED_DECREMENT_RULES } from "../../../lib/v2/no-decrement";

// FR-016 - Earned WPM is never removed [FROZEN]
describe("FR-016 earned WPM is never removed", () => {
  it("no GREEN/NOT_GREEN sequence of up to 14 passages ever lowers WPM (AC-P08, exhaustive)", () => {
    const LENGTH = 14;
    for (let bits = 0; bits < 1 << LENGTH; bits += 1) {
      let state: CoreWpmState = newCoreWpmState(90);
      let previous = state.wpm;
      for (let i = 0; i < LENGTH; i += 1) {
        const result = (bits >> i) & 1 ? "GREEN" : "NOT_GREEN";
        state = recordNewPassage(state, result).state;
        expect(state.wpm).toBeGreaterThanOrEqual(previous);
        assertNoDecrement(previous, state.wpm);
        previous = state.wpm;
      }
    }
  });

  it("holds WPM after ten NOT_GREEN passages and after 0/5", () => {
    let state: CoreWpmState = newCoreWpmState(90);
    for (let i = 0; i < 10; i += 1) state = recordNewPassage(state, "NOT_GREEN").state;
    expect(state.wpm).toBe(90);
  });

  it("has no downward outcome in the engine's vocabulary", () => {
    expect(CORE_PROGRESSION_OUTCOMES).toEqual(["NONE", "LEVEL_UP", "HOLD_AFTER_FIVE"]);
    expect(CORE_PROGRESSION_OUTCOMES.join()).not.toMatch(/DOWN|DECREMENT|REGRESS/);
  });

  it("records the superseded decrement rules so they are never reintroduced", () => {
    expect(Object.keys(SUPERSEDED_DECREMENT_RULES)).toEqual(["DECREMENT-AFTER-TEN", "DECREMENT-AFTER-ZERO-OF-FIVE", "STEP_DOWN"]);
  });

  it("the guard throws on a decrement and allows hold or increase", () => {
    expect(() => assertNoDecrement(90, 89)).toThrow(/forbidden/);
    expect(() => assertNoDecrement(90, 90)).not.toThrow();
    expect(() => assertNoDecrement(90, 91)).not.toThrow();
  });
});
