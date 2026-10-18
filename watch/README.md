# Speed Reader narrated QA watch mode (first increment)

A visible, paced Playwright test runner: for **each case**, it displays a full-screen requirement title and expected outcome, speaks both **before** operating the application, then highlights the actual screen and shows PASS or FAIL. All tests record a Playwright video and trace. It does not change the learner application.

## Start on Windows

From the repository root, double-click exactly one:

- `run-watch-edge.bat` — real installed Microsoft Edge, via Playwright `msedge` channel.
- `run-watch-chrome.bat` — real installed Google Chrome, via Playwright `chrome` channel.
- `run-watch-safari.bat` — Playwright **WebKit** browser on Windows. **Not native Apple Safari.** Safari itself requires macOS; this cannot replace macOS Safari verification.

Prerequisites: Node.js, npm, installed Edge/Chrome for their launchers, and internet access for the first npm install / WebKit download. The script installs packages with `npm ci` when `node_modules` is absent. No accounts or production data are required. Port 3003 must be available.

Each launcher starts a local Next.js development server with seeded approved **test** package data. Do **not** point it at production. Launching does not use a deployed site.

Speech uses Windows System.Speech PowerShell TTS. Audio is **blocking and mandatory** for normal watch mode: if it is unavailable, the case fails before the test begins rather than silently proceeding. On macOS the same tests use `say`; on Linux install speech-dispatcher. Diagnostic-only `WATCH_NARRATE=off` disables sound; do not confuse this with the requested movie experience.

Optional: `set WATCH_PACE_MS=1000` in a Command Prompt before calling a launcher to slow down highlights.

## What gets tested now

1. **14 frozen requirement domain demonstrations** checked against explicit expected results, including worlds, passage structure, stamina, WPM rules, comprehension boundaries, and speech uncertainty. These check `/frozen-v2-demo`; they are **not** real-child journey passes.
2. **Five actual learner UI cases**: frozen five-world contract visible on the learner home page, approved passage completion, struggling learner retry, unavailable content rejection, and private numeric comprehension feedback. Tests that expose known old UI mismatches should FAIL — that's meaningful evidence, not a test-runner error.

For every requirement in the frozen document, `watch-results/<browser>/coverage.md` identifies whether this increment executed a check, and whether the result was a domain-demo-only or real-UI assertion. Remaining requirements are listed as **NOT AUTOMATED**. All acceptance criteria and independent human QA gates are **not** covered by this initial increment.

## Reports

- `watch-results/<browser>/html/index.html` — interactive test report.
- `watch-results/<browser>/results.json` — machine-readable results.
- `watch-results/<browser>/coverage.md` and `coverage.json` — honest frozen-FR coverage inventory.
- `watch-results/<browser>/artifacts/` — movies, screenshots, and trace archives.

Videos are one clip per case, not a single concatenated movie. The headed browser is the live viewing experience. **Playwright videos do not capture the spoken audio**; narration is heard from the Windows system while watching live. To archive a combined audiovisual movie, use a separate screen recorder.

## Why we expect some red tests

`requirements/SpeedReader_v2_Traceability_Report.md` documents that the live learner UI remains the older six-world, 36-level implementation, and displays numeric comprehension results. The frozen v2.0 requirements supersede that model. The watch suite deliberately detects the mismatch and does not silently weaken expectations.

## Extending this suite

Add one `[DOMAIN] FR-XXX` demo assertion or `[LIVE] FR-XXX` full UI scenario, always with a **meaningful independent expected result**. Wrap it in `watched()` to enforce spoken introduction, visible annotations, verdict, and failure evidence. Never test merely that a result element exists and call that a requirement PASS.

Do not run these tests against production. They are not an independent QA certification, native Safari verification, or a substitute for real-child comprehension and usability pilots.
