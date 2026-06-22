@echo off
REM JS-only reload: adb prep + Metro POST /reload. App stays open, no git pull, no Metro recycle.
REM After crash or dev-server disconnect: flip-reconnect.bat
cd /d "%~dp0"
if not exist "package.json" (
  echo ERROR: package.json not found. Run from Flip repo root.
  pause
  exit /b 1
)
call npm.cmd run dev:connect:reload
exit /b %errorlevel%
