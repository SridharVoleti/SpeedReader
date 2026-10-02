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
