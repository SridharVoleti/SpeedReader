import { describe, expect, it } from "vitest";
import { assertPersonalOnly, personalImprovement, COMPARATIVE_FIELDS, type HistoryPoint } from "../../../lib/v2/personal-trajectory";

const h = (...wpms: number[]): HistoryPoint[] => wpms.map((wpm, i) => ({ attemptId: `a${i}`, wpm, valid: true }));

// FR-009 - Personal trajectory [FROZEN]
describe("FR-009 personal trajectory", () => {
  it("measures improvement only against the learner's own valid history", () => {
    expect(personalImprovement(h(60, 61, 62, 65))).toEqual({ startWpm: 60, currentWpm: 65, gainWpm: 5, validPoints: 4 });
  });

  it("ignores invalid attempts in the learner's own history", () => {
    const history = [...h(60, 70), { attemptId: "x", wpm: 200, valid: false }];
    expect(personalImprovement(history).currentWpm).toBe(70);
  });

  it("lets two learners have different starting points, routes and rates", () => {
    const a = personalImprovement(h(40, 41, 42));
    const b = personalImprovement(h(110, 111, 113, 114, 115));
    expect(a.gainWpm).toBe(2);
    expect(b.gainWpm).toBe(5);
    expect(a.startWpm).not.toBe(b.startWpm);
  });

  it("returns no improvement figure when there is no valid history rather than inventing one", () => {
    expect(personalImprovement([])).toEqual({ startWpm: null, currentWpm: null, gainWpm: null, validPoints: 0 });
  });

  it("rejects any comparison with other learners, age averages, leaderboards or universal rates", () => {
    expect(COMPARATIVE_FIELDS).toEqual(expect.arrayContaining(["peerRank", "ageGroupAverage", "leaderboardPosition", "expectedImprovementRate"]));
    for (const field of COMPARATIVE_FIELDS) {
      expect(() => assertPersonalOnly({ learnerId: "l1", [field]: 1 })).toThrow(/comparative/i);
    }
    expect(() => assertPersonalOnly({ learnerId: "l1", wpm: 90 })).not.toThrow();
  });

  it("checks nested inputs too", () => {
    expect(() => assertPersonalOnly({ learnerId: "l1", context: { peerRank: 3 } })).toThrow(/peerRank/);
  });
});
