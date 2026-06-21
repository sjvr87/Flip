@echo off
cd /d "%~dp0"
if not exist "package.json" (
  echo.
  echo ERROR: package.json not found in:
  echo   %~dp0
  echo.
  echo Double-click flip-dev.bat from the Flip repo folder, or run scripts\flip-dev.cmd with its full path.
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
