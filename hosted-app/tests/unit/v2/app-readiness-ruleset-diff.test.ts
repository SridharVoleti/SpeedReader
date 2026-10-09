import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { diffReadinessRuleset } from "../../../lib/v2/readiness-ruleset-diff";
import { READINESS_RULES, RS_KEYS } from "../../../lib/v2/p10-readiness";

const read = (p: string) => readFileSync(`hosted-app/${p}`, "utf8");

describe("readiness rule table conformance diff (the tool to run against the approved canonical v0.56 package)", () => {
  it("the supplied Blocker-4 v1.0 matrix is textually identical to what the app executes", () => {
    const d = diffReadinessRuleset(read("Content Creation/SpeedReader_World1_Blocker4_BandA_Readiness_Matrix_v1.0.csv"));
    expect(d.conforms).toBe(true);
    expect(d.different).toEqual([]);
    expect(d.missingInCandidate).toEqual([]);
  });

  it("flags a changed threshold, a missing RS and an unknown stage", () => {
    const rule = (rs: string, text: string) => `${rs},P10,"${text}"`;
    const rows = RS_KEYS.filter((rs) => rs !== "RS15").map((rs) => rule(rs, READINESS_RULES.find((r) => r.rs === rs)!.specText.replace("final_accuracy ≥97%", "final_accuracy ≥98%")));
    const d = diffReadinessRuleset(["reading_stage,p_level,p10_success_rule", ...rows, rule("RS99", "x"), rule("RS01", "ignored P1 row").replace("P10", "P1")].join("\n"));
    expect(d.conforms).toBe(false);
    expect(d.different.map((x) => x.rs)).toEqual(["RS01"]);
    expect(d.different[0].candidate).toContain("≥98%");
    expect(d.missingInCandidate).toEqual(["RS15"]);
    expect(d.unknownInCandidate).toEqual(["RS99"]);
  });

  it("rejects a table without the needed columns", () => {
    expect(() => diffReadinessRuleset("a,b\n1,2")).toThrow(/reading_stage/);
  });

  it("records how the repo's older v0.25 pipeline rule model differs from the executed v1.0 table (neither is canonical v0.56)", () => {
    const d = diffReadinessRuleset(read("pipeline/wip/SpeedReader_W1_BandA_RS_Model_v0.25.csv"));
    expect(d.candidateVersions).toEqual(["v0.25"]);
    expect(d.unknownInCandidate).toEqual([]);
    // The differing RS are listed so a reviewer sees exactly where the pre-v1.0 model said something else.
    expect(d.different.map((x) => x.rs)).toMatchInlineSnapshot(`
      [
        "RS05",
        "RS07",
        "RS12",
      ]
    `);
  });
});
