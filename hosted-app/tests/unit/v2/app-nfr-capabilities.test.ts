import { describe, expect, it, vi } from "vitest";
import { classifyMicError, degradationPlan, detectCapabilities, requestMicrophoneFor, SPEECH_ACTIVITIES, type Capabilities } from "../../../lib/v2/capabilities";
import { newLearnerAggregate } from "../../../lib/v2/learner-aggregate";

const full = { SpeechRecognition: function () {}, speechSynthesis: { getVoices: () => [{ name: "Neerja" }, { name: "Other" }] }, Audio: function () {} };
const nav = { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) } };

describe("APP-NFR-003 capability detection", () => {
  it("detects microphone, speech recognition, speech synthesis, voices and audio playback", () => {
    expect(detectCapabilities(full, nav)).toEqual({ microphone: true, speechRecognition: true, speechSynthesis: true, voices: 2, audioPlayback: true });
  });
  it("detects the prefixed recognition API and tolerates an empty environment", () => {
    expect(detectCapabilities({ webkitSpeechRecognition: function () {} }, undefined).speechRecognition).toBe(true);
    expect(detectCapabilities({}, undefined)).toEqual({ microphone: false, speechRecognition: false, speechSynthesis: false, voices: 0, audioPlayback: false });
  });
  it("a throwing getVoices is treated as no voices", () => {
    expect(detectCapabilities({ speechSynthesis: { getVoices: () => { throw new Error("boom"); } } }, nav)).toMatchObject({ speechSynthesis: true, voices: 0 });
  });
});

describe("APP-NFR-002 microphone permission", () => {
  it("is requested only for speech activities and never for core reading", async () => {
    const getUserMedia = vi.fn(async () => ({ getTracks: () => [{ stop() {} }] }));
    for (const a of ["CORE_READING", "STRUCTURED_QUESTIONS", "FAMILIAR_PRACTICE", "BPC"] as const) {
      expect(await requestMicrophoneFor(a, { mediaDevices: { getUserMedia } })).toEqual({ state: "NOT_REQUESTED", learnerFailure: false });
    }
    expect(getUserMedia).not.toHaveBeenCalled();
    for (const a of SPEECH_ACTIVITIES) expect(await requestMicrophoneFor(a, { mediaDevices: { getUserMedia } })).toEqual({ state: "GRANTED", learnerFailure: false });
    expect(getUserMedia).toHaveBeenCalledTimes(SPEECH_ACTIVITIES.length);
  });
  it("releases the probe stream tracks after granting", async () => {
    const stop = vi.fn();
    await requestMicrophoneFor("NEWS_READER", { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [{ stop }, { stop }] }) } });
    expect(stop).toHaveBeenCalledTimes(2);
  });
  it("denial is a capability condition with a typing fallback, never a learner failure", async () => {
    const denied = await requestMicrophoneFor("SPOKEN_COMPREHENSION", { mediaDevices: { getUserMedia: async () => { throw Object.assign(new Error("no"), { name: "NotAllowedError" }); } } });
    expect(denied).toEqual({ state: "DENIED", learnerFailure: false, fallback: "TYPE_ANSWER" });
    const none = await requestMicrophoneFor("SPOKEN_COMPREHENSION", { mediaDevices: { getUserMedia: async () => { throw Object.assign(new Error("no device"), { name: "NotFoundError" }); } } });
    expect(none).toMatchObject({ state: "UNAVAILABLE", learnerFailure: false });
    expect(await requestMicrophoneFor("NEWS_READER", undefined)).toMatchObject({ state: "UNAVAILABLE", fallback: "TYPE_ANSWER" });
  });
  it("classifies errors", () => {
    expect(classifyMicError({ name: "NotAllowedError" })).toBe("DENIED");
    expect(classifyMicError({ name: "SecurityError" })).toBe("DENIED");
    expect(classifyMicError({ name: "NotFoundError" })).toBe("UNAVAILABLE");
    expect(classifyMicError("weird")).toBe("UNAVAILABLE");
  });
});

describe("APP-NFR-004 graceful degradation", () => {
  const none: Capabilities = { microphone: false, speechRecognition: false, speechSynthesis: false, voices: 0, audioPlayback: false };
  it("full capability uses speech in and out", () => {
    expect(degradationPlan({ microphone: true, speechRecognition: true, speechSynthesis: true, voices: 3, audioPlayback: true })).toMatchObject({ spokenInput: "MICROPHONE_STT", readAloud: "SPEECH_SYNTHESIS", referenceAudio: "AUDIO_ELEMENT", notes: [] });
  });
  it("every missing optional capability degrades to a no-penalty alternative while core state is preserved", () => {
    const p = degradationPlan(none);
    expect(p).toMatchObject({ corePreserved: true, spokenInput: "TYPED", readAloud: "ON_SCREEN_TEXT", referenceAudio: "TEXT_ONLY" });
    expect(p.notes.join()).toMatch(/no penalty/);
    expect(degradationPlan({ ...none, speechSynthesis: true, voices: 1 }).referenceAudio).toBe("TTS_ONLY");
    expect(degradationPlan({ ...none, microphone: true }).spokenInput).toBe("TYPED"); // mic without recognition cannot transcribe
    expect(degradationPlan({ ...none, speechSynthesis: true, voices: 0 }).readAloud).toBe("ON_SCREEN_TEXT");
  });
  it("capability state is not part of the learner aggregate, so it can never change earned WPM", () => {
    const l = newLearnerAggregate("kid", 90);
    expect(Object.keys(l)).not.toEqual(expect.arrayContaining(["capabilities", "microphone"]));
    degradationPlan(none);
    expect(l.core.wpm).toBe(90);
  });
});
