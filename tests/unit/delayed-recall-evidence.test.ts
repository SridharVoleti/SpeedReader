import { describe, expect, it } from "vitest";
import { classifyDelayBucket, recordRetentionEvidence } from "../../lib/retention";

// SR-R8-001: Delayed recall evidence.
// "Support delayed comprehension tied to original passage without revealing prior answers."
// "Delayed item links to source and scores separately from immediate comprehension."
describe("classifyDelayBucket", () => {
  it("classifies a short delay into the SAME_SESSION bucket", () => {
    expect(classifyDelayBucket(600)).toBe("SAME_SESSION");
  });

  it("classifies an overnight delay into the NEXT_DAY bucket", () => {
    expect(classifyDelayBucket(50000)).toBe("NEXT_DAY");
  });

  it("classifies a multi-day delay into the LONG_TERM bucket", () => {
    expect(classifyDelayBucket(300000)).toBe("LONG_TERM");
  });
});

describe("recordRetentionEvidence", () => {
  it("links the delayed item to its source passage and scores it separately from immediate comprehension", () => {
    const evidence = recordRetentionEvidence(
      "level1_001",
      50000,
      { correct: 5, total: 5 },
      { correct: 2, total: 5 }
    );

    expect(evidence.sourcePassageId).toBe("level1_001");
    expect(evidence.delayBucket).toBe("NEXT_DAY");
    expect(evidence.immediateScore).toBe(1);
    expect(evidence.retentionScore).toBe(0.4);
  });

  it("a perfect immediate score never influences the retention score computation", () => {
    const evidence = recordRetentionEvidence("level1_001", 50000, { correct: 5, total: 5 }, { correct: 0, total: 5 });
    expect(evidence.retentionScore).toBe(0);
  });

  it("reports no retention score when no delayed comprehension questions were answered", () => {
    const evidence = recordRetentionEvidence("level1_001", 50000, { correct: 5, total: 5 }, { correct: 0, total: 0 });
    expect(evidence.retentionScore).toBeNull();
  });

  it("is deterministic for identical inputs", () => {
    expect(recordRetentionEvidence("level1_001", 50000, { correct: 4, total: 5 }, { correct: 3, total: 5 })).toEqual(
      recordRetentionEvidence("level1_001", 50000, { correct: 4, total: 5 }, { correct: 3, total: 5 })
    );
  });
});
