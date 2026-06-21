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
call npm.cmd run dev:connect:restart
if errorlevel 1 (
  echo.
  echo Dev connect failed. See errors above.
  pause
  exit /b 1
)
echo.
echo Leave this window open while Metro is running.
