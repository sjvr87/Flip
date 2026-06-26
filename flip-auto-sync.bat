@echo off
REM Leave this window open: auto pull + Metro reload when agents push (current branch).
REM Start Metro once first: flip-dev.bat
cd /d "%~dp0"
if not exist "package.json" (
  echo ERROR: Run from Flip repo root.
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\flip-auto-sync.ps1" %*
if errorlevel 1 (
  echo.
  echo flip-auto-sync stopped with an error.
  pause
)
exit /b %ERRORLEVEL%
