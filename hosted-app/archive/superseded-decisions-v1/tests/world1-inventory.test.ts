import { describe, expect, it } from "vitest";
import { completeWorld1Passage, confirmStaminaStep, selectEligibleWorld1Passage, type World1LearnerState } from "../../lib/world1-engine";
import { newWorld1Profile } from "../../lib/world1-storage";
import { passageLengthTarget, WORLD1_CONFIG, type CatalogPassage } from "../../lib/world1-product";

const event = (sequence: number) => ({
  attemptId: `passage-${sequence}`, sessionId: `session-${sequence}`, sequence, trainedWpm: 100,
  comprehension: "PASS" as const, oralQuality: "PASS" as const, kmReadinessApproved: true
});

describe("DEC-005 complete sequential inventory", () => {
  it("holds the next longer block until the current length was validated", () => {
    const state: World1LearnerState = {
      ...newWorld1Profile("learner", 100).state,
      nextPassageSequence: 176,
      stamina: { validatedWords: 100, pendingWords: null, confirmingAttemptIds: [] }
    };
    const decision = completeWorld1Passage(state, event(176), { ...WORLD1_CONFIG, staminaConfirmations: 1 });
    expect(decision.reason).toBe("READINESS_HOLD");
    expect(decision.state).toBe(state);
  });

  it("does not serve a longer passage until its prerequisite length is validated", () => {
    const passage: CatalogPassage = {
      content_id: "p176", content_version: "1", schema_version: "1.0", approval_status: "APPROVED",
      passage_sequence: 176, age_band: "7-10", text: "approved passage", rs_id: "RS01",
      knowledge_strand: "Self & Character", theme: "nature", narrative_form: "story", reading_purpose: "normal",
      language_qa_approved: true, age_qa_approved: true, km_approved: true,
      language_qa: { accessibleProseApproved: true, ageTopicApproved: true, vocabularyOverload: false, unnecessaryStretchDimensions: [] }
    };
    const state = { ...newWorld1Profile("learner", 100).state, nextPassageSequence: 176 };
    expect(selectEligibleWorld1Passage([passage], state, "7-10", () => 150).status).toBe("READINESS_HOLD");
    expect(selectEligibleWorld1Passage([passage], { ...state, stamina: { ...state.stamina, validatedWords: 125 } }, "7-10", () => 150).status).toBe("READY");
    expect(selectEligibleWorld1Passage([], { ...state, stamina: { ...state.stamina, validatedWords: 125 } }, "7-10", () => 150).status).toBe("CONTENT_UNAVAILABLE");
  });

  it("can visit and complete every passage exactly once without skips or a calendar quota", () => {
    let state = newWorld1Profile("learner", 100).state;
    const config = { ...WORLD1_CONFIG, staminaConfirmations: 1 };
    const visited: number[] = [];
    for (let sequence = 1; sequence <= 1500; sequence += 1) {
      expect(state.nextPassageSequence).toBe(sequence);
      const decision = completeWorld1Passage(state, event(sequence), config);
      state = decision.state;
      visited.push(sequence);
      const targetWords = passageLengthTarget(sequence).words;
      if (targetWords === state.stamina.validatedWords + 25) {
        const validation = confirmStaminaStep(state, {
          attemptId: `passage-${sequence}`, sequence, targetWords,
          comprehension: "PASS", oralQuality: "PASS", kmReadinessApproved: true
        }, config);
        expect(validation.reason).toBe("STAMINA_VALIDATED");
        state = validation.state;
      }
      if (sequence === 1500) expect(decision.reason).toBe("WORLD_COMPLETE");
    }
    expect(visited).toHaveLength(1500);
    expect(new Set(visited).size).toBe(1500);
    expect(state.nextPassageSequence).toBe(1501);
    expect(state.stamina.validatedWords).toBe(1000);
    expect(completeWorld1Passage(state, event(1500), config).state).toBe(state);
  });
});
