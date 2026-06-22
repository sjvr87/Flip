@echo off
REM Lightweight: adb reverse + Metro POST /reload. No git pull, no Metro recycle, no app relaunch.
REM Use for JS-only changes when Metro and the app are already running.
cd /d "%~dp0"
if not exist "package.json" (
  echo ERROR: package.json not found. Run from Flip repo root.
  pause
  exit /b 1
)
call npm.cmd run dev:connect:reload
exit /b %errorlevel%
