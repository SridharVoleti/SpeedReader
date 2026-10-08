// Server side of the learner experience for approved SR packages (issue #14).
//  * the learner view never contains answer keys
//  * all four item answers are committed in ONE call before any correctness is revealed
//  * the first attempt per learner+package is recorded as independent evidence; later calls are SUPPORTED retries
//  * the free explanation is classified by SR-044 and never fails the learner
//  * weak/failed explanations get the SR-011 news-reader replay and optional retry; nothing blocks progress
//  * a struggled passage joins the SR-002 revisit list, which is never readiness evidence

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { loadApprovedPackage, type LearnerPackage } from "./package-loader";
import { scoreP10, SCORING_RULES } from "../p10-scoring";
import { classifyResponse, type FactMapV, type FactState } from "../semantic-recall";
import { oralFeedbackPlan } from "../mimicry";
import { emptyRevisitState, recordPassageOutcome, revisitCandidates, type RevisitState } from "../revisit";
import type { createStore } from "../pipeline/storage";

type Store = ReturnType<typeof createStore>;

export type LearnerView = { packageId: string; passageId: string; text: string; items: { itemId: string; stem: string; options: string[] }[] };
export type AttemptInput = {
  learnerId: string; packageId: string; answers: number[];
  explanation: { raw: string; corrected: string; asrFailed: boolean; asrConfidence: number };
};
export type LedgerRecord = {
  evidenceId: string; learnerId: string; packageId: string; at: string; firstAttempt: boolean;
  answers: number[]; comprehension: { pass: boolean; correct: number; reason: string };
  explanation: { raw: string; corrected: string; asrFailed: boolean; asrConfidence: number; states: Record<string, FactState> };
};

const STOP = new Set(["the", "and", "that", "with", "from", "this", "then", "were", "have", "been", "into", "about", "their", "there", "when", "what", "which", "for", "his", "her", "was", "are", "but", "not", "had"]);
const contentWords = (t: string) => [...new Set(t.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length >= 4 && !STOP.has(w)))];

/** The package carries meaning units but no approved paraphrase alternates, so the fact map is derived from the units.
 *  A learner using the unit's own wording is credited; partial key-term overlap is routed to review, never penalised. */
export function factMapFromPackage(pkg: LearnerPackage): FactMapV {
  const byFact = new Map<string, string[]>();
  for (const u of pkg.meaningUnits) for (const f of u.factIds) byFact.set(f, [...(byFact.get(f) ?? []), u.text]);
  return {
    mapId: pkg.passageId, version: String(pkg.packageVersion),
    facts: [...byFact.entries()].map(([factId, texts]) => ({
      factId, explicitness: "EXPLICIT" as const,
      proposition: { predicate: texts, keyTerms: contentWords(texts.join(" ")) }
    }))
  };
}

export function learnerView(pkg: LearnerPackage): LearnerView {
  return { packageId: pkg.packageId, passageId: pkg.passageId, text: pkg.text, items: pkg.items.map((i) => ({ itemId: i.itemId, stem: i.stem, options: [...i.options] })) };
}

export function readLedger(file: string): LedgerRecord[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as LedgerRecord);
}
function appendLedger(file: string, rec: LedgerRecord) {
  mkdirSync(dirname(file), { recursive: true });
  appendFileSync(file, JSON.stringify(rec) + "\n", "utf8");
}
export const ledgerPath = (dataDir: string) => join(dataDir, "sr-attempts.jsonl");

export function revisitFor(ledger: readonly LedgerRecord[], learnerId: string): string[] {
  let st: RevisitState = emptyRevisitState();
  for (const r of ledger.filter((x) => x.learnerId === learnerId)) {
    const struggled = !r.comprehension.pass || Object.values(r.explanation.states).some((s) => s === "OMITTED" || s === "CONTRADICTED");
    st = recordPassageOutcome(st, r.packageId, struggled ? "NOT_GREEN" : "GREEN");
  }
  return revisitCandidates(st);
}

