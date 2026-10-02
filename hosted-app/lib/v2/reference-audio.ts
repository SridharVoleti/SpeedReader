// FR-037 - News Reader reference delivery [FROZEN]
// The reference should model professional, clear Indian-English newsreader qualities (clarity,
// confidence, precision, meaningful pauses, appropriate emphasis, controlled pitch/intonation, no
// exaggerated drama). The SAME canonical pre-generated reference audio is used on every supported
// platform; device-specific runtime TTS must never provide the normative reference performance.

export const REFERENCE_QUALITIES = [
  "clarity", "confidence", "precision", "meaningful-pauses", "appropriate-emphasis", "controlled-pitch-and-intonation", "no-exaggerated-drama"
] as const;
export type ReferenceQuality = (typeof REFERENCE_QUALITIES)[number];

export type ReferenceAudio = {
  passageId: string;
  assetId: string;
  /** One canonical, platform-independent URL. */
  url: string;
  version: string;
  sha256: string;
  source: "PRE_GENERATED" | "DEVICE_TTS" | "RUNTIME_TTS";
  /** Independent QA checklist: every normative quality must be confirmed. */
  qaQualities: Partial<Record<ReferenceQuality, boolean>>;
  qaApproved: boolean;
};

export function validateReferenceAudio(audio: ReferenceAudio): string[] {
  const errors: string[] = [];
  if (audio.source !== "PRE_GENERATED") errors.push(`reference audio must be PRE_GENERATED, got ${audio.source}`);
  if (!audio.sha256) errors.push("reference audio needs a sha256 so every platform plays identical audio");
  if (!audio.version) errors.push("reference audio needs a version");
  if (!audio.url) errors.push("reference audio needs a canonical url");
  if (!audio.qaApproved) errors.push("reference audio is not QA approved");
  for (const q of REFERENCE_QUALITIES) if (audio.qaQualities[q] !== true) errors.push(`QA has not confirmed quality: ${q}`);
  return errors;
}

export type Platform = "ios" | "android" | "web" | "desktop";

export type ReferenceResolution =
  | { ok: true; audio: ReferenceAudio }
  | { ok: false; reason: "NO_REFERENCE_AUDIO" | "REFERENCE_AUDIO_INVALID"; errors: string[] };

/** Same asset for every platform: the platform argument is deliberately ignored. */
export function resolveReferenceAudio(catalog: readonly ReferenceAudio[], passageId: string, _platform: Platform): ReferenceResolution {
  const audio = catalog.find((a) => a.passageId === passageId);
  if (!audio) return { ok: false, reason: "NO_REFERENCE_AUDIO", errors: [] };
  const errors = validateReferenceAudio(audio);
  if (errors.length) return { ok: false, reason: "REFERENCE_AUDIO_INVALID", errors };
  return { ok: true, audio };
}
