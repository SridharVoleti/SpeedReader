import { describe, expect, it } from "vitest";
import { buildCheckpointContribution, CheckpointEvidence, shouldTriggerCheckpoint } from "../../lib/book-mode";

// SR-R10-003: Section mental-model checks.
// "Test section/chapter understanding without over-testing every paragraph."
// "Checkpoint links to section-level constructs/evidence and contributes independently of
//  speed."
describe("shouldTriggerCheckpoint", () => {
  it("does not trigger a checkpoint on every paragraph - only at the configured section interval", () => {
    expect(shouldTriggerCheckpoint(1, 5)).toBe(false);
    expect(shouldTriggerCheckpoint(2, 5)).toBe(false);
    expect(shouldTriggerCheckpoint(4, 5)).toBe(false);
  });

  it("triggers a checkpoint exactly at each section-level paragraph interval", () => {
    expect(shouldTriggerCheckpoint(5, 5)).toBe(true);
    expect(shouldTriggerCheckpoint(10, 5)).toBe(true);
  });

  it("never triggers at paragraph 0 (nothing read yet)", () => {
    expect(shouldTriggerCheckpoint(0, 5)).toBe(false);
  });
});

describe("buildCheckpointContribution", () => {
  const evidence: CheckpointEvidence = {
    checkpointId: "cp-1",
    sectionId: "chapter-3",
    constructsAssessed: ["main-idea", "cause-effect"],
    correct: 4,
    total: 5
  };

  it("links the checkpoint to its section-level constructs and evidence", () => {
    const contribution = buildCheckpointContribution(evidence, 320);

    expect(contribution.checkpointId).toBe("cp-1");
    expect(contribution.sectionId).toBe("chapter-3");
    expect(contribution.comprehensionScore).toBe(0.8);
  });

  it("contributes independently of reading speed - the comprehension score is unaffected by effective WPM", () => {
    const atSlowSpeed = buildCheckpointContribution(evidence, 80);
    const atFastSpeed = buildCheckpointContribution(evidence, 900);

    expect(atSlowSpeed.comprehensionScore).toBe(atFastSpeed.comprehensionScore);
  });

  it("is deterministic for identical inputs", () => {
    expect(buildCheckpointContribution(evidence, 320)).toEqual(buildCheckpointContribution(evidence, 320));
  });
});
