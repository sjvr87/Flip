@echo off
cd /d "%~dp0\.."
if not exist "package.json" (
  echo.
  echo ERROR: package.json not found in:
  echo   %~dp0\..
  echo.
  echo Run this script from the Flip repo, e.g.:
  echo   "C:\Users\tomas\Documents\Flip\scripts\flip-dev.cmd"
  echo.
  pause
  exit /b 1
)
call npm.cmd run dev:connect
if errorlevel 1 (
  echo.
  echo Dev connect failed. See errors above.
  pause
  exit /b 1
)
echo.
echo Done. Metro runs in its own window if it was started - look for "Flip Metro" on the taskbar.
exit /b 0
