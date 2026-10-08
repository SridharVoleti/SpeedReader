// SR-011 - Weak oral reading is answered with a news-reader replay and an optional retry. Progress is
// never blocked and the supported retry stays separate from the original oral evidence.

export const NEWS_READER_REPLAY_VOICE = Object.freeze({ wpm: 145, voice: "female-news-reader" });

export function oralFeedbackPlan(r: { oralResult: "WEAK" | "STRONG" }) {
  const weak = r.oralResult === "WEAK";
  return { offerReplay: weak, offerRetry: weak, retryOptional: true as const, blocksProgress: false as const, replayVoice: NEWS_READER_REPLAY_VOICE };
}

export function recordMimicryRetry(i: { originalOral: { score: number }; retryScore: number }) {
  return {
    original: { ...i.originalOral },
    retry: { score: i.retryScore, supportStatus: "AFTER_MODEL_REPLAY" as const, evidenceType: "SUPPORTED" as const }
  };
}
