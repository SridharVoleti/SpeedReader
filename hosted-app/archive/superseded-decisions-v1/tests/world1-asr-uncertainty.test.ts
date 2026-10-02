import { describe, expect, it } from "vitest";
import { assessYoungBeginnerSpoken, rollingPersonalBaseline } from "../../lib/world1-session";
import { evaluateSpeedSession } from "../../lib/world1-advancement";

describe("DEC-011 uncertain ASR is technical evidence", () => {
  it("routes low-confidence ASR to retry even if semantic classification says unrelated", () => {
    const assessment = assessYoungBeginnerSpoken({
      transcript: "possibly unrelated", asrUsable: true, semanticJudgement: "UNRELATED",
      asrConfidence: 0.49, minimumAsrConfidence: 0.5
    });
    expect(assessment).toEqual({ state: "TECHNICAL_RETRY", reason: "ASR_UNCERTAIN" });

    const speed = { currentWpm: 100, consecutiveValidSuccess: 2, consumedSessionIds: ["one", "two"] };
    expect(evaluateSpeedSession(speed, { sessionId: "three", atWpm: 100, comprehension: assessment.state, oralQuality: "PASS" }).state).toBe(speed);
    expect(rollingPersonalBaseline([{ sessionId: "three", value: 0, evidence: assessment.state, comparable: true }], 100, { windowSize: 5, minimumSamples: 1 })).toBe(100);
  });
});
