import { describe, expect, it } from "vitest";
import { classifyFacts, type FactSpec } from "../../../lib/sr/semantic-recall";

const facts: FactSpec[] = [
  { factId: "F1", phrases: ["returned the extra money"], contradictions: ["kept the extra money"], inferenceOnly: false },
  { factId: "F2", phrases: ["was afraid of the shopkeeper"], contradictions: [], inferenceOnly: true },
  { factId: "F3", phrases: ["bought a pencil"], contradictions: [], inferenceOnly: false }
];
describe("SR-044 semantic recall and uncertainty", () => {
  it("equivalent paraphrase is credited", () => {
    expect(classifyFacts("he returned the extra money", facts, { asrConfidence: 0.9 }).F1).toBe("CREDITED");
  });
  it("omission is OMITTED, contradiction is CONTRADICTED", () => {
    const r = classifyFacts("he kept the extra money", facts, { asrConfidence: 0.9 });
    expect(r.F1).toBe("CONTRADICTED");
    expect(r.F3).toBe("OMITTED");
  });
  it("an unsupported inference is not credited as recall", () => {
    expect(classifyFacts("he was afraid of the shopkeeper", facts, { asrConfidence: 0.9 }).F2).toBe("UNSUPPORTED_INFERENCE");
  });
  it("low ASR confidence leaves omitted facts UNRESOLVED instead of failing the learner", () => {
    const r = classifyFacts("um something about a shop", facts, { asrConfidence: 0.3 });
    expect(r.F1).toBe("UNRESOLVED_ASR");
    expect(r.F3).toBe("UNRESOLVED_ASR");
  });
  it("low confidence never downgrades a fact that was clearly credited", () => {
    expect(classifyFacts("bought a pencil", facts, { asrConfidence: 0.3 }).F3).toBe("CREDITED");
  });
});
