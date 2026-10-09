import { describe, expect, it } from "vitest";
import { ATTEMPT_TYPES, applyAttemptToCore, countsAsProgressionEvidence, newCoreWpmState, progressionEvidence, type ScoredAttempt, type AttemptType } from "../../../lib/v2/attempt-types";

const att = (id: string, attemptType: AttemptType, classification: "GREEN" | "NOT_GREEN" = "GREEN"): ScoredAttempt => ({ attemptId: id, attemptType, classification });

// FR-017 - Architectural rule [FROZEN]
describe("FR-017 new passages prove progress, earlier passages practise progress", () => {
  it("defines the seven approved attempt types", () => {
    expect(ATTEMPT_TYPES).toEqual(["NEW_PROGRESSION", "FAMILIAR_PRACTICE", "INITIAL_ASSESSMENT", "ASSESSMENT", "REASSESSMENT", "REVALIDATION", "NEWS_READER"]);
  });

  it("only NEW_PROGRESSION counts as Level Up evidence", () => {
    for (const type of ATTEMPT_TYPES) expect(countsAsProgressionEvidence(type)).toBe(type === "NEW_PROGRESSION");
  });

  it("filters mixed histories down to new progression evidence", () => {
    const history = [att("1", "NEW_PROGRESSION"), att("2", "FAMILIAR_PRACTICE"), att("3", "NEWS_READER"), att("4", "NEW_PROGRESSION")];
    expect(progressionEvidence(history).map((a) => a.attemptId)).toEqual(["1", "4"]);
  });

  it("any number of GREEN familiar-practice attempts cannot level the learner up (AC-P09)", () => {
    let state = newCoreWpmState(90);
    for (let i = 0; i < 50; i += 1) {
      const out = applyAttemptToCore(state, att(`p${i}`, "FAMILIAR_PRACTICE"));
      expect(out.event).toBe("EXCLUDED");
      state = out.state;
    }
    expect(state).toEqual(newCoreWpmState(90));
  });

  it("practice inserted between new attempts does not change the outcome", () => {
    const run = (types: AttemptType[]) => {
      let state = newCoreWpmState(90);
      for (const [i, type] of types.entries()) state = applyAttemptToCore(state, att(`a${i}`, type, "GREEN")).state;
      return state.wpm;
    };
    const pure = run(["NEW_PROGRESSION", "NEW_PROGRESSION", "NEW_PROGRESSION", "NEW_PROGRESSION", "NEW_PROGRESSION"]);
    const mixed = run(["NEW_PROGRESSION", "FAMILIAR_PRACTICE", "NEW_PROGRESSION", "FAMILIAR_PRACTICE", "NEW_PROGRESSION", "NEW_PROGRESSION", "FAMILIAR_PRACTICE", "NEW_PROGRESSION"]);
    expect(pure).toBe(91);
    expect(mixed).toBe(91);
    // four new + lots of practice is still only four new passages
    expect(run(["NEW_PROGRESSION", "NEW_PROGRESSION", "NEW_PROGRESSION", "NEW_PROGRESSION", "FAMILIAR_PRACTICE", "FAMILIAR_PRACTICE", "FAMILIAR_PRACTICE"])).toBe(90);
  });

  it("excludes assessment, reassessment and News Reader attempts as well", () => {
    for (const type of ["ASSESSMENT", "REASSESSMENT", "NEWS_READER"] as AttemptType[]) {
      expect(applyAttemptToCore(newCoreWpmState(90), att("x", type)).event).toBe("EXCLUDED");
    }
  });

  it("rejects an attempt without an approved type (AC-C02)", () => {
    expect(() => applyAttemptToCore(newCoreWpmState(90), { attemptId: "x", attemptType: undefined as never, classification: "GREEN" })).toThrow(/attemptType/);
    expect(() => applyAttemptToCore(newCoreWpmState(90), { attemptId: "x", attemptType: "OTHER" as never, classification: "GREEN" })).toThrow(/attemptType/);
  });
});
