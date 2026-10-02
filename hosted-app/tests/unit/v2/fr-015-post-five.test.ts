import { describe, expect, it } from "vitest";
import { newCoreWpmState, recordNewPassage, type CoreWpmState } from "../../../lib/v2/core-wpm";
import type { Classification } from "../../../lib/v2/comprehension-threshold";

const G: Classification = "GREEN";
const N: Classification = "NOT_GREEN";

function play(start: number, results: Classification[]) {
  let state: CoreWpmState = newCoreWpmState(start);
  const events: string[] = [];
  for (const r of results) {
    const out = recordNewPassage(state, r);
    state = out.state;
    events.push(out.event);
  }
  return { state, events };
}

// FR-015 - Post-five rule [FROZEN]
describe("FR-015 post-five rule", () => {
  it("after an unsuccessful first-five window the learner holds the current WPM (AC-P05)", () => {
    const { state, events } = play(90, [G, N, G, N, G]);
    expect(state.wpm).toBe(90);
    expect(events.at(-1)).toBe("HOLD_AFTER_FIVE");
  });

  it("three consecutive GREEN new passages from passage six trigger exactly +1 WPM (AC-P06)", () => {
    const { state, events } = play(90, [N, N, N, N, N, G, G, G]);
    expect(state.wpm).toBe(91);
    expect(events.filter((e) => e === "LEVEL_UP")).toHaveLength(1);
    expect(events.at(-1)).toBe("LEVEL_UP");
  });

  it("a NOT_GREEN after one or two post-five GREEN passages resets the streak (AC-P07)", () => {
    expect(play(90, [N, N, N, N, N, G, G, N, G, G]).state.wpm).toBe(90);
    expect(play(90, [N, N, N, N, N, G, N, G, G]).state.wpm).toBe(90);
    // ... and a fresh run of three then succeeds
    expect(play(90, [N, N, N, N, N, G, G, N, G, G, G]).state.wpm).toBe(91);
  });

  it("only passages from six onward count: first-five GREENs do not join the streak", () => {
    // passages 4,5 GREEN + passage 6 GREEN would be three in a row if the window counted - it must not
    const { state } = play(90, [N, N, N, G, G, G]);
    expect(state.wpm).toBe(90);
    expect(play(90, [N, N, N, G, G, G, G, G]).state.wpm).toBe(91);
  });

  it("starts both counters afresh after a Level Up at the new WPM", () => {
    const { state } = play(90, [G, G, G, G, G]); // first-five level up
    expect(state).toMatchObject({ wpm: 91, newAttempts: [], postFiveStreak: 0, practiceEligible: false });
    const next = play(91, [N, N, N, N, N, G, G, G]);
    expect(next.state.wpm).toBe(92);
  });

  it("makes the learner practice-eligible internally while stalled, never decrementing WPM", () => {
    const { state } = play(90, [N, N, N, N, N, N, N, N, N, N]);
    expect(state.wpm).toBe(90);
    expect(state.practiceEligible).toBe(true);
  });

  it("never exceeds the 150 WPM ceiling", () => {
    const { state } = play(150, [G, G, G, G, G, G, G, G]);
    expect(state.wpm).toBe(150);
  });

  it("is deterministic", () => {
    const seq = [N, G, N, N, N, G, G, G];
    expect(play(70, seq)).toEqual(play(70, seq));
  });
});
