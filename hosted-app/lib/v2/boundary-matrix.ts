// AC-C06 - Boundary tests [Codex engineering gate]
// The thirteen boundary scenarios the engineering gate requires, each executed against the REAL engine.
// runBoundaryMatrix() returns one PASS/FAIL row per scenario so the gate is visible (unit test + live page).

import { classifyComprehension } from "./comprehension-threshold";
import { scoreComprehension, structuredEvidence } from "./comprehension-score";
import { newCoreWpmState, recordNewPassage, type CoreWpmState } from "./core-wpm";
import { applyNewPassage, newLearnerAggregate, type LearnerAggregate } from "./learner-aggregate";
import { applyAttemptToCore } from "./attempt-types";
import { resolveSpokenEvidence, comprehensionFromOutcome } from "./spoken-evidence";
import { newNewsReaderState, recordNewsReaderAttempt, type NewsReaderState } from "./news-reader";
import { checkCertificationEvidence, type ReadinessForm } from "./readiness-forms";
import type { Classification } from "./comprehension-threshold";

export type BoundaryRow = { id: string; scenario: string; pass: boolean; observed: string };

const G: Classification = "GREEN";
const N: Classification = "NOT_GREEN";

function play(start: number, results: Classification[]): { state: CoreWpmState; events: string[] } {
  let state = newCoreWpmState(start);
  const events: string[] = [];
  for (const r of results) {
    const out = recordNewPassage(state, r);
    state = out.state;
    events.push(out.event);
  }
  return { state, events };
}

const scored = (s: number) => scoreComprehension(structuredEvidence([{ itemId: "q1", score: s }]), { score: s });

function learnerAfter(scores: number[], start = 90, pointer = 1, newsReader?: NewsReaderState): LearnerAggregate {
  let learner: LearnerAggregate = { ...newLearnerAggregate("l", start), canonicalPointer: pointer, ...(newsReader ? { newsReader } : {}) };
  scores.forEach((s, i) => { learner = applyNewPassage(learner, `b${i}`, scored(s)).learner; });
  return learner;
}

export function runBoundaryMatrix(): BoundaryRow[] {
  const rows: BoundaryRow[] = [];
  const row = (id: string, scenario: string, pass: boolean, observed: string) => rows.push({ id, scenario, pass, observed });

  row("B01", "exactly 75%", classifyComprehension(0.75) === "GREEN", classifyComprehension(0.75));
  row("B02", "just below 75%", classifyComprehension(0.7499) === "NOT_GREEN", classifyComprehension(0.7499));

  const four = play(90, [G, G, N, G, G]);
  row("B03", "4/5 GREEN", four.state.wpm === 91 && four.events.at(-1) === "LEVEL_UP", `${four.state.wpm} WPM, ${four.events.at(-1)}`);
  const three = play(90, [G, N, G, N, G]);
  row("B04", "3/5 GREEN", three.state.wpm === 90 && three.events.at(-1) === "HOLD_AFTER_FIVE", `${three.state.wpm} WPM, ${three.events.at(-1)}`);

  const ggg = play(90, [N, N, N, N, N, G, G, G]);
  row("B05", "post-five G-G-G", ggg.state.wpm === 91 && ggg.events.at(-1) === "LEVEL_UP", `${ggg.state.wpm} WPM`);
  const ggnggg = play(90, [N, N, N, N, N, G, G, N, G, G, G]);
  const earlyLevelUp = ggnggg.events.slice(5, 10).includes("LEVEL_UP");
  row("B06", "post-five G-G-N-G-G-G", ggnggg.state.wpm === 91 && !earlyLevelUp && ggnggg.events.at(-1) === "LEVEL_UP", `${ggnggg.state.wpm} WPM, level-up only on the final G=${!earlyLevelUp}`);

  const to150 = play(149, [G, G, G, G, G]);
  row("B07", "current WPM 149 -> 150", to150.state.wpm === 150, `${to150.state.wpm} WPM`);
  const at150 = play(150, [G, G, G, G, G, G, G, G]);
  row("B08", "current WPM 150", at150.state.wpm === 150, `${at150.state.wpm} WPM`);

  const boundary = learnerAfter([0.9, 0.9, 0.9, 0.9, 0.9], 90, 146);
  row("B09", "stamina-boundary passage", boundary.core.wpm === 90 && boundary.canonicalPointer === 151, `${boundary.core.wpm} WPM at pointer ${boundary.canonicalPointer}`);

  let withPractice = newCoreWpmState(90);
  const mixed: Array<["NEW_PROGRESSION" | "FAMILIAR_PRACTICE", Classification]> = [["NEW_PROGRESSION", G], ["FAMILIAR_PRACTICE", G], ["NEW_PROGRESSION", G], ["FAMILIAR_PRACTICE", G], ["NEW_PROGRESSION", G], ["FAMILIAR_PRACTICE", G], ["NEW_PROGRESSION", G]];
  mixed.forEach(([attemptType, classification], i) => { withPractice = applyAttemptToCore(withPractice, { attemptId: `m${i}`, attemptType, classification }).state; });
  row("B10", "familiar practice inserted between new attempts", withPractice.wpm === 90 && withPractice.newAttempts.length === 4, `${withPractice.wpm} WPM, ${withPractice.newAttempts.length} new attempts`);

  const meta = { passageId: "p", ideas: [{ ideaId: "i1", role: "KEY_EVENT" as const, wordings: [["kite"]] }] };
  const unresolved = resolveSpokenEvidence("garbled", { usable: true, confidence: 0.1, speechDetected: true }, meta);
  const unresolvedComprehension = comprehensionFromOutcome(structuredEvidence([{ itemId: "q", score: 1 }]), unresolved);
  const asrLearner = applyNewPassage(newLearnerAggregate("l", 90), "asr", unresolvedComprehension);
  row("B11", "ASR unresolved", unresolvedComprehension.status === "AWAITING_SPOKEN_EVIDENCE" && asrLearner.learner.core.newAttempts.length === 0 && asrLearner.learner.canonicalPointer === 1, `${unresolvedComprehension.status}, evidence ${asrLearner.learner.core.newAttempts.length}`);

  const nr = (id: string, clarity: number | null) => recordNewsReaderAttempt(newNewsReaderState(), {
    attemptId: id, passageId: "P1", readNumber: 1, metrics: clarity === null ? {} : { clarity }, technicalState: clarity === null ? "MIC_UNAVAILABLE" : "OK", recordedAt: "2026-10-03T10:00:00Z"
  });
  const seq = [0.9, 0.9, 0.5, 0.9, 0.9];
  const ref = learnerAfter(seq).core;
  const variants = [newNewsReaderState(), nr("low", 0), nr("high", 1), nr("mic", null)];
  const stable = variants.every((v) => JSON.stringify(learnerAfter(seq, 90, 1, v).core) === JSON.stringify(ref));
  row("B12", "News Reader missing/low/high", stable, `core identical across ${variants.length} News Reader states=${stable}`);

  const form: ReadinessForm = { formId: "RS03-A", version: "1.0", rsId: "RS03", equivalenceGroupId: "g1", source: "PRE_GENERATED", qaApproved: true, independentQaReviewerId: "qa", authorId: "au" };
  const mismatch = checkCertificationEvidence({ formId: "RS03-A", version: "0.9" }, [form]);
  row("B13", "reassessment form version mismatch", !mismatch.ok && mismatch.reason.startsWith("FORM_VERSION_MISMATCH"), mismatch.ok ? "accepted" : mismatch.reason.split(":")[0]);

  return rows;
}
