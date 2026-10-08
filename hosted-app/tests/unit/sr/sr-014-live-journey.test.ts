import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { seedApprovedPackage, REAL_PACKAGE_ID } from "../../fixtures/real-package";
import { loadApprovedPackage } from "../../../lib/sr/runtime/package-loader";
import { learnerView, submitAttempt, ledgerPath, readLedger, factMapFromPackage } from "../../../lib/sr/runtime/attempt-service";
import {
  createExplainSession, receiveAsr, receiveAsrError, editText, submitExplanation, submissionPayload
} from "../../../lib/sr/runtime/explain-session";

// Issue #14: the learner journey, driven against a REAL approved package on disk.
let base: string;
let seeded: ReturnType<typeof seedApprovedPackage>;
const data = () => join(base, "data");
const pkgOf = () => {
  const l = loadApprovedPackage(seeded.store, REAL_PACKAGE_ID);
  if (!l.ok) throw new Error(l.errors.join());
  return l.pkg;
};
const ALL_RIGHT = [0, 0, 0, 0];
const good = { raw: "", corrected: "Ravi returned the extra coins", asrFailed: false, asrConfidence: 1 };
const attempt = (over: Partial<Parameters<typeof submitAttempt>[2]> = {}) =>
  submitAttempt(seeded.store, data(), { learnerId: "L1", packageId: REAL_PACKAGE_ID, answers: ALL_RIGHT, explanation: good, ...over });

beforeEach(() => { base = mkdtempSync(join(tmpdir(), "sr-live-")); seeded = seedApprovedPackage(base); });
afterEach(() => rmSync(base, { recursive: true, force: true, maxRetries: 3 }));

describe("SR-009 / SR-008 session: speech, typed fallback, editable transcript", () => {
  const supported = { stt: true, tts: true, sttApi: "webkitSpeechRecognition" as const };
  const unsupported = { stt: false, tts: false, sttApi: null };
  it("unsupported browser starts in typed mode and still submits", () => {
    let s = createExplainSession(REAL_PACKAGE_ID, unsupported);
    expect(s.plan).toMatchObject({ input: "TYPED_TEXT", blocking: false });
    s = submitExplanation(editText(s, "Ravi gave back the money"));
    expect(submissionPayload(s)).toMatchObject({ corrected: "Ravi gave back the money", asrConfidence: 1, asrFailed: false });
  });
  it("ASR text is editable: raw and corrected are kept separately", () => {
    let s = receiveAsr(createExplainSession(REAL_PACKAGE_ID, supported), "ravi return the extra coin", 0.8);
    s = submitExplanation(editText(s, "Ravi returned the extra coins"));
    expect(submissionPayload(s)).toMatchObject({ raw: "ravi return the extra coin", corrected: "Ravi returned the extra coins", wasCorrected: true });
  });
  it("ASR failure is never an automatic failure: falls back to typing and can still submit", () => {
    let s = receiveAsrError(createExplainSession(REAL_PACKAGE_ID, supported));
    expect(s).toMatchObject({ typedFallback: true, phase: "EDIT" });
    s = submitExplanation(editText(s, "he returned the money"));
    expect(submissionPayload(s).asrFailed).toBe(true);
  });
  it("empty submissions and double submissions are rejected", () => {
    const s = createExplainSession(REAL_PACKAGE_ID, unsupported);
    expect(() => submitExplanation(s)).toThrow(/empty/);
    const done = submitExplanation(editText(s, "x"));
    expect(() => submitExplanation(done)).toThrow(/already/);
  });
});

describe("learner view and attempt service on a real approved package", () => {
  it("the learner view never leaks answer keys", () => {
    const view = JSON.stringify(learnerView(pkgOf()));
    expect(view).not.toMatch(/answerIndex|evidence|primary/);
  });
  it("first attempt is recorded as independent evidence; correctness is revealed only in the response", () => {
    const r = attempt();
    expect(r).toMatchObject({ ok: true, firstAttempt: true, readiness: { comprehension: "PASS", oral: "NOT_ASSESSED" } });
    const ledger = readLedger(ledgerPath(data()));
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({ firstAttempt: true, learnerId: "L1", answers: ALL_RIGHT });
  });
  it("a later attempt is a supported retry: it cannot create comprehension readiness", () => {
    attempt({ answers: [1, 1, 1, 1] });
    const retry = attempt();
    expect(retry).toMatchObject({ ok: true, firstAttempt: false, readiness: { comprehension: "NOT_FIRST_ATTEMPT_EVIDENCE" } });
    expect(readLedger(ledgerPath(data())).map((x) => x.firstAttempt)).toEqual([true, false]);
  });
  it("first attempt below the approved rule is NOT_YET and the primary item decides", () => {
    expect(attempt({ answers: [1, 0, 0, 0] })).toMatchObject({ readiness: { comprehension: "NOT_YET" }, comprehension: { reason: "PRIMARY_ITEM_INCORRECT" } });
  });
  it("explanation is scored semantically, never fails the learner, and weak answers get replay + optional retry without blocking", () => {
    const strong = attempt({ learnerId: "S" });
    expect(strong).toMatchObject({ ok: true, explanation: { credited: 1 }, feedback: { retryOptional: true, blocksProgress: false } });
    const weak = attempt({ learnerId: "W", explanation: { raw: "", corrected: "something happened at a place", asrFailed: false, asrConfidence: 1 } });
    expect(weak).toMatchObject({ ok: true, feedback: { replay: { offered: true, wpm: 145 }, blocksProgress: false } });
    expect(weak.ok && weak.feedback.replay.text).toMatch(/Ravi/);
    expect(weak.ok && weak.explanation.hints.length).toBeGreaterThan(0);
  });
  it("low-confidence ASR leaves unmatched ideas unresolved instead of marking them omitted", () => {
    const r = attempt({ explanation: { raw: "um", corrected: "um", asrFailed: true, asrConfidence: 0.2 } });
    expect(r.ok && Object.values(r.explanation.states).every((s) => s === "UNRESOLVED_ASR")).toBe(true);
  });
  it("a paraphrase that only partly matches is routed to review, not scored as an omission", () => {
    const r = attempt({ explanation: { raw: "", corrected: "Ravi gave back the extra coins", asrFailed: false, asrConfidence: 1 } });
    expect(r.ok && r.explanation.states.F3).toBe("UNRESOLVED_SEMANTIC");
    expect(r.ok && r.explanation.reviewNeeded).toBe(true);
  });
  it("a struggled passage joins the revisit list without blocking anything", () => {
    const r = attempt({ answers: [1, 1, 1, 1] });
    expect(r).toMatchObject({ ok: true, revisit: [REAL_PACKAGE_ID], feedback: { blocksProgress: false } });
  });
  it("invalid input is rejected with clear errors; unknown packages are 404", () => {
    expect(attempt({ answers: [0, 0] })).toMatchObject({ ok: false, status: 400 });
    expect(attempt({ answers: [0, 0, 0, 9] })).toMatchObject({ ok: false, status: 400 });
    expect(attempt({ explanation: { ...good, corrected: "  " } })).toMatchObject({ ok: false, status: 400 });
    expect(attempt({ learnerId: "" })).toMatchObject({ ok: false, status: 400 });
    expect(attempt({ packageId: "PKG-W1-9999" })).toMatchObject({ ok: false, status: 404 });
  });
  it("the derived fact map is version-bound to the package", () => {
    const map = factMapFromPackage(pkgOf());
    expect(map).toMatchObject({ mapId: "W1-0001", version: "1" });
    expect(map.facts.map((f) => f.factId)).toEqual(["F1", "F2", "F3", "F4"]);
  });
});
