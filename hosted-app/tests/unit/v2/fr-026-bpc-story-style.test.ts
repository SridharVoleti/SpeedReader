import { describe, expect, it } from "vitest";
import { BPC_STYLE_CONFIG, lintBpcStyle } from "../../../lib/v2/bpc-style";

const passageText =
  "Mia flew her red kite on a windy day. The wind pulled the string from her hand. The kite flew over the hill. Mia felt sad and sat down. Her brother Sam saw her and came to help. They climbed the hill together. They found the kite in a tree.";
const source = {
  passageText,
  questionAnswers: ["The wind pulled the kite away", "Sam helped her", "The kite was in a tree"]
};

const story =
  "Mia was flying her kite when the wind pulled it out of her hand, so the kite floated away over the hill. Mia felt sad, so she sat down. Then her brother Sam saw her and came to help. Together they climbed the hill, and they found the kite in a tree. This shows that things got better for Mia when Sam helped her.";

// FR-026 - Story-style explanation [FROZEN]
describe("FR-026 Best Possible Comprehension is story-style", () => {
  it("accepts a connected explanation: what happened -> why -> what mattered -> what we can understand", () => {
    expect(lintBpcStyle(story, source)).toEqual([]);
  });

  it("rejects sentence-by-sentence repetition of the passage", () => {
    expect(lintBpcStyle(passageText, source)).toContain("SENTENCE_BY_SENTENCE_COPY");
  });

  it("rejects a mechanical paraphrase that just restates each sentence and never connects or explains", () => {
    const mechanical =
      "Mia flew a red kite on a windy day. The wind pulled the string out of her hand. The kite flew over a hill. Mia felt sad and sat down. Sam saw her and came to help. They climbed the hill together. They found the kite in a tree.";
    const findings = lintBpcStyle(mechanical, source);
    expect(findings).toEqual(expect.arrayContaining(["SENTENCE_BY_SENTENCE_COPY", "MISSING_WHY", "MISSING_MEANING"]));
  });

  it("rejects an answer key presented as the explanation", () => {
    const answerKey = "1. The wind pulled the kite away.\n2. Sam helped her.\n3. The kite was in a tree.";
    expect(lintBpcStyle(answerKey, source)).toContain("ANSWER_KEY_FORM");
    expect(lintBpcStyle("Answer 1: The wind pulled the kite away. Answer 2: Sam helped her.", source)).toContain("ANSWER_KEY_FORM");
  });

  it("flags explanations that never explain why or what mattered", () => {
    const flat = "Mia had a kite. It was red. Sam is her brother. They like hills. Trees are tall.";
    const findings = lintBpcStyle(flat, source);
    expect(findings).toEqual(expect.arrayContaining(["NOT_CONNECTED", "MISSING_WHY", "MISSING_MEANING"]));
  });

  it("flags explanations that are too short to be a connected story", () => {
    expect(lintBpcStyle("Mia lost her kite because of the wind.", source)).toContain("TOO_SHORT");
  });

  it("is deterministic and configurable", () => {
    expect(lintBpcStyle(story, source)).toEqual(lintBpcStyle(story, source));
    expect(BPC_STYLE_CONFIG.version).toBe("bpc-style-pilot-1");
    expect(lintBpcStyle(story, source, { ...BPC_STYLE_CONFIG, minSentences: 20 })).toContain("TOO_SHORT");
  });
});
