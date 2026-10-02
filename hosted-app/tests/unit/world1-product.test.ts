import { describe, expect, it } from "vitest";
import { WORLD1_CONFIG, passageLengthTarget, nextSequentialPassage, validateCatalog, validateWorldConfig, varietyIssues, type CatalogPassage } from "../../lib/world1-product";
import { assessYoungBeginnerSpoken, completeNewsReader, finishSession, judgeAuthoredSpokenIdea, recommendNextSession, rollingPersonalBaseline, sessionOutcome, sessionTimeRemaining, type OralMetrics } from "../../lib/world1-session";
import { chooseAdvancement, evaluateConfiguredBandCrossing, evaluateSpeedSession, evaluateStaminaStep, recordValidatedLevel, type LevelLedger } from "../../lib/world1-advancement";
import { PRODUCT_AUDIO_DEFAULT_GOVERNANCE, retainImprovementAudio } from "../../lib/world1-audio";
import { completeWorld1Passage, confirmSpeedStep, confirmStaminaStep, type World1LearnerState } from "../../lib/world1-engine";
import { appendBaselineEvidence, loadWorld1Profile, newWorld1Profile, saveWorld1Profile } from "../../lib/world1-storage";
import { bandACoordinate, KNOWLEDGE_STRANDS, RS_IDS } from "../../lib/world1-framework";