export type AttemptError = { ok: false; status: number; error: string };
export type AttemptOk = {
  ok: true; evidenceId: string; firstAttempt: boolean;
  comprehension: { pass: boolean; correct: number; reason: string; items: { itemId: string; correct: boolean; correctIndex: number }[] };
  explanation: { states: Record<string, FactState>; credited: number; total: number; hints: string[]; reviewNeeded: boolean; unclassifiedClauses: string[] };
  feedback: { replay: { offered: boolean; text: string; wpm: number; voice: string }; retryOptional: boolean; blocksProgress: false };
  revisit: string[];
  readiness: { comprehension: "PASS" | "NOT_YET" | "NOT_FIRST_ATTEMPT_EVIDENCE"; oral: "NOT_ASSESSED" };
};

export function submitAttempt(store: Store, dataDir: string, input: AttemptInput): AttemptOk | AttemptError {
  if (!input.learnerId || typeof input.learnerId !== "string") return { ok: false, status: 400, error: "learnerId required" };
  const loaded = loadApprovedPackage(store, input.packageId);
  if (!loaded.ok) return { ok: false, status: 404, error: "package unavailable" };
  const pkg = loaded.pkg;
  if (!Array.isArray(input.answers) || input.answers.length !== pkg.items.length || input.answers.some((a, n) => !Number.isInteger(a) || a < 0 || a >= pkg.items[n].options.length))
    return { ok: false, status: 400, error: `answers must be ${pkg.items.length} option indexes, one per item` };
  const ex = input.explanation;
  if (!ex || typeof ex.corrected !== "string" || !ex.corrected.trim()) return { ok: false, status: 400, error: "an explanation (typed or corrected transcript) is required" };

  const file = ledgerPath(dataDir);
  const ledger = readLedger(file);
  const firstAttempt = !ledger.some((r) => r.learnerId === input.learnerId && r.packageId === pkg.packageId);

  const rule = SCORING_RULES[pkg.ruleId];
  const itemResults = pkg.items.map((i, n) => ({ itemId: i.itemId, correct: input.answers[n] === i.answerIndex, correctIndex: i.answerIndex }));
  const score = scoreP10(pkg.items.map((i, n) => ({ itemId: i.itemId, primary: i.primary, correct: itemResults[n].correct, firstAttempt })), rule);

  const map = factMapFromPackage(pkg);
  const cls = classifyResponse(ex.corrected, map, { asrConfidence: Number.isFinite(ex.asrConfidence) ? ex.asrConfidence : 1, boundVersion: { mapId: map.mapId, version: map.version } });
  const credited = Object.values(cls.states).filter((s) => s === "CREDITED").length;
  const hints = pkg.meaningUnits.filter((u) => u.factIds.some((f) => cls.states[f] === "OMITTED")).map((u) => u.text);
  const reviewNeeded = Object.values(cls.states).some((s) => s === "UNRESOLVED_SEMANTIC" || s === "UNRESOLVED_ASR");

  const weak = credited === 0 || ex.asrFailed;
  const plan = oralFeedbackPlan({ oralResult: weak ? "WEAK" : "STRONG" });

  const rec: LedgerRecord = {
    evidenceId: `EV-${Date.now().toString(36)}-${ledger.length + 1}`, learnerId: input.learnerId, packageId: pkg.packageId, at: new Date().toISOString(), firstAttempt,
    answers: input.answers, comprehension: { pass: score.pass, correct: score.correct, reason: score.reason },
    explanation: { raw: ex.raw ?? "", corrected: ex.corrected, asrFailed: !!ex.asrFailed, asrConfidence: ex.asrConfidence, states: cls.states }
  };
  appendLedger(file, rec);

  return {
    ok: true, evidenceId: rec.evidenceId, firstAttempt,
    comprehension: { pass: score.pass, correct: score.correct, reason: score.reason, items: itemResults },
    explanation: { states: cls.states, credited, total: map.facts.length, hints, reviewNeeded, unclassifiedClauses: cls.unclassifiedClauses },
    feedback: { replay: { offered: plan.offerReplay, text: pkg.bpcText, wpm: plan.replayVoice.wpm, voice: plan.replayVoice.voice }, retryOptional: plan.retryOptional, blocksProgress: plan.blocksProgress },
    revisit: revisitFor([...ledger, rec], input.learnerId),
    readiness: { comprehension: !firstAttempt ? "NOT_FIRST_ATTEMPT_EVIDENCE" : score.pass ? "PASS" : "NOT_YET", oral: "NOT_ASSESSED" }
  };
}
