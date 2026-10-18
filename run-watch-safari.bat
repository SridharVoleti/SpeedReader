@echo off
setlocal
cd /d "%~dp0"
set "WATCH_BROWSER=safari"
if not exist node_modules (
  echo Installing project dependencies...
  call npm ci
  if errorlevel 1 goto :fail
)
echo Windows cannot launch native Safari. This uses Playwright WebKit.
echo Testing actual Safari requires running on macOS.
call npx playwright install webkit
if errorlevel 1 goto :fail
echo Starting narrated Speed Reader WebKit compatibility QA.
echo Close other Speed Reader servers on port 3003 before running.
call npx playwright test --config=watch/playwright.watch.config.ts
set "TEST_EXIT=%errorlevel%"
node watch/generate-coverage.mjs safari
if exist "watch-results\safari\scorecard.html" start "" "watch-results\safari\scorecard.html"
if exist "watch-results\safari\html\index.html" start "" "watch-results\safari\html\index.html"
echo.
echo Visual scorecard: watch-results\safari\scorecard.html
echo WebKit watch report: watch-results\safari\coverage.md
echo Video and traces: watch-results\safari\artifacts
pause
exit /b %TEST_EXIT%
:fail
echo Setup failed. Install Node.js and check npm/Playwright setup.
pause
exit /b 1
