import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { NEWS_READER_TTS, REFERENCE_QUALITIES, resolveReferenceAudio, resolveReferenceDelivery, validateReferenceAudio, type Platform, type ReferenceAudio } from "../../../lib/v2/reference-audio";

const allQualities = Object.fromEntries(REFERENCE_QUALITIES.map((q) => [q, true])) as ReferenceAudio["qaQualities"];
const good: ReferenceAudio = {
  passageId: "P001", assetId: "ref-P001-v1", url: "https://cdn.example/reference/P001-v1.mp3", version: "v1",
  sha256: "a".repeat(64), source: "PRE_GENERATED", qaQualities: allQualities, qaApproved: true
};

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? sourceFiles(p) : /\.(ts|tsx)$/.test(name) ? [p] : [];
  });
}

// FR-037 - Reference delivery [FROZEN] (AC-P30 reference audio)
describe("FR-037 News Reader reference delivery", () => {
  it("lists the seven normative newsreader qualities", () => {
    expect(REFERENCE_QUALITIES).toEqual([
      "clarity", "confidence", "precision", "meaningful-pauses", "appropriate-emphasis", "controlled-pitch-and-intonation", "no-exaggerated-drama"
    ]);
  });

  it("accepts pre-generated, QA-approved audio with every quality confirmed", () => {
    expect(validateReferenceAudio(good)).toEqual([]);
  });

  it("rejects device or runtime TTS as a pre-generated audio asset", () => {
    expect(validateReferenceAudio({ ...good, source: "DEVICE_TTS" })).toContain("reference audio must be PRE_GENERATED, got DEVICE_TTS");
    expect(validateReferenceAudio({ ...good, source: "RUNTIME_TTS" })).toContain("reference audio must be PRE_GENERATED, got RUNTIME_TTS");
  });

  it("requires every quality to be explicitly confirmed by QA, plus a hash, version and approval", () => {
    expect(validateReferenceAudio({ ...good, qaQualities: { ...allQualities, "no-exaggerated-drama": false } })).toContain("QA has not confirmed quality: no-exaggerated-drama");
    expect(validateReferenceAudio({ ...good, qaQualities: {} }).length).toBe(7);
    expect(validateReferenceAudio({ ...good, sha256: "" }).join()).toMatch(/sha256/);
    expect(validateReferenceAudio({ ...good, qaApproved: false }).join()).toMatch(/not QA approved/);
  });

  it("serves the identical canonical asset on every supported platform", () => {
    const platforms: Platform[] = ["ios", "android", "web", "desktop"];
    const resolved = platforms.map((p) => resolveReferenceAudio([good], "P001", p));
    for (const r of resolved) {
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.audio.url).toBe(good.url);
        expect(r.audio.sha256).toBe(good.sha256);
      }
    }
  });

  it("reports missing or invalid reference audio as a content error at the asset level", () => {
    expect(resolveReferenceAudio([good], "P999", "web")).toEqual({ ok: false, reason: "NO_REFERENCE_AUDIO", errors: [] });
    const bad = resolveReferenceAudio([{ ...good, source: "DEVICE_TTS" }], "P001", "ios");
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.reason).toBe("REFERENCE_AUDIO_INVALID");
  });

  // Amendment A1 (2026-10-06): until pre-generated audio exists, the News Reader reference is
  // text-to-speech at 145 WPM with a female voice. The speech API stays confined to the narrator
  // engine and ReadAloud; the pure reference-audio policy module never touches it.
  it("interim policy: no approved asset means TTS at 145 WPM, female voice, on every platform", () => {
    expect(NEWS_READER_TTS).toMatchObject({ wpm: 145, voiceGender: "female", preferredVoice: "Microsoft Neerja" });
    for (const platform of ["ios", "android", "web", "desktop"] as Platform[]) {
      expect(resolveReferenceDelivery([], "P001", platform)).toEqual({ mode: "TTS", wpm: 145, voiceGender: "female" });
    }
  });

  it("approved pre-generated audio takes precedence over TTS; a broken asset is an error, not a silent fallback", () => {
    expect(resolveReferenceDelivery([good], "P001", "web")).toEqual({ mode: "AUDIO", audio: good });
    const broken = resolveReferenceDelivery([{ ...good, qaApproved: false }], "P001", "web");
    expect(broken.mode).toBe("ERROR");
  });

  it("device speech synthesis is confined to the on-screen narrator and never feeds reference audio", () => {
    const root = resolve(__dirname, "../../..");
    const files = [...sourceFiles(join(root, "ui")), ...sourceFiles(join(root, "lib"))];
    // capabilities.ts only DETECTS whether the API exists (APP-NFR-003); it never speaks, so it cannot feed reference audio
    const allowed = new Set([join(root, "lib", "narrator.ts"), join(root, "ui", "components", "ReadAloud.tsx"), join(root, "lib", "v2", "capabilities.ts")]);
    const offenders = files.filter((f) => !allowed.has(f) && /speechSynthesis|SpeechSynthesisUtterance/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
    const referenceSource = readFileSync(join(root, "lib", "v2", "reference-audio.ts"), "utf8");
    expect(referenceSource).not.toMatch(/narrator|ReadAloud|speechSynthesis/);
  });
});
