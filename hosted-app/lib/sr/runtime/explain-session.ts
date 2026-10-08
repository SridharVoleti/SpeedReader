// Learner-side "explain it in your own words" flow (issue #14). Composes the SR modules into one session:
//  SR-009 browser speech detection with typed fallback, SR-008 editable transcript (raw ASR kept separate from the
//  learner's correction; failed ASR never an automatic failure), submission as first-attempt evidence.
// Pure state functions - the React page and the tests drive the same code.

import { detectSpeechSupport, speechPlan, type SpeechSupport } from "../browser-speech";
import { applyAsrResult, editTranscript, startTranscript, submitTranscript, type TranscriptDraft } from "../editable-transcript";

export type ExplainPhase = "CAPTURE" | "EDIT" | "SUBMITTED";
export type ExplainSession = {
  packageId: string;
  plan: ReturnType<typeof speechPlan>;
  /** true once speech capture was attempted and failed/unsupported: the learner types instead. */
  typedFallback: boolean;
  transcript: TranscriptDraft;
  phase: ExplainPhase;
  submission?: ReturnType<typeof submitTranscript>;
};

export function createExplainSession(packageId: string, support: SpeechSupport): ExplainSession {
  const plan = speechPlan(support);
  return { packageId, plan, typedFallback: plan.input === "TYPED_TEXT", transcript: startTranscript(), phase: "CAPTURE" };
}

export const createExplainSessionFromWindow = (packageId: string, win: Record<string, unknown>) =>
  createExplainSession(packageId, detectSpeechSupport(win));

/** Browser recognition returned text. Low confidence / empty text flags asrFailed but keeps the draft editable. */
export function receiveAsr(s: ExplainSession, text: string, confidence: number): ExplainSession {
  if (s.phase === "SUBMITTED") throw new Error("explanation already submitted");
  const transcript = applyAsrResult(s.transcript, text, confidence);
  return { ...s, transcript, phase: "EDIT", typedFallback: s.typedFallback || transcript.asrFailed };
}

/** Recognition errored (permission denied, no speech, network...). Never a learner failure: switch to typing. */
export function receiveAsrError(s: ExplainSession): ExplainSession {
  if (s.phase === "SUBMITTED") throw new Error("explanation already submitted");
  return { ...s, transcript: { ...s.transcript, asrFailed: true }, phase: "EDIT", typedFallback: true };
}

export function editText(s: ExplainSession, text: string): ExplainSession {
  if (s.phase === "SUBMITTED") throw new Error("explanation already submitted");
  return { ...s, transcript: editTranscript(s.transcript, text), phase: "EDIT" };
}

export function submitExplanation(s: ExplainSession): ExplainSession {
  if (s.phase === "SUBMITTED") throw new Error("explanation already submitted");
  return { ...s, submission: submitTranscript(s.transcript), phase: "SUBMITTED" };
}

/** What the server needs: the corrected text, the untouched raw ASR text, and the confidence the matcher may rely on. */
export function submissionPayload(s: ExplainSession) {
  if (!s.submission) throw new Error("not submitted");
  const typedOnly = s.transcript.confidence === null;
  return {
    raw: s.submission.raw,
    corrected: s.submission.corrected,
    wasCorrected: s.submission.wasCorrected,
    asrFailed: s.submission.asrFailed,
    // typed text is exact; a learner-corrected transcript is trusted as the learner's own words
    asrConfidence: typedOnly || s.submission.wasCorrected ? 1 : (s.transcript.confidence as number)
  };
}
