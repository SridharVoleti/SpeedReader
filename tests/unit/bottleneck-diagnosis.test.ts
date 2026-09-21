import { describe, expect, it } from "vitest";
import { diagnoseBottleneck } from "../../lib/reading-skill-diagnosis";
import { RsAttributedEvidence } from "../../lib/reading-skill-diagnosis";

// SR-R5-002: Bottleneck reason codes.
// "Diagnose bottleneck only when configured evidence minimums are satisfied."
// "Below minimum returns INSUFFICIENT_EVIDENCE; sufficient pattern returns deterministic
//  bottleneck code." (TC-R5-002-B: "Insufficient diagnosis evidence" - pattern below minimum ->
//  INSUFFICIENT_EVIDENCE; no bottleneck label.)
function evidence(rsId: string, matched: boolean): RsAttributedEvidence {
  return { rsId, evidenceTag: "tag", itemId: `${rsId}-${Math.random()}`, matched };
}

describe("diagnoseBottleneck", () => {
  it("returns INSUFFICIENT_EVIDENCE (no bottleneck label) when the evidence pattern is below the configured minimum (TC-R5-002-B)", () => {
    const items = [evidence("RS-INFERENCE", false), evidence("RS-INFERENCE", false)]; // only 2

    const diagnosis = diagnoseBottleneck(items, "RS-INFERENCE", 5, 0.5);

    expect(diagnosis.evidenceCount).toBe(2);
    expect(diagnosis.bottleneckCode).toBe("INSUFFICIENT_EVIDENCE");
  });

  it("returns a deterministic BOTTLENECK_DETECTED code once evidence is sufficient and failure rate crosses the threshold", () => {
    const items = [
      evidence("RS-INFERENCE", false),
      evidence("RS-INFERENCE", false),
      evidence("RS-INFERENCE", false),
      evidence("RS-INFERENCE", true),
      evidence("RS-INFERENCE", true)
    ]; // 5 items, 3/5 = 60% failure

    const diagnosis = diagnoseBottleneck(items, "RS-INFERENCE", 5, 0.5);

    expect(diagnosis.evidenceCount).toBe(5);
    expect(diagnosis.bottleneckCode).toBe("BOTTLENECK_DETECTED");
  });

  it("returns NO_BOTTLENECK when evidence is sufficient but the failure rate stays below threshold", () => {
    const items = [
      evidence("RS-INFERENCE", true),
      evidence("RS-INFERENCE", true),
      evidence("RS-INFERENCE", true),
      evidence("RS-INFERENCE", true),
      evidence("RS-INFERENCE", false)
    ]; // 1/5 = 20% failure

    const diagnosis = diagnoseBottleneck(items, "RS-INFERENCE", 5, 0.5);

    expect(diagnosis.bottleneckCode).toBe("NO_BOTTLENECK");
  });

  it("only counts evidence for the requested RS, ignoring evidence attributed to other RS competencies", () => {
    const items = [
      evidence("RS-INFERENCE", false),
      evidence("RS-INFERENCE", false),
      evidence("RS-VOCABULARY", false),
      evidence("RS-VOCABULARY", false),
      evidence("RS-VOCABULARY", false)
    ];

    const diagnosis = diagnoseBottleneck(items, "RS-INFERENCE", 5, 0.5);

    expect(diagnosis.evidenceCount).toBe(2); // only the 2 RS-INFERENCE items count
    expect(diagnosis.bottleneckCode).toBe("INSUFFICIENT_EVIDENCE");
  });

  it("is deterministic for identical inputs", () => {
    const items = [evidence("RS-INFERENCE", false), evidence("RS-INFERENCE", true)];
    expect(diagnoseBottleneck(items, "RS-INFERENCE", 1, 0.5)).toEqual(
      diagnoseBottleneck(items, "RS-INFERENCE", 1, 0.5)
    );
  });
});
