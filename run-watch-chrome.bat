@echo off
setlocal
cd /d "%~dp0"
set "WATCH_BROWSER=chrome"
if not exist node_modules (
  echo Installing project dependencies...
  call npm ci
  if errorlevel 1 goto :fail
)
echo Starting narrated Speed Reader real-user QA in Google Chrome.
echo Close other Speed Reader servers on port 3003 before running.
call npx playwright test --config=watch/playwright.watch.config.ts
set "TEST_EXIT=%errorlevel%"
node watch/generate-coverage.mjs chrome
if exist "watch-results\chrome\html\index.html" start "" "watch-results\chrome\html\index.html"
echo.
echo Chrome watch report: watch-results\chrome\coverage.md
echo Video and traces: watch-results\chrome\artifacts
pause
exit /b %TEST_EXIT%
:fail
echo Setup failed. Install Node.js and check npm access.
pause
exit /b 1
