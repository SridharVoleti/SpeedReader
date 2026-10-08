import { describe, expect, it } from "vitest";
import { oralFeedbackPlan, recordMimicryRetry } from "../../../lib/sr/mimicry";

describe("SR-011 news-reader model and mimicry", () => {
  it("weak oral reading offers TTS replay and an optional retry", () => {
    const p = oralFeedbackPlan({ oralResult: "WEAK" });
    expect(p).toMatchObject({ offerReplay: true, offerRetry: true, retryOptional: true, blocksProgress: false });
  });
  it("strong oral reading does not push a retry", () => {
    expect(oralFeedbackPlan({ oralResult: "STRONG" })).toMatchObject({ offerRetry: false, blocksProgress: false });
  });
  it("replay uses the news-reader voice settings", () => {
    expect(oralFeedbackPlan({ oralResult: "WEAK" }).replayVoice).toMatchObject({ wpm: 145 });
  });
  it("a retry is recorded as supported and kept separate from the original oral evidence", () => {
    const rec = recordMimicryRetry({ originalOral: { score: 40 }, retryScore: 80 });
    expect(rec.retry).toMatchObject({ supportStatus: "AFTER_MODEL_REPLAY", score: 80 });
    expect(rec.original).toEqual({ score: 40 });
    expect(rec.retry.evidenceType).toBe("SUPPORTED");
  });
});
