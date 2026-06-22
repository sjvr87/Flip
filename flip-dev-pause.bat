@echo off
REM Same as flip-dev.bat but keeps this window open so you can read the log.
cd /d "%~dp0"
if not exist "package.json" (
  echo ERROR: package.json not found. Run from Flip repo root.
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\dev-connect.ps1"
if errorlevel 1 (
  echo.
  echo Dev connect failed. See errors above.
  pause
  exit /b 1
)
pause
exit /b 0
