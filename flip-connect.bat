@echo off
REM Lightweight: adb reverse + launch Flip. No git pull, no Metro recycle.
REM Use when Metro is already running and you only need USB + app relaunch.
cd /d "%~dp0"
if not exist "package.json" (
  echo ERROR: package.json not found. Run from Flip repo root.
  pause
  exit /b 1
)
call npm.cmd run dev:connect:only
exit /b %errorlevel%
