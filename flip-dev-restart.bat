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
call npm.cmd run dev:connect:restart
if errorlevel 1 (
  echo.
  echo Dev connect failed. See errors above.
  pause
  exit /b 1
)
echo.
echo Done. Metro runs in a separate window titled "Flip Metro" on the taskbar.
echo       This window is the connect script only - you can close it.
exit /b 0
