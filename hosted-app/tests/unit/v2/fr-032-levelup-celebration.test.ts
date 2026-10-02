import { describe, expect, it } from "vitest";
import { completeNewPassage } from "../../../lib/v2/passage-completion";
import { scoreComprehension, structuredEvidence } from "../../../lib/v2/comprehension-score";
import { newCoreWpmState, type CoreWpmState } from "../../../lib/v2/core-wpm";
import { CELEBRATION_RANK, assertNoInternalLeak, buildLearnerFeedback, buildLevelUpFeedback } from "../../../lib/v2/learner-feedback";
import { LEVEL_UP_MESSAGE } from "../../../lib/v2/level-semantics";

const scored = (s: number) => scoreComprehension(structuredEvidence([{ itemId: "q1", score: s }]), { score: s });

function playToLevelUp() {
  let core: CoreWpmState = newCoreWpmState(90);
  const outcomes = [];
  for (let i = 0; i < 5; i += 1) {
    const out = completeNewPassage(`a${i}`, scored(0.9), core);
    core = out.coreAfter;
    outcomes.push(out);
  }
  return outcomes;
}

// FR-032 - Level-Up celebration [FROZEN]
describe("FR-032 Level Up celebration", () => {
  it("a validated +1 WPM Level Up is celebrated more than an individual GREEN passage", () => {
    const outcomes = playToLevelUp();
    const greenOnly = outcomes[0].learner;
    const levelUp = outcomes[4].learner;
    expect(CELEBRATION_RANK[levelUp.celebration]).toBeGreaterThan(CELEBRATION_RANK[greenOnly.celebration]);
    expect(levelUp.celebration).toBe("LARGE");
    expect(greenOnly.celebration).toBe("SMALL");
  });

  it("uses the canonical phrase 'You Levelled Up!'", () => {
    const outcomes = playToLevelUp();
    expect(outcomes[4].coreEvent).toBe("LEVEL_UP");
    expect(outcomes[4].learner.message).toBe("You Levelled Up!");
    expect(buildLevelUpFeedback(91).message).toBe(LEVEL_UP_MESSAGE);
  });

  it("shows the new WPM with the celebration, still without any score or state label", () => {
    const levelUp = playToLevelUp()[4].learner;
    expect(levelUp.newWpm).toBe(91);
    assertNoInternalLeak(levelUp);
    expect(levelUp.message).not.toMatch(/graduat/i);
  });

  it("does not celebrate as a Level Up when nothing is validated (holds, NOT_GREEN, unscored)", () => {
    let core: CoreWpmState = newCoreWpmState(90);
    for (let i = 0; i < 5; i += 1) {
      const out = completeNewPassage(`n${i}`, scored(0.5), core);
      core = out.coreAfter;
      expect(out.learner.message).not.toBe("You Levelled Up!");
      expect(out.learner.celebration).not.toBe("LARGE");
    }
    expect(buildLearnerFeedback({ attemptId: "x", score: 0.9, classification: "GREEN" }).message).not.toBe("You Levelled Up!");
  });

  it("celebrates every individual +1 WPM, one at a time", () => {
    let core: CoreWpmState = newCoreWpmState(90);
    let levelUps = 0;
    for (let i = 0; i < 15; i += 1) {
      const out = completeNewPassage(`b${i}`, scored(0.95), core);
      core = out.coreAfter;
      if (out.learner.celebration === "LARGE") levelUps += 1;
    }
    expect(levelUps).toBe(3);
    expect(core.wpm).toBe(93);
  });
});
