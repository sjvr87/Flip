@echo off
REM Post-crash reconnect: git pull + adb reverse, fix stale Metro, launch LAN deep link.
REM When nothing works: flip-reset-dev.bat
REM No Metro cache clear. One Metro window max.
REM Use after app crash / "could not connect to development server" when USB is still plugged in.
REM For JS-only tweaks while app is running: flip-reload.bat
REM For stuck Metro / native dep changes: flip-dev-restart.bat
REM First connect of the day / sync branch: flip-dev.bat
cd /d "%~dp0"
if not exist "package.json" (
  echo ERROR: package.json not found. Run from Flip repo root.
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\dev-connect.ps1" -Reconnect
if errorlevel 1 (
  echo.
  echo Reconnect failed. See errors above.
  pause
  exit /b 1
)
exit 0
