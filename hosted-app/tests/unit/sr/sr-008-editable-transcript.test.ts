import { describe, expect, it } from "vitest";
import { startTranscript, applyAsrResult, editTranscript, submitTranscript } from "../../../lib/sr/editable-transcript";

describe("SR-008 editable speech-to-text transcript", () => {
  it("shows the ASR text in an editable draft and keeps the raw transcript", () => {
    const t = applyAsrResult(startTranscript(), "the cat sat on the mat", 0.9);
    expect(t.draft).toBe("the cat sat on the mat");
    expect(t.raw).toBe("the cat sat on the mat");
  });
  it("learner edits change the draft but never the raw transcript", () => {
    let t = applyAsrResult(startTranscript(), "the cat sat on the map", 0.9);
    t = editTranscript(t, "the cat sat on the mat");
    expect(t.raw).toBe("the cat sat on the map");
    expect(t.draft).toBe("the cat sat on the mat");
  });
  it("submission carries both raw and corrected text and records the correction", () => {
    let t = applyAsrResult(startTranscript(), "the cat sat on the map", 0.9);
    t = editTranscript(t, "the cat sat on the mat");
    const s = submitTranscript(t);
    expect(s).toMatchObject({ raw: "the cat sat on the map", corrected: "the cat sat on the mat", wasCorrected: true });
  });
  it("an unedited submission is not marked corrected", () => {
    expect(submitTranscript(applyAsrResult(startTranscript(), "hello", 0.9)).wasCorrected).toBe(false);
  });
  it("a poor or empty ASR result lets the learner type; it is never an automatic failure", () => {
    let t = applyAsrResult(startTranscript(), "", 0.1);
    expect(t.asrFailed).toBe(true);
    t = editTranscript(t, "typed answer");
    const s = submitTranscript(t);
    expect(s.corrected).toBe("typed answer");
    expect(s.automaticFailure).toBe(false);
  });
  it("cannot submit an empty answer", () => {
    expect(() => submitTranscript(startTranscript())).toThrow();
  });
});
