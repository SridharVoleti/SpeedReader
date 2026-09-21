import { describe, expect, it } from "vitest";
import { attributeEvidenceToRs, RsTaggedItem } from "../../lib/reading-skill-diagnosis";

// SR-R5-001: RS competency integration.
// "Consume approved RS competency tags/evidence from content files."
// "Attempt evidence attributes to relevant RS without hard-coded passage IDs."
type ItemResult = { itemId: string; matched: boolean };

describe("attributeEvidenceToRs", () => {
  it("attributes each result to its authored RS competency purely from the tag data, for one content set", () => {
    const tags: RsTaggedItem[] = [
      { itemId: "level1_001-i1", rsId: "RS-VOCABULARY", evidenceTag: "keyword-recognition" },
      { itemId: "level1_001-i2", rsId: "RS-INFERENCE", evidenceTag: "cause-effect-reasoning" }
    ];
    const results: ItemResult[] = [
      { itemId: "level1_001-i1", matched: true },
      { itemId: "level1_001-i2", matched: false }
    ];

    const attributed = attributeEvidenceToRs(results, tags);

    expect(attributed).toEqual([
      { rsId: "RS-VOCABULARY", evidenceTag: "keyword-recognition", itemId: "level1_001-i1", matched: true },
      { rsId: "RS-INFERENCE", evidenceTag: "cause-effect-reasoning", itemId: "level1_001-i2", matched: false }
    ]);
  });

  it("attributes correctly for an entirely different content set/passage - never hard-coded to specific IDs", () => {
    const tags: RsTaggedItem[] = [
      { itemId: "world3_042-q7", rsId: "RS-FLUENCY", evidenceTag: "phrase-recognition-speed" }
    ];
    const results: ItemResult[] = [{ itemId: "world3_042-q7", matched: true }];

    const attributed = attributeEvidenceToRs(results, tags);

    expect(attributed).toEqual([
      { rsId: "RS-FLUENCY", evidenceTag: "phrase-recognition-speed", itemId: "world3_042-q7", matched: true }
    ]);
  });

  it("omits a result whose item has no authored RS tag, rather than guessing one", () => {
    const tags: RsTaggedItem[] = [{ itemId: "i1", rsId: "RS-VOCABULARY", evidenceTag: "keyword-recognition" }];
    const results: ItemResult[] = [
      { itemId: "i1", matched: true },
      { itemId: "untagged-item", matched: true }
    ];

    const attributed = attributeEvidenceToRs(results, tags);

    expect(attributed).toHaveLength(1);
    expect(attributed[0].itemId).toBe("i1");
  });

  it("is deterministic for identical inputs", () => {
    const tags: RsTaggedItem[] = [{ itemId: "i1", rsId: "RS-VOCABULARY", evidenceTag: "keyword-recognition" }];
    const results: ItemResult[] = [{ itemId: "i1", matched: true }];

    expect(attributeEvidenceToRs(results, tags)).toEqual(attributeEvidenceToRs(results, tags));
  });
});
