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
