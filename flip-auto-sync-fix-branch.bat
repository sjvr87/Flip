@echo off
REM Auto-sync agent fix branch + reload phone. Leave window open while testing.
REM First time today: run flip-dev.bat once if Metro is not up.
cd /d "%~dp0"
if not exist "package.json" (
  echo ERROR: Run from Flip repo root.
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\flip-auto-sync.ps1" -Branch cursor/fix-s25-feed-tabs-regression-56a3 -CheckoutBranch
if errorlevel 1 (
  echo.
  echo flip-auto-sync-fix-branch stopped with an error.
  pause
)
exit /b %ERRORLEVEL%
