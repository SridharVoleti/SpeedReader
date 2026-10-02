import { describe, expect, it } from "vitest";
import { assessYoungBeginnerSpoken } from "../../lib/world1-session";

describe("DEC-010 spoken comprehension confidence", () => {
  const confident = { transcript: "She returned it", asrUsable: true, semanticJudgement: "RELEVANT" as const };

  it("accepts one relevant idea when semantic confidence reaches the configured floor", () => {
    expect(assessYoungBeginnerSpoken({ ...confident, semanticConfidence: 0.81, minimumSemanticConfidence: 0.8 }).state).toBe("PASS");
  });

  it("holds low or missing semantic confidence for review, including an apparent unrelated response", () => {
    expect(assessYoungBeginnerSpoken({ ...confident, semanticConfidence: 0.79, minimumSemanticConfidence: 0.8 }).state).toBe("INSUFFICIENT_EVIDENCE");
    expect(assessYoungBeginnerSpoken({ ...confident, minimumSemanticConfidence: 0.8 }).state).toBe("INSUFFICIENT_EVIDENCE");
    expect(assessYoungBeginnerSpoken({ ...confident, semanticJudgement: "UNRELATED", semanticConfidence: 0.79, minimumSemanticConfidence: 0.8 }).state).toBe("INSUFFICIENT_EVIDENCE");
  });
});