describe("World 1 catalog and policy", () => {
  it("preserves all 15 RS tracks and knowledge strands in each Band A round", () => {
    for (let round = 0; round < 10; round += 1) {
      const coordinates = Array.from({ length: 15 }, (_, index) => bandACoordinate(round * 15 + index + 1));
      expect(coordinates.map((coordinate) => coordinate.rsId)).toEqual(RS_IDS);
      expect(new Set(coordinates.map((coordinate) => coordinate.knowledgeStrand)).size).toBe(15);
      expect(coordinates.every((coordinate) => coordinate.pLevel === round + 1)).toBe(true);
    }
    expect(bandACoordinate(1).knowledgeStrand).toBe(KNOWLEDGE_STRANDS[0]);
    expect(bandACoordinate(16).knowledgeStrand).toBe(KNOWLEDGE_STRANDS[1]);
    expect(bandACoordinate(150).rsId).toBe("RS15");
  });

  it("uses the same competency coordinate across age bands with different prose", () => {
    const coordinate = bandACoordinate(16);
    const base: CatalogPassage = {
      content_id: "young-16", content_version: "1", schema_version: "1.0", approval_status: "APPROVED",
      passage_sequence: 16, age_band: "7-10", text: "young theme", rs_id: coordinate.rsId,
      knowledge_strand: coordinate.knowledgeStrand, competency_level: coordinate.pLevel,
      theme: "friendship", narrative_form: "story", reading_purpose: "normal",
      language_qa_approved: true, age_qa_approved: true, km_approved: true,
      language_qa: { accessibleProseApproved: true, ageTopicApproved: true, vocabularyOverload: false, unnecessaryStretchDimensions: [] }
    };
    const older = { ...base, content_id: "older-16", age_band: "15-18", text: "older theme", theme: "civic life" };
    expect(nextSequentialPassage([base, older], "7-10", 16, () => 100)).toEqual({ status: "READY", passage: base });
    expect(nextSequentialPassage([base, older], "15-18", 16, () => 100)).toEqual({ status: "READY", passage: older });
    expect(nextSequentialPassage([{ ...older, rs_id: "RS02" }], "15-18", 16, () => 100).status).toBe("CONTENT_INVALID");
  });

  it("maps every sequence through 1500 and each bridge/milestone boundary", () => {
    const boundaries: Record<number, number> = { 1: 100, 150: 100, 151: 125, 175: 125, 176: 150, 200: 150, 201: 175, 225: 175, 226: 200, 300: 200, 301: 225, 1426: 1000, 1500: 1000 };
    for (const [sequence, words] of Object.entries(boundaries)) expect(passageLengthTarget(Number(sequence)).words).toBe(words);
    const steps = Array.from({ length: 1500 }, (_, i) => passageLengthTarget(i + 1));
    expect(steps[149].staminaStep).toBe(0);
    expect(steps[1499].staminaStep).toBe(36);
    for (let i = 1; i < steps.length; i += 1) expect(steps[i].words - steps[i - 1].words).toBeGreaterThanOrEqual(0);
    expect(() => passageLengthTarget(1501)).toThrow();
  });

  it("rejects missing, duplicate, wrong-band, unapproved and wrong-length content", () => {
    const passage: CatalogPassage = { content_id: "p1", content_version: "1", schema_version: "1.0", approval_status: "APPROVED", passage_sequence: 1, age_band: "7-10", text: "one", rs_id: "RS01", knowledge_strand: "Self & Character", competency_level: 1, theme: "nature", narrative_form: "story", reading_purpose: "normal", language_qa_approved: true, age_qa_approved: true, km_approved: true, language_qa: { accessibleProseApproved: true, ageTopicApproved: true, vocabularyOverload: false, unnecessaryStretchDimensions: [] } };
    const count = () => 100;
    expect(nextSequentialPassage([passage], "7-10", 1, count).status).toBe("READY");
    expect(nextSequentialPassage([passage], "11-14", 1, count).status).toBe("CONTENT_UNAVAILABLE");
    expect(nextSequentialPassage([passage, passage], "7-10", 1, count).status).toBe("CONTENT_UNAVAILABLE");
    expect(nextSequentialPassage([{ ...passage, language_qa_approved: false }], "7-10", 1, count).status).toBe("CONTENT_INVALID");
    expect(nextSequentialPassage([passage], "7-10", 1, () => 99).status).toBe("CONTENT_INVALID");
    expect(validateCatalog([passage], "7-10", count, 2)).toContain("missing sequence 2");
    expect(varietyIssues([passage, { ...passage, passage_sequence: 2 }], 1).length).toBe(3);
    expect(validateWorldConfig(WORLD1_CONFIG)).toEqual([]);
  });

  it("validates an entire synthetic ordered inventory without skipping any sequence", () => {
    const records: CatalogPassage[] = Array.from({ length: 1500 }, (_, index) => ({
      content_id: `p${index + 1}`, content_version: "1", schema_version: "1.0", approval_status: "APPROVED",
      passage_sequence: index + 1, age_band: "7-10", text: String(passageLengthTarget(index + 1).words),
      rs_id: index < 150 ? bandACoordinate(index + 1).rsId : "RS01",
      knowledge_strand: index < 150 ? bandACoordinate(index + 1).knowledgeStrand : "Self & Character",
      competency_level: index < 150 ? bandACoordinate(index + 1).pLevel : undefined,
      theme: "nature", narrative_form: "story", reading_purpose: "normal",
      language_qa_approved: true, age_qa_approved: true, km_approved: true,
      language_qa: { accessibleProseApproved: true, ageTopicApproved: true, vocabularyOverload: false, unnecessaryStretchDimensions: [] }
    }));
    expect(validateCatalog(records, "7-10", Number)).toEqual([]);
    const missing = records.filter((record) => record.passage_sequence !== 999);
    expect(validateCatalog(missing, "7-10", Number)).toContain("missing sequence 999");
  });
});

