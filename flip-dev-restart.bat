@echo off
REM Full dev connect WITH Metro recycle (clear cache). Use when Metro is stuck or after native dep changes.
cd /d "%~dp0"
if not exist "package.json" (
  echo ERROR: package.json not found. Run from Flip repo root.
  pause
  exit /b 1
)
call npm.cmd run dev:connect:restart
if errorlevel 1 (
  echo.
  echo Dev connect failed. See errors above.
  pause
  exit /b 1
)
echo.
echo Done. Metro runs in its own window - you can close this one.
exit /b 0
