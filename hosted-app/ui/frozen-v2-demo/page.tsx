"use client";

// Live-verification page for the v2.0 Final Frozen Requirements. Each implemented FR adds one
// entry below that runs the real module and renders its observable result, so the deployed
// site can be checked end to end (see hosted-app/tests/ui/frozen-v2.spec.ts).

import { startingWorld, WORLDS } from "../../lib/v2/worlds";
import { worldStrategies } from "../../lib/v2/world-strategies";
import { first150Architecture, validateWorld1Catalog, WORLD1_PASSAGE_COUNT } from "../../lib/v2/catalog";
import { foundationSpec, presentationChunks, validateFoundationPassageText } from "../../lib/v2/foundation";
import { passageWords, staircaseTable } from "../../lib/v2/stamina";
import { planNextPassage } from "../../lib/v2/stamina-transition";
import { evaluateStaminaTransitions, STAMINA_TRANSITIONS, SUPERSEDED_RULES } from "../../lib/v2/ac53r";
import { runAssessment } from "../../lib/v2/initial-assessment";
import { assertPersonalOnly, personalImprovement } from "../../lib/v2/personal-trajectory";
import { clampToCeiling, developmentContinuesAtCeiling, isSchedulableWpm, WORLD1_MAX_WPM } from "../../lib/v2/speed-ceiling";
import { dimensionCelebration, levelUpAchievement, levelUpCount, levelUpsForWpmChange } from "../../lib/v2/level-semantics";
import { toGateEvidence } from "../../lib/v2/gate-evidence";
import { classifyComprehension, greenCount, GREEN_THRESHOLD } from "../../lib/v2/comprehension-threshold";
import { evaluateFirstFive } from "../../lib/v2/first-five";
import { newCoreWpmState, recordNewPassage, type CoreWpmState } from "../../lib/v2/core-wpm";
import { CORE_PROGRESSION_OUTCOMES, SUPERSEDED_DECREMENT_RULES } from "../../lib/v2/no-decrement";
import { applyAttemptToCore, newCoreWpmState as newCoreState, type AttemptType } from "../../lib/v2/attempt-types";
import { recordPracticeAttempt, selectFamiliarPassage, type LearnerRecord } from "../../lib/v2/familiar-practice";
import { ALL_INTERNAL_STATES, learnerCopyFor, learnerLanguageViolations } from "../../lib/v2/learner-language";
import { scoreComprehension, structuredEvidence } from "../../lib/v2/comprehension-score";
import { greenThresholdForCalibration, validateCalibration } from "../../lib/v2/calibration-lifecycle";
import { alignItem, P_LEVEL_QUESTION_TYPES, questionTypeForPLevel, scoreAlignedItems } from "../../lib/v2/question-alignment";
import type { AssessmentItem } from "../../lib/item-types";
import { evaluateSpokenExpression, type SpokenPassageMeta } from "../../lib/v2/spoken-expression";
import { comprehensionFromOutcome, resolveSpokenEvidence, technicalRecoveryAction } from "../../lib/v2/spoken-evidence";
import { bestComprehensionFor, lockScoring, newBpcAttempt, submitAttempt } from "../../lib/v2/best-comprehension";
import { lintBpcStyle } from "../../lib/v2/bpc-style";
import { checkBpcFidelity } from "../../lib/v2/bpc-fidelity";
import { EXPRESSION_FOCUS_BY_WORLD, expressionFocusFor, permanentFeaturesFor } from "../../lib/v2/expression-by-world";
import { assertNoInternalLeak, buildLearnerFeedback } from "../../lib/v2/learner-feedback";
import { completeNewPassage } from "../../lib/v2/passage-completion";
import { CELEBRATION_RANK } from "../../lib/v2/learner-feedback";
import { bookTimeImpact, formatDuration } from "../../lib/v2/book-time";
import { NEWS_READER_PURPOSES, newNewsReaderState, newsReaderGatesCoreProgression, recordNewsReaderAttempt } from "../../lib/v2/news-reader";
import { applyNewPassage, newLearnerAggregate } from "../../lib/v2/learner-aggregate";
import { assertComprehensionEvidence, comprehensionEvidenceForPassage, emptyEvidenceStore, oralEvidenceForPassage, recordCoreEvidence, recordNewsReaderEvidence } from "../../lib/v2/evidence-store";
import { REFERENCE_QUALITIES, resolveReferenceAudio, resolveReferenceDelivery, type Platform, type ReferenceAudio } from "../../lib/v2/reference-audio";
import { twoReadCoaching } from "../../lib/v2/news-reader-coaching";
import { CORE_WPM_GATES, SUPERSESSION_REGISTER, assertNoOralGate, supersededRuleFor } from "../../lib/v2/supersession";
import { world1Status } from "../../lib/v2/world1-completion";
import { RS_IDS } from "../../lib/world1-framework";
import { ceilingIsCompletionRequirement } from "../../lib/v2/speed-ceiling";
import { missingReadiness } from "../../lib/v2/world1-completion";
import { advanceFromWorld1 } from "../../lib/v2/world1-completion";
import { checkCertificationEvidence, selectEquivalentForm, type ReadinessForm } from "../../lib/v2/readiness-forms";
import { RECENCY_POLICY_V1, applyRecency, evidenceRecency } from "../../lib/v2/evidence-recency";
import { LIFECYCLE_STATES, THRESHOLD_REGISTRY, changeThreshold, transitionThreshold } from "../../lib/v2/threshold-lifecycle";
import { recordNewProgressionAttempt, validateAttemptRecord } from "../../lib/v2/attempt-record";
import { ATTEMPT_TYPES } from "../../lib/v2/attempt-types";
import { assertResponseEditable, correctAttempt, effectiveAttempts, isSilentFailureRecord } from "../../lib/v2/evidence-governance";
import { explainFromLedger, lastDecision } from "../../lib/v2/explainability";
import { SCAN_ALLOWLIST, STALE_RULE_PATTERNS, scanForStaleRules } from "../../lib/v2/stale-rules";
import { ProgressStore } from "../../lib/v2/progress-store";
import { LearnerAggregate } from "../../lib/v2/learner-aggregate";
import { COMPLIANT_SNIPPETS, STALE_SNIPPETS } from "../../lib/v2/stale-rules-fixtures";
import { OPS_EVENT_KINDS, OpsLog, contentDefectEvent, learnerVisibleOps, opsEventsForAttempt } from "../../lib/v2/ops-log";
import { runBoundaryMatrix } from "../../lib/v2/boundary-matrix";
import styles from "../page.module.css";

type Check = { id: string; title: string; result: string };

