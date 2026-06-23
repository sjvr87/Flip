@echo off
REM Stuck Metro / native dep changes: git pull + adb reverse + recycle Metro if unhealthy.
REM When nothing works: flip-reset-dev.bat
REM Skips Metro recycle when /status is already healthy. After crash use flip-reconnect.bat instead.
cd /d "%~dp0"
if not exist "package.json" (
  echo ERROR: package.json not found. Run from Flip repo root.
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\dev-connect.ps1" -RestartMetro
if errorlevel 1 (
  echo.
  echo Dev connect failed. See errors above.
  pause
  exit /b 1
)
exit 0
