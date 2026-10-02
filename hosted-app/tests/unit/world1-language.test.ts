import { describe, expect, it } from "vitest";
import { nextSequentialPassage, type CatalogPassage } from "../../lib/world1-product";

const base: CatalogPassage = {
  content_id: "w1-001", content_version: "1", schema_version: "1.0", approval_status: "APPROVED",
  passage_sequence: 1, age_band: "7-10", text: "approved prose", rs_id: "RS01",
  knowledge_strand: "Self & Character", competency_level: 1,
  theme: "responsibility", narrative_form: "story", reading_purpose: "normal",
  language_qa_approved: true, age_qa_approved: true, km_approved: true
};

describe("DEC-004 accessible language gate", () => {
  it("blocks vocabulary overload even when a generic approval flag was set", () => {
    const passage = { ...base, language_qa: { accessibleProseApproved: true, ageTopicApproved: true, vocabularyOverload: true, unnecessaryStretchDimensions: [] } };
    expect(nextSequentialPassage([passage], "7-10", 1, () => 100)).toMatchObject({ status: "CONTENT_INVALID" });
  });

  it("blocks simultaneous unnecessary stretch demands", () => {
    const passage = { ...base, language_qa: { accessibleProseApproved: true, ageTopicApproved: true, vocabularyOverload: false, unnecessaryStretchDimensions: ["vocabulary", "syntax"] } };
    expect(nextSequentialPassage([passage], "7-10", 1, () => 100)).toMatchObject({ status: "CONTENT_INVALID" });
  });

  it("requires explicit review and accepts a clear age-appropriate passage", () => {
    expect(nextSequentialPassage([base], "7-10", 1, () => 100)).toMatchObject({ status: "CONTENT_INVALID" });
    const passage = { ...base, language_qa: { accessibleProseApproved: true, ageTopicApproved: true, vocabularyOverload: false, unnecessaryStretchDimensions: [] } };
    expect(nextSequentialPassage([passage], "7-10", 1, () => 100)).toMatchObject({ status: "READY" });
  });

  it("allows a mature age-band topic with simple language and one gentle stretch", () => {
    const passage = {
      ...base, age_band: "15-18", theme: "civic responsibility",
      language_qa: { accessibleProseApproved: true, ageTopicApproved: true, vocabularyOverload: false,
        unnecessaryStretchDimensions: [], primaryStretchDimensions: ["reading stamina"] }
    };
    expect(nextSequentialPassage([passage], "15-18", 1, () => 100)).toMatchObject({ status: "READY" });
    expect(nextSequentialPassage([{ ...passage, language_qa: { ...passage.language_qa, primaryStretchDimensions: ["reading stamina", "syntax"] } }], "15-18", 1, () => 100))
      .toMatchObject({ status: "CONTENT_INVALID" });
  });
});
