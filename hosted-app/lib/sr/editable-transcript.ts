// SR-008 - The browser STT transcript is shown in an editable draft. Raw ASR text and the learner's
// corrected submission are stored separately; a failed recognition is never an automatic failure.

export type TranscriptDraft = { raw: string; draft: string; confidence: number | null; asrFailed: boolean };

export const startTranscript = (): TranscriptDraft => ({ raw: "", draft: "", confidence: null, asrFailed: false });

export function applyAsrResult(t: TranscriptDraft, text: string, confidence: number): TranscriptDraft {
  const asrFailed = text.trim() === "" || confidence < 0.3;
  return { ...t, raw: text, draft: text, confidence, asrFailed };
}

export const editTranscript = (t: TranscriptDraft, text: string): TranscriptDraft => ({ ...t, draft: text });

export function submitTranscript(t: TranscriptDraft) {
  const corrected = t.draft.trim();
  if (!corrected) throw new Error("cannot submit an empty answer");
  return { raw: t.raw, corrected, wasCorrected: corrected !== t.raw.trim(), asrFailed: t.asrFailed, automaticFailure: false as const };
}
