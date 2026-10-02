// AC-C01 - No stale-rule implementation [Codex engineering gate]
// Repository scan for any active implementation of a superseded rule:
//   two-green-light WPM gating, oral-as-core-speed-gate, -1 WPM regression, ten-passage automatic decrement,
//   familiar-practice-as-progression-evidence, age-based starting WPM, direct 100->200 stamina jump.
// The scanner is pure (it takes file contents); the unit test feeds it the real source tree.

export type StaleRuleId =
  | "TWO_GREEN_LIGHT_WPM_GATE"
  | "ORAL_AS_CORE_SPEED_GATE"
  | "MINUS_ONE_WPM_REGRESSION"
  | "TEN_PASSAGE_AUTOMATIC_DECREMENT"
  | "FAMILIAR_PRACTICE_AS_PROGRESSION_EVIDENCE"
  | "AGE_BASED_STARTING_WPM"
  | "DIRECT_100_TO_200_STAMINA_JUMP";

export type StaleRulePattern = { id: StaleRuleId; description: string; pattern: RegExp };

export const STALE_RULE_PATTERNS: readonly StaleRulePattern[] = Object.freeze([
  { id: "TWO_GREEN_LIGHT_WPM_GATE", description: "WPM gated by comprehension AND oral both passing", pattern: /bothPassed|comprehension\s*(===|==)\s*["']PASS["']\s*&&\s*[\w.]*oral/i },
  { id: "ORAL_AS_CORE_SPEED_GATE", description: "oral/News Reader result used in a condition on core progression", pattern: /oralQuality\s*(===|==|!==|!=)\s*["']|newsReader\w*\s*(===|==|>=|<=|>|<)\s*[\w."]+\s*\?\s*level|if\s*\([^)]*newsReader\w*[^)]*\)\s*\{?\s*(return|block)/i },
  { id: "MINUS_ONE_WPM_REGRESSION", description: "earned WPM decremented", pattern: /STEP_DOWN|stepDown\b|\bwpm\s*-=\s*1\b|wpm\s*:\s*[\w.]*wpm\s*-\s*1\b|decrementWpm|reduceWpm|\bwpm\s*=\s*[\w.]*wpm\s*-\s*1\b/ },
  { id: "TEN_PASSAGE_AUTOMATIC_DECREMENT", description: "automatic WPM drop after ten passages", pattern: /after\s+ten\s+passages|tenPassageDecrement|passages\s*>=\s*10[^\n]{0,40}wpm\s*-/i },
  { id: "FAMILIAR_PRACTICE_AS_PROGRESSION_EVIDENCE", description: "familiar practice fed to the progression state machine", pattern: /FAMILIAR_PRACTICE[^\n]{0,80}(recordNewPassage|countedTowardEvidence:\s*true)/ },
  { id: "AGE_BASED_STARTING_WPM", description: "starting WPM derived from age", pattern: /\bage\w*[^\n]{0,40}(startWpm|startingWpm|baselineWpm)|(startWpm|startingWpm|baselineWpm)[^\n]{0,40}\bage\b/i },
  { id: "DIRECT_100_TO_200_STAMINA_JUMP", description: "direct 100 -> 200 word transition", pattern: /100\s*(->|→|to)\s*200[^\n]{0,30}(jump|transition|step)|jump[^\n]{0,30}100[^\n]{0,10}200/i }
]);

export type SourceFile = { path: string; text: string };
export type StaleFinding = { ruleId: StaleRuleId; path: string; line: number; text: string };

function isCommentOrBlank(line: string): boolean {
  const t = line.trim();
  return t === "" || t.startsWith("//") || t.startsWith("*") || t.startsWith("/*");
}

/** Files that deliberately NAME superseded rules in order to forbid or register them. */
export const SCAN_ALLOWLIST: Readonly<Record<string, string>> = Object.freeze({
  "hosted-app/lib/v2/supersession.ts": "the supersession register itself",
  "hosted-app/lib/v2/no-decrement.ts": "names the superseded decrement rules in order to forbid them",
  "hosted-app/lib/v2/gate-evidence.ts": "lists non-gate signals in order to exclude them",
  "hosted-app/lib/v2/ac53r.ts": "registers the superseded AC-53",
  "hosted-app/lib/v2/stale-rules.ts": "the scanner's own patterns"
});

export function scanForStaleRules(files: readonly SourceFile[], patterns: readonly StaleRulePattern[] = STALE_RULE_PATTERNS): StaleFinding[] {
  const findings: StaleFinding[] = [];
  for (const file of files) {
    if (file.path in SCAN_ALLOWLIST) continue;
    file.text.split("\n").forEach((line, index) => {
      if (isCommentOrBlank(line)) return;
      for (const p of patterns) if (p.pattern.test(line)) findings.push({ ruleId: p.id, path: file.path, line: index + 1, text: line.trim() });
    });
  }
  return findings;
}
