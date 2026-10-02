import { describe, expect, it } from "vitest";
import { ASR_POLICY, comprehensionFromOutcome, resolveSpokenEvidence, technicalRecoveryAction } from "../../../lib/v2/spoken-evidence";
import { structuredEvidence } from "../../../lib/v2/comprehension-score";
import type { SpokenPassageMeta } from "../../../lib/v2/spoken-expression";
import { learnerCopyFor } from "../../../lib/v2/learner-language";

const meta: SpokenPassageMeta = {
  passageId: "p",
  ideas: [{ ideaId: "i1", role: "KEY_EVENT", wordings: [["mia", "lost", "kite"]] }, { ideaId: "i2", role: "CAUSE_EFFECT", wordings: [["wind", "blew"]] }]
};
const good = { usable: true, confidence: 0.9, speechDetected: true };
const structured = structuredEvidence([{ itemId: "q1", score: 1 }, { itemId: "q2", score: 1 }]);

// FR-024 - ASR uncertainty [FROZEN] (+ CODEX-12 fail safe)
describe("FR-024 ASR uncertainty", () => {
  it("scores normally when recognition is usable and confident", () => {
    const o = resolveSpokenEvidence("Mia lost her kite because the wind blew it.", good, meta);
    expect(o.status).toBe("SCORED");
    if (o.status === "SCORED") expect(o.evaluation.score).toBeGreaterThan(0);
  });

  it("marks unusable, low-confidence, silent and confidence-less evidence as unresolved/technical - never scored", () => {
    const cases: Array<[string, Parameters<typeof resolveSpokenEvidence>[1], string]> = [
      ["x", { usable: false, confidence: null, speechDetected: true }, "ASR_UNUSABLE"],
      ["Mia lost kite", { usable: true, confidence: 0.3, speechDetected: true }, "ASR_LOW_CONFIDENCE"],
      ["", { usable: true, confidence: 0.95, speechDetected: false }, "NO_SPEECH_DETECTED"],
      ["Mia lost kite", { usable: true, confidence: null, speechDetected: true }, "ASR_CONFIDENCE_MISSING"]
    ];
    for (const [text, asr, reason] of cases) {
      const o = resolveSpokenEvidence(text, asr, meta);
      expect(o.status).toBe("UNRESOLVED_TECHNICAL");
      if (o.status !== "UNRESOLVED_TECHNICAL") throw new Error("unreachable");
      expect(o.evaluation).toBeNull();
      expect(o.retryRecommended).toBe(true);
      expect(o.audit.reason).toBe(reason);
    }
  });

  it("preserves audit data explaining why the evidence was not scored normally", () => {
    const o = resolveSpokenEvidence("Mia lost kite", { usable: true, confidence: 0.3, speechDetected: true }, meta);
    if (o.status !== "UNRESOLVED_TECHNICAL") throw new Error("unreachable");
    expect(o.audit).toEqual({
      policyVersion: ASR_POLICY.version, reason: "ASR_LOW_CONFIDENCE", confidence: 0.3, threshold: 0.6,
      explanation: "recognition confidence 0.3 is below 0.6"
    });
  });

  it("an ASR-unresolved response can never become a low comprehension score (AC-P15)", () => {
    for (const asr of [{ usable: false, confidence: null, speechDetected: false }, { usable: true, confidence: 0.1, speechDetected: true }]) {
      const result = comprehensionFromOutcome(structured, resolveSpokenEvidence("garbled", asr, meta));
      expect(result.status).toBe("AWAITING_SPOKEN_EVIDENCE");
      expect(result.score).toBeNull();
      expect(result.classification).toBeNull(); // neither GREEN nor NOT_GREEN
    }
  });

  it("offers natural retries then continues without penalty or progression evidence", () => {
    expect(technicalRecoveryAction(0)).toBe("RETRY");
    expect(technicalRecoveryAction(1)).toBe("RETRY");
    expect(technicalRecoveryAction(2)).toBe("CONTINUE_WITHOUT_PROGRESSION_EVIDENCE");
  });

  it("uses neutral learner wording for technical retries", () => {
    expect(learnerCopyFor("ASR_UNCERTAIN")).toBe("Let's try that once more.");
    expect(learnerCopyFor("TECHNICAL_RETRY")).toMatch(/one more/i);
  });

  it("is deterministic", () => {
    const a = resolveSpokenEvidence("Mia lost her kite", { usable: true, confidence: 0.2, speechDetected: true }, meta);
    const b = resolveSpokenEvidence("Mia lost her kite", { usable: true, confidence: 0.2, speechDetected: true }, meta);
    expect(a).toEqual(b);
  });
});
