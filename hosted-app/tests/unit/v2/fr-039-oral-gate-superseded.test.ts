import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CORE_WPM_GATES, FORBIDDEN_CORE_GATES, SUPERSESSION_REGISTER, assertNoOralGate, supersededRuleFor } from "../../../lib/v2/supersession";

const v2 = (file: string) => readFileSync(resolve(__dirname, "../../../lib/v2", file), "utf8");

// FR-039 - Supersession of oral-as-core-gate [FROZEN]
describe("FR-039 oral-as-core-gate is superseded", () => {
  it("records all 14 superseded historical rules from the v2.0 register", () => {
    expect(SUPERSESSION_REGISTER).toHaveLength(14);
    expect(supersededRuleFor("SUP-03")?.historical).toBe("Oral/News Reader blocks core reading progress");
    expect(supersededRuleFor("SUP-03")?.replacement).toBe("News Reader is a parallel oral communication track");
    expect(supersededRuleFor("SUP-02")?.replacement).toBe("Comprehension only");
    expect(supersededRuleFor("SUP-99")).toBeUndefined();
  });

  it("the only core WPM gate is comprehension", () => {
    expect([...CORE_WPM_GATES]).toEqual(["COMPREHENSION"]);
  });

  it("rejects any gate list that makes oral/News Reader performance a core gate", () => {
    for (const gate of FORBIDDEN_CORE_GATES) {
      expect(() => assertNoOralGate(["COMPREHENSION", gate])).toThrow(/SUPERSEDED/);
      expect(() => assertNoOralGate([gate.toLowerCase()])).toThrow(/SUPERSEDED/);
    }
    expect(() => assertNoOralGate(["COMPREHENSION"])).not.toThrow();
    expect(() => assertNoOralGate([])).not.toThrow();
  });

  it("no core progression module refers to oral or News Reader signals", () => {
    // gate-evidence.ts is deliberately excluded: it names these signals only to list what is NOT a gate.
    for (const file of ["core-wpm.ts", "first-five.ts", "learner-aggregate.ts", "passage-completion.ts", "stamina-transition.ts"]) {
      const code = v2(file).split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
      expect(code, file).not.toMatch(/oralQuality|oralFluency|pronunciation|intonation|newsReaderScore|oralGate/);
    }
  });

  it("the only core module that names News Reader does so to declare it isolated", () => {
    const code = v2("learner-aggregate.ts");
    const mentions = code.split("\n").filter((l) => /newsReader/i.test(l) && !/^\s*(\/\/|\*|\/\*)/.test(l));
    // field declaration, constructor default and the import only - never read inside the decision
    expect(mentions.length).toBeLessThanOrEqual(4);
    expect(code.slice(code.indexOf("export function applyNewPassage"))).not.toMatch(/\.newsReader/);
  });
});
