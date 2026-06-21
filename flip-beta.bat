@echo off
cd /d "%~dp0"
if not exist "package.json" (
  echo.
  echo ERROR: package.json not found in:
  echo   %~dp0
  echo.
  echo Double-click flip-beta.bat from the Flip repo folder.
  echo.
  pause
  exit /b 1
)
call npm.cmd run beta:build
if errorlevel 1 (
  echo.
  echo Beta build failed. See errors above.
  pause
  exit /b 1
)
