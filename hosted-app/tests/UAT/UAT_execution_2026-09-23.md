# SpeedReader UAT execution — 2026-09-23

## Scope

Reference: `SpeedReader_10_Release_Requirements_Acceptance_Tests_v1.0.xlsx` (110 cases: 80 R1–R10, 30 BabySteps launch integration). Tested the current workspace state, including pre-existing uncommitted changes. No application code was changed during this UAT run.

## Execution summary

| Area | Evidence | Result |
| --- | --- | --- |
| R1–R10 deterministic reading logic, progression, scoring, certification, evidence, adaptive speed, diagnosis, training, sustained reading, retention, chunking, personal reading model, book mode | 53 Vitest files / 313 tests; 27 Python backend tests | Automated checks passed. Four live-flow defects found by following the user path and storage calls. |
| TypeScript | `tsc --noEmit --pretty false` | Passed after restoring local package files moved by an interrupted package-manager repair. |
| Browser/UI | Attempted 71 Playwright tests against Next dev server on port 3005 | Inconclusive. Next printed `Starting...` but never served `/health`; first request and page navigation timed out. Run stopped after two infrastructure timeouts. No product assertion was reached. |
| BabySteps launch integration | Reviewed all 30 workbook cases against handlers, configuration, session, exchange and platform API code; existing Playwright cases inspected | Not fully executed. No valid BabySteps exchange fixture/configuration was available, and the Next server did not respond. Existing automated launch coverage is partial (as noted in workbook). |

## Defects filed

| Issue | UAT cases | Finding |
| --- | --- | --- |
| [#1](https://github.com/SridharVoleti/SpeedReader/issues/1) | TC-R1-013-A | Editable learner cookie selects a learner's locally stored progress. |
| [#2](https://github.com/SridharVoleti/SpeedReader/issues/2) | TC-R1-007-A/B | Playable levels bypass structured mandatory comprehension gates. |
| [#3](https://github.com/SridharVoleti/SpeedReader/issues/3) | TC-R2-002-A/B, TC-R8-003-A | Six passages recur across 36 levels, contaminating higher-world transfer evidence. |
| [#4](https://github.com/SridharVoleti/SpeedReader/issues/4) | TC-R1-014-A | The playable flow does not append a raw attempt ledger. |

## Release assessment

UAT is **not complete for sign-off**. The deterministic suites are green, but the actual learner flow has four acceptance gaps and the browser and BabySteps launch cases remain unverified. Re-run the 71 UI tests and the 30 launch cases against a responsive build with a controlled BabySteps fixture, then retest the four filed defects.

## Live deployment follow-up — speedreader.babystepsindia.com

The existing 71 Playwright UI cases were run against the deployed URL in three viewports (desktop 1280×800, mobile 390×844, and narrow browser 430×900): **210 passed, 3 failed**. All three failures are the same TC-AL-014-A check: `POST /api/babysteps-progress` returned HTTP 404 instead of 200 with `{synced:false,reason:"not_launched_from_babysteps"}`. This was filed as [#5](https://github.com/SridharVoleti/SpeedReader/issues/5). Raw Playwright results are in `live-playwright-results.json`.

Four additional targeted live probes confirmed the previously filed findings:

- [#1](https://github.com/SridharVoleti/SpeedReader/issues/1): with no signed `speedreader_session`, an editable `speedreader_learner` cookie selected learner A's stored `1/36` progress and enabled level 2.
- [#2](https://github.com/SridharVoleti/SpeedReader/issues/2): a retelling that says Ravi kept the extra money, was not honest, and never returned it nevertheless scored at least 70 and unlocked level 2.
- [#3](https://github.com/SridharVoleti/SpeedReader/issues/3): level 7 displayed the same passage title as level 1 after seeding the required preceding progress.
- [#4](https://github.com/SridharVoleti/SpeedReader/issues/4): after a completed live attempt, local storage contained the aggregate progress score but no raw answer or attempt-ledger key.

Unauthenticated BabySteps routes (`/health`, `/identity`, `/launch`, `/return`) were exercised. Valid signed launch, grant activation/renewal, central sync, and session-security cases still require a controlled BabySteps fixture and credentials; those 30 integration cases are **not fully certified** by this run. The live UI coverage is broad, but the five filed defects block release acceptance.
