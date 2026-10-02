import { describe, expect, it } from "vitest";
import { explainFromLedger, lastDecision } from "../../../lib/v2/explainability";
import { recordNewProgressionAttempt } from "../../../lib/v2/attempt-record";
import { newLearnerAggregate, type LearnerAggregate } from "../../../lib/v2/learner-aggregate";
import { scoreComprehension, structuredEvidence } from "../../../lib/v2/comprehension-score";
import type { AttemptRecord } from "../../../lib/v2/attempt-record";

const scored = (s: number) => scoreComprehension(structuredEvidence([{ itemId: "q1", score: s }]), { score: s });

function play(scores: number[], start = 90, startPointerAt = 0) {
  let learner: LearnerAggregate = newLearnerAggregate("l", start);
  if (startPointerAt) learner = { ...learner, canonicalPointer: startPointerAt };
  scores.forEach((s, i) => {
    learner = recordNewProgressionAttempt(learner, {
      attemptId: `a${i}`, passageId: `P${i + 1}`, displayedWpm: learner.core.wpm, passageWords: 100,
      recordedAt: "2026-10-03T10:00:00Z", comprehension: scored(s)
    }).learner;
  });
  return learner;
}

// FR-049 - Explainability [FROZEN] (AC-P28)
describe("FR-049 explainability", () => {
  it("explains a first-five Level Up: LEVEL_UP: first_five_green_count=4/5", () => {
    const learner = play([0.9, 0.9, 0.5, 0.9, 0.9]);
    const replay = explainFromLedger(learner.ledger, 90);
    expect(lastDecision(replay)?.reason).toBe("LEVEL_UP: first_five_green_count=4/5");
    expect(replay.finalWpm).toBe(91);
  });

  it("explains a 5/5 Level Up", () => {
    expect(lastDecision(explainFromLedger(play([0.9, 0.9, 0.9, 0.9, 0.9]).ledger, 90))?.reason).toBe("LEVEL_UP: first_five_green_count=5/5");
  });

  it("explains a HOLD: HOLD: first_five_green_count=3/5", () => {
    const replay = explainFromLedger(play([0.9, 0.5, 0.9, 0.5, 0.9]).ledger, 90);
    expect(lastDecision(replay)?.reason).toBe("HOLD: first_five_green_count=3/5");
    expect(replay.finalWpm).toBe(90);
  });

  it("explains a post-five Level Up: LEVEL_UP: post_five_consecutive_green=3", () => {
    const replay = explainFromLedger(play([0.5, 0.5, 0.5, 0.5, 0.5, 0.9, 0.9, 0.9]).ledger, 90);
    expect(lastDecision(replay)?.reason).toBe("LEVEL_UP: post_five_consecutive_green=3");
    expect(replay.finalWpm).toBe(91);
  });

  it("explains excluded practice: PRACTICE_ONLY: excluded_from_progression_evidence", () => {
    const ledger = play([0.9]).ledger;
    const practice: AttemptRecord = { ...ledger[0], attemptId: "pr1", attemptType: "FAMILIAR_PRACTICE" };
    const replay = explainFromLedger([...ledger, practice], 90);
    expect(replay.explanations.at(-1)).toMatchObject({ decision: "PRACTICE_ONLY", reason: "PRACTICE_ONLY: excluded_from_progression_evidence" });
    expect(replay.finalWpm).toBe(90);
  });

  it("reconstructs from the immutable ledger alone and agrees with the stored Level-Up states (AC-P28)", () => {
    const learner = play([0.9, 0.9, 0.9, 0.9, 0.9, 0.5, 0.5, 0.5, 0.5, 0.5, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9]);
    const replay = explainFromLedger(learner.ledger, 90);
    expect(replay.consistent).toBe(true);
    expect(replay.finalWpm).toBe(learner.core.wpm);
    expect(replay.explanations).toHaveLength(learner.ledger.length);
  });

  it("explains a deferred Level Up at a stamina length step and agrees with the stored state", () => {
    // pointer at 146: the 5th passage is P150 and P151 is longer, so the Level Up is deferred
    const learner = play([0.9, 0.9, 0.9, 0.9, 0.9], 90, 146);
    expect(learner.core.wpm).toBe(90);
    expect(learner.ledger.at(-1)?.levelUpAfter.event).toBe("LEVEL_UP_DEFERRED_BY_LENGTH_STEP");
    const replay = explainFromLedger(learner.ledger, 90, 146);
    expect(replay.consistent).toBe(true);
    expect(replay.finalWpm).toBe(90);
    expect(lastDecision(replay)).toMatchObject({ decision: "LEVEL_UP_DEFERRED" });
    expect(lastDecision(replay)?.reason).toMatch(/^LEVEL_UP_DEFERRED: length_step_p151_takes_precedence/);
  });

  it("flags an inconsistent stored record instead of silently trusting it", () => {
    const learner = play([0.9, 0.9, 0.9, 0.9, 0.9]);
    const tampered = learner.ledger.map((r, i) => (i === 4 ? ({ ...r, levelUpAfter: { wpm: 95, event: "LEVEL_UP" as const } }) : r));
    expect(explainFromLedger(tampered, 90).consistent).toBe(false);
  });

  it("returns null when no Level Up or HOLD decision has been made yet", () => {
    expect(lastDecision(explainFromLedger(play([0.9, 0.9]).ledger, 90))).toBeNull();
  });

  it("is deterministic for the same ledger and versions (AC-C09)", () => {
    const ledger = play([0.5, 0.9, 0.9, 0.9, 0.5, 0.9, 0.9, 0.9]).ledger;
    expect(explainFromLedger(ledger, 90)).toEqual(explainFromLedger(ledger, 90));
  });
});