describe("integrated session and evidence", () => {
  it("allows a single passage, graceful time expiry and alternate-day recommendation", () => {
    const session = { id: "s", startedAtMs: 0, passages: [{ passageId: "p", targetWpm: 100, comprehension: "PASS" as const, oralQuality: "PASS" as const, staminaWords: 100 }] };
    expect(sessionOutcome(session)).toBe("SUCCESS");
    expect(sessionTimeRemaining(session, 21 * 60_000, WORLD1_CONFIG)).toBe(0);
    expect(finishSession(session, 21 * 60_000).passages).toHaveLength(1);
    expect(recommendNextSession(0, WORLD1_CONFIG)).toBe(2 * 24 * 60 * 60 * 1000);
    expect(sessionOutcome({ ...session, passages: [{ ...session.passages[0], oralQuality: "TECHNICAL_RETRY" }] })).toBe("INSUFFICIENT_EVIDENCE");
  });

  it("separates semantic relevance from ASR uncertainty and sentence length", () => {
    const propositions = [{ propositionId: "idea", canonicalText: "Ravi returned the change", mandatory: true, constructId: "main_idea" as const, acceptedExpressions: ["he gave the extra coins back", "Ravi returned the money"], contradictionExpressions: ["he kept the extra coins"] }];
    expect(judgeAuthoredSpokenIdea("he gave the extra coins back", propositions)).toBe("RELEVANT");
    expect(judgeAuthoredSpokenIdea("he kept the extra coins", propositions)).toBe("UNRELATED");
    expect(judgeAuthoredSpokenIdea("he did something", propositions)).toBe("UNCERTAIN");
    expect(assessYoungBeginnerSpoken({ transcript: "He helped", asrUsable: true, semanticJudgement: "RELEVANT" }).state).toBe("PASS");
    expect(assessYoungBeginnerSpoken({ transcript: "unrelated", asrUsable: true, semanticJudgement: "UNRELATED" }).reason).toBe("GENTLE_RETRY");
    expect(assessYoungBeginnerSpoken({ transcript: "unknown", asrUsable: false, semanticJudgement: "UNRELATED" }).state).toBe("TECHNICAL_RETRY");
    expect(assessYoungBeginnerSpoken({ transcript: "", asrUsable: true }).state).toBe("INSUFFICIENT_EVIDENCE");
  });

  it("retains both oral reads with per-field average and signed delta", () => {
    const first: OralMetrics = { accuracy: 80, omissions: 2, substitutions: 1, hesitations: 3, restarts: 1, selfCorrections: 0, wpm: 80 };
    const second: OralMetrics = { ...first, accuracy: 90, omissions: 0, wpm: 90 };
    const result = completeNewsReader({ attempt: 1, passageId: "p", metrics: first, evidence: "PASS" }, { attempt: 2, passageId: "p", metrics: second, evidence: "PASS" });
    expect(result.average?.accuracy).toBe(85);
    expect(result.delta?.omissions).toBe(-2);
    expect(result.delta?.wpm).toBe(10);
    expect(result.read1.metrics).toEqual(first);
    expect(() => completeNewsReader(result.read2, result.read1)).toThrow();
    expect(completeNewsReader(result.read1, { ...result.read2, evidence: "TECHNICAL_RETRY" }).average).toBeNull();
  });

  it("uses only comparable personal evidence and resists one outlier", () => {
    const samples = [100, 101, 99, 100, 1000].map((value, i) => ({ sessionId: String(i), value, evidence: "PASS" as const, comparable: true }));
    expect(rollingPersonalBaseline(samples, null, { windowSize: 5, minimumSamples: 3 })).toBe(100);
    expect(rollingPersonalBaseline(samples.slice(0, 2), 95, { windowSize: 5, minimumSamples: 3 })).toBe(95);
    expect(rollingPersonalBaseline([...samples, { sessionId: "bad", value: 0, evidence: "TECHNICAL_RETRY", comparable: true }], null, { windowSize: 5, minimumSamples: 3 })).toBe(100);
  });
});

