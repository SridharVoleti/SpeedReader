import { describe, expect, it } from "vitest";
import { buildPersonalReadingModel, LedgerEntry, PROFILE_VERSION } from "../../lib/personal-reading-model";

// SR-R9-004: Personal Reading Model.
// "Maintain explainable profile: CRR, sustainable rate, span, construct strengths and
//  bottlenecks."
// "Profile derives only from valid stored evidence and rebuilds identically from ledger."
// (TC-R9-004-B: delete derived profile, rebuild from ledger -> rebuilt state equals original.)
const MIXED_LEDGER: LedgerEntry[] = [
  { kind: "CRR_ATTEMPT", challengeWpm: 240, passed: true },
  { kind: "CRR_ATTEMPT", challengeWpm: 300, passed: false }, // invalid evidence - must not count
  { kind: "SUSTAINED_ATTEMPT", measuredWpm: 200, durationBandMet: true, comprehensionPassed: true },
  { kind: "SUSTAINED_ATTEMPT", measuredWpm: 260, durationBandMet: false, comprehensionPassed: true }, // invalid
  { kind: "SPAN_ATTEMPT", challengeSpanLevel: 2, comprehensionPassed: true },
  { kind: "SPAN_ATTEMPT", challengeSpanLevel: 3, comprehensionPassed: false }, // invalid
  { kind: "RS_EVIDENCE", rsId: "RS-INFERENCE", matched: false },
  { kind: "RS_EVIDENCE", rsId: "RS-INFERENCE", matched: true }
];

describe("buildPersonalReadingModel", () => {
  it("derives CRR, sustainable rate and span only from valid (passing) evidence in the ledger", () => {
    const profile = buildPersonalReadingModel(MIXED_LEDGER);

    expect(profile.profileVersion).toBe(PROFILE_VERSION);
    expect(profile.crr.certifiedWpm).toBe(240);
    expect(profile.sustainableRate.sustainableWpm).toBe(200);
    expect(profile.span.certifiedSpanLevel).toBe(2);
  });

  it("retains every RS evidence entry for construct strength/bottleneck reporting", () => {
    const profile = buildPersonalReadingModel(MIXED_LEDGER);

    expect(profile.rsEvidence).toEqual([
      { rsId: "RS-INFERENCE", matched: false },
      { rsId: "RS-INFERENCE", matched: true }
    ]);
  });

  it("rebuilds an identical profile from the same ledger (TC-R9-004-B)", () => {
    const original = buildPersonalReadingModel(MIXED_LEDGER);
    const rebuilt = buildPersonalReadingModel(MIXED_LEDGER); // simulates deleting the derived profile and rebuilding

    expect(rebuilt).toEqual(original);
  });

  it("produces an empty, well-formed profile from an empty ledger", () => {
    const profile = buildPersonalReadingModel([]);

    expect(profile.crr.certifiedWpm).toBe(0);
    expect(profile.sustainableRate.sustainableWpm).toBe(0);
    expect(profile.span.certifiedSpanLevel).toBe(1);
    expect(profile.rsEvidence).toEqual([]);
  });
});
