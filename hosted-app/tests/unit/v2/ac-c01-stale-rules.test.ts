import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { SCAN_ALLOWLIST, STALE_RULE_PATTERNS, scanForStaleRules, type StaleRuleId } from "../../../lib/v2/stale-rules";

const root = resolve(__dirname, "../../../..");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === "node_modules" || name === ".next" || name === "archive" || name === "tests" ? [] : walk(p);
    return /\.(ts|tsx)$/.test(name) ? [p] : [];
  });
}

const sourceFiles = ["hosted-app/lib", "hosted-app/ui", "container", "app"].flatMap((d) => walk(join(root, d))).map((p) => ({
  path: relative(root, p).split(sep).join("/"),
  text: readFileSync(p, "utf8")
}));

const snippet = (text: string) => scanForStaleRules([{ path: "x.ts", text }]).map((f) => f.ruleId);

// AC-C01 - No stale-rule implementation
describe("AC-C01 no stale-rule implementation", () => {
  it("scans a meaningful source set (lib, ui, container, app routes)", () => {
    expect(sourceFiles.length).toBeGreaterThan(60);
    expect(sourceFiles.some((f) => f.path.startsWith("hosted-app/lib/v2/"))).toBe(true);
    expect(sourceFiles.some((f) => f.path.startsWith("container/"))).toBe(true);
  });

  it("finds no active implementation of any superseded rule in the repository", () => {
    expect(scanForStaleRules(sourceFiles)).toEqual([]);
  });

  it("the superseded v1 product-layer modules are no longer in the active tree", () => {
    const active = sourceFiles.map((f) => f.path);
    for (const gone of ["world1-engine", "world1-session", "world1-advancement", "world1-product", "world1-storage", "world1-audio"]) {
      expect(active.some((p) => p.endsWith(`${gone}.ts`)), gone).toBe(false);
    }
  });

  it("every allowlisted file exists and states why it is allowed", () => {
    for (const [path, reason] of Object.entries(SCAN_ALLOWLIST)) {
      expect(sourceFiles.some((f) => f.path === path), path).toBe(true);
      expect(reason.length).toBeGreaterThan(10);
    }
  });

  describe("the scanner really detects each stale rule (so a clean scan means something)", () => {
    const cases: Array<[StaleRuleId, string]> = [
      ["TWO_GREEN_LIGHT_WPM_GATE", "const bothPassed = comprehension === 'PASS' && oralQuality === 'PASS';"],
      ["ORAL_AS_CORE_SPEED_GATE", "if (event.oralQuality !== 'PASS') return hold;"],
      ["MINUS_ONE_WPM_REGRESSION", "state = { ...state, wpm: state.wpm - 1 };"],
      ["MINUS_ONE_WPM_REGRESSION", "return 'STEP_DOWN';"],
      ["TEN_PASSAGE_AUTOMATIC_DECREMENT", "if (passages >= 10 && !levelUp) wpm - 1"],
      ["FAMILIAR_PRACTICE_AS_PROGRESSION_EVIDENCE", "if (a.attemptType === 'FAMILIAR_PRACTICE') recordNewPassage(state, a.result)"],
      ["AGE_BASED_STARTING_WPM", "const startWpm = age < 10 ? 60 : 90;"],
      ["DIRECT_100_TO_200_STAMINA_JUMP", "// stamina: direct 100 -> 200 jump".replace("// ", "")]
    ];
    for (const [id, code] of cases) {
      it(`detects ${id}`, () => expect(snippet(code)).toContain(id));
    }
    it("ignores comments and compliant code", () => {
      expect(snippet("// bothPassed STEP_DOWN wpm - 1")).toEqual([]);
      expect(snippet("const next = Math.min(state.wpm + 1, 150);")).toEqual([]);
      expect(snippet("const wpm = assessment.startingWpm;")).toEqual([]);
    });
    it("has one pattern per stale rule in the engineering gate", () => {
      expect(new Set(STALE_RULE_PATTERNS.map((p) => p.id)).size).toBe(7);
    });
  });
});
