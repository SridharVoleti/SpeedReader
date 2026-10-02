import { describe, expect, it } from "vitest";
import { WORLD1_CONFIG, validateWorldConfig, nextSequentialPassage, type CatalogPassage } from "../../lib/world1-product";
import { completeWorld1Passage, selectEligibleWorld1Passage } from "../../lib/world1-engine";
import { newWorld1Profile } from "../../lib/world1-storage";
import { recommendNextSession } from "../../lib/world1-session";

describe("DEC-006 mastery-driven completion timing", () => {
  it("rejects calendar deadlines and passage quotas in versioned world configuration", () => {
    const withDeadline = { ...WORLD1_CONFIG, completionDeadlineDays: 365 };
    const withQuota = { ...WORLD1_CONFIG, requiredPassagesPerMonth: 65 };
    expect(validateWorldConfig(withDeadline)).toContain("unsupported config field completionDeadlineDays");
    expect(validateWorldConfig(withQuota)).toContain("unsupported config field requiredPassagesPerMonth");
    const initial = newWorld1Profile("slow-reader", 100).state;
    const decision = completeWorld1Passage(initial, {
      attemptId: "a", sessionId: "s", sequence: 1, trainedWpm: 100,
      comprehension: "PASS", oralQuality: "PASS", kmReadinessApproved: true
    }, withDeadline);
    expect(decision.reason).toBe("CONFIG_INVALID");
    expect(decision.state).toBe(initial);
  });

  it("keeps a slow learner at the same passage after years; cadence is only guidance", () => {
    const initial = newWorld1Profile("slow-reader", 100).state;
    const failed = completeWorld1Passage(initial, {
      attemptId: "attempt-1", sessionId: "session-1", sequence: 1, trainedWpm: 100,
      comprehension: "HOLD", oralQuality: "PASS", kmReadinessApproved: false
    }, WORLD1_CONFIG).state;
    const yearsLater = 3 * 365 * 24 * 60 * 60 * 1000;
    expect(recommendNextSession(0, WORLD1_CONFIG)).toBeLessThan(yearsLater);
    expect(failed.nextPassageSequence).toBe(1);
    expect(failed.speed.currentWpm).toBe(100);
    const passage: CatalogPassage = {
      content_id: "w1-1", content_version: "1", schema_version: "1.0", approval_status: "APPROVED",
      passage_sequence: 1, age_band: "7-10", text: "approved", rs_id: "RS01",
      knowledge_strand: "Self & Character", competency_level: 1, theme: "nature",
      narrative_form: "story", reading_purpose: "normal", language_qa_approved: true,
      age_qa_approved: true, km_approved: true,
      language_qa: { accessibleProseApproved: true, ageTopicApproved: true, vocabularyOverload: false, unnecessaryStretchDimensions: [] }
    };
    expect(selectEligibleWorld1Passage([passage], failed, "7-10", () => 100)).toMatchObject({ status: "READY", passage });
    expect(nextSequentialPassage([passage], "7-10", failed.nextPassageSequence, () => 100).status).toBe("READY");
  });
});