const checks: Check[] = [
  {
    id: "FR-001",
    title: "Five content-difficulty Worlds",
    result: `${WORLDS.map((w) => `${w.id}:${w.difficulty}`).join(" | ")}; every learner starts in World ${startingWorld({ age: 7 }).id}`
  },
  {
    id: "FR-002",
    title: "World 2+ strategy direction",
    result: [2, 3, 4, 5].map((id) => `W${id}=${worldStrategies(id).join("+")}`).join(" | ")
  },
  {
    id: "FR-003",
    title: "1,500 canonical passages",
    result: `${WORLD1_PASSAGE_COUNT} sequential passages, ${validateWorld1Catalog(Array.from({ length: WORLD1_PASSAGE_COUNT }, (_, i) => ({ sequence: i + 1 }))).length} structural errors; first 150 = ${new Set(first150Architecture().map((c) => c.rsId)).size} RS x ${new Set(first150Architecture().map((c) => c.pLevel)).size} P`
  },
  {
    id: "FR-004",
    title: "First 150 passages",
    result: (() => {
      const sample = Array.from({ length: 100 }, (_, i) => `w${i}`).join(" ");
      const spec = foundationSpec(150);
      return `P150 = ${spec.words} words, ${spec.display}, ${spec.coordinate.rsId}/P${spec.coordinate.pLevel}; sample text errors ${validateFoundationPassageText(sample).length}; ${presentationChunks(sample).length} single-word steps`;
    })()
  },
  {
    id: "FR-005",
    title: "Stamina staircase",
    result: `P1=${passageWords(1)} P151=${passageWords(151)} P176=${passageWords(176)} P226=${passageWords(226)} P376=${passageWords(376)} P1500=${passageWords(1500)}; ${staircaseTable().length} steps`
  },
  {
    id: "FR-006",
    title: "Stamina transition precedence",
    result: (() => {
      const boundary = planNextPassage({ completedSequence: 150, currentWpm: 90, levelUpEligible: true });
      const normal = planNextPassage({ completedSequence: 160, currentWpm: 90, levelUpEligible: true });
      return `P151 at ${boundary.nextWords}w ${boundary.nextWpm}WPM (level-up deferred=${boundary.levelUpDeferred}); P161 at ${normal.nextWords}w ${normal.nextWpm}WPM (level-up applied=${normal.levelUpApplied})`;
    })()
  },
  {
    id: "FR-007",
    title: "AC-53R progressive stamina-transition validity",
    result: (() => {
      const limits = { maxComprehensionDrop: 0.1, maxCompletionBurdenIncrease: 0.15, maxConfidenceDrop: 0.1, maxEngagementDrop: 0.1 };
      const sample = STAMINA_TRANSITIONS.map(([from, to]) => ({
        from, to, learners: 30, comprehensionDrop: 0.02, completionBurdenIncrease: 0.03, confidenceDrop: 0.01, engagementDrop: 0.02
      }));
      return `${STAMINA_TRANSITIONS.length} transitions; sample ${evaluateStaminaTransitions(sample, limits).status}; no data ${evaluateStaminaTransitions([], limits).status}; AC-53 superseded=${"AC-53" in SUPERSEDED_RULES}`;
    })()
  },
  {
    id: "FR-008",
    title: "Ten-minute initial assessment",
    result: (() => {
      const run = (limit: number) =>
        runAssessment((wpm) => ({ wpm, comprehensionScore: wpm <= limit ? 0.9 : 0.4, durationSec: 40 }));
      const a = run(95);
      const b = run(45);
      return `limit 95 -> start ${a.startingWpm} WPM in ${a.attempts.length} attempts; limit 45 -> start ${b.startingWpm} WPM; budget 600s`;
    })()
  },
  {
    id: "FR-009",
    title: "Personal trajectory",
    result: (() => {
      const pts = (...w: number[]) => w.map((wpm, i) => ({ attemptId: `a${i}`, wpm, valid: true }));
      const a = personalImprovement(pts(40, 41, 42));
      const b = personalImprovement(pts(110, 111, 113));
      let rejected = false;
      try { assertPersonalOnly({ peerRank: 3 }); } catch { rejected = true; }
      return `learner A ${a.startWpm}->${a.currentWpm} (+${a.gainWpm}); learner B ${b.startWpm}->${b.currentWpm} (+${b.gainWpm}); peer comparison rejected=${rejected}`;
    })()
  },
  {
    id: "FR-010",
    title: "World 1 speed ceiling",
    result: `max ${WORLD1_MAX_WPM} WPM; 151 schedulable=${isSchedulableWpm(151)}; clamp(180)=${clampToCeiling(180)}; at 150 other development continues=${developmentContinuesAtCeiling(150).otherDevelopmentContinues}`
  },
  {
    id: "FR-011",
    title: "Level semantics",
    result: `+1 WPM = ${levelUpsForWpmChange(90, 91)} Level Up; 60->75 WPM = ${levelUpCount(60, 75)} Level Ups; "${levelUpAchievement().kind === "LEVEL_UP" ? "You Levelled Up!" : ""}"; stamina celebration numbered=${dimensionCelebration("stamina").numbered}`
  },
  {
    id: "FR-012",
    title: "Comprehension is the only WPM gate",
    result: (() => {
      const clean = toGateEvidence({ attemptId: "a", wpm: 90, comprehensionScore: 0.8 });
      const noisy = toGateEvidence({ attemptId: "a", wpm: 90, comprehensionScore: 0.8, oralQuality: 0, newsReaderScore: 0, pronunciation: 0, confidence: 0 });
      return `oral/news/pronunciation/confidence at 0 -> same gate evidence: ${JSON.stringify(clean) === JSON.stringify(noisy)}; gate sees ${Object.keys(noisy).length} fields`;
    })()
  },
  {
    id: "FR-013",
    title: "Passage GREEN threshold",
    result: `threshold ${GREEN_THRESHOLD * 100}%; 75%=${classifyComprehension(0.75)}; 74.99%=${classifyComprehension(0.7499)}; [100,100,74,60,70] GREEN count=${greenCount([1, 1, 0.74, 0.6, 0.7])} (average ignored)`
  },
  {
    id: "FR-014",
    title: "First-five rule",
    result: (() => {
      const show = (p: ("GREEN" | "NOT_GREEN")[]) => `${p.filter((c) => c === "GREEN").length}/5=${evaluateFirstFive(p).decision}`;
      const G = "GREEN" as const;
      const N = "NOT_GREEN" as const;
      return [show([G, G, G, G, G]), show([G, G, N, G, G]), show([G, N, G, N, G]), show([N, N, G, N, N]), show([N, N, N, N, N])].join(" ");
    })()
  },
  {
    id: "FR-015",
    title: "Post-five rule",
    result: (() => {
      const run = (seq: string) => {
        let state: CoreWpmState = newCoreWpmState(90);
        for (const c of seq) state = recordNewPassage(state, c === "G" ? "GREEN" : "NOT_GREEN").state;
        return state.wpm;
      };
      return `NNNNN+GGG -> ${run("NNNNNGGG")} WPM; NNNNN+GGNGG -> ${run("NNNNNGGNGG")} WPM (streak reset); NNNGGG -> ${run("NNNGGG")} WPM`;
    })()
  },
  {
    id: "FR-016",
    title: "Earned WPM is never removed",
    result: (() => {
      let state: CoreWpmState = newCoreWpmState(90);
      for (let i = 0; i < 12; i += 1) state = recordNewPassage(state, "NOT_GREEN").state;
      return `12 NOT_GREEN passages from 90 WPM -> ${state.wpm} WPM; outcomes ${CORE_PROGRESSION_OUTCOMES.join("/")}; ${Object.keys(SUPERSEDED_DECREMENT_RULES).length} decrement rules superseded`;
    })()
  },
  {
    id: "FR-017",
    title: "New passages prove progress; earlier passages practise progress",
    result: (() => {
      const run = (types: AttemptType[]) => {
        let state = newCoreState(90);
        types.forEach((attemptType, i) => {
          state = applyAttemptToCore(state, { attemptId: `a${i}`, attemptType, classification: "GREEN" }).state;
        });
        return state.wpm;
      };
      const practice = Array<AttemptType>(50).fill("FAMILIAR_PRACTICE");
      const four = Array<AttemptType>(4).fill("NEW_PROGRESSION");
      return `50 GREEN practice -> ${run(practice)} WPM; 4 new + 3 practice -> ${run([...four, "FAMILIAR_PRACTICE", "FAMILIAR_PRACTICE", "FAMILIAR_PRACTICE"])} WPM; 5 new -> ${run([...four, "NEW_PROGRESSION"])} WPM`;
    })()
  },
  {
    id: "FR-018",
    title: "familiar practice at current WPM, pointer unchanged",
    result: (() => {
      const completed = [1, 2, 3].map((n) => ({ sequence: n, passageId: `P00${n}`, originalScore: 0.9, completedAt: "2026-10-01T10:00:00Z" }));
      const serve = selectFamiliarPassage(completed, 97)!;
      let stalled: CoreWpmState = newCoreWpmState(97);
      for (let i = 0; i < 6; i += 1) stalled = recordNewPassage(stalled, "NOT_GREEN").state;
      let rec: LearnerRecord = { core: stalled, canonicalPointer: 4, originalAttempts: { P001: { score: 0.9 }, P002: { score: 0.9 }, P003: { score: 0.9 } }, practiceAnalytics: [] };
      for (let i = 0; i < 5; i += 1) rec = recordPracticeAttempt(rec, { attemptId: `p${i}`, passageId: serve.passageId, wpm: serve.wpm, classification: "GREEN" });
      return `serve ${serve.passageId} at ${serve.wpm} WPM as ${serve.attemptType}; after 5 practice: pointer ${rec.canonicalPointer}, WPM ${rec.core.wpm}, ${rec.practiceAnalytics.length} analytics rows`;
    })()
  },
  {
    id: "FR-019",
    title: "support is invisible to the learner",
    result: (() => {
      const shown = ["FAMILIAR_PRACTICE_ACTIVE", "HOLD_AFTER_FIVE", "NOT_GREEN"] as const;
      const copy = shown.map((s) => learnerCopyFor(s));
      const violations = copy.flatMap((c) => learnerLanguageViolations(c));
      return `${ALL_INTERNAL_STATES.length} internal states -> learner copy; violations in shown copy: ${violations.length}; "struggling" flagged=${learnerLanguageViolations("struggling").length > 0}`;
    })()
  },
  {
    id: "FR-020",
    title: "hybrid comprehension evidence",
    result: (() => {
      const r = scoreComprehension(structuredEvidence([1, 1, 0, 1].map((score, i) => ({ itemId: `q${i + 1}`, score }))), { score: 0.8 });
      const pending = scoreComprehension(structuredEvidence([{ itemId: "q1", score: 1 }]), null);
      if (r.status !== "SCORED") return "unscored";
      return `structured ${r.structured.items.length} items stored separately from spoken; weights ${r.weights.structured}/${r.weights.spoken} (${r.calibrationVersion}); one result; without spoken: ${pending.status}`;
    })()
  },
  {
    id: "FR-021",
    title: "weighting lifecycle",
    result: (() => {
      const cfg = (structured: number, spoken: number) => ({ version: "demo", status: "PROVISIONAL_PILOT" as const, comprehensionWeights: { structured, spoken } });
      const verdict = (s: number, p: number) => (validateCalibration(cfg(s, p)).length === 0 ? "ok" : "rejected");
      return `70/30 ${verdict(0.7, 0.3)}; 65/35 ${verdict(0.65, 0.35)}; 50/50 ${verdict(0.5, 0.5)}; 100/0 ${verdict(1, 0)}; GREEN threshold stays ${greenThresholdForCalibration("any") * 100}%`;
    })()
  },
  {
    id: "FR-022",
    title: "structured questions aligned to P1-P10",
    result: (() => {
      const item = (id: string) => ({
        itemId: id, itemType: "single_choice", constructId: "detail", mandatory: true, prompt: "Q?",
        options: [{ id: "a", label: "A" }, { id: "b", label: "B" }], correctOptionId: "a"
      }) as AssessmentItem;
      const aligned = [alignItem(1, item("q1")), alignItem(7, item("q2"))];
      const responses = { q1: { type: "single_choice", selectedOptionId: "a" }, q2: { type: "single_choice", selectedOptionId: "b" } };
      const out = scoreAlignedItems(aligned, responses);
      const again = scoreAlignedItems(aligned, responses);
      return `${P_LEVEL_QUESTION_TYPES.length} types P1=${questionTypeForPLevel(1)} P10=${questionTypeForPLevel(10)}; items ${out.records.map((r) => `${r.itemId}:${r.questionType}=${r.points}`).join(",")}; deterministic=${JSON.stringify(out) === JSON.stringify(again)}`;
    })()
  },
  {
    id: "FR-023",
    title: "spoken expression rewards meaning, not vocabulary or accent",
    result: (() => {
      const meta: SpokenPassageMeta = {
        passageId: "demo",
        ideas: [
          { ideaId: "i1", role: "KEY_EVENT", wordings: [["mia", "lost", "kite"], ["kite", "flew", "away"]] },
          { ideaId: "i2", role: "CAUSE_EFFECT", wordings: [["wind", "kite"], ["wind", "blew"]] },
          { ideaId: "i3", role: "MOTIVATION", wordings: [["mia", "sad"], ["mia", "cry"]] },
          { ideaId: "i4", role: "KEY_EVENT", wordings: [["sam", "help"], ["brother", "help"]] },
          { ideaId: "i5", role: "DETAIL", wordings: [["hill"]] },
          { ideaId: "i6", role: "KEY_EVENT", wordings: [["found", "kite", "tree"], ["kite", "tree"]] }
        ]
      };
      const plain = evaluateSpokenExpression("Mia lost her kite because the wind blew it away. She felt sad. Then her brother Sam helped her. They went up the hill and found the kite in a tree.", meta);
      const fancy = evaluateSpokenExpression("Notwithstanding turbulence, Mia lost her kite because the wind blew it away. She felt sad. Then her brother Sam helped her. They ascended the magnificent hill and found the kite in a tree.", meta);
      const dialect = evaluateSpokenExpression("Mia she lost her kite cos the wind blew it away. Mia feel sad. Then her brother Sam he help her. They go up hill and find kite in tree.", meta);
      const unrelated = evaluateSpokenExpression("I like pizza and my dog is big and brown today.", meta);
      return `retelling covers ${plain.matchedIdeaIds.length}/6 ideas (strong=${plain.score > 0.85}); fancy vocabulary adds nothing=${fancy.score <= plain.score + 1e-9}; dialect keeps coverage=${dialect.evidenceCoverage === plain.evidenceCoverage}; unrelated covers ${unrelated.matchedIdeaIds.length}/6`;
    })()
  },
  {
    id: "FR-024",
    title: "ASR uncertainty is never learner error",
    result: (() => {
      const meta: SpokenPassageMeta = { passageId: "d", ideas: [{ ideaId: "i1", role: "KEY_EVENT", wordings: [["mia", "lost", "kite"]] }] };
      const structured = structuredEvidence([{ itemId: "q1", score: 1 }]);
      const low = resolveSpokenEvidence("garbled", { usable: true, confidence: 0.2, speechDetected: true }, meta);
      const silent = resolveSpokenEvidence("", { usable: true, confidence: 0.9, speechDetected: false }, meta);
      const outcome = comprehensionFromOutcome(structured, low);
      return `low confidence -> ${low.status} (${low.status === "UNRESOLVED_TECHNICAL" ? low.audit.reason : ""}); silence -> ${silent.status === "UNRESOLVED_TECHNICAL" ? silent.audit.reason : silent.status}; comprehension ${outcome.status}, classification ${outcome.classification}; retries 0/1/2 -> ${[0, 1, 2].map((n) => technicalRecoveryAction(n)).join("/")}`;
    })()
  },
  {
    id: "FR-025",
    title: "Best Possible Comprehension only after scoring",
    result: (() => {
      const catalog = [{ passageId: "P001", text: "Mia lost her kite ...", qaApproved: true, version: "bpc-1" }];
      const a0 = newBpcAttempt("a1", "P001");
      const a1 = submitAttempt(a0);
      const states = [a0, a1].map((a) => { const r = bestComprehensionFor(a, catalog); return r.available ? "available" : r.reason; });
      const greenOut = bestComprehensionFor(lockScoring(a1, { score: 0.9, classification: "GREEN" }), catalog).available;
      const notGreenOut = bestComprehensionFor(lockScoring(a1, { score: 0.4, classification: "NOT_GREEN" }), catalog).available;
      return `before submit ${states[0]}; after submit ${states[1]}; locked GREEN available=${greenOut}; locked NOT_GREEN available=${notGreenOut}`;
    })()
  },
  {
    id: "FR-026",
    title: "BPC is a story-style explanation",
    result: (() => {
      const passageText = "Mia flew her red kite on a windy day. The wind pulled the string from her hand. The kite flew over the hill. Mia felt sad and sat down. Her brother Sam saw her and came to help. They climbed the hill together. They found the kite in a tree.";
      const source = { passageText, questionAnswers: ["The wind pulled the kite away", "Sam helped her", "The kite was in a tree"] };
      const story = "Mia was flying her kite when the wind pulled it out of her hand, so the kite floated away over the hill. Mia felt sad, so she sat down. Then her brother Sam saw her and came to help. Together they climbed the hill, and they found the kite in a tree. This shows that things got better for Mia when Sam helped her.";
      return `story-style explanation findings: ${lintBpcStyle(story, source).length}; passage copied back: ${lintBpcStyle(passageText, source).includes("SENTENCE_BY_SENTENCE_COPY") ? "rejected" : "accepted"}; answer key: ${lintBpcStyle("1. The wind pulled the kite away.\n2. Sam helped her.", source).includes("ANSWER_KEY_FORM") ? "rejected" : "accepted"}`;
    })()
  },
  {
    id: "FR-027",
    title: "BPC never invents unsupported content",
    result: (() => {
      const passageText = "Mia flew her red kite on a windy day. The wind pulled the string from her hand. The kite flew over the hill. Mia felt sad and sat down. Her brother Sam saw her and came to help. They climbed the hill together. They found the kite in a tree.";
      const faithful = "Mia was flying her kite when the wind pulled it out of her hand, so the kite floated away over the hill. Mia felt sad, so she sat down. Then her brother Sam saw her and came to help. Together they climbed the hill, and they found the kite in a tree. This shows that things got better for Mia when Sam helped her.";
      const ok = checkBpcFidelity(faithful, { passageText, qaAllowedExtras: ["flying", "floated", "helped"] });
      const motive = checkBpcFidelity("Mia felt sad because she loved that kite.", { passageText });
      const fact = checkBpcFidelity("Sam brought a ladder and a dog yesterday.", { passageText });
      return `faithful explanation supported=${ok.supported}; invented motive flagged: ${motive.inventionCues.join(",")}; invented facts flagged: ${fact.unsupportedTerms.join(",")}`;
    })()
  },
  {
    id: "FR-028",
    title: "expression and BPC are permanent across Worlds",
    result: `both features active in ${WORLDS.filter((w) => permanentFeaturesFor(w.id).bestPossibleComprehension && permanentFeaturesFor(w.id).comprehensionExpression).length}/5 Worlds; sophistication ${EXPRESSION_FOCUS_BY_WORLD.map((f) => f.sophistication).join("<")}; W1 focus: ${expressionFocusFor(1).expectation.length} expectations; W4 includes ${expressionFocusFor(4).expectation[0]}`
  },
  {
    id: "FR-029",
    title: "numeric comprehension is private",
    result: (() => {
      const rows: { attemptId: string; score: number | null; classification: "GREEN" | "NOT_GREEN" | null }[] = [
        { attemptId: "a1", score: 0.75, classification: "GREEN" },
        { attemptId: "a2", score: 0.7499, classification: "NOT_GREEN" },
        { attemptId: "a3", score: null, classification: null }
      ];
      const shown = rows.map((r) => JSON.stringify(buildLearnerFeedback(r)));
      const leaks = shown.filter((t) => /GREEN|PASS|FAIL|%|\d/.test(t)).length;
      let guard = false;
      try { assertNoInternalLeak({ score: 0.8 }); } catch { guard = true; }
      return `${rows.length} passages shown to learner with ${leaks} numeric/state leaks; internal score kept (${rows[0].score}); leak guard trips on score=${guard}`;
    })()
  },
  {
    id: "FR-030",
    title: ">=75% is a celebration",
    result: (() => {
      const scored = (s: number) => scoreComprehension(structuredEvidence([{ itemId: "q1", score: s }]), { score: s });
      let core = newCoreWpmState(90);
      let last = completeNewPassage("a0", scored(0.8), core);
      core = last.coreAfter;
      for (let i = 1; i < 5; i += 1) { last = completeNewPassage(`a${i}`, scored(0.8), core); core = last.coreAfter; }
      const single = completeNewPassage("b1", scored(0.75), newCoreWpmState(90));
      return `GREEN stored as ${single.record.classification} with exact score kept=${single.record.score !== null}; celebration ${single.learner.celebration}; BPC offered=${single.learner.showBestPossibleComprehension}; message mentions number=${/\d|%/.test(single.learner.message)}; five GREEN -> ${core.wpm} WPM (${last.coreEvent})`;
    })()
  },
  {
    id: "FR-031",
    title: "below 75% remains positive",
    result: (() => {
      const scored = (s: number) => scoreComprehension(structuredEvidence([{ itemId: "q1", score: s }]), { score: s });
      const out = completeNewPassage("c1", scored(0.7499), newCoreWpmState(90));
      let core = newCoreWpmState(90);
      for (let i = 0; i < 8; i += 1) core = completeNewPassage(`n${i}`, scored(0.5), core).coreAfter;
      const text = JSON.stringify(out.learner);
      return `below-75 stored as ${out.record.classification} (exact score kept=${out.record.score !== null}); celebration ${out.learner.celebration}; BPC offered=${out.learner.showBestPossibleComprehension}; digits/failure words shown=${/\d|fail|wrong/i.test(text)}; 8 low passages keep ${core.wpm} WPM`;
    })()
  },
  {
    id: "FR-032",
    title: "Level Up is celebrated more than a GREEN passage",
    result: (() => {
      const scored = (s: number) => scoreComprehension(structuredEvidence([{ itemId: "q1", score: s }]), { score: s });
      let core = newCoreWpmState(90);
      const outs = [];
      for (let i = 0; i < 5; i += 1) { const o = completeNewPassage(`l${i}`, scored(0.9), core); core = o.coreAfter; outs.push(o); }
      const green = outs[0].learner;
      const up = outs[4].learner;
      return `single GREEN celebration ${green.celebration}; Level Up celebration ${up.celebration} ("${up.message}"), new WPM ${up.newWpm}; larger=${CELEBRATION_RANK[up.celebration] > CELEBRATION_RANK[green.celebration]}`;
    })()
  },
  {
    id: "FR-033",
    title: "book-time impact on Level Up",
    result: (() => {
      const i = bookTimeImpact(90, 91, 60);
      const scored = (s: number) => scoreComprehension(structuredEvidence([{ itemId: "q1", score: s }]), { score: s });
      let core = newCoreWpmState(90);
      let last = completeNewPassage("b0", scored(0.9), core, 90);
      core = last.coreAfter;
      for (let k = 1; k < 5; k += 1) { last = completeNewPassage(`b${k}`, scored(0.9), core, 90); core = last.coreAfter; }
      return `${i.previousWpm}->${i.newWpm} WPM: 50,000-word book ${formatDuration(i.estimatedAtNewWpm)}, saves about ${formatDuration(i.savedVsPrevious)}; since baseline about ${formatDuration(i.cumulativeSavedVsBaseline!)}; wording estimated+about=${/estimated/.test(i.message) && /about/.test(i.message)}; shown on Level Up=${last.learner.bookTime !== undefined}`;
    })()
  },
  {
    id: "FR-034",
    title: "News Reader is a separate parallel track",
    result: (() => {
      const core = newCoreWpmState(90);
      let nr = newNewsReaderState();
      for (let i = 0; i < 5; i += 1) {
        nr = recordNewsReaderAttempt(nr, { attemptId: `n${i}`, passageId: "P001", readNumber: 1, metrics: { clarity: 0, pronunciation: 0 }, technicalState: "OK", recordedAt: "2026-10-03T10:00:00Z" });
      }
      const mic = recordNewsReaderAttempt(newNewsReaderState(), { attemptId: "m", passageId: "P001", readNumber: 1, metrics: {}, technicalState: "MIC_UNAVAILABLE", recordedAt: "2026-10-03T10:00:00Z" });
      return `${NEWS_READER_PURPOSES.length} oral purposes; gates core=${newsReaderGatesCoreProgression()}; 5 zero-score News Reader attempts stored (${nr.attempts.length}) and core stays ${core.wpm} WPM with ${core.newAttempts.length} evidence; mic unavailable stored as ${mic.attempts[0].technicalState}`;
    })()
  },
  {
    id: "FR-035",
    title: "News Reader is independent of core progression",
    result: (() => {
      const scored = (s: number) => scoreComprehension(structuredEvidence([{ itemId: "q1", score: s }]), { score: s });
      const oral = (clarity: number) => recordNewsReaderAttempt(newNewsReaderState(), { attemptId: "o", passageId: "P001", readNumber: 1, metrics: { clarity, pronunciation: clarity, confidence: clarity }, technicalState: "OK", recordedAt: "2026-10-03T10:00:00Z" });
      const run = (nr: ReturnType<typeof newNewsReaderState>) => {
        let learner = { ...newLearnerAggregate("l", 90), newsReader: nr };
        for (let i = 0; i < 5; i += 1) learner = applyNewPassage(learner, `a${i}`, scored(0.9)).learner;
        return `${learner.core.wpm}@${learner.canonicalPointer}`;
      };
      const none = run(newNewsReaderState());
      const low = run(oral(0));
      const high = run(oral(1));
      return `five GREEN passages -> WPM@pointer: no News Reader ${none}; worst oral ${low}; best oral ${high}; identical=${none === low && low === high}`;
    })()
  },
  {
    id: "FR-036",
    title: "shared content, separate state",
    result: (() => {
      let store = emptyEvidenceStore();
      store = recordCoreEvidence(store, "P001", { attemptId: "c1", attemptType: "NEW_PROGRESSION", score: 0.9, classification: "GREEN", countedTowardEvidence: true, calibrationVersion: "demo" });
      for (let i = 0; i < 3; i += 1) {
        store = recordNewsReaderEvidence(store, { attemptId: `n${i}`, passageId: "P001", readNumber: 1, metrics: { clarity: 1 }, technicalState: "OK", recordedAt: "2026-10-03T10:00:00Z" });
      }
      let refused = false;
      try { assertComprehensionEvidence({ attemptType: "NEWS_READER" }); } catch { refused = true; }
      return `P001 shared: ${comprehensionEvidenceForPassage(store, "P001").length} comprehension record(s), ${oralEvidenceForPassage(store, "P001").length} oral record(s); oral counted as comprehension: ${comprehensionEvidenceForPassage(store, "P001").length === 1 ? "no" : "yes"}; substitution refused=${refused}`;
    })()
  },
  {
    id: "FR-037",
    title: "reference delivery (pre-generated audio, else TTS at 145 WPM female)",
    result: (() => {
      const qualities = Object.fromEntries(REFERENCE_QUALITIES.map((q) => [q, true])) as ReferenceAudio["qaQualities"];
      const audio: ReferenceAudio = { passageId: "P001", assetId: "ref-P001-v1", url: "https://cdn.example/reference/P001-v1.mp3", version: "v1", sha256: "a".repeat(64), source: "PRE_GENERATED", qaQualities: qualities, qaApproved: true };
      const platforms: Platform[] = ["ios", "android", "web", "desktop"];
      const urls = new Set(platforms.map((p) => { const r = resolveReferenceAudio([audio], "P001", p); return r.ok ? r.audio.url : "none"; }));
      const device = resolveReferenceAudio([{ ...audio, source: "DEVICE_TTS" }], "P001", "ios");
      const interim = platforms.map((p) => resolveReferenceDelivery([], "P001", p));
      const tts = interim.every((d) => d.mode === "TTS" && d.wpm === 145 && d.voiceGender === "female");
      return `${REFERENCE_QUALITIES.length} reference qualities; ${platforms.length} platforms resolve ${urls.size} identical asset; device TTS asset rejected=${!device.ok}; no asset -> TTS 145 WPM female=${tts}`;
    })()
  },
  {
    id: "FR-038",
    title: "oral two-read coaching",
    result: (() => {
      const read = (id: string, readNumber: 1 | 2, clarity: number) => ({ attemptId: id, passageId: "P001", readNumber, metrics: { clarity, pronunciation: clarity }, technicalState: "OK" as const, recordedAt: "2026-10-03T10:00:00Z" });
      const pair = (a: number, b: number) => twoReadCoaching(recordNewsReaderAttempt(recordNewsReaderAttempt(newNewsReaderState(), read("r1", 1, a)), read("r2", 2, b)), "P001");
      const up = pair(0.4, 0.7);
      const down = pair(0.7, 0.4);
      if (up.status !== "COMPLETE" || down.status !== "COMPLETE") return "incomplete";
      return `reads stored independently; delta ${up.meanDelta.toFixed(1)} improved=${up.improved}; lower second read improved=${down.improved}; both framed as practice=${/practice/i.test(up.coaching) && /practice/i.test(down.coaching)}; punishing words=${/worse|wrong|fail/i.test(up.coaching + down.coaching)}`;
    })()
  },
  {
    id: "FR-039",
    title: "oral-as-core-gate is superseded",
    result: (() => {
      const rejected = ["ORAL", "NEWS_READER", "PRONUNCIATION"].filter((gate) => { try { assertNoOralGate(["COMPREHENSION", gate]); return false; } catch { return true; } });
      let comprehensionOnly = true;
      try { assertNoOralGate([...CORE_WPM_GATES]); } catch { comprehensionOnly = false; }
      return `${SUPERSESSION_REGISTER.length} superseded rules recorded; core WPM gates: ${CORE_WPM_GATES.join(",")}; oral gates rejected ${rejected.length}/3; comprehension-only gate list accepted=${comprehensionOnly}; SUP-03 "${supersededRuleFor("SUP-03")?.replacement}"`;
    })()
  },
  {
    id: "FR-040",
    title: "passage 1500 alone does not prove mastery",
    result: (() => {
      const ready = RS_IDS.map((rsId) => ({ rsId, confirmed: true, formId: `form-${rsId}-v1` }));
      const none = world1Status({ canonicalPointer: 1501, readiness: [] });
      const partial = world1Status({ canonicalPointer: 1501, readiness: ready.slice(0, 14) });
      const full = world1Status({ canonicalPointer: 1501, readiness: ready });
      const early = world1Status({ canonicalPointer: 900, readiness: ready });
      return `P1500 done without readiness: ${none.status}; 14/15 ready: ${partial.status} (missing ${partial.status === "SEQUENCE_COMPLETE_READINESS_PENDING" ? partial.missingReadiness.join(",") : ""}); 15/15 ready: ${full.status}; ready but P900: ${early.status}`;
    })()
  },
  {
    id: "FR-041",
    title: "150 WPM is not mandatory",
    result: (() => {
      const ready = RS_IDS.map((rsId) => ({ rsId, confirmed: true, formId: `form-${rsId}-v1` }));
      const at = (earnedWpm: number, readiness = ready, canonicalPointer = 1501) => world1Status({ canonicalPointer, readiness, earnedWpm }).status;
      return `completes at 60 WPM=${at(60)}; at 90 WPM=${at(90)}; at 149 WPM=${at(149)}; at 150 WPM=${at(150)}; 150 WPM but readiness missing=${at(150, [])}; ceiling is a requirement=${ceilingIsCompletionRequirement()}`;
    })()
  },
  {
    id: "FR-042",
    title: "Level Ups do not substitute for readiness",
    result: (() => {
      const scored = (s: number) => scoreComprehension(structuredEvidence([{ itemId: "q1", score: s }]), { score: s });
      let learner = newLearnerAggregate("l1", 60);
      for (let i = 0; i < 60; i += 1) learner = applyNewPassage(learner, `u${i}`, scored(0.95)).learner;
      const levelUps = learner.core.wpm - learner.baselineWpm;
      const verdict = world1Status({ canonicalPointer: 1501, readiness: [], levelUps, earnedWpm: learner.core.wpm });
      return `${levelUps} Level Ups earned (${learner.baselineWpm}->${learner.core.wpm} WPM); readiness missing ${missingReadiness([]).length}/15; World 1 status with ${levelUps} Level Ups but no readiness: ${verdict.status}`;
    })()
  },
  {
    id: "FR-043",
    title: "News Reader does not block World progression",
    result: (() => {
      const ready = RS_IDS.map((rsId) => ({ rsId, confirmed: true, formId: `form-${rsId}-v1` }));
      const show = (mastery: unknown, readiness = ready) => { const r = advanceFromWorld1({ canonicalPointer: 1501, readiness, newsReaderMastery: mastery }); return r.advance ? `advance to World ${r.toWorld}` : `hold (${r.reason})`; };
      return `ready + no News Reader: ${show(undefined)}; ready + worst oral: ${show({ score: 0 })}; ready + mic unavailable: ${show("MIC_UNAVAILABLE")}; not ready + perfect oral: ${show({ score: 1 }, [])}`;
    })()
  },
  {
    id: "FR-044",
    title: "readiness-critical forms are pre-approved",
    result: (() => {
      const form = (over: Partial<ReadinessForm> = {}): ReadinessForm => ({ formId: "RS03-A", version: "1.0", rsId: "RS03", equivalenceGroupId: "RS03-equiv-1", source: "PRE_GENERATED", qaApproved: true, independentQaReviewerId: "qa-1", authorId: "author-1", ...over });
      const catalog = [form(), form({ formId: "RS03-B" })];
      const verdict = (ref: { formId: string; version: string }, cat = catalog) => { const r = checkCertificationEvidence(ref, cat); return r.ok ? "accepted" : r.reason.split(":")[0]; };
      return `approved form: ${verdict({ formId: "RS03-A", version: "1.0" })}; runtime-generated id: ${verdict({ formId: "runtime-gen-1", version: "1.0" })}; version mismatch: ${verdict({ formId: "RS03-A", version: "0.9" })}; unapproved form: ${verdict({ formId: "RS03-A", version: "1.0" }, [form({ qaApproved: false })])}; next unused equivalent after A: ${selectEquivalentForm(catalog, "RS03", ["RS03-A"])?.formId}`;
    })()
  },
  {
    id: "FR-045",
    title: "readiness evidence recency",
    result: (() => {
      const now = "2026-10-03T00:00:00Z";
      const recent = evidenceRecency({ gatheredAt: "2026-09-20T00:00:00Z", sessionsSince: 5 }, now);
      const old = evidenceRecency({ gatheredAt: "2025-01-01T00:00:00Z", sessionsSince: 0 }, now);
      const inactive = evidenceRecency({ gatheredAt: "2026-09-30T00:00:00Z", sessionsSince: 500 }, now);
      const dated = RS_IDS.map((rsId) => ({ rsId, confirmed: true, formId: `form-${rsId}-v1`, gatheredAt: "2026-09-20T00:00:00Z", sessionsSince: 5 }));
      dated[5] = { ...dated[5], gatheredAt: "2025-01-01T00:00:00Z" };
      const after = world1Status({ canonicalPointer: 1501, readiness: applyRecency(dated, now) });
      return `recent evidence current=${recent.current}; 21-month-old current=${old.current}; 500 sessions later current=${inactive.current}; policy ${RECENCY_POLICY_V1.status} v=${recent.policyVersion}; one stale competency -> ${after.status}${after.status === "SEQUENCE_COMPLETE_READINESS_PENDING" ? ` (missing ${after.missingReadiness.join(",")})` : ""}`;
    })()
  },
  {
    id: "FR-046",
    title: "threshold lifecycle governance",
    result: (() => {
      const audit = { changedAt: "2026-11-01", reason: "pilot evidence", changedBy: "calibration-board" };
      const find = (key: string) => THRESHOLD_REGISTRY.find((e) => e.key === key)!;
      const tryIt = (fn: () => unknown) => { try { fn(); return "allowed"; } catch { return "blocked"; } };
      const frozen = THRESHOLD_REGISTRY.filter((e) => e.frozen).length;
      const calibratable = THRESHOLD_REGISTRY.filter((e) => !e.frozen).length;
      return `${LIFECYCLE_STATES.length} states; ${frozen} frozen + ${calibratable} calibratable thresholds; change ASR confidence: ${tryIt(() => changeThreshold(find("asr-min-confidence"), 0.65, audit))}; change 75% GREEN threshold: ${tryIt(() => changeThreshold(find("green-threshold"), 0.6, audit))}; PROVISIONAL->APPROVED directly: ${tryIt(() => transitionThreshold(find("weight-spoken"), "PRODUCTION_APPROVED", audit))}`;
    })()
  },
  {
    id: "FR-047",
    title: "attempt records carry every required field",
    result: (() => {
      const scored = scoreComprehension(structuredEvidence([{ itemId: "q1", score: 0.9 }, { itemId: "q2", score: 0.9 }]), { score: 0.9 });
      let learner = newLearnerAggregate("learner-1", 90);
      let last = recordNewProgressionAttempt(learner, { attemptId: "r0", passageId: "P001", displayedWpm: 90, passageWords: 100, recordedAt: "2026-10-03T10:00:00Z", comprehension: scored });
      learner = last.learner;
      for (let i = 1; i < 5; i += 1) { last = recordNewProgressionAttempt(learner, { attemptId: `r${i}`, passageId: `P00${i + 1}`, displayedWpm: 90, passageWords: 100, recordedAt: "2026-10-03T10:00:00Z", comprehension: scored }); learner = last.learner; }
      const r = last.record;
      const bad = validateAttemptRecord({ ...r, attemptType: "NEWS_READER" });
      return `${learner.ledger.length} frozen records; last: ${r.attemptType} ${r.passageId} @${r.displayedWpm}WPM ${r.passageWords}w, spoken ${r.spokenStatus}, Level-Up ${r.levelUpBefore.wpm}->${r.levelUpAfter.wpm} (${r.levelUpAfter.event}), ${Object.keys(r.ruleVersions).length} rule versions; types ${ATTEMPT_TYPES.length}; News Reader record with comprehension rejected=${bad.length > 0}`;
    })()
  },
  {
    id: "FR-048",
    title: "evidence separation guards",
    result: (() => {
      const scored = scoreComprehension(structuredEvidence([{ itemId: "q1", score: 0.6 }]), { score: 0.6 });
      const pending = scoreComprehension(structuredEvidence([{ itemId: "q1", score: 0 }]), null);
      const base = { passageId: "P001", displayedWpm: 90, passageWords: 100, recordedAt: "2026-10-03T10:00:00Z" };
      const first = recordNewProgressionAttempt(newLearnerAggregate("l", 90), { ...base, attemptId: "a1", comprehension: scored });
      const technical = recordNewProgressionAttempt(newLearnerAggregate("l", 90), { ...base, attemptId: "t1", comprehension: pending, spokenReason: "ASR_UNUSABLE" });
      const locked = lockScoring(submitAttempt(newBpcAttempt("a1", "P001")), { score: 0.6, classification: "NOT_GREEN" });
      let editBlocked = false;
      try { assertResponseEditable(locked); } catch { editBlocked = true; }
      const fixed = { ...first.record, attemptId: "a1-corrected", comprehensionScore: 0.8, classification: "GREEN" as const };
      const corr = correctAttempt(first.learner.ledger, [], "a1", fixed, { correctedAt: "2026-10-04", reason: "scoring defect", correctedBy: "qa-1" });
      const view = effectiveAttempts(first.learner.ledger, corr)[0];
      return `edit after model answer blocked=${editBlocked}; technical retry stored as failure=${isSilentFailureRecord(technical.record)}; original record kept (${first.learner.ledger[0].attemptId} score ${first.learner.ledger[0].comprehensionScore}) while effective view uses ${view.attemptId}; original frozen=${Object.isFrozen(first.record)}`;
    })()
  },
  {
    id: "FR-049",
    title: "Level Up and HOLD decisions are explainable",
    result: (() => {
      const play = (scores: number[]) => {
        let learner = newLearnerAggregate("l", 90);
        scores.forEach((s, i) => {
          learner = recordNewProgressionAttempt(learner, { attemptId: `e${i}`, passageId: `P${i + 1}`, displayedWpm: learner.core.wpm, passageWords: 100, recordedAt: "2026-10-03T10:00:00Z", comprehension: scoreComprehension(structuredEvidence([{ itemId: "q1", score: s }]), { score: s }) }).learner;
        });
        return explainFromLedger(learner.ledger, 90);
      };
      const four = play([0.9, 0.9, 0.5, 0.9, 0.9]);
      const three = play([0.9, 0.5, 0.9, 0.5, 0.9]);
      const post = play([0.5, 0.5, 0.5, 0.5, 0.5, 0.9, 0.9, 0.9]);
      return `${lastDecision(four)?.reason}; ${lastDecision(three)?.reason}; ${lastDecision(post)?.reason}; replay consistent with stored state=${four.consistent && three.consistent && post.consistent}`;
    })()
  },
  {
    id: "AC-C01",
    title: "stale-rule scan",
    result: (() => {
      const stale = STALE_SNIPPETS;
      const detected = stale.filter((code) => scanForStaleRules([{ path: "demo.ts", text: code }]).length > 0).length;
      const compliant = scanForStaleRules([{ path: "demo.ts", text: "const next = Math.min(state.wpm + 1, 150);\nconst wpm = assessment.startingWpm;" }]).length;
      return `${STALE_RULE_PATTERNS.length} stale-rule patterns; detects ${detected}/${stale.length} stale snippets; compliant code findings=${compliant}; allowlisted registry files=${Object.keys(SCAN_ALLOWLIST).length}`;
    })()
  },
  {
    id: "AC-C05",
    title: "Level Up and evidence commit atomically",
    result: (() => {
      const scored = scoreComprehension(structuredEvidence([{ itemId: "q1", score: 0.9 }]), { score: 0.9 });
      const advance = (l: LearnerAggregate, i: number) => recordNewProgressionAttempt(l, { attemptId: `c${i}`, passageId: `P${i + 1}`, displayedWpm: l.core.wpm, passageWords: 100, recordedAt: "2026-10-03T10:00:00Z", comprehension: scored }).learner;
      let before = newLearnerAggregate("l", 90);
      for (let i = 0; i < 4; i += 1) before = advance(before, i);
      const next = advance(before, 4);
      const store = new ProgressStore(before);
      const failed = store.commit(next, (s) => { if (s === "WRITE_WPM") throw new Error("boom"); });
      const afterFail = `${store.snapshot.learner.core.wpm} WPM/${store.snapshot.learner.ledger.length} records/v${store.snapshot.version}`;
      const retried = store.commit(next);
      const forged = new ProgressStore(before).commit({ ...next, core: { ...next.core, wpm: 95 } });
      return `failed mid-commit ok=${failed.ok} -> unchanged ${afterFail}; retry ok=${retried.ok} -> ${store.snapshot.learner.core.wpm} WPM/${store.snapshot.learner.ledger.length} records/v${store.snapshot.version}; WPM/evidence disagreement rejected=${!forged.ok}`;
    })()
  },
  {
    id: "AC-C08",
    title: "operational observability",
    result: (() => {
      const scored = (s: number) => scoreComprehension(structuredEvidence([{ itemId: "q1", score: s }]), { score: s });
      const base = { passageId: "P001", displayedWpm: 90, passageWords: 100, recordedAt: "2026-10-03T10:00:00Z" };
      const low = recordNewProgressionAttempt(newLearnerAggregate("l", 90), { ...base, attemptId: "o1", comprehension: scored(0.5) }).record;
      const tech = recordNewProgressionAttempt(newLearnerAggregate("l", 90), { ...base, attemptId: "o2", comprehension: scoreComprehension(structuredEvidence([{ itemId: "q1", score: 0 }]), null), spokenReason: "ASR_LOW_CONFIDENCE" }).record;
      const log = new OpsLog();
      log.emit(...opsEventsForAttempt(low, true), ...opsEventsForAttempt(tech), contentDefectEvent("P077", "missing approved BPC", "2026-10-03T00:00:00Z"));
      const kinds = [...new Set(log.all().map((e) => e.kind))];
      return `${OPS_EVENT_KINDS.length} ops event kinds; logged: ${kinds.join(",")}; technical retry logged as learner NOT_GREEN=${log.byKind("LEARNER_NOT_GREEN").some((e) => e.attemptId === "o2")}; learner-visible ops events=${learnerVisibleOps(log.all()).length}`;
    })()
  },
  {
    id: "AC-C06",
    title: "boundary matrix",
    result: (() => {
      const rows = runBoundaryMatrix();
      const passed = rows.filter((r) => r.pass).length;
      const failing = rows.filter((r) => !r.pass).map((r) => r.id).join(",");
      return `boundary matrix ${passed}/${rows.length} PASS${failing ? ` (failing ${failing})` : ""}; B03 ${rows[2].observed}; B09 ${rows[8].observed}; B11 ${rows[10].observed}; B13 ${rows[12].observed}`;
    })()
  },
  {
    id: "AC-C03",
    title: "separate state",
    result: (() => {
      const learner = newLearnerAggregate("l", 90);
      const keys = Object.keys(learner).sort();
      const generic = keys.filter((k) => /^(score|level|status|state|rating|result)$/i.test(k)).length;
      return `aggregate domains: ${keys.join(",")}; generic score/level/status fields=${generic}; News Reader state separate from core WPM state=${learner.newsReader !== (learner.core as unknown)}`;
    })()
  }
];

export default function FrozenV2Demo() {
  return (
    <main className={styles.shell}>
      <h1>Frozen requirements v2.0 - live checks</h1>
      <ul>
        {checks.map((c) => (
          <li key={c.id} data-testid={`check-${c.id}`}>
            <strong>{c.id}</strong> {c.title}: <span data-testid={`result-${c.id}`}>{c.result}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
