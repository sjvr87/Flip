@echo off
REM Pull branch, adb + Metro, launch Flip, open logcat window for live JS/native errors.
REM Nuclear reset: flip-dev-live.bat -Reset
cd /d "%~dp0"
if not exist "package.json" (
  echo ERROR: Run from Flip repo root.
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\flip-dev-live.ps1" %*
if errorlevel 1 (
  echo.
  echo dev-live failed. See errors above.
  pause
  exit /b 1
)
exit 0
