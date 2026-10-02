// Deliberately STALE code snippets, used only to prove the AC-C01 scanner detects each superseded rule
// (so a clean repository scan means something). Allowlisted in stale-rules.ts for that reason; never import
// this file from production code.

export const STALE_SNIPPETS: readonly string[] = Object.freeze([
  "const bothPassed = comprehension === 'PASS' && oralQuality === 'PASS';",
  "if (event.oralQuality !== 'PASS') return hold;",
  "state = { ...state, wpm: state.wpm - 1 };",
  "if (passages >= 10 && !levelUp) wpm - 1",
  "if (a.attemptType === 'FAMILIAR_PRACTICE') recordNewPassage(state, a.result)",
  "const startWpm = age < 10 ? 60 : 90;",
  "stamina: direct 100 -> 200 jump"
]);

export const COMPLIANT_SNIPPETS = "const next = Math.min(state.wpm + 1, 150);\nconst wpm = assessment.startingWpm;";
