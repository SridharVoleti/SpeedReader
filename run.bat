@echo off
rem Starts the Speed Reading app (Next.js dev server).
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
    echo Node.js / npm was not found. Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

if not exist node_modules (
    echo Installing dependencies...
    call npm install
)

echo Starting Speed Reading app at http://localhost:3003 ...
call npm run dev
pause
