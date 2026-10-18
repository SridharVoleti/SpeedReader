@echo off
setlocal
cd /d "%~dp0"
set "WATCH_BROWSER=edge"
if not exist node_modules (
  echo Installing project dependencies...
  call npm ci
  if errorlevel 1 goto :fail
)
echo Starting narrated Speed Reader real-user QA in Microsoft Edge.
echo Close other Speed Reader servers on port 3003 before running.
call npx playwright test --config=watch/playwright.watch.config.ts
set "TEST_EXIT=%errorlevel%"
node watch/generate-coverage.mjs edge
if exist "watch-results\edge\scorecard.html" start "" "watch-results\edge\scorecard.html"
if exist "watch-results\edge\html\index.html" start "" "watch-results\edge\html\index.html"
echo.
echo Visual scorecard: watch-results\edge\scorecard.html
echo Edge watch report: watch-results\edge\coverage.md
echo Video and traces: watch-results\edge\artifacts
pause
exit /b %TEST_EXIT%
:fail
echo Setup failed. Install Node.js and check npm access.
pause
exit /b 1