describe("advancement, levels and badges", () => {
  it("requires 3 distinct valid sessions and both independent gates", () => {
    const initial = { currentWpm: 100, consecutiveValidSuccess: 0, consumedSessionIds: [] as string[] };
    for (const [comprehension, oralQuality] of [["PASS", "HOLD"], ["HOLD", "PASS"], ["HOLD", "HOLD"]] as const) {
      expect(evaluateSpeedSession(initial, { sessionId: "s", atWpm: 100, comprehension, oralQuality }).eligible).toBe(false);
    }
    const one = evaluateSpeedSession(initial, { sessionId: "1", atWpm: 100, comprehension: "PASS", oralQuality: "PASS" });
    const technical = evaluateSpeedSession(one.state, { sessionId: "t", atWpm: 100, comprehension: "TECHNICAL_RETRY", oralQuality: "PASS" });
    expect(technical.state).toEqual(one.state);
    const two = evaluateSpeedSession(one.state, { sessionId: "2", atWpm: 100, comprehension: "PASS", oralQuality: "PASS" });
    expect(two.eligible).toBe(false);
    expect(evaluateSpeedSession(two.state, { sessionId: "3", atWpm: 100, comprehension: "PASS", oralQuality: "PASS" }).eligible).toBe(true);
    expect(evaluateSpeedSession(two.state, { sessionId: "2", atWpm: 100, comprehension: "PASS", oralQuality: "PASS" }).state).toEqual(two.state);
  });

  it("does not award a served-only stamina step or invent confirmation count", () => {
    const state = { validatedWords: 100, pendingWords: null, confirmingAttemptIds: [] as string[] };
    const evidence = { attemptId: "a", targetWords: 125, comprehension: "PASS" as const, oralQuality: "PASS" as const };
    expect(evaluateStaminaStep(state, evidence).reason).toBe("CONFIRMATION_COUNT_OPEN");
    expect(evaluateStaminaStep(state, { ...evidence, comprehension: "HOLD" }, 1).eligible).toBe(false);
    expect(evaluateStaminaStep(state, { ...evidence, oralQuality: "TECHNICAL_RETRY" }, 1).eligible).toBe(false);
    expect(evaluateStaminaStep(state, evidence, 1).state.validatedWords).toBe(125);
    const first = evaluateStaminaStep(state, evidence, 2);
    expect(first.eligible).toBe(false);
    expect(evaluateStaminaStep(first.state, { ...evidence, attemptId: "b" }, 2).eligible).toBe(true);
  });

  it("selects only one dimension and leaves unresolved tie breaks dormant", () => {
    const candidates = [{ dimension: "SPEED" as const, key: "speed-1" }, { dimension: "STAMINA" as const, key: "length-1" }];
    expect(chooseAdvancement(candidates)).toBeNull();
    expect(chooseAdvancement(candidates, "LENGTH")).toEqual(candidates[1]);
  });

  it("deduplicates validated crossings and awards each fifth level once", () => {
    let ledger: LevelLedger = { levels: [], badges: [] };
    const dimensions = ["SPEED", "COMPREHENSION", "ORAL_FLUENCY", "STAMINA", "INDEPENDENCE"] as const;
    for (let i = 0; i < 10; i += 1) {
      const crossing = { eventId: `event-${i}`, dimension: dimensions[i % 5], coordinate: `band-${i}`, evidenceIds: [`e-${i}`] };
      ledger = recordValidatedLevel(ledger, crossing);
      expect(recordValidatedLevel(ledger, crossing)).toBe(ledger);
    }
    expect(ledger.levels).toHaveLength(10);
    expect(ledger.badges).toEqual([{ badgeIndex: 1, levelOrdinal: 5 }, { badgeIndex: 2, levelOrdinal: 10 }]);
    expect(evaluateConfiguredBandCrossing("A", [{ evidenceId: "1", band: "B", valid: true }])).toBe(false);
    expect(evaluateConfiguredBandCrossing("A", [{ evidenceId: "1", band: "B", valid: true }, { evidenceId: "2", band: "B", valid: true }], { order: ["A", "B"], confirmations: 2 })).toBe(true);
  });
});

describe("improvement audio governance", () => {
  it("stores nothing by default and strips caller metadata when explicitly enabled", async () => {
    const saved: unknown[] = [];
    const store = { save: async (record: unknown) => { saved.push(record); } };
    const input = { passageId: "p", audioBytes: new Uint8Array([1]), format: "audio/webm", learnerId: "private", age: 7 };
    expect(await retainImprovementAudio(input, PRODUCT_AUDIO_DEFAULT_GOVERNANCE, store)).toBe("DISABLED");
    expect(saved).toHaveLength(0);
    expect(await retainImprovementAudio(input, { enabled: true, approved: true, explicitConsent: true, retentionPolicyId: "approved-policy" }, store)).toBe("STORED");
    expect(Object.keys(saved[0] as object)).toEqual(["passageId", "audioBytes", "format"]);
  });
});

describe("per-learner World 1 state", () => {
  it("persists progress and comparable evidence without mixing learners", () => {
    const data = new Map<string, string>();
    const store = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
    const profile = newWorld1Profile("learner-a", 100);
    const sample = { sessionId: "s1", value: 100, evidence: "PASS" as const, comparable: true };
    const updated = appendBaselineEvidence(profile, "SPEED", sample);
    expect(appendBaselineEvidence(updated, "SPEED", sample)).toBe(updated);
    saveWorld1Profile(store, updated);
    expect(loadWorld1Profile(store, "learner-a")?.baselineEvidence.SPEED).toEqual([sample]);
    expect(loadWorld1Profile(store, "learner-b")).toBeNull();
    data.set("speedreader-world1-profile-v1:learner-a", "{broken");
    expect(loadWorld1Profile(store, "learner-a")).toBeNull();
  });
});

