# Superseded: "Decisions & Acceptance Criteria (Codex)" product layer, v1

These modules and tests implemented the earlier decisions workbook
(`hosted-app/requirements/SpeedReader_Decisions_Acceptance_Criteria_Codex.xlsx`). They are **archived, not active**:
they are excluded from the TypeScript build (`tsconfig.json`), from the unit-test run (`vitest.config.ts`) and from
the app, because they implement rules that `SpeedReader_Final_Frozen_Requirements_Codex_Acceptance_v2.0` explicitly
SUPERSEDES (v2.0 section 19 and AC-C01):

| Archived behaviour | Superseded by |
|---|---|
| Two green lights for WPM (comprehension **and** oral quality both PASS) | FR-012 / FR-039: comprehension is the only WPM gate |
| Speed levels from three valid sessions | FR-014 / FR-015: first-five 4/5, then 3 consecutive GREEN |
| Age-band passage libraries (`7-10`, `11-14`, `15-18`) | FR-001: content-difficulty Worlds; every learner starts in World 1 |
| Separate stamina-confirmation counters / tie-break configuration | FR-005 / FR-006: fixed staircase, length takes precedence |

The active replacement lives in `hosted-app/lib/v2/`. What was kept: `hosted-app/lib/world1-framework.ts` (the
approved Band A Knowledge Map semantics: 15 RS tracks x 10 P levels and the 15 knowledge strands), which v2.0
keeps normative.

Full history is in git (`git log -- hosted-app/lib/world1-engine.ts`). Do not restore any of this code without an
explicit, versioned product change (CODEX-01).
