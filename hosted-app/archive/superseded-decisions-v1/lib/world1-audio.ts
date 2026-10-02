// Product-improvement audio is deliberately separate from learner metrics/history.
// Child-voice recordings are identifiable in practice even without account metadata.
export type ImprovementAudioRecord = Readonly<{
  passageId: string;
  audioBytes: Uint8Array;
  format: string;
}>;

export type AudioGovernance = Readonly<{
  enabled: boolean;
  approved: boolean;
  explicitConsent: boolean;
  retentionPolicyId?: string;
}>;

export type AudioStore = { save: (record: ImprovementAudioRecord) => Promise<void> };

export async function retainImprovementAudio(
  input: { passageId: string; audioBytes: Uint8Array; format: string },
  governance: AudioGovernance,
  store: AudioStore
): Promise<"STORED" | "DISABLED"> {
  if (!governance.enabled || !governance.approved || !governance.explicitConsent || !governance.retentionPolicyId) return "DISABLED";
  if (!input.passageId || input.audioBytes.length === 0 || !input.format) throw new Error("invalid audio record");
  // Explicit allowlist prevents caller-supplied learner/account fields from crossing stores.
  await store.save({ passageId: input.passageId, audioBytes: input.audioBytes, format: input.format });
  return "STORED";
}

export const PRODUCT_AUDIO_DEFAULT_GOVERNANCE: AudioGovernance = Object.freeze({
  enabled: false,
  approved: false,
  explicitConsent: false
});