describe("World 1 progression coordination", () => {
  const initial = (): World1LearnerState => ({
    nextPassageSequence: 149,
    speed: { currentWpm: 100, consecutiveValidSuccess: 2, consumedSessionIds: ["old-1", "old-2"] },
    stamina: { validatedWords: 100, pendingWords: null, confirmingAttemptIds: [] },
    levels: { levels: [], badges: [] },
    processedAttemptIds: [], pendingSpeedWpm: null
  });
  const event = (sequence: number, attemptId: string) => ({ attemptId, sessionId: attemptId, sequence, trainedWpm: 100, comprehension: "PASS" as const, oralQuality: "PASS" as const, kmReadinessApproved: true });

  it("preserves sequential order and canonical readiness, with no calendar gate", () => {
    expect(completeWorld1Passage(initial(), event(150, "a"), WORLD1_CONFIG).reason).toBe("WRONG_SEQUENCE");
    expect(completeWorld1Passage(initial(), { ...event(149, "a"), kmReadinessApproved: false }, WORLD1_CONFIG).state.nextPassageSequence).toBe(149);
    const passed = completeWorld1Passage(initial(), event(149, "a"), WORLD1_CONFIG);
    expect(passed.state.nextPassageSequence).toBe(150);
    expect(completeWorld1Passage(passed.state, event(149, "a"), WORLD1_CONFIG).state).toBe(passed.state);
    expect(completeWorld1Passage(initial(), { ...event(149, "a"), oralQuality: "TECHNICAL_RETRY" }, WORLD1_CONFIG).state).toEqual(initial());
  });

  it("holds speed on a length boundary, then awards stamina only after validation", () => {
    const at150 = { ...initial(), nextPassageSequence: 150 };
    const result = completeWorld1Passage(at150, event(150, "a"), { ...WORLD1_CONFIG, speedStepWpm: 5, staminaConfirmations: 1 });
    expect(result.reason).toBe("LENGTH_STEP_SERVED_SPEED_HELD");
    expect(result.state.speed.currentWpm).toBe(100);
    expect(result.state.speed.consecutiveValidSuccess).toBe(0);
    expect(result.state.pendingSpeedWpm).toBeNull();
    expect(result.state.levels.levels).toHaveLength(0);
    const sample = { attemptId: "length-a", sequence: 151, targetWords: 125, comprehension: "PASS" as const, oralQuality: "PASS" as const, kmReadinessApproved: true };
    expect(confirmStaminaStep(result.state, sample, { ...WORLD1_CONFIG, staminaConfirmations: 1 }).reason).toBe("PASSAGE_NOT_VALIDATED");
    const after151 = completeWorld1Passage(result.state, event(151, "length-a"), WORLD1_CONFIG).state;
    const validated = confirmStaminaStep(after151, sample, { ...WORLD1_CONFIG, staminaConfirmations: 1 });
    expect(validated.state.stamina.validatedWords).toBe(125);
    expect(validated.state.levels.levels[0].dimension).toBe("STAMINA");
    expect(confirmStaminaStep(validated.state, sample, { ...WORLD1_CONFIG, staminaConfirmations: 1 }).state.levels.levels).toHaveLength(1);
  });

  it("requires configured speed step and successful validation before a speed level", () => {
    expect(completeWorld1Passage(initial(), event(149, "a"), WORLD1_CONFIG).reason).toBe("SPEED_STEP_CONFIGURATION_OPEN");
    const result = completeWorld1Passage(initial(), event(149, "a"), { ...WORLD1_CONFIG, speedStepWpm: 5 });
    expect(result.state.pendingSpeedWpm).toBe(105);
    expect(result.state.levels.levels).toHaveLength(0);
    expect(confirmSpeedStep(result.state, "challenge", "TECHNICAL_RETRY", true).state).toBe(result.state);
    expect(confirmSpeedStep(result.state, "challenge", "PASS", false).state).toBe(result.state);
    const confirmed = confirmSpeedStep(result.state, "challenge", "PASS", true);
    expect(confirmed.state.speed.currentWpm).toBe(105);
    expect(confirmed.state.levels.levels[0].dimension).toBe("SPEED");
    expect(confirmSpeedStep(confirmed.state, "challenge", "PASS", true).state).toBe(confirmed.state);
  });
});
