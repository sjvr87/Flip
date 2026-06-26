@echo off
REM Leave this window open while testing: auto git pull + Metro reload when agents push.
REM Start Metro once first: flip-dev.bat  (or flip-pull-fix-branch.bat for the fix branch)
cd /d "%~dp0"
if not exist "package.json" (
  echo ERROR: Run from Flip repo root.
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\flip-auto-sync.ps1" %*
exit /b %ERRORLEVEL%
