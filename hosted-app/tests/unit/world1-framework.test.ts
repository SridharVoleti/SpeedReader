import { describe, expect, it } from "vitest";
import { bandACoordinate, KNOWLEDGE_STRANDS, RS_IDS, isKnowledgeStrand, isRsId } from "../../lib/world1-framework";

// Approved World 1 Band A Knowledge Map semantics (15 RS x 10 P, 15 knowledge strands). The v2.0 document
// keeps these normative, so this test is retained when the superseded product-layer modules are archived.
describe("World 1 Band A Knowledge Map framework (retained)", () => {
  it("preserves all 15 RS tracks and knowledge strands in each Band A round", () => {
    for (let round = 0; round < 10; round += 1) {
      const coordinates = Array.from({ length: 15 }, (_, index) => bandACoordinate(round * 15 + index + 1));
      expect(coordinates.map((coordinate) => coordinate.rsId)).toEqual(RS_IDS);
      expect(new Set(coordinates.map((coordinate) => coordinate.knowledgeStrand)).size).toBe(15);
      expect(coordinates.every((coordinate) => coordinate.pLevel === round + 1)).toBe(true);
    }
    expect(bandACoordinate(1).knowledgeStrand).toBe(KNOWLEDGE_STRANDS[0]);
    expect(bandACoordinate(16).knowledgeStrand).toBe(KNOWLEDGE_STRANDS[1]);
    expect(bandACoordinate(150).rsId).toBe("RS15");
  });

  it("rejects delivery sequences outside 1..150 and validates ids", () => {
    expect(() => bandACoordinate(0)).toThrow(RangeError);
    expect(() => bandACoordinate(151)).toThrow(RangeError);
    expect(isRsId("RS07")).toBe(true);
    expect(isRsId("RS16")).toBe(false);
    expect(isKnowledgeStrand(KNOWLEDGE_STRANDS[0])).toBe(true);
    expect(isKnowledgeStrand("nope")).toBe(false);
  });
});
